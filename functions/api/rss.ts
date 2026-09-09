import { jsonResponse, optionsResponse } from '../_shared/auth.ts';
import { assertSafeExternalUrl, fetchWithSafeRedirects } from '../_shared/urlSafety.ts';
import { discoverFeedUrls, parseRssFeedText } from '../../services/rssParser.ts';

const MAX_BODY_BYTES = 1_500_000;
const REQUEST_TIMEOUT_MS = 12_000;
const BROWSER_UA = 'Mozilla/5.0 (compatible; CloudNav RSS Reader/1.0; +https://nav.006680.xyz/)';

const fetchText = async (url: string, accept: string) => {
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
    if (declaredLength > MAX_BODY_BYTES) throw new Error('Feed is too large');
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) throw new Error('Feed is too large');
    return { response, text };
  } finally {
    clearTimeout(timeout);
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
      const result = await fetchText(page.toString(), 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5');
      return jsonResponse({ feeds: discoverFeedUrls(result.text, result.response.url || page.toString()) }, {
        headers: { 'Cache-Control': 'public, max-age=600' },
      });
    }

    if (!feedUrl) return jsonResponse({ error: 'RSS URL is required' }, { status: 400 });
    const parsedUrl = assertSafeExternalUrl(feedUrl);
    const result = await fetchText(parsedUrl.toString(), 'application/rss+xml,application/atom+xml,application/feed+json,application/json,text/xml;q=0.9,*/*;q=0.5');
    const normalizedUrl = result.response.url || parsedUrl.toString();
    const parsed = parseRssFeedText(result.text, normalizedUrl);
    if (isHtmlDocument(result.text, result.response.headers.get('content-type'))) {
      const discovered = await findWorkingDiscoveredFeed(normalizedUrl, result.text);
      if (!discovered) throw new Error('No working RSS feed was found');
      return jsonResponse({ ...discovered, fetchedAt: Date.now() }, {
        headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' },
      });
    }
    return jsonResponse({ ...parsed, fetchedAt: Date.now(), sourceUrl: normalizedUrl }, {
      headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'RSS request failed';
    const isInvalid = /invalid|private|credential|only http|not allowed/i.test(message);
    return jsonResponse({ error: isInvalid ? '不支持的外部地址' : 'RSS 暂时无法访问', detail: message }, { status: isInvalid ? 400 : 502 });
  }
};
