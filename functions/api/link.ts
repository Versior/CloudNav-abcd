import { jsonResponse, optionsResponse, requireAuth } from '../_shared/auth';

interface Env {
  CLOUDNAV_KV: KVNamespace;
  PASSWORD: string;
  SESSION_SECRET?: string;
}

interface LinkData {
  title?: string;
  url?: string;
  description?: string;
  categoryId?: string;
}

const isPrivateHostname = (hostname: string) => {
  const normalized = hostname.toLowerCase();
  if (normalized === 'localhost' || normalized.endsWith('.localhost') || normalized.includes(':')) return true;
  const ipv4 = normalized.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;
  const [a, b] = ipv4.slice(1).map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
};

const classifyStatus = (statusCode: number, originalUrl: string, finalUrl?: string | null) => {
  if (statusCode >= 200 && statusCode < 300) {
    if (finalUrl && finalUrl !== originalUrl) {
      try {
        const a = new URL(originalUrl);
        const b = new URL(finalUrl, originalUrl);
        if (a.host.replace(/^www\./, '') !== b.host.replace(/^www\./, '') || a.pathname.replace(/\/$/, '') !== b.pathname.replace(/\/$/, '')) {
          return 'redirected' as const;
        }
      } catch {
        return 'redirected' as const;
      }
    }
    return 'ok' as const;
  }
  if (statusCode >= 300 && statusCode < 400) return 'redirected' as const;
  if (statusCode >= 400) return 'broken' as const;
  return 'unknown' as const;
};

const fetchWithTimeout = async (url: string, init: RequestInit, timeoutMs = 10000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const handleCheckHealth = async (url: string) => {
  try {
    if (!url?.trim()) {
      return jsonResponse({ status: 'invalid', error: 'URL is required' }, { status: 400 });
    }
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return jsonResponse({ status: 'invalid', error: 'Invalid URL' }, { status: 400 });
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return jsonResponse({ status: 'invalid', error: 'URL must use http or https' }, { status: 400 });
    }
    if (isPrivateHostname(parsed.hostname)) {
      return jsonResponse({ status: 'invalid', error: 'Private/internal URLs are not allowed' }, { status: 400 });
    }

    const commonHeaders = {
      'User-Agent': 'NaviX-HealthCheck/1.0 (+https://navix.local)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    };

    // Prefer HEAD first (cheap). Many sites reject HEAD — fall back to GET range/body.
    let response: Response | null = null;
    try {
      response = await fetchWithTimeout(url, { method: 'HEAD', redirect: 'follow', headers: commonHeaders });
      if (response.status === 405 || response.status === 501 || response.status === 403) {
        response = null;
      }
    } catch {
      response = null;
    }

    if (!response) {
      response = await fetchWithTimeout(url, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          ...commonHeaders,
          Range: 'bytes=0-0',
        },
      });
    }

    const finalUrl = response.url || response.headers.get('Location') || url;
    const status = classifyStatus(response.status, url, finalUrl);
    return jsonResponse({
      status,
      statusCode: response.status,
      finalUrl,
      checkedAt: Date.now(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed';
    const aborted = /abort/i.test(message);
    return jsonResponse({
      status: 'broken',
      statusCode: 0,
      error: aborted ? 'Request timeout' : 'Request failed',
      checkedAt: Date.now(),
    });
  }
};

export const onRequestOptions = async () => optionsResponse();

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;

  const authError = await requireAuth(request, env);
  if (authError) return authError;

  try {
    const body = await request.json() as LinkData & { action?: string };

    if (body.action === 'checkHealth') {
      return await handleCheckHealth(body.url || '');
    }

    if (!body.title || !body.url) {
      return jsonResponse({ error: 'Missing title or url' }, { status: 400 });
    }

    const currentDataStr = await env.CLOUDNAV_KV.get('app_data');
    const currentData = currentDataStr ? JSON.parse(currentDataStr) : { links: [], categories: [] };

    let targetCatId = '';
    let targetCatName = '';

    if (body.categoryId) {
      const explicitCat = currentData.categories.find((c: any) => c.id === body.categoryId);
      if (explicitCat) {
        targetCatId = explicitCat.id;
        targetCatName = explicitCat.name;
      }
    }

    if (!targetCatId) {
      if (currentData.categories && currentData.categories.length > 0) {
        const keywords = ['收集', '未分类', 'inbox', 'temp', 'later'];
        const match = currentData.categories.find((c: any) =>
          keywords.some(k => c.name.toLowerCase().includes(k))
        );

        if (match) {
          targetCatId = match.id;
          targetCatName = match.name;
        } else {
          const common = currentData.categories.find((c: any) => c.id === 'common');
          if (common) {
            targetCatId = 'common';
            targetCatName = common.name;
          } else {
            targetCatId = currentData.categories[0].id;
            targetCatName = currentData.categories[0].name;
          }
        }
      } else {
        targetCatId = 'common';
        targetCatName = '默认';
      }
    }

    const newLink = {
      id: Date.now().toString(),
      title: body.title,
      url: body.url,
      description: body.description || '',
      categoryId: targetCatId,
      createdAt: Date.now(),
      pinned: false,
      icon: undefined,
    };

    currentData.links = [newLink, ...(currentData.links || [])];
    await env.CLOUDNAV_KV.put('app_data', JSON.stringify(currentData));

    return jsonResponse({
      success: true,
      link: newLink,
      category: { id: targetCatId, name: targetCatName },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed';
    return jsonResponse({ error: message }, { status: 500 });
  }
};
