import { isAuthenticated, jsonResponse, optionsResponse, requireAuth } from '../_shared/auth';
import { buildStoredData, isVersionConflict, normalizeStoredData } from '../_shared/storageData';
import { normalizeHealthSchedule } from '../../services/healthSchedule';
import { appendHistory, createHistorySnapshot, getStaleHistoryKeys, normalizeHistory } from '../../services/historyService';
import { normalizeHealthNotification } from '../../services/healthNotifications';

interface Env {
  CLOUDNAV_KV: KVNamespace;
  PASSWORD: string;
  SESSION_SECRET?: string;
}

interface AIConfig {
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

interface WebDavConfig {
  url?: string;
  username?: string;
  password?: string;
  enabled?: boolean;
}

const DASHBOARD_WIDGETS = ['stats', 'folders', 'activity', 'tools'] as const;
type DashboardWidget = typeof DASHBOARD_WIDGETS[number];
// RSS 正文和阅读标注会随工作区快照一起同步；保留边界，避免正常内容因 1.5 MB 上限被反复排队。
const MAX_BODY_BYTES = 8 * 1024 * 1024;

const sanitizeDashboardConfig = (config: any = {}) => {
  const requestedOrder = Array.isArray(config.order) ? config.order : [];
  const order = DASHBOARD_WIDGETS.filter(id => requestedOrder.includes(id));
  const hidden = Array.isArray(config.hidden) ? DASHBOARD_WIDGETS.filter(id => config.hidden.includes(id)) : [];
  return {
    order: order.length > 0 ? [...order, ...DASHBOARD_WIDGETS.filter(id => !order.includes(id))] : [...DASHBOARD_WIDGETS],
    hidden: order.length > 0 ? hidden : [],
  } satisfies { order: DashboardWidget[]; hidden: DashboardWidget[] };
};

const sanitizeAiConfig = (config: AIConfig = {}, env?: Env) => ({
  provider: config.provider || 'gemini',
  apiKey: '',
  baseUrl: config.baseUrl || '',
  model: config.model || 'gemini-2.5-flash',
  hasApiKey: !!config.apiKey || !!(env as any)?.GEMINI_API_KEY,
});

const sanitizeWebDavConfig = (config: WebDavConfig = {}) => ({
  url: config.url || 'https://webdav.opendrive.com/',
  username: config.username || '',
  password: '',
  enabled: !!config.enabled,
  hasPassword: !!config.password,
});

const readJson = async <T>(kv: KVNamespace, key: string, fallback: T): Promise<T> => {
  const value = await kv.get(key);
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const cleanupHistorySnapshots = async (kv: KVNamespace, history: unknown) => {
  try {
    const listableKv = kv as KVNamespace & {
      list?: (options?: { prefix?: string; limit?: number }) => Promise<{ keys: Array<{ name: string }> }>;
    };
    if (typeof listableKv.list !== 'function') return;
    const list = await listableKv.list({ prefix: 'app_history:', limit: 1000 });
    const staleKeys = getStaleHistoryKeys(list.keys.map(item => item.name), history);
    await Promise.all(staleKeys.map(key => kv.delete(key)));
  } catch {
    // 清理失败不应阻断主数据保存；下次写入继续尝试。
  }
};

const mergeAiConfig = (existing: AIConfig, incoming: AIConfig, clearApiKey = false) => ({
  provider: incoming.provider || existing.provider || 'gemini',
  apiKey: clearApiKey ? '' : incoming.apiKey !== undefined ? incoming.apiKey : existing.apiKey || '',
  baseUrl: incoming.baseUrl !== undefined ? incoming.baseUrl : existing.baseUrl || '',
  model: incoming.model || existing.model || 'gemini-2.5-flash',
});

const mergeWebDavConfig = (existing: WebDavConfig, incoming: WebDavConfig) => ({
  url: incoming.url !== undefined ? incoming.url : existing.url || 'https://webdav.opendrive.com/',
  username: incoming.username !== undefined ? incoming.username : existing.username || '',
  password: incoming.password ? incoming.password : existing.password || '',
  enabled: incoming.enabled !== undefined ? !!incoming.enabled : !!existing.enabled,
});

export const onRequestOptions = async () => optionsResponse();

export const onRequestGet = async (context: { env: Env; request: Request }) => {
  const { env, request } = context;
  const url = new URL(request.url);
  const checkAuth = url.searchParams.get('checkAuth');
  const getConfig = url.searchParams.get('getConfig');

  try {
    if (checkAuth === 'true') {
      return jsonResponse({
        hasPassword: !!env.PASSWORD,
        requiresAuth: !!env.PASSWORD,
        authenticated: await isAuthenticated(request, env),
      });
    }

    if (getConfig === 'favicon') {
      const domain = url.searchParams.get('domain');
      if (!domain || !/^[a-z0-9.-]{1,253}$/i.test(domain)) {
        return jsonResponse({ error: 'Domain parameter is invalid' }, { status: 400 });
      }

      const cachedIcon = await env.CLOUDNAV_KV.get(`favicon:${domain.toLowerCase()}`);
      return jsonResponse({ icon: cachedIcon || null, cached: !!cachedIcon });
    }

    if (getConfig === 'website') {
      const websiteConfig = await env.CLOUDNAV_KV.get('website_config');
      return jsonResponse(websiteConfig ? JSON.parse(websiteConfig) : { passwordExpiryDays: 7 });
    }

    if (getConfig === 'search') {
      const searchConfig = await env.CLOUDNAV_KV.get('search_config');
      return jsonResponse(searchConfig ? JSON.parse(searchConfig) : {});
    }

    const authError = await requireAuth(request, env);
    if (authError) return authError;

    if (getConfig === 'ai') {
      const aiConfig = await readJson<AIConfig>(env.CLOUDNAV_KV, 'ai_config', {});
      return jsonResponse(sanitizeAiConfig(aiConfig, env));
    }

    if (getConfig === 'webdav') {
      const webDavConfig = await readJson<WebDavConfig>(env.CLOUDNAV_KV, 'webdav_config', {});
      return jsonResponse(sanitizeWebDavConfig(webDavConfig));
    }

    if (getConfig === 'dashboard') {
      const dashboardConfig = await readJson(env.CLOUDNAV_KV, 'dashboard_config', {});
      return jsonResponse(sanitizeDashboardConfig(dashboardConfig));
    }

    if (getConfig === 'healthSchedule') {
      const config = await readJson(env.CLOUDNAV_KV, 'health_schedule_config', {});
      return jsonResponse(normalizeHealthSchedule(config));
    }

    if (getConfig === 'healthRuns') {
      const runs = await readJson(env.CLOUDNAV_KV, 'health_run_history', [] as unknown[]);
      return jsonResponse(Array.isArray(runs) ? runs.slice(0, 30) : []);
    }

    if (getConfig === 'healthNotification') {
      const config = await readJson(env.CLOUDNAV_KV, 'health_notification_config', {});
      return jsonResponse(normalizeHealthNotification(config));
    }

    if (getConfig === 'history') {
      const history = await readJson(env.CLOUDNAV_KV, 'app_history_index', [] as unknown[]);
      return jsonResponse(normalizeHistory(history));
    }

    if (getConfig === 'historySnapshot') {
      const id = url.searchParams.get('id');
      if (!id || !/^v\d+-\d+$/.test(id)) return jsonResponse({ error: 'Invalid snapshot id' }, { status: 400 });
      const snapshot = await env.CLOUDNAV_KV.get(`app_history:${id}`);
      return snapshot ? jsonResponse(normalizeStoredData(JSON.parse(snapshot))) : jsonResponse({ error: 'Snapshot not found' }, { status: 404 });
    }

    if (getConfig === 'prev') {
      const history = normalizeHistory(await readJson(env.CLOUDNAV_KV, 'app_history_index', [] as unknown[]));
      const latest = history[0];
      if (!latest) return jsonResponse({ error: 'No previous version' }, { status: 404 });
      const snapshot = await env.CLOUDNAV_KV.get(`app_history:${latest.id}`);
      return snapshot ? jsonResponse(normalizeStoredData(JSON.parse(snapshot))) : jsonResponse({ error: 'Snapshot not found' }, { status: 404 });
    }

    const data = await env.CLOUDNAV_KV.get('app_data');
    return jsonResponse(normalizeStoredData(data ? JSON.parse(data) : null));
  } catch {
    return jsonResponse({ error: 'Failed to fetch data' }, { status: 500 });
  }
};

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;

  try {
      const contentLength = Number(request.headers.get('content-length') || 0);
      if (contentLength > MAX_BODY_BYTES) return jsonResponse({ error: 'Request payload is too large' }, { status: 413 });
      const rawBody = await request.text();
      if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) return jsonResponse({ error: 'Request payload is too large' }, { status: 413 });
      const body = JSON.parse(rawBody) as any;

    if (body.saveConfig === 'favicon') {
      const authError = await requireAuth(request, env);
      if (authError) return authError;

      const { domain, icon } = body;
      if (!domain || !icon || icon.length > 4096 || !/^[a-z0-9.-]{1,253}$/i.test(domain)) {
        return jsonResponse({ error: 'Domain and icon are required' }, { status: 400 });
      }

      await env.CLOUDNAV_KV.put(`favicon:${domain.toLowerCase()}`, icon, { expirationTtl: 30 * 24 * 60 * 60 });
      return jsonResponse({ success: true });
    }

    const authError = await requireAuth(request, env);
    if (authError) return authError;

    if (body.saveConfig === 'search') {
      if (JSON.stringify(body.config || {}).length > 64_000) return jsonResponse({ error: 'Config is too large' }, { status: 413 });
      await env.CLOUDNAV_KV.put('search_config', JSON.stringify(body.config || {}));
      return jsonResponse({ success: true });
    }

    if (body.saveConfig === 'ai') {
      const existing = await readJson<AIConfig>(env.CLOUDNAV_KV, 'ai_config', {});
      const next = mergeAiConfig(existing, body.config || {}, body.clearApiKey === true);
      await env.CLOUDNAV_KV.put('ai_config', JSON.stringify(next));
      return jsonResponse({ success: true, config: sanitizeAiConfig(next, env) });
    }

    if (body.saveConfig === 'webdav') {
      const existing = await readJson<WebDavConfig>(env.CLOUDNAV_KV, 'webdav_config', {});
      const next = mergeWebDavConfig(existing, body.config || {});
      await env.CLOUDNAV_KV.put('webdav_config', JSON.stringify(next));
      return jsonResponse({ success: true, config: sanitizeWebDavConfig(next) });
    }

    if (body.saveConfig === 'website') {
      if (JSON.stringify(body.config || {}).length > 64_000) return jsonResponse({ error: 'Config is too large' }, { status: 413 });
      await env.CLOUDNAV_KV.put('website_config', JSON.stringify(body.config || {}));
      return jsonResponse({ success: true });
    }

    if (body.saveConfig === 'dashboard') {
      const dashboardConfig = sanitizeDashboardConfig(body.config || {});
      await env.CLOUDNAV_KV.put('dashboard_config', JSON.stringify(dashboardConfig));
      return jsonResponse({ success: true, config: dashboardConfig });
    }

    if (body.saveConfig === 'healthSchedule') {
      const config = normalizeHealthSchedule(body.config || {});
      await env.CLOUDNAV_KV.put('health_schedule_config', JSON.stringify(config));
      return jsonResponse({ success: true, config });
    }

    if (body.saveConfig === 'healthNotification') {
      const config = normalizeHealthNotification(body.config || {});
      await env.CLOUDNAV_KV.put('health_notification_config', JSON.stringify(config));
      return jsonResponse({ success: true, config });
    }

    if (body.restoreHistory) {
      const id = typeof body.restoreHistory === 'string' ? body.restoreHistory : body.id;
      if (!id || !/^v\d+-\d+$/.test(id)) return jsonResponse({ error: 'Invalid snapshot id' }, { status: 400 });
      const snapshotRaw = await env.CLOUDNAV_KV.get(`app_history:${id}`);
      if (!snapshotRaw) return jsonResponse({ error: 'Snapshot not found' }, { status: 404 });
      const currentRaw = await env.CLOUDNAV_KV.get('app_data');
      const currentData = normalizeStoredData(currentRaw ? JSON.parse(currentRaw) : null);
      const currentSnapshot = createHistorySnapshot({ ...currentData, createdAt: Date.now() });
      const history = appendHistory(await readJson(env.CLOUDNAV_KV, 'app_history_index', [] as unknown[]), currentSnapshot);
      await env.CLOUDNAV_KV.put(`app_history:${currentSnapshot.id}`, JSON.stringify(currentData));
      await env.CLOUDNAV_KV.put('app_history_index', JSON.stringify(history));
      await cleanupHistorySnapshots(env.CLOUDNAV_KV, history);
      const restored = normalizeStoredData(JSON.parse(snapshotRaw));
      const nextData = buildStoredData(restored, currentData.version + 1);
      await env.CLOUDNAV_KV.put('app_data', JSON.stringify(nextData));
      return jsonResponse({ success: true, data: nextData });
    }

    const currentRaw = await env.CLOUDNAV_KV.get('app_data');
    const currentData = normalizeStoredData(currentRaw ? JSON.parse(currentRaw) : null);
    if (isVersionConflict(body.baseVersion, currentData.version)) {
      return jsonResponse({ error: 'Conflict', data: currentData, version: currentData.version }, { status: 409 });
    }

    const historySnapshot = createHistorySnapshot({ ...currentData, createdAt: Date.now() });
    const history = appendHistory(await readJson(env.CLOUDNAV_KV, 'app_history_index', [] as unknown[]), historySnapshot);
    await env.CLOUDNAV_KV.put(`app_history:${historySnapshot.id}`, JSON.stringify(currentData));
    await env.CLOUDNAV_KV.put('app_history_index', JSON.stringify(history));
    await cleanupHistorySnapshots(env.CLOUDNAV_KV, history);
    const nextData = buildStoredData(body, currentData.version + 1);
    await env.CLOUDNAV_KV.put('app_data', JSON.stringify(nextData));
    return jsonResponse({ success: true, version: nextData.version });
  } catch {
    return jsonResponse({ error: 'Failed to save data' }, { status: 500 });
  }
};
