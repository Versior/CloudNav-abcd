import { jsonResponse, optionsResponse, requireAuth } from '../_shared/auth';
import { isBlockedHost } from '../_shared/hostGuard';

interface Env {
  PASSWORD: string;
  SESSION_SECRET?: string;
}

const MAX_BYTES = 512 * 1024;
const TIMEOUT_MS = 8000;

export const onRequestOptions = async (context: { request: Request }) => optionsResponse(context.request);


// 服务端抓取网页 <title>，免 CORS。鉴权 + SSRF 防护（拦内网 / 本地 / 重定向绕过）。
export const onRequestGet = async (context: { env: Env; request: Request }) => {
  const { env, request } = context;

  const authError = await requireAuth(request, env);
  if (authError) return authError;

  const target = new URL(request.url).searchParams.get('url');
  if (!target) return jsonResponse({ error: 'url required' }, { status: 400 }, request);

  let parsed: URL;
  try { parsed = new URL(target); } catch { return jsonResponse({ error: 'invalid url' }, { status: 400 }, request); }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return jsonResponse({ error: 'unsupported protocol' }, { status: 400 }, request);
  }
  if (isBlockedHost(parsed.hostname)) {
    return jsonResponse({ error: '不支持内网 / 本地地址' }, { status: 400 }, request);
  }

  try {
    // 禁止跟随重定向：否则公网地址可 302 到内网，绕过上面的主机校验
    const res = await fetch(parsed.toString(), {
      headers: { 'User-Agent': 'NaviX/1.0 (+bookmark title fetch)' },
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (res.status >= 300 && res.status < 400) {
      return jsonResponse({ error: '不跟随重定向' }, { status: 400 }, request);
    }
    if (!res.ok) return jsonResponse({ title: '' }, {}, request);

    const length = Number(res.headers.get('content-length') || 0);
    if (length > MAX_BYTES) return jsonResponse({ title: '' }, {}, request);

    const html = (await res.text()).slice(0, MAX_BYTES);
    const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    let title = m ? m[1].replace(/\s+/g, ' ').trim() : '';
    title = title
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'");
    return jsonResponse({ title }, {}, request);
  } catch {
    return jsonResponse({ error: 'fetch failed' }, { status: 502 }, request);
  }
};
