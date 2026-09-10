import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverFeedUrls, parseRssFeedText } from '../services/rssParser.ts';

test('parses RSS 2.0 items into a normalized feed and article list', () => {
  const result = parseRssFeedText(`
    <rss version="2.0">
      <channel>
        <title>Tech Daily</title>
        <link>https://example.com/</link>
        <item>
          <guid>article-1</guid>
          <title>First &amp; Important Story</title>
          <link>/news/first</link>
          <description><![CDATA[<p>A short <b>summary</b>.</p>]]></description>
          <content:encoded><![CDATA[<p>A full <b>article body</b> with more detail.</p>]]></content:encoded>
          <pubDate>Tue, 09 Sep 2026 09:00:00 GMT</pubDate>
        </item>
      </channel>
    </rss>
  `, 'https://example.com/rss.xml');

  assert.equal(result.feed.title, 'Tech Daily');
  assert.equal(result.feed.siteUrl, 'https://example.com/');
  assert.equal(result.articles[0].title, 'First & Important Story');
  assert.equal(result.articles[0].url, 'https://example.com/news/first');
  assert.equal(result.articles[0].summary, 'A short summary.');
  assert.equal(result.articles[0].content, 'A full article body with more detail.');
  assert.equal(result.articles[0].sourceTitle, 'Tech Daily');
  assert.equal(typeof result.articles[0].publishedAt, 'number');
});

test('parses Atom and JSON Feed documents', () => {
  const atom = parseRssFeedText(`
    <feed xmlns="http://www.w3.org/2005/Atom">
      <title>Atom Notes</title>
      <link href="https://example.com/" rel="alternate" />
      <entry>
        <id>tag:example.com,2026:2</id>
        <title>Atom entry</title>
        <link rel="alternate" href="/atom-entry" />
        <summary>Atom summary</summary>
        <updated>2026-09-09T10:00:00Z</updated>
      </entry>
    </feed>
  `, 'https://example.com/atom.xml');
  assert.equal(atom.feed.title, 'Atom Notes');
  assert.equal(atom.articles[0].url, 'https://example.com/atom-entry');

  const json = parseRssFeedText(JSON.stringify({
    version: 'https://jsonfeed.org/version/1.1',
    title: 'JSON Notes',
    home_page_url: 'https://json.example.com',
    items: [{
      id: 'json-1',
      url: 'https://json.example.com/one',
      title: 'JSON item',
      content_text: 'Plain text content',
      date_published: '2026-09-09T11:00:00Z',
      author: { name: 'Kai' },
    }],
  }), 'https://json.example.com/feed.json');
  assert.equal(json.feed.title, 'JSON Notes');
  assert.equal(json.articles[0].author, 'Kai');
  assert.equal(json.articles[0].summary, 'Plain text content');
  assert.equal(json.articles[0].content, 'Plain text content');
});

test('discovers declared alternate feeds and common fallback paths', () => {
  const urls = discoverFeedUrls(`
    <html><head>
      <link rel="alternate" type="application/rss+xml" title="RSS" href="/rss.xml">
      <link rel="alternate" type="application/atom+xml" href="https://feeds.example.com/atom.xml">
    </head></html>
  `, 'https://example.com/blog');

  assert.deepEqual(urls.slice(0, 2), [
    'https://example.com/rss.xml',
    'https://feeds.example.com/atom.xml',
  ]);
  assert.ok(urls.includes('https://example.com/feed'));
  assert.ok(urls.includes('https://example.com/feed.xml'));
});

test('caps the article list and ignores malformed entries', () => {
  const items = Array.from({ length: 40 }, (_, index) => `
    <item>
      <title>${index === 3 ? '' : `Story ${index}`}</title>
      <link>https://example.com/${index}</link>
    </item>
  `).join('');
  const result = parseRssFeedText(`<rss><channel><title>Many</title>${items}</channel></rss>`, 'https://example.com/rss');
  assert.equal(result.articles.length, 30);
  assert.equal(result.articles.some(article => article.title === ''), false);
});
