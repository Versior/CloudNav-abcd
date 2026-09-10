import { jsonResponse, optionsResponse } from '../_shared/auth.ts';
import { assertSafeExternalUrl, fetchWithSafeRedirects } from '../_shared/urlSafety.ts';
import { extractReadableDocument } from '../../services/contentParser.ts';

const MAX_BODY_BYTES = 4_000_000;
const REQUEST_TIMEOUT_MS = 12_000;
const BROWSER_UA = 'Mozilla/5.0 (compatible; CloudNav Reader/1.0; +https://nav.006680.xyz/)';

export const onRequestOptions = async () => optionsResponse();

export const onRequestGet = async (context: { request: Request }) => {
  const rawUrl = new URL(context.request.url).searchParams.get('url')?.trim();
  if (!rawUrl) return jsonResponse({ error: 'Content URL is required' }, { status: 400 });
  try {
    const sourceUrl = assertSafeExternalUrl(rawUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetchWithSafeRedirects(sourceUrl.toString(), {
        headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5', 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8' },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const declaredLength = Number(response.headers.get('Content-Length') || 0);
      if (declaredLength > MAX_BODY_BYTES) throw new Error('Page is too large');
      const html = await response.text();
      if (new TextEncoder().encode(html).byteLength > MAX_BODY_BYTES) throw new Error('Page is too large');
      return jsonResponse({ document: extractReadableDocument(html, response.url || sourceUrl.toString()), fetchedAt: Date.now() }, {
        headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' },
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Reader request failed';
    const isInvalid = /invalid|private|credential|only http|not allowed/i.test(message);
    return jsonResponse({ error: isInvalid ? '不支持的外部地址' : '正文暂时无法抓取', detail: message }, { status: isInvalid ? 400 : 502 });
  }
};
