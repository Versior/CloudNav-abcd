/**
 * cloudnav-auto-backup — CloudNav 每日自动备份
 *
 * 触发方式：Durable Object 的 alarm 自续期（每天一次）。
 * 之所以不用 Cron Trigger：Cloudflare 免费版账号上限是 5 个 cron 触发器，
 * 这个账号已经用满（health-cron / cleanup-worker / cf-server-monitor×2 / temp_email），
 * 而 DO alarm 不占用该配额，且同样能在你没打开站点时照常执行。
 *
 * 行为：
 *  - 读 KV：app_data（数据本体）、webdav_config（地址/账号）、auto_backup_config（开关、小时、保留份数、文件名）
 *  - 数据未变化时跳过（避免无意义覆盖与额外操作量）
 *  - PUT 默认文件名 cloudnav_backup.json（覆盖式：云端始终只有最新一份）
 *  - 上传后按 keep 清理旧的备份文件（默认只留最新 1 份）
 *  - 状态写入 KV auto_backup_state，可通过 /status 查看
 *
 * 手动触发：GET /run?token=<RUN_TOKEN>[&force=1]
 * 查看状态：GET /status?token=<RUN_TOKEN>
 */

const BACKUP_RE = /^(?:cloudnav|navix)_backup(?:_[0-9T_:-]+)?\.json$/;
const RESPONSE_RE = /<[dD]:response[^>]*>([\s\S]*?)<\/[dD]:response>/g;
const DEFAULT_HOUR_UTC = 20; // 20:00 UTC = 北京时间 04:00
const DO_NAME = 'daily-scheduler';

const b64 = (value) => {
  const bytes = new TextEncoder().encode(value);
  let s = '';
  bytes.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s);
};

const sha256Hex = async (text) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body, null, 2), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

const readJson = async (kv, key) => {
  const raw = await kv.get(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
};

const parseBackups = (xml) => {
  const out = [];
  let block;
  while ((block = RESPONSE_RE.exec(xml))) {
    const chunk = block[1];
    const href = chunk.match(/<[dD]:href[^>]*>([\s\S]*?)<\/[dD]:href>/);
    if (!href) continue;
    let path = href[1].trim();
    try { path = new URL(path, 'https://placeholder.invalid/').pathname; } catch { /* keep */ }
    try { path = decodeURIComponent(path); } catch { /* keep */ }
    const name = path.replace(/\/+$/, '').split('/').pop() || '';
    if (!BACKUP_RE.test(name)) continue;
    const m = chunk.match(/<[dD]:getlastmodified[^>]*>([\s\S]*?)<\/[dD]:getlastmodified>/);
    const parsed = m ? Date.parse(m[1].trim()) : NaN;
    out.push({ name, mtime: Number.isFinite(parsed) ? parsed : 0 });
  }
  return out.sort((a, b) => (b.mtime - a.mtime) || b.name.localeCompare(a.name));
};

/** 下一个 hourUtc 点（UTC），若今天已过则取明天。 */
const nextOccurrence = (hourUtc, from = Date.now()) => {
  const d = new Date(from);
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hourUtc, 0, 0, 0);
  return next > from ? next : next + 24 * 60 * 60 * 1000;
};

