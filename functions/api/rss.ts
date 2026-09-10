import { jsonResponse, optionsResponse } from '../_shared/auth.ts';
import { assertSafeExternalUrl, fetchWithSafeRedirects } from '../_shared/urlSafety.ts';
import { discoverFeedUrls, parseRssFeedText } from '../../services/rssParser.ts';

const MAX_BODY_BYTES = 1_500_000;
const MAX_MIRROR_BODY_BYTES = 6_000_000;
const REQUEST_TIMEOUT_MS = 12_000;
const BROWSER_UA = 'Mozilla/5.0 (compatible; CloudNav RSS Reader/1.0; +https://nav.006680.xyz/)';
const LINUX_DO_MIRROR_BASE = 'https://linuxdorss.longpink.com';

const fetchText = async (url: string, accept: string, maxBodyBytes = MAX_BODY_BYTES) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchWithSafeRedirects(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: accept,
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const declaredLength = Number(response.headers.get('Content-Length') || 0);
    if (declaredLength > maxBodyBytes) throw new Error('Feed is too large');
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > maxBodyBytes) throw new Error('Feed is too large');
    return { response, text };
  } finally {
    clearTimeout(timeout);
  }
};

const getLinuxDoMirrorUrl = (sourceUrl: URL) => {
  const hostname = sourceUrl.hostname.toLowerCase();
  if (hostname !== 'linux.do' && hostname !== 'www.linux.do') return '';
  if (sourceUrl.pathname === '/latest.rss') return `${LINUX_DO_MIRROR_BASE}/latest.xml`;
  if (sourceUrl.pathname === '/top.rss') return `${LINUX_DO_MIRROR_BASE}/top.xml`;
  return '';
};

const fetchRssTextWithFallback = async (sourceUrl: URL, accept: string) => {
  try {
    const result = await fetchText(sourceUrl.toString(), accept);
    return { ...result, sourceUrl: result.response.url || sourceUrl.toString(), usedMirror: false };
  } catch (error) {
    const mirrorUrl = getLinuxDoMirrorUrl(sourceUrl);
    if (!mirrorUrl) throw error;
    return { ...(await fetchText(mirrorUrl, accept, MAX_MIRROR_BODY_BYTES)), sourceUrl: sourceUrl.toString(), mirrorUrl, usedMirror: true };
  }
};

const isHtmlDocument = (text: string, contentType: string | null) => (
  /text\/html|application\/xhtml\+xml/i.test(contentType || '') || /<html\b|<head\b/i.test(text.slice(0, 2000))
);

const findWorkingDiscoveredFeed = async (pageUrl: string, html: string) => {
  const candidates = discoverFeedUrls(html, pageUrl).slice(0, 8);
  const results = await Promise.all(candidates.map(async candidate => {
    try {
      const result = await fetchText(candidate, 'application/rss+xml,application/atom+xml,application/feed+json,application/json,text/xml;q=0.9,*/*;q=0.5');
      const parsed = parseRssFeedText(result.text, result.response.url || candidate);
      return parsed.articles.length > 0
        ? { ...parsed, sourceUrl: result.response.url || candidate }
        : null;
    } catch {
      return null;
    }
  }));
  return results.find(Boolean) || null;
};

export const onRequestOptions = async () => optionsResponse();

export const onRequestGet = async (context: { request: Request }) => {
  const query = new URL(context.request.url).searchParams;
  const discoverUrl = query.get('discover')?.trim();
  const feedUrl = query.get('url')?.trim();

  try {
    if (discoverUrl) {
      const page = assertSafeExternalUrl(discoverUrl);
      const linuxMirror = getLinuxDoMirrorUrl(new URL(`${page.origin}/latest.rss`));
      if (linuxMirror) {
        return jsonResponse({ feeds: [`${LINUX_DO_MIRROR_BASE}/latest.xml`, `${LINUX_DO_MIRROR_BASE}/top.xml`] }, {
          headers: { 'Cache-Control': 'public, max-age=600' },
        });
      }
      const result = await fetchText(page.toString(), 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5');
      return jsonResponse({ feeds: discoverFeedUrls(result.text, result.response.url || page.toString()) }, {
        headers: { 'Cache-Control': 'public, max-age=600' },
      });
    }

    if (!feedUrl) return jsonResponse({ error: 'RSS URL is required' }, { status: 400 });
    const parsedUrl = assertSafeExternalUrl(feedUrl);
    const result = await fetchRssTextWithFallback(parsedUrl, 'application/rss+xml,application/atom+xml,application/feed+json,application/json,text/xml;q=0.9,*/*;q=0.5');
    const normalizedUrl = result.sourceUrl;
    const parsedSourceUrl = result.response.url || normalizedUrl;
    const parsed = parseRssFeedText(result.text, parsedSourceUrl);
    const feed = { ...parsed.feed, id: normalizedUrl, url: normalizedUrl };
    if (isHtmlDocument(result.text, result.response.headers.get('content-type'))) {
      const discovered = await findWorkingDiscoveredFeed(normalizedUrl, result.text);
      if (!discovered) throw new Error('No working RSS feed was found');
      return jsonResponse({ ...discovered, fetchedAt: Date.now() }, {
        headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' },
      });
    }
    return jsonResponse({ ...parsed, feed: result.usedMirror ? feed : parsed.feed, fetchedAt: Date.now(), sourceUrl: normalizedUrl }, {
      headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'RSS request failed';
    const isInvalid = /invalid|private|credential|only http|not allowed/i.test(message);
    return jsonResponse({ error: isInvalid ? '不支持的外部地址' : 'RSS 暂时无法访问', detail: message }, { status: isInvalid ? 400 : 502 });
  }
};
