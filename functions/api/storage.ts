import { createExtensionToken, isAuthenticated, jsonResponse, optionsResponse, requireAuth } from '../_shared/auth';
import {
  getStorageKv,
  hashData,
  LATEST_BACKUP_KEY,
  normalizeData,
  persistData,
  pruneLatestBackups,
  readStoredDataWithPresence,
  writeLatestBackup,
  StorageEnv,
} from '../_shared/dataStore';

interface Env extends StorageEnv {
  PASSWORD: string;
  SESSION_SECRET?: string;
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
}

interface AIConfig {
  provider?: 'gemini' | 'openai';
  baseUrl?: string;
  model?: string;
}

const normalizeAiProvider = (value: unknown): 'gemini' | 'openai' => value === 'openai' ? 'openai' : 'gemini';
const sanitizeAiConfig = (config: AIConfig = {}, env: Env) => {
  const provider = normalizeAiProvider(config.provider);
  return {
    provider,
    baseUrl: typeof config.baseUrl === 'string' ? config.baseUrl.trim() : '',
    model: typeof config.model === 'string' && config.model.trim() ? config.model.trim() : 'gemini-2.5-flash',
    hasApiKey: provider === 'openai' ? !!env.OPENAI_API_KEY : !!env.GEMINI_API_KEY,
  };
};

const readJson = async <T>(kv: KVNamespace, key: string, fallback: T): Promise<T> => {
  const value = await kv.get(key);
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const mergeAiConfig = (existing: AIConfig, incoming: AIConfig) => ({
  provider: normalizeAiProvider(incoming.provider ?? existing.provider),
  baseUrl: incoming.baseUrl !== undefined ? String(incoming.baseUrl).trim() : existing.baseUrl || '',
  model: incoming.model !== undefined && String(incoming.model).trim() ? String(incoming.model).trim() : existing.model || 'gemini-2.5-flash',
});

const getFaviconDomain = (value: string | null) => {
  if (!value || !/^[a-z0-9.-]{1,253}$/i.test(value)) return null;
  return value.toLowerCase();
};

export const onRequestOptions = async (context: { request: Request }) => optionsResponse(context.request);

export const onRequestGet = async (context: { env: Env; request: Request }) => {
  const { env, request } = context;
  const url = new URL(request.url);
  const checkAuth = url.searchParams.get('checkAuth');
  const getConfig = url.searchParams.get('getConfig');

  try {
    if (checkAuth === 'true') {
      const authenticated = await isAuthenticated(request, env);
      return jsonResponse({
        hasPassword: !!env.PASSWORD,
        requiresAuth: !!env.PASSWORD,
        authenticated,
        extensionToken: authenticated ? await createExtensionToken(env) : '',
      }, {}, request);
    }

    if (getConfig === 'website' || getConfig === 'search' || getConfig === 'favicon') {
      // 配置读取属于私有数据，必须与数据读取同等鉴权，避免匿名枚举站点配置。
      const configAuthError = await requireAuth(request, env);
      if (configAuthError) return configAuthError;

      const kv = getStorageKv(env);
      if (getConfig === 'favicon') {
        const domain = getFaviconDomain(url.searchParams.get('domain'));
        if (!domain) return jsonResponse({ error: 'Domain parameter is invalid' }, { status: 400 }, request);
        const icon = await kv.get(`favicon:${domain}`);
        return jsonResponse({ icon: icon || null, cached: !!icon }, {}, request);
      }
      const key = getConfig === 'website' ? 'website_config' : 'search_config';
      const fallback = getConfig === 'website' ? { passwordExpiryDays: 7 } : {};
      return jsonResponse(await readJson(kv, key, fallback), {}, request);
    }

    const authError = await requireAuth(request, env);
    if (authError) return authError;

    const kv = getStorageKv(env);
    if (getConfig === 'ai') {
      const aiConfig = await readJson<AIConfig>(kv, 'ai_config', {});
      return jsonResponse(sanitizeAiConfig(aiConfig, env), {}, request);
    }

    const stored = await readStoredDataWithPresence(env);
    return jsonResponse({ ...stored.data, initialized: stored.exists }, {}, request);
  } catch {
    return jsonResponse({ error: 'Failed to fetch data' }, { status: 500 }, request);
  }
};

export const onRequestPost = async (context: {
  request: Request;
  env: Env;
  waitUntil?: (promise: Promise<unknown>) => void;
}) => {
  const { request, env, waitUntil } = context;

  const authError = await requireAuth(request, env);
  if (authError) return authError;

  try {
    const body = await request.json() as {
      saveConfig?: string;
      config?: Record<string, unknown>;
      domain?: string;
      icon?: string;
      links?: unknown;
      categories?: unknown;
      baseVersion?: number;
    };
    const kv = getStorageKv(env);

    if (body.saveConfig === 'favicon') {
      const domain = getFaviconDomain(body.domain || null);
      if (!domain || !body.icon || body.icon.length > 2048) {
        return jsonResponse({ error: 'Domain and icon are required' }, { status: 400 }, request);
      }
      await kv.put(`favicon:${domain}`, body.icon, { expirationTtl: 30 * 24 * 60 * 60 });
      return jsonResponse({ success: true }, {}, request);
    }

    if (body.saveConfig === 'search' || body.saveConfig === 'website') {
      const key = body.saveConfig === 'search' ? 'search_config' : 'website_config';
      await kv.put(key, JSON.stringify(body.config || {}));
      return jsonResponse({ success: true }, {}, request);
    }

    if (body.saveConfig === 'ai') {
      const existing = await readJson<AIConfig>(kv, 'ai_config', {});
      const next = mergeAiConfig(existing, body.config || {});
      await kv.put('ai_config', JSON.stringify(next));
      return jsonResponse({ success: true, config: sanitizeAiConfig(next, env) }, {}, request);
    }

    if (body.saveConfig === 'pruneBackup') {
      const result = await pruneLatestBackups(env);
      return jsonResponse({ success: result.status !== 'missing-binding', ...result }, {}, request);
    }

    if (!Array.isArray(body.links) || !Array.isArray(body.categories)) {
      return jsonResponse({ error: 'links and categories must be arrays' }, { status: 400 }, request);
    }

    const result = await persistData(env, {
      links: body.links,
      categories: body.categories,
    }, body.baseVersion);

    if (result.conflict === true) {
      return jsonResponse({ error: 'Data conflict', data: result.current }, { status: 409 }, request);
    }

    if (result.changed === false) {
      return jsonResponse({ success: true, changed: false, version: result.data.version, updatedAt: result.data.updatedAt, backup: result.backup }, {}, request);
    }

    const backupPromise = writeLatestBackup(env, result.data, result.hash);
    if (waitUntil) {
      waitUntil(backupPromise.catch(() => undefined));
      return jsonResponse({ success: true, changed: true, version: result.data.version, updatedAt: result.data.updatedAt, backup: { status: 'scheduled', key: LATEST_BACKUP_KEY } }, {}, request);
    }

    const backup = await backupPromise.catch(() => ({ status: 'failed' as const }));
    return jsonResponse({ success: true, changed: true, version: result.data.version, updatedAt: result.data.updatedAt, backup }, {}, request);
  } catch {
    return jsonResponse({ error: 'Failed to save data' }, { status: 500 }, request);
  }
};