async function runBackup(env, { force = false, trigger = 'auto' } = {}) {
  const startedAt = new Date().toISOString();
  const result = { trigger, startedAt, ok: false };

  try {
    const config = (await readJson(env.CLOUDNAV_KV, 'auto_backup_config')) || {};

    // 数据历史裁剪与"是否开启备份"无关：它是控制 KV 占用的日常维护
    // （历史快照一份约 2.3 MB，30 份就是 ~64 MB）。historyKeep=0 可关闭。
    try {
      result.history = await trimHistory(env, Number(config.historyKeep ?? env.HISTORY_KEEP ?? 5));
    } catch (error) {
      result.historyError = String(error?.message || error);
    }
    if (config.enabled === false) return { ...result, skipped: '自动备份已关闭' };

    const webdav = (await readJson(env.CLOUDNAV_KV, 'webdav_config')) || {};
    if (!webdav.enabled || !webdav.url || !webdav.username || !webdav.password) {
      return { ...result, skipped: 'WebDAV 未配置或未启用' };
    }

    const dataRaw = await env.CLOUDNAV_KV.get('app_data');
    if (!dataRaw) return { ...result, skipped: 'KV 里没有 app_data' };

    const hash = await sha256Hex(dataRaw);
    const previous = (await readJson(env.CLOUDNAV_KV, 'auto_backup_state')) || {};


/**
 * 裁剪 KV 里的数据历史（app_history:v*）：保留最新 keep 份，
 * 同时把 app_history_index 里对应条目一并去掉，避免界面列出已删除的版本。
 * keep <= 0 表示不清理。
 */
async function trimHistory(env, keep) {
  if (!Number.isFinite(keep) || keep <= 0) return { keep, deleted: [] };
  const listed = await env.CLOUDNAV_KV.list({ prefix: 'app_history:v', limit: 1000 });
  const keys = listed.keys.map((k) => k.name).sort();
  if (keys.length <= keep) return { keep, deleted: [], remaining: keys.length };
  const doomed = keys.slice(0, keys.length - keep);
  const retainedIds = new Set(keys.slice(keys.length - keep).map((name) => name.slice('app_history:'.length)));
  const index = (await readJson(env.CLOUDNAV_KV, 'app_history_index')) || [];
  if (Array.isArray(index)) {
    const nextIndex = index.filter((entry) => entry && retainedIds.has(entry.id));
    if (nextIndex.length !== index.length) {
      await env.CLOUDNAV_KV.put('app_history_index', JSON.stringify(nextIndex));
    }
  }
  const deleted = [];
  for (const key of doomed) {
    await env.CLOUDNAV_KV.delete(key);
    deleted.push(key);
  }
  return { keep, deleted, remaining: keep };
}
    if (!force && previous.lastHash === hash) {
      await env.CLOUDNAV_KV.put('auto_backup_state', JSON.stringify({
        ...previous, lastCheckedAt: startedAt, lastResult: 'skipped-unchanged',
      }));
      return { ...result, ok: true, skipped: '数据未变化，跳过', hash };
    }

    const base = new URL(webdav.url.trim().endsWith('/') ? webdav.url.trim() : `${webdav.url.trim()}/`);
    const authHeader = `Basic ${b64(`${webdav.username}:${webdav.password}`)}`;
    const ua = 'CloudNav-AutoBackup/1.0';

    const stamp = new Date().toISOString();
    const filename = (config.filename || env.BACKUP_FILENAME || 'cloudnav_backup.json')
      .replace('{date}', stamp.slice(0, 10))
      .replace('{ts}', stamp.replace(/[:.]/g, '-'));

    if (!BACKUP_RE.test(filename)) {
      return { ...result, error: `文件名不符合备份命名规则: ${filename}` };
    }

    const upload = await fetch(new URL(filename, base).toString(), {
      method: 'PUT',
      headers: { Authorization: authHeader, 'User-Agent': ua, 'Content-Type': 'application/json' },
      body: dataRaw,
      redirect: 'manual',
    });

    result.upload = { filename, status: upload.status, bytes: dataRaw.length };
    if (!upload.ok && upload.status !== 201 && upload.status !== 204) {
      await env.CLOUDNAV_KV.put('auto_backup_state', JSON.stringify({
        ...previous, lastCheckedAt: startedAt, lastRunAt: startedAt, lastResult: `upload-failed-${upload.status}`,
      }));
      return { ...result, error: `上传失败: HTTP ${upload.status}` };
    }

    const keep = Number(config.keep ?? env.KEEP_BACKUPS ?? 1);
    const deleted = [];
    if (Number.isFinite(keep) && keep > 0) {
      const listing = await fetch(base.toString(), {
        method: 'PROPFIND',
        headers: { Authorization: authHeader, 'User-Agent': ua, Depth: '1' },
        redirect: 'manual',
      });
      if (listing.status === 207 || listing.ok) {
        const entries = parseBackups(await listing.text());
        result.remaining = entries.slice(0, keep).map((entry) => entry.name);
        for (const entry of entries.slice(keep, keep + 50)) {
          const del = await fetch(new URL(entry.name, base).toString(), {
            method: 'DELETE', headers: { Authorization: authHeader, 'User-Agent': ua }, redirect: 'manual',
          });
          if (del.ok || del.status === 204) deleted.push(entry.name);
        }
      } else {
        result.pruneError = `PROPFIND 返回 ${listing.status}`;
      }
    }
    result.deleted = deleted;

    await env.CLOUDNAV_KV.put('auto_backup_state', JSON.stringify({
      lastRunAt: startedAt,
      lastCheckedAt: startedAt,
      lastHash: hash,
      lastBytes: dataRaw.length,
      lastFilename: filename,
      lastDeleted: deleted,
      lastRemaining: result.remaining || [],
      lastResult: 'ok',
    }));

    return { ...result, ok: true };
  } catch (error) {
    return { ...result, error: String(error?.message || error) };
  }
}

/** 每天一次的调度器：alarm 执行后自动续期到下一天。 */
export class AutoBackupScheduler {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async hourUtc() {
    const config = (await readJson(this.env.CLOUDNAV_KV, 'auto_backup_config')) || {};
    const hour = Number(config.hourUtc);
    return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : DEFAULT_HOUR_UTC;
  }

  async ensureAlarm() {
    if ((await this.state.storage.getAlarm()) === null) {
      await this.state.storage.setAlarm(nextOccurrence(await this.hourUtc()));
    }
    return this.state.storage.getAlarm();
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/ensure') {
      const next = await this.ensureAlarm();
      return json({ ok: true, nextAlarm: next ? new Date(next).toISOString() : null });
    }

    if (url.pathname === '/run') {
      const result = await runBackup(this.env, {
        force: url.searchParams.get('force') === '1',
        trigger: 'manual',
      });
      await this.ensureAlarm();
      return json(result);
    }

    return json({ error: 'not found' }, 404);
  }

  async alarm() {
    const result = await runBackup(this.env, { trigger: 'do-alarm' });
    console.log('auto-backup', JSON.stringify(result));
    // 无论成功与否都续期，避免一次失败后永久停摆
    await this.state.storage.setAlarm(nextOccurrence(await this.hourUtc()));
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const expected = env.RUN_TOKEN || '';
    if (!expected || url.searchParams.get('token') !== expected) {
      return json({ error: 'Unauthorized' }, 401);
    }

    if (url.pathname === '/status') {
      const id = env.AUTO_BACKUP_SCHEDULER.idFromName(DO_NAME);
      const stub = env.AUTO_BACKUP_SCHEDULER.get(id);
      const next = await (await stub.fetch('https://do/ensure')).json().catch(() => ({}));
      return json({
        nextAlarm: next?.nextAlarm ?? null,
        config: await readJson(env.CLOUDNAV_KV, 'auto_backup_config'),
        state: await readJson(env.CLOUDNAV_KV, 'auto_backup_state'),
      });
    }

    if (url.pathname === '/run') {
      const id = env.AUTO_BACKUP_SCHEDULER.idFromName(DO_NAME);
      return env.AUTO_BACKUP_SCHEDULER.get(id).fetch(new Request(`https://do/run${url.search}`, { method: 'GET' }));
    }

    return json({ usage: 'GET /run?token=…[&force=1]   GET /status?token=…' });
  },
};