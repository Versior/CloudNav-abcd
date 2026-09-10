import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInboxItems, getInboxKindLabel } from '../services/inboxService.ts';

test('builds a deduplicated cross-source inbox ordered by recent activity', () => {
  const items = buildInboxItems({
    articles: [{ id: 'a1', feedId: 'f1', title: 'RSS article', url: 'https://example.com/a', summary: 'summary', publishedAt: 20, read: false }],
    readLater: [{ id: 'later', kind: 'rss', title: 'Same article', url: 'https://example.com/a', status: 'unread', addedAt: 10, updatedAt: 10 }],
    inspirations: [{ id: 'idea', title: 'Idea', content: 'content', type: 'idea', tags: [], status: 'active', createdAt: 30, updatedAt: 30 }],
  });
  assert.deepEqual(items.map(item => item.title), ['Idea', 'RSS article']);
  assert.equal(getInboxKindLabel('rss'), 'RSS');
});
