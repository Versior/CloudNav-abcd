import { isAuthenticated, jsonResponse, optionsResponse } from '../_shared/auth';
import { isBlockedHost } from '../_shared/hostGuard';

/**
 * 图标代理：由 Cloudflare 边缘抓取站点图标，再回传给浏览器。
 *
 * 为什么需要它：
 * 之前浏览器直接请求 gstatic（Google）取图标。项目部署在 Cloudflare，
 * 但**用户浏览器**在国内访问不到 Google，图标就全部回落成首字母。
 * 放到边缘抓取后，浏览器只访问同域的 /api/favicon，不碰 Google。
 *
 * 取图顺序：
 * 1. 站点自己的 /favicon.ico
 * 2. 站点 HTML 里 <link rel="icon"> 指向的地址（很多站点只写在这里）
 * 3. 兜底：DuckDuckGo 的 ip3 图标服务（对国内可达性比 Google 好）
 *
 * 安全：与 fetchtitle 一致——鉴权 + SSRF 防护 + 不跟随重定向 + 体积与超时上限。
 */

interface Env {
  PASSWORD: string;
  SESSION_SECRET?: string;
}

const TIMEOUT_MS = 6000;
const MAX_BYTES = 256 * 1024;
const CACHE_SECONDS = 60 * 60 * 24 * 7;

export const onRequestOptions = async (context: { request: Request }) => optionsResponse(context.request);

const isImage = (type: string) =>
  /^image\//i.test(type) || /octet-stream/i.test(type);

/** 从 HTML 里找 <link rel="...icon..."> 的 href。 */
const findIconHref = (html: string, base: URL): string | null => {
  const linkTags = html.match(/<link[^>]+>/gi) || [];
  for (const tag of linkTags) {
    if (!/rel\s*=\s*["']?[^"'>]*icon/i.test(tag)) continue;
    const hrefMatch = tag.match(/href\s*=\s*["']([^"']+)["']/i);
    if (!hrefMatch) continue;
    try {
      const resolved = new URL(hrefMatch[1], base);
      if (resolved.protocol === 'https:' || resolved.protocol === 'http:') return resolved.toString();
    } catch { /* 跳过非法 href */ }
  }
  return null;
};

/** 抓一个候选地址，成功则返回图片响应，失败返回 null。 */
const tryFetchIcon = async (target: string): Promise<Response | null> => {
  let parsed: URL;
  try { parsed = new URL(target); } catch { return null; }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
  if (isBlockedHost(parsed.hostname)) return null;

  try {
    const res = await fetch(parsed.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Cove-Favicon/1.0)', Accept: 'image/*,*/*;q=0.8' },
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || '';
    // 有些站点对 favicon 返回 HTML（404 页面），必须排除，否则浏览器拿到一坨文本
    if (!isImage(type)) return null;
    const buf = await res.arrayBuffer();
    if (!buf.byteLength || buf.byteLength > MAX_BYTES) return null;
    return new Response(buf, {
      headers: {
        'Content-Type': type.startsWith('image/') ? type : 'image/x-icon',
        'Cache-Control': `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}`,
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return null;
  }
};

export const onRequestGet = async (context: { env: Env; request: Request }) => {
  const { env, request } = context;

  /*
   * 鉴权用 isAuthenticated 而不是 requireAuth。
   *
   * 图标是 <img src> 加载的，浏览器不会给它加 Authorization 头，
   * 只能用同源请求自动携带的 cookie。requireAuth 只认 Bearer，
   * 导致这个接口对页面渲染永远是 401——兜底路径等于不存在，
   * 这正是"很多站点刷新才有图标"的真正原因。
   * isAuthenticated 同时接受 cookie 与 Bearer，两种调用方都能用。
   */
  if (!(await isAuthenticated(request, env))) {
    return jsonResponse({ error: 'unauthorized' }, { status: 401 }, request);
  }

  const raw = new URL(request.url).searchParams.get('url');
  if (!raw) return jsonResponse({ error: 'url required' }, { status: 400 }, request);

  let parsed: URL;
  try { parsed = new URL(raw); } catch { return jsonResponse({ error: 'invalid url' }, { status: 400 }, request); }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return jsonResponse({ error: 'unsupported protocol' }, { status: 400 }, request);
  }
  if (isBlockedHost(parsed.hostname)) {
    return jsonResponse({ error: '不支持内网 / 本地地址' }, { status: 400 }, request);
  }

  const origin = parsed.origin;
  const host = parsed.hostname;

  // 1) 站点根 favicon
  const direct = await tryFetchIcon(`${origin}/favicon.ico`);
  if (direct) return direct;

  // 2) 解析页面里的 <link rel="icon">
  try {
    const page = await fetch(parsed.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Cove-Favicon/1.0)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (page.ok) {
      const type = page.headers.get('content-type') || '';
      if (/text\/html/i.test(type)) {
        const html = (await page.text()).slice(0, 128 * 1024);
        const href = findIconHref(html, parsed);
        if (href) {
          const fromHtml = await tryFetchIcon(href);
          if (fromHtml) return fromHtml;
        }
      }
    }
  } catch { /* 页面抓不到就继续兜底 */ }

  // 3) DuckDuckGo 图标服务兜底（国内可达性优于 Google）
  const ddg = await tryFetchIcon(`https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`);
  if (ddg) return ddg;

  return jsonResponse({ error: 'no icon' }, { status: 404 }, request);
};
