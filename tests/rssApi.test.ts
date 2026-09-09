import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/api/rss.ts';

test('RSS API resolves a website URL to a working discovered feed', async () => {
  const originalFetch = globalThis.fetch;
  const responses = new Map([
    ['https://example.com/', new Response('<html><head><link rel="alternate" type="application/rss+xml" href="/rss.xml"></head><body>Home</body></html>', { headers: { 'content-type': 'text/html; charset=utf-8' } })],
    ['https://example.com/rss.xml', new Response(`<?xml version="1.0"?><rss version="2.0"><channel><title>Example News</title><link>https://example.com</link><item><title>第一条资讯</title><link>https://example.com/articles/1</link><description>内容</description><pubDate>Tue, 09 Sep 2026 08:00:00 GMT</pubDate></item></channel></rss>`, { headers: { 'content-type': 'application/rss+xml' } })],
  ]);

  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    const response = responses.get(url);
    return response ? response.clone() : new Response('not found', { status: 404 });
  };

  try {
    const response = await onRequestGet({ request: new Request('https://cloudnav.test/api/rss?url=https%3A%2F%2Fexample.com') });
    const payload = await response.json() as { articles?: Array<{ title: string }>; sourceUrl?: string };
    assert.equal(response.status, 200);
    assert.equal(payload.sourceUrl, 'https://example.com/rss.xml');
    assert.equal(payload.articles?.[0]?.title, '第一条资讯');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
