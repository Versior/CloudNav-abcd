import { jsonResponse, optionsResponse, requireAuth } from '../_shared/auth';

interface Env {
  CLOUDNAV_KV: KVNamespace;
  PASSWORD: string;
  SESSION_SECRET?: string;
}

interface WebDavConfig {
  url?: string;
  username?: string;
  password?: string;
  enabled?: boolean;
  /** 云端保留的备份份数：默认 1（只留最新一份），0 = 不清理。 */
  retention?: number;
}

type Operation = 'check' | 'upload' | 'download' | 'list';

/** Backup file names produced by this app: cloudnav_backup_*.json / navix_backup.json. */
const BACKUP_FILENAME_RE = /^(?:cloudnav|navix)_backup(?:_[0-9T_:-]+)?\.json$/;

/**
 * 备份是把整份数据（链接/分类/workspace）放进请求体的，实测一份约 2.3 MB，
 * 原来的 1 MiB 上限会直接把上传打成 413。这里放宽到 16 MiB，
 * 并与 WebDAV 服务端的单文件上限保持一致（Cloudflare Workers 请求体上限为 100 MB）。
 */
const MAX_REQUEST_BYTES = 16 * 1024 * 1024;

const isPrivateHostname = (hostname: string) => {
  const normalized = hostname.toLowerCase();
  if (normalized === 'localhost' || normalized.endsWith('.localhost')) return true;

  const ipv4 = normalized.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;

  const parts = ipv4.slice(1).map(Number);
  if (parts.some(part => part < 0 || part > 255)) return true;

  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
};

const buildSafeBaseUrl = (url: string) => {
  const parsed = new URL(url.trim());

  if (parsed.protocol !== 'https:') {
    throw new Error('WebDAV URL must use HTTPS');
  }

  if (parsed.username || parsed.password || isPrivateHostname(parsed.hostname)) {
    throw new Error('WebDAV URL is not allowed');
  }

  if (!parsed.pathname.endsWith('/')) {
    parsed.pathname += '/';
  }

  parsed.hash = '';
  parsed.search = '';
  return parsed;
};

const safeFilename = (filename?: string) => {
  const value = filename || 'cloudnav_backup.json';
  if (!BACKUP_FILENAME_RE.test(value)) {
    throw new Error('Invalid backup filename');
  }
  return value;
};

/**
 * Cloudflare 的边缘请求失败时会给出自己的 5xx/530 状态码，直接透传会
 * 让浏览器渲染「error code: 5xx」这类无意义页面，也让人看不出真实原因。
 * 这里统一翻译成可操作的中文说明。
 */
const describeUpstreamFailure = (status: number, host: string) => {
  const base = `无法访问 WebDAV 服务器 ${host}`;

  if (status === 520 || status === 521 || status === 522 || status === 523 || status === 524) {
    return `${base}（HTTP ${status}）：Cloudflare 边缘回源失败。国内网盘（如坚果云 dav.jianguoyun.com）会拒绝 Cloudflare 出口 IP，属于服务商限制，改请求头无法解决；请改用 Cloudflare 可达的 WebDAV，或为该网盘配置一台国内中转。`;
  }

  if (status === 525 || status === 526) {
    return `${base}（HTTP ${status}）：TLS 握手失败，请检查 WebDAV 域名与证书是否有效。`;
  }

  if (status === 530 || status === 1016) {
    return `${base}（HTTP ${status}）：Cloudflare 无法解析该域名的源站，请检查 WebDAV 地址是否拼写正确。`;
  }

  if (status === 1010) {
    return `${base}（HTTP ${status}）：对方防火墙拒绝了本次请求（通常按 User-Agent 拦截）。`;
  }

  if (status === 401 || status === 403) {
    return `${base}（HTTP ${status}）：账号或应用密码不正确，或该账号未开通 WebDAV。`;
  }

  return `${base}：HTTP ${status}`;
};

const readWebDavConfig = async (env: Env) => {
  // cacheTtl 取下限 30s：KV 读本身有边缘缓存，改配置后最长要等这么久才生效
  const value = await env.CLOUDNAV_KV.get('webdav_config', { cacheTtl: 30 });
  const config = value ? JSON.parse(value) as WebDavConfig : {};

  if (!config.enabled || !config.url || !config.username || !config.password) {
    throw new Error('WebDAV is not configured');
  }

  return config;
};

/** Basic 认证头必须是 UTF-8，直接 btoa 对非 ASCII 账号（如中文用户名）会抛错。 */
const basicAuthHeader = (username: string, password: string) => {
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return `Basic ${btoa(binary)}`;
};

const decodeXml = (value: string) =>
  value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');

