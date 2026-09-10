import { corsHeaders, jsonResponse, optionsResponse, requireAuth } from '../_shared/auth';
import { assertSafeExternalUrl, fetchWithSafeRedirects } from '../_shared/urlSafety';

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_HTML_BYTES = 512_000;

interface Env {
  PASSWORD: string;
  SESSION_SECRET?: string;
}

export const onRequestOptions = async () => optionsResponse();

// 服务端抓取网页 <title>,免 CORS。鉴权 + SSRF 防护(拦内网/本地)。
export const onRequestGet = async (context: { env: Env; request: Request }) => {
  const { env, request } = context;

  const authError = await requireAuth(request, env);
  if (authError) return authError;

  const target = new URL(request.url).searchParams.get('url');
  if (!target) return jsonResponse({ error: 'url required' }, { status: 400 });

  try { assertSafeExternalUrl(target); } catch { return jsonResponse({ error: '不支持内网 / 本地地址' }, { status: 400 }); }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetchWithSafeRedirects(target, {
        headers: { 'User-Agent': 'NaviX/1.0 (+bookmark title fetch)' },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) return jsonResponse({ title: '' });

    const declaredLength = Number(res.headers.get('content-length') || 0);
    if (declaredLength > MAX_HTML_BYTES) return jsonResponse({ title: '' });
    const html = await res.text();
    if (new TextEncoder().encode(html).byteLength > MAX_HTML_BYTES) return jsonResponse({ title: '' });
    const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    let title = m ? m[1].replace(/\s+/g, ' ').trim() : '';
    title = title
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'");
    return jsonResponse({ title }, { headers: corsHeaders });
  } catch {
    return jsonResponse({ error: 'fetch failed' }, { status: 502 });
  }
};
