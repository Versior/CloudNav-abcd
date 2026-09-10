import { normalizeStoredData } from '../functions/_shared/storageData.ts';
import { assertSafeExternalUrl, fetchWithSafeRedirects } from '../functions/_shared/urlSafety.ts';
import { getNextHealthRun, normalizeHealthSchedule, summarizeHealthRun } from '../services/healthSchedule.ts';
import { appendHistory, createHistorySnapshot } from '../services/historyService.ts';
import { getHealthNotificationEvent, normalizeHealthNotification } from '../services/healthNotifications.ts';

interface Env {
  CLOUDNAV_KV: KVNamespace;
}

const USER_AGENT = 'CloudNav Health Monitor/1.0';

const classify = (statusCode: number, originalUrl: string, finalUrl: string) => {
  if (statusCode >= 200 && statusCode < 300) {
    return { status: finalUrl !== originalUrl ? 'redirected' as const : 'ok' as const, statusCode, finalUrl };
  }
  if (statusCode >= 300 && statusCode < 400) return { status: 'redirected' as const, statusCode, finalUrl };
  if (statusCode === 404 || statusCode === 410) return { status: 'broken' as const, statusCode, finalUrl };
  return { status: 'unknown' as const, statusCode, finalUrl };
};

const probe = async (url: string) => {
  try {
    assertSafeExternalUrl(url);
    const request = (method: 'HEAD' | 'GET') => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      return fetchWithSafeRedirects(url, {
        method,
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml', ...(method === 'GET' ? { Range: 'bytes=0-1023' } : {}) },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));
    };
    let response = await request('HEAD');
    if ([0, 403, 405, 429, 501, 503].includes(response.status)) {
      response = await request('GET');
    }
    return classify(response.status, url, response.url || url);
  } catch (error) {
    return {
      status: 'unknown' as const,
      statusCode: 0,
      finalUrl: url,
      error: error instanceof Error && /abort/i.test(error.message) ? 'timeout' : 'request_failed',
    };
  }
};

const mergeHealthUpdates = (latestLinks: any[], scannedLinks: any[], now: number) => {
  const updates = new Map(scannedLinks.map(link => [link.id, link.health]));
  return latestLinks.map(link => {
    const health = updates.get(link.id);
    return health ? { ...link, health, updatedAt: now } : link;
  });
};

const runHealthScan = async (env: Env, now = Date.now()) => {
  const configRaw = await env.CLOUDNAV_KV.get('health_schedule_config');
  const config = normalizeHealthSchedule(configRaw ? JSON.parse(configRaw) : {});
  const nextRun = getNextHealthRun(config, now);
  if (!config.enabled || nextRun === null || nextRun > now) return { skipped: true, reason: 'not_due' };

  const storedRaw = await env.CLOUDNAV_KV.get('app_data');
  const stored = normalizeStoredData(storedRaw ? JSON.parse(storedRaw) : null);
  const targets = stored.links
    .filter((link: any) => !link.deletedAt && (config.scope !== 'unchecked' || !link.health?.checkedAt) && (config.scope !== 'category' || link.categoryId === config.categoryId))
    .slice(0, config.maxLinksPerRun) as any[];
  let cursor = 0;
  let completed = [...stored.links] as any[];
  const worker = async () => {
    while (cursor < targets.length) {
      const link = targets[cursor++];
      const result = await probe(link.url);
      completed = completed.map(item => item.id === link.id ? {
        ...item,
        health: { status: result.status, statusCode: result.statusCode, finalUrl: result.finalUrl, checkedAt: now },
        updatedAt: now,
      } : item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, Math.max(1, targets.length)) }, worker));

  const summary = summarizeHealthRun(completed.filter(link => targets.some(target => target.id === link.id)));
  const run = { id: crypto.randomUUID(), startedAt: now, finishedAt: Date.now(), summary, scope: config.scope, categoryId: config.categoryId };
  const historyRaw = await env.CLOUDNAV_KV.get('health_run_history');
  const history = historyRaw ? JSON.parse(historyRaw) : [];
  const previousRun = Array.isArray(history) ? history[0] : null;
  const nextHistory = [run, ...(Array.isArray(history) ? history : [])].slice(0, 30);

  // KV 没有事务。重新读取最新快照，只把本轮健康字段合并回去，避免覆盖用户在扫描期间新增、删除或编辑的链接。
  const latestRaw = await env.CLOUDNAV_KV.get('app_data');
  const latest = normalizeStoredData(latestRaw ? JSON.parse(latestRaw) : null);
  const latestLinks = mergeHealthUpdates(latest.links as any[], completed.filter(link => targets.some(target => target.id === link.id)), now);
  const appSnapshot = createHistorySnapshot({ ...latest, createdAt: now });
  const appHistory = appendHistory(await env.CLOUDNAV_KV.get('app_history_index').then(value => value ? JSON.parse(value) : []), appSnapshot);
  await env.CLOUDNAV_KV.put(`app_history:${appSnapshot.id}`, JSON.stringify(latest));
  await env.CLOUDNAV_KV.put('app_history_index', JSON.stringify(appHistory));
  await env.CLOUDNAV_KV.put('app_data', JSON.stringify({ ...latest, links: latestLinks, version: latest.version + 1 }));
  await env.CLOUDNAV_KV.put('health_run_history', JSON.stringify(nextHistory));
  await env.CLOUDNAV_KV.put('health_schedule_config', JSON.stringify({ ...config, lastRunAt: run.finishedAt }));

  const notificationRaw = await env.CLOUDNAV_KV.get('health_notification_config');
  const notification = normalizeHealthNotification(notificationRaw ? JSON.parse(notificationRaw) : {});
  const event = notification.enabled ? getHealthNotificationEvent(previousRun?.summary, summary, notification) : null;
  if (event && notification.webhookUrl) {
    try {
      assertSafeExternalUrl(notification.webhookUrl);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(notification.webhookUrl, {
          method: 'POST',
          redirect: 'manual',
          headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
          body: JSON.stringify({ source: 'cloudnav', event, summary, run }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`webhook_status_${response.status}`);
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      // Notification delivery is best-effort and must not invalidate the scan result.
    }
  }
  return run;
};

export default {
  async scheduled(controller: { scheduledTime: number }, env: Env) {
    await runHealthScan(env, controller.scheduledTime);
  },
};

export { mergeHealthUpdates, runHealthScan };