/**
 * 从 PROPFIND 的 multistatus 里解析出备份文件（兼容绝对/相对 href、d:/D: 前缀、
 * 以及不返回 getlastmodified 的服务端）。按修改时间倒序。
 */
const parseBackupEntries = (xml: string) => {
  const entries: { name: string; mtime: number }[] = [];
  const seen = new Set<string>();
  const responseRe = /<[dD]:response[^>]*>([\s\S]*?)<\/[dD]:response>/g;

  let block: RegExpExecArray | null;
  while ((block = responseRe.exec(xml))) {
    const chunk = block[1];
    const hrefMatch = chunk.match(/<[dD]:href[^>]*>([\s\S]*?)<\/[dD]:href>/);
    if (!hrefMatch) continue;

    let href = decodeXml(hrefMatch[1].trim());
    if (!href) continue;
    try {
      href = new URL(href, 'https://placeholder.invalid/').pathname;
    } catch {
      // 保持原样
    }

    let decoded = href;
    try { decoded = decodeURIComponent(href); } catch { /* keep */ }
    const base = decoded.replace(/\/+$/, '').split('/').pop() || '';
    if (!BACKUP_FILENAME_RE.test(base) || seen.has(base)) continue;
    seen.add(base);

    const mtimeMatch = chunk.match(/<[dD]:getlastmodified[^>]*>([\s\S]*?)<\/[dD]:getlastmodified>/);
    const parsed = mtimeMatch ? Date.parse(decodeXml(mtimeMatch[1].trim())) : NaN;
    entries.push({ name: base, mtime: Number.isFinite(parsed) ? parsed : 0 });
  }

  // 时间戳文件名本身可比较，作为 mtime 缺失时的兜底
  return entries.sort((a, b) => (b.mtime - a.mtime) || b.name.localeCompare(a.name));
};

const extractBackupFilenames = (xml: string) => parseBackupEntries(xml).map(entry => entry.name);

const DEFAULT_DOWNLOAD_NAMES = new Set(['navix_backup.json', 'cloudnav_backup.json']);

const remoteHeaders = (authHeader: string, extra: Record<string, string> = {}) => ({
  Authorization: authHeader,
  'User-Agent': 'CloudNav/1.0',
  Accept: '*/*',
  ...extra,
});

/** PROPFIND Depth:1 列出云端备份，按时间倒序。 */
const listRemoteBackups = async (baseUrl: URL, authHeader: string) => {
  const response = await fetch(baseUrl.toString(), {
    method: 'PROPFIND',
    headers: remoteHeaders(authHeader, { Depth: '1' }),
    redirect: 'manual',
  });

  if (response.status !== 207 && !response.ok) {
    throw new Error(describeUpstreamFailure(response.status, baseUrl.hostname));
  }

  return parseBackupEntries(await response.text());
};

/**
 * 保留最新 keep 份备份，其余删除（keep<=0 表示不清理）。
 * 只删匹配备份文件名规则的文件，其它文件一律不碰。
 */
const applyRetention = async (baseUrl: URL, authHeader: string, keep: number) => {
  if (!Number.isFinite(keep) || keep <= 0) return { keep, deleted: [] as string[] };

  const entries = await listRemoteBackups(baseUrl, authHeader);
  const deleted: string[] = [];

  for (const entry of entries.slice(keep, keep + 50)) {
    const response = await fetch(new URL(entry.name, baseUrl).toString(), {
      method: 'DELETE',
      headers: remoteHeaders(authHeader),
      redirect: 'manual',
    });
    if (response.ok || response.status === 204) deleted.push(entry.name);
  }

  return { keep, deleted };
};

