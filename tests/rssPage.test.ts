import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseInitialRssArticle, getRssFeedViewState } from '../services/rssService.ts';

test('RSS feed state distinguishes empty, error, and offline content', () => {
  const feed = { id: 'feed', url: 'https://example.test/rss', title: '示例', addedAt: 1 };
  assert.equal(getRssFeedViewState(feed, [], true), 'empty');
  assert.equal(getRssFeedViewState({ ...feed, error: '抓取失败' }, [], true), 'error');
  assert.equal(getRssFeedViewState(feed, [{ id: 'article', feedId: 'feed', title: '缓存', url: 'https://example.test/a' }], false), 'offline');
});

test('RSS initial article chooses unread newest content first', () => {
  const article = chooseInitialRssArticle([
    { id: 'old', feedId: 'feed', title: '旧', url: 'https://example.test/old', publishedAt: 10, read: false },
    { id: 'new', feedId: 'feed', title: '新', url: 'https://example.test/new', publishedAt: 20, read: true },
  ]);
  assert.equal(article?.id, 'old');
});
