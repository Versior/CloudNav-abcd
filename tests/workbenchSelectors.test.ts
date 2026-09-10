import test from 'node:test';
import assert from 'node:assert/strict';
import { INBOX_ID } from '../types.ts';
import { getInboxLinks, getNormalLinks } from '../services/workbenchSelectors.ts';

test('workbench separates the canonical inbox category from normal links', () => {
  const links = [
    { id: 'inbox', title: '待整理', url: 'https://inbox.test', categoryId: INBOX_ID, createdAt: 1 },
    { id: 'normal', title: '入口', url: 'https://normal.test', categoryId: 'common', createdAt: 1 },
    { id: 'deleted', title: '已删', url: 'https://deleted.test', categoryId: 'common', createdAt: 1, deletedAt: 2 },
  ];

  assert.deepEqual(getInboxLinks(links).map(link => link.id), ['inbox']);
  assert.deepEqual(getNormalLinks(links).map(link => link.id), ['normal']);
});
