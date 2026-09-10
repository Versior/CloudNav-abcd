import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchIndex, searchIndexedLinks } from '../services/searchIndex.ts';

test('indexes aliases and searchable metadata', () => {
  const index = buildSearchIndex([{ id: '1', title: '设计工具', url: 'https://design.example', categoryId: 'design', createdAt: 1, aliases: ['画板'] }]);
  assert.deepEqual(searchIndexedLinks(index, '画板'), ['1']);
});

test('ranks healthy pinned links ahead of broken links for the same text match', () => {
  const index = buildSearchIndex([
    { id: 'broken', title: 'Docs', url: 'https://docs.example', categoryId: 'dev', createdAt: 1, health: { status: 'broken' } },
    { id: 'good', title: 'Docs', url: 'https://docs-good.example', categoryId: 'dev', createdAt: 2, pinned: true, health: { status: 'ok' } },
  ]);
  assert.deepEqual(searchIndexedLinks(index, 'docs'), ['good', 'broken']);
});
