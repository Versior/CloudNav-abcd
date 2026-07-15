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

type HealthStatus = 'ok' | 'broken' | 'redirected' | 'unknown' | 'invalid';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const isPrivateHostname = (hostname: string) => {
  const normalized = hostname.toLowerCase();
  if (normalized === 'localhost' || normalized.endsWith('.localhost') || normalized.includes(':')) return true;
  const ipv4 = normalized.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;
  const [a, b] = ipv4.slice(1).map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
};

const sameSite = (originalUrl: string, finalUrl?: string | null) => {
  if (!finalUrl) return true;
  try {
    const a = new URL(originalUrl);
    const b = new URL(finalUrl, originalUrl);
    const hostA = a.hostname.replace(/^www\./i, '').toLowerCase();
    const hostB = b.hostname.replace(/^www\./i, '').toLowerCase();
    const pathA = a.pathname.replace(/\/+$/, '') || '/';
    const pathB = b.pathname.replace(/\/+$/, '') || '/';
    return hostA === hostB && pathA === pathB;
  } catch {
    return originalUrl === finalUrl;
  }
};

/**
 * Classification rules (browser-friendly):
 * - 2xx => ok (redirected if final URL meaningfully changed)
 * - 3xx => redirected (still reachable)
 * - 401/403/429/407 => unknown (auth / bot protection — often opens fine in real browsers)
 * - 404/410 => broken (true dead)
 * - other 4xx/5xx => unknown (temporary or anti-bot, not hard-delete)
 * - network/timeout => unknown (Cloudflare egress may be blocked by target)
 */
const classifyStatus = (
  statusCode: number,
  originalUrl: string,
  finalUrl?: string | null
): { status: HealthStatus; reason?: string } => {
  if (statusCode >= 200 && statusCode < 300) {
    if (finalUrl && !sameSite(originalUrl, finalUrl)) {
      return { status: 'redirected', reason: '站点返回了新地址' };
    }
    return { status: 'ok' };
  }

  if (statusCode >= 300 && statusCode < 400) {
    return { status: 'redirected', reason: `HTTP ${statusCode} 跳转` };
  }

  // Auth / bot walls — site is usually fine in a real browser
  if ([401, 403, 407, 429].includes(statusCode)) {
    return {
      status: 'unknown',
      reason:
        statusCode === 429
          ? '站点限流/防爬，浏览器里通常仍可打开'
          : statusCode === 401 || statusCode === 407
            ? '需要登录或鉴权，不一定失效'
            : '疑似防爬/WAF 拦截探测，浏览器里通常仍可打开',
    };
  }

  // Hard dead
  if (statusCode === 404 || statusCode === 410) {
    return { status: 'broken', reason: statusCode === 410 ? '资源已永久移除' : '页面不存在 (404)' };
  }

  // Method issues after retries still shouldn't mean dead
  if (statusCode === 405 || statusCode === 501) {
    return { status: 'unknown', reason: '站点不支持当前探测方式' };
  }

  if (statusCode >= 500) {
    return { status: 'unknown', reason: `服务器临时错误 HTTP ${statusCode}` };
  }

  if (statusCode >= 400) {
    return { status: 'unknown', reason: `HTTP ${statusCode}，未判定为确定失效` };
  }

  return { status: 'unknown', reason: '无法确认状态' };
};

const fetchWithTimeout = async (url: string, init: RequestInit, timeoutMs = 12000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const commonHeaders = {
  'User-Agent': BROWSER_UA,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Cache-Control': 'no-cache',
};

const probeOnce = async (url: string, method: 'HEAD' | 'GET', extraHeaders: Record<string, string> = {}) => {
  return fetchWithTimeout(url, {
    method,
    redirect: 'follow',
    headers: { ...commonHeaders, ...extraHeaders },
  });
};

const shouldRetryWithGet = (status: number) =>
  [0, 403, 405, 501, 503, 520, 521, 522, 523, 524].includes(status);

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

    let response: Response | null = null;
    let lastError = '';

    // 1) HEAD
    try {
      response = await probeOnce(url, 'HEAD');
      if (shouldRetryWithGet(response.status)) {
        response = null;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'HEAD failed';
      response = null;
    }

    // 2) GET with Range (cheap body)
    if (!response) {
      try {
        response = await probeOnce(url, 'GET', { Range: 'bytes=0-1023' });
        // Some CDNs return 416 for range — still means host is alive
        if (response.status === 416) {
          const finalUrl = response.url || url;
          return jsonResponse({
            status: 'ok',
            statusCode: 416,
            finalUrl,
            checkedAt: Date.now(),
            reason: '站点可达（Range 响应）',
          });
        }
        if (shouldRetryWithGet(response.status) && response.status !== 403) {
          // keep 403 for one more full GET attempt below if needed
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'GET range failed';
        response = null;
      }
    }

    // 3) Full GET fallback for stubborn anti-bot / HEAD-only failures
    if (!response || shouldRetryWithGet(response.status)) {
      try {
        const full = await probeOnce(url, 'GET');
        // Prefer a more informative successful-ish response
        if (!response || full.status < response.status || [200, 301, 302, 303, 307, 308].includes(full.status)) {
          response = full;
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'GET failed';
        if (!response) {
          const aborted = /abort/i.test(lastError);
          return jsonResponse({
            status: 'unknown',
            statusCode: 0,
            error: aborted ? 'Request timeout' : 'Request failed',
            reason: aborted
              ? '探测超时（站点可能屏蔽数据中心 IP）'
              : '网络探测失败（站点可能屏蔽服务器访问，浏览器仍可打开）',
            checkedAt: Date.now(),
          });
        }
      }
    }

    if (!response) {
      return jsonResponse({
        status: 'unknown',
        statusCode: 0,
        error: lastError || 'Request failed',
        reason: '无法完成探测',
        checkedAt: Date.now(),
      });
    }

    const finalUrl = response.url || response.headers.get('Location') || url;
    const classified = classifyStatus(response.status, url, finalUrl);
    return jsonResponse({
      status: classified.status,
      statusCode: response.status,
      finalUrl,
      reason: classified.reason,
      checkedAt: Date.now(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed';
    const aborted = /abort/i.test(message);
    return jsonResponse({
      status: 'unknown',
      statusCode: 0,
      error: aborted ? 'Request timeout' : 'Request failed',
      reason: aborted
        ? '探测超时（站点可能屏蔽数据中心 IP）'
        : '网络探测失败（浏览器里可能仍可打开）',
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
