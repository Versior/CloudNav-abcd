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
}

type Operation = 'check' | 'upload' | 'download';

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
  if (!/^cloudnav_backup(?:_[0-9T_:-]+)?\.json$/.test(value)) {
    throw new Error('Invalid backup filename');
  }
  return value;
};

const readWebDavConfig = async (env: Env) => {
  const value = await env.CLOUDNAV_KV.get('webdav_config');
  const config = value ? JSON.parse(value) as WebDavConfig : {};

  if (!config.enabled || !config.url || !config.username || !config.password) {
    throw new Error('WebDAV is not configured');
  }

  return config;
};

export const onRequestOptions = async () => optionsResponse();

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;

  const authError = await requireAuth(request, env);
  if (authError) return authError;

  try {
    const contentLength = Number(request.headers.get('Content-Length') || 0);
    if (contentLength > 1024 * 1024) {
      return jsonResponse({ error: 'Request too large' }, { status: 413 });
    }

    const body = await request.json() as { operation?: Operation; payload?: unknown; filename?: string };
    const operation = body.operation;

    if (operation !== 'check' && operation !== 'upload' && operation !== 'download') {
      return jsonResponse({ error: 'Invalid operation' }, { status: 400 });
    }

    const config = await readWebDavConfig(env);
    const baseUrl = buildSafeBaseUrl(config.url || '');
    const finalFilename = safeFilename(body.filename);
    const fileUrl = new URL(finalFilename, baseUrl);
    const authHeader = `Basic ${btoa(`${config.username}:${config.password}`)}`;

    let fetchUrl = baseUrl.toString();
    let method = 'PROPFIND';
    const headers: Record<string, string> = {
      'Authorization': authHeader,
      'User-Agent': 'CloudNav/1.0',
    };
    let requestBody: string | undefined;

    if (operation === 'check') {
      headers.Depth = '0';
    } else if (operation === 'upload') {
      fetchUrl = fileUrl.toString();
      method = 'PUT';
      headers['Content-Type'] = 'application/json';
      requestBody = JSON.stringify(body.payload || {});
    } else {
      fetchUrl = fileUrl.toString();
      method = 'GET';
    }

    const response = await fetch(fetchUrl, {
      method,
      headers,
      body: requestBody,
      redirect: 'manual',
    });

    if (response.status >= 300 && response.status < 400) {
      return jsonResponse({ error: 'WebDAV redirects are not allowed' }, { status: 400 });
    }

    if (operation === 'download') {
      if (!response.ok) {
        return jsonResponse({ error: response.status === 404 ? 'Backup file not found' : `WebDAV Error: ${response.status}` }, { status: response.status });
      }

      const data = await response.json();
      return jsonResponse(data);
    }

    return jsonResponse({ success: response.ok || response.status === 207, status: response.status });
  } catch (err: any) {
    return jsonResponse({ error: err.message || 'WebDAV request failed' }, { status: 400 });
  }
};
