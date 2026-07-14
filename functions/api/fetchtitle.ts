interface Env {
  PASSWORD: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-auth-password',
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

export const onRequestOptions = async () =>
  new Response(null, { status: 204, headers: corsHeaders });

// 服务端抓取网页 <title>,免 CORS。鉴权 + SSRF 防护(拦内网/本地)。
export const onRequestGet = async (context: { env: Env; request: Request }) => {
  const { env, request } = context;

  if (!env.PASSWORD || request.headers.get('x-auth-password') !== env.PASSWORD) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const target = new URL(request.url).searchParams.get('url');
  if (!target) return jsonResponse({ error: 'url required' }, 400);

  let parsed: URL;
  try { parsed = new URL(target); } catch { return jsonResponse({ error: 'invalid url' }, 400); }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return jsonResponse({ error: 'unsupported protocol' }, 400);
  }

  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' || host.endsWith('.local') || host === '0.0.0.0' ||
    /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) || /^169\.254\./.test(host)
  ) {
    return jsonResponse({ error: '不支持内网 / 本地地址' }, 400);
  }

  try {
    const res = await fetch(target, {
      headers: { 'User-Agent': 'NaviX/1.0 (+bookmark title fetch)' },
      redirect: 'follow',
    });
    if (!res.ok) return jsonResponse({ title: '' });

    const html = await res.text();
    const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    let title = m ? m[1].replace(/\s+/g, ' ').trim() : '';
    title = title
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'");
    return jsonResponse({ title });
  } catch {
    return jsonResponse({ error: 'fetch failed' }, 502);
  }
};
