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

test('RSS API falls back for Cloudflare-blocked Linux.do latest and top feeds', async () => {
  const originalFetch = globalThis.fetch;
  const requested: string[] = [];
  const mirrorFeeds = new Map([
    ['https://linuxdorss.longpink.com/latest.xml', 'Linux.do 最新话题'],
    ['https://linuxdorss.longpink.com/top.xml', 'Linux.do 热门话题'],
  ]);

  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    requested.push(url);
    if (url === 'https://linux.do/latest.rss' || url === 'https://linux.do/top.rss') {
      return new Response('<html><title>Just a moment...</title></html>', { status: 403, headers: { 'content-type': 'text/html' } });
    }
    const title = mirrorFeeds.get(url);
    if (title) {
      return new Response(`<?xml version="1.0"?><rss version="2.0"><channel><title>${title}</title><link>https://linux.do</link><item><guid>${url}</guid><title>Linux.do 测试主题</title><link>https://linux.do/t/topic/1</link><description>镜像内容</description><pubDate>Tue, 09 Sep 2026 08:00:00 GMT</pubDate></item></channel></rss>`, { headers: { 'content-type': 'application/xml' } });
    }
    return new Response('not found', { status: 404 });
  };

  try {
    for (const sourceUrl of ['https://linux.do/latest.rss', 'https://linux.do/top.rss']) {
      const response = await onRequestGet({ request: new Request(`https://cloudnav.test/api/rss?url=${encodeURIComponent(sourceUrl)}`) });
      const payload = await response.json() as { feed?: { url?: string }; articles?: Array<{ title: string }>; sourceUrl?: string };
      assert.equal(response.status, 200);
      assert.equal(payload.feed?.url, sourceUrl);
      assert.equal(payload.sourceUrl, sourceUrl);
      assert.equal(payload.articles?.[0]?.title, 'Linux.do 测试主题');
    }
    assert.ok(requested.includes('https://linuxdorss.longpink.com/latest.xml'));
    assert.ok(requested.includes('https://linuxdorss.longpink.com/top.xml'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