export const onRequestOptions = async () => optionsResponse();

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;

  const authError = await requireAuth(request, env);
  if (authError) return authError;

  try {
    const contentLength = Number(request.headers.get('Content-Length') || 0);
    if (contentLength > MAX_REQUEST_BYTES) {
      return jsonResponse({ error: 'Request too large' }, { status: 413 });
    }

    const raw = await request.text();
    if (raw.length > MAX_REQUEST_BYTES) {
      return jsonResponse({ error: 'Request too large' }, { status: 413 });
    }

    let body: { operation?: Operation; payload?: unknown; filename?: string };
    try {
      body = JSON.parse(raw) as typeof body;
    } catch {
      return jsonResponse({ error: 'Invalid request body' }, { status: 400 });
    }

    const operation = body.operation;
    if (operation !== 'check' && operation !== 'upload' && operation !== 'download' && operation !== 'list') {
      return jsonResponse({ error: 'Invalid operation' }, { status: 400 });
    }

    const config = await readWebDavConfig(env);
    const baseUrl = buildSafeBaseUrl(config.url || '');
    const finalFilename = safeFilename(body.filename);
    const fileUrl = new URL(finalFilename, baseUrl);
    const authHeader = basicAuthHeader(config.username || '', config.password || '');

    let fetchUrl = baseUrl.toString();
    let method = 'PROPFIND';
    const headers: Record<string, string> = {
      'Authorization': authHeader,
      'User-Agent': 'CloudNav/1.0',
      'Accept': '*/*',
    };
    let requestBody: string | undefined;

    if (operation === 'check') {
      headers.Depth = '0';
    } else if (operation === 'list') {
      headers.Depth = '1';
    } else if (operation === 'upload') {
      fetchUrl = fileUrl.toString();
      method = 'PUT';
      headers['Content-Type'] = 'application/json';
      requestBody = JSON.stringify(body.payload || {});
    } else {
      fetchUrl = fileUrl.toString();
      method = 'GET';
    }

    let response: Response;
    try {
      response = await fetch(fetchUrl, {
        method,
        headers,
        body: requestBody,
        redirect: 'manual',
      });
    } catch (err: any) {
      return jsonResponse({
        success: false,
        error: `无法连接 WebDAV 服务器 ${baseUrl.hostname}：${err?.message || err}`,
      }, { status: 502 });
    }

    if (response.status >= 300 && response.status < 400) {
      return jsonResponse({ error: 'WebDAV redirects are not allowed' }, { status: 400 });
    }

    // 上游/边缘故障：不要把这些状态码当成我们自己的状态码返回，
    // 否则浏览器只会显示 Cloudflare 的「error code: 5xx」页面。
    if (response.status >= 500) {
      return jsonResponse({
        success: false,
        status: response.status,
        error: describeUpstreamFailure(response.status, baseUrl.hostname),
      }, { status: 502 });
    }

    if (operation === 'download') {
      let target = response;
      let servedName = finalFilename;

      // 默认文件名不存在时，回退到云端最新的一份备份：
      // 这样「只保留最新一份」的清理策略不会让恢复功能失效。
      if (!response.ok && response.status === 404 && DEFAULT_DOWNLOAD_NAMES.has(finalFilename)) {
        const newest = (await listRemoteBackups(baseUrl, authHeader).catch(() => []))[0];
        if (newest) {
          servedName = newest.name;
          target = await fetch(new URL(newest.name, baseUrl).toString(), {
            method: 'GET',
            headers: remoteHeaders(authHeader),
            redirect: 'manual',
          });
        }
      }

      if (!target.ok) {
        return jsonResponse({
          success: false,
          status: target.status,
          error: target.status === 404
            ? 'Backup file not found'
            : describeUpstreamFailure(target.status, baseUrl.hostname),
        }, { status: target.status === 404 ? 404 : 502 });
      }

      try {
        const data = await target.json();
        if (servedName !== finalFilename) {
          return jsonResponse({ ...data, _servedFrom: servedName });
        }
        return jsonResponse(data);
      } catch {
        return jsonResponse({ error: 'Backup file is not valid JSON' }, { status: 502 });
      }
    }

    if (operation === 'list') {
      if (response.status !== 207 && !response.ok) {
        return jsonResponse({
          success: false,
          files: [],
          status: response.status,
          error: describeUpstreamFailure(response.status, baseUrl.hostname),
        });
      }

      const xml = await response.text();
      return jsonResponse({ success: true, status: response.status, files: extractBackupFilenames(xml) });
    }

    if (operation === 'upload' && !response.ok) {
      return jsonResponse({
        success: false,
        status: response.status,
        error: describeUpstreamFailure(response.status, baseUrl.hostname),
      }, { status: 502 });
    }

    if (operation === 'upload') {
      // 上传成功后按保留策略清理旧备份（默认只留最新 1 份）
      const keep = Number.isFinite(Number(config.retention)) ? Number(config.retention) : 1;
      let retention: { keep: number; deleted: string[]; error?: string };

      try {
        retention = await applyRetention(baseUrl, authHeader, keep);
      } catch (err: any) {
        retention = { keep, deleted: [], error: err?.message || String(err) };
      }

      return jsonResponse({
        success: response.ok || response.status === 207 || response.status === 201 || response.status === 204,
        status: response.status,
        retention,
      });
    }

    return jsonResponse({
      success: response.ok || response.status === 207 || response.status === 201 || response.status === 204,
      status: response.status,
    });
  } catch (err: any) {
    return jsonResponse({ error: err.message || 'WebDAV request failed' }, { status: 400 });
  }
};