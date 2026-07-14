import { isAuthenticated, jsonResponse, optionsResponse, requireAuth } from '../_shared/auth';

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

const sanitizeAiConfig = (config: AIConfig = {}) => ({
  provider: config.provider || 'gemini',
  apiKey: '',
  baseUrl: config.baseUrl || '',
  model: config.model || 'gemini-2.5-flash',
  hasApiKey: !!config.apiKey,
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

const mergeAiConfig = (existing: AIConfig, incoming: AIConfig) => ({
  provider: incoming.provider || existing.provider || 'gemini',
  apiKey: incoming.apiKey ? incoming.apiKey : existing.apiKey || '',
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
      return jsonResponse(sanitizeAiConfig(aiConfig));
    }

    if (getConfig === 'webdav') {
      const webDavConfig = await readJson<WebDavConfig>(env.CLOUDNAV_KV, 'webdav_config', {});
      return jsonResponse(sanitizeWebDavConfig(webDavConfig));
    }

    const data = await env.CLOUDNAV_KV.get('app_data');
    return jsonResponse(data ? JSON.parse(data) : { links: [], categories: [] });
  } catch {
    return jsonResponse({ error: 'Failed to fetch data' }, { status: 500 });
  }
};

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;

  try {
    const body = await request.json() as any;

    if (body.saveConfig === 'favicon') {
      const { domain, icon } = body;
      if (!domain || !icon || !/^[a-z0-9.-]{1,253}$/i.test(domain)) {
        return jsonResponse({ error: 'Domain and icon are required' }, { status: 400 });
      }

      await env.CLOUDNAV_KV.put(`favicon:${domain.toLowerCase()}`, icon, { expirationTtl: 30 * 24 * 60 * 60 });
      return jsonResponse({ success: true });
    }

    const authError = await requireAuth(request, env);
    if (authError) return authError;

    if (body.saveConfig === 'search') {
      await env.CLOUDNAV_KV.put('search_config', JSON.stringify(body.config || {}));
      return jsonResponse({ success: true });
    }

    if (body.saveConfig === 'ai') {
      const existing = await readJson<AIConfig>(env.CLOUDNAV_KV, 'ai_config', {});
      const next = mergeAiConfig(existing, body.config || {});
      await env.CLOUDNAV_KV.put('ai_config', JSON.stringify(next));
      return jsonResponse({ success: true, config: sanitizeAiConfig(next) });
    }

    if (body.saveConfig === 'webdav') {
      const existing = await readJson<WebDavConfig>(env.CLOUDNAV_KV, 'webdav_config', {});
      const next = mergeWebDavConfig(existing, body.config || {});
      await env.CLOUDNAV_KV.put('webdav_config', JSON.stringify(next));
      return jsonResponse({ success: true, config: sanitizeWebDavConfig(next) });
    }

    if (body.saveConfig === 'website') {
      await env.CLOUDNAV_KV.put('website_config', JSON.stringify(body.config || {}));
      return jsonResponse({ success: true });
    }

    await env.CLOUDNAV_KV.put('app_data', JSON.stringify(body));
    return jsonResponse({ success: true });
  } catch {
    return jsonResponse({ error: 'Failed to save data' }, { status: 500 });
  }
};
