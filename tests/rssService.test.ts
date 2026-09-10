import test from 'node:test';
import assert from 'node:assert/strict';
import { RSS_PRESET_VERSION_KEY, RSS_STATE_KEY } from '../constants/storageKeys.ts';
import { DEFAULT_RSS_FEEDS, fetchRssFeed, readRssState, updateRssFeed } from '../services/rssService.ts';

test('ships useful Chinese AI and GitHub preset subscriptions', () => {
  const urls = new Set(DEFAULT_RSS_FEEDS.map(feed => feed.url));
  assert.ok(urls.has('https://cdn.jsdelivr.net/gh/Hyraze/trending-collection@main/api/daily/all.json'));
  assert.ok(urls.has('https://www.qbitai.com/feed'));
  assert.ok(urls.has('https://decemberpei.cyou/rssbox/wechat-jiqizhixin.xml'));
  assert.ok(urls.has('https://www.geekpark.net/rss'));
  assert.ok(urls.has('https://www.ithome.com/rss/'));
  assert.equal(urls.has('https://36kr.com/feed'), false);
  assert.equal(urls.has('https://36kr.com/feed-newsflash'), false);
  assert.equal(urls.has('https://rsshub.app/juejin/trending/ai/weekly'), false);
  assert.equal(urls.has('https://rsshub.app/github/trending/daily'), false);
  assert.equal(urls.has('https://hnrss.org/frontpage'), false);
  assert.equal(urls.has('https://github.blog/feed/'), false);
  assert.equal(urls.has('https://github.blog/changelog/feed/'), false);
  assert.equal(DEFAULT_RSS_FEEDS.find(feed => feed.id === 'preset-github')?.title, 'GitHub 热门项目');
});

test('migrates previously seeded broken presets to reliable sources', () => {
  const values = new Map<string, string>([
    [RSS_PRESET_VERSION_KEY, '3'],
    [RSS_STATE_KEY, JSON.stringify({
      feeds: [
        { id: 'preset-hot', url: 'https://36kr.com/feed-newsflash', title: '每日热点 · 36氪快讯', preset: true, addedAt: 0 },
        { id: 'preset-github', url: 'https://rsshub.app/github/trending/daily', title: 'GitHub 热门项目', preset: true, addedAt: 0 },
        { id: 'custom-feed', url: 'https://example.com/custom.xml', title: '我的订阅', addedAt: 1 },
      ],
      articles: [],
    })],
  ]);
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) || null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });

  const state = readRssState();
  assert.equal(state.feeds.some(feed => feed.id === 'preset-hot'), false);
  assert.equal(state.feeds.find(feed => feed.id === 'preset-github')?.url, 'https://cdn.jsdelivr.net/gh/Hyraze/trending-collection@main/api/daily/all.json');
  assert.ok(state.feeds.some(feed => feed.id === 'preset-jiqizhixin'));
  assert.equal(values.get(RSS_PRESET_VERSION_KEY), '5');
});

test('updates an RSS subscription without losing its identity or preset state', () => {
  const current = { id: 'feed-1', url: 'https://example.com/old.xml', title: '旧名称', preset: true, addedAt: 1 };
  const result = updateRssFeed(current, ' https://example.com/new.xml ', ' 新名称 ', [current]);
  assert.equal(result.error, undefined);
  assert.deepEqual(result.feed, {
    ...current,
    url: 'https://example.com/new.xml',
    title: '新名称',
    preset: false,
    lastFetchedAt: undefined,
    error: undefined,
  });
  assert.equal(result.urlChanged, true);
});

test('rejects invalid or duplicate RSS subscription edits', () => {
  const current = { id: 'feed-1', url: 'https://example.com/old.xml', title: '旧名称', addedAt: 1 };
  const duplicate = { id: 'feed-2', url: 'https://example.com/other.xml', title: '其他', addedAt: 1 };
  assert.equal(updateRssFeed(current, 'not-a-url', '名称', [current, duplicate]).error, '请输入 http 或 https 的 RSS 地址');
  assert.equal(updateRssFeed(current, duplicate.url, '名称', [current, duplicate]).error, '这个订阅地址已经存在');
});

test('rejects an invalid successful RSS payload instead of returning an undefined feed', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({}), { status: 200, headers: { 'content-type': 'application/json' } });
  try {
    await assert.rejects(() => fetchRssFeed('https://example.com/feed.xml'), /RSS 返回数据无效/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
