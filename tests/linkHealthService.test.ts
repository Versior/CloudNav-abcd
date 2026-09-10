import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchWithRetry } from '../services/linkHealthService.ts';
import { mergeDuplicateMetadata } from '../services/duplicateService.ts';

test('retries transient health requests and returns the first successful response', async () => {
  let attempts = 0;
  const result = await fetchWithRetry(async () => {
    attempts += 1;
    if (attempts < 3) throw new Error('temporary');
    return 'ok';
  }, 2, 0);
  assert.equal(result, 'ok');
  assert.equal(attempts, 3);
});

test('merges useful duplicate metadata without overwriting the keeper', () => {
  const result = mergeDuplicateMetadata(
    { id: 'keep', title: 'Keep', url: 'https://example.com', categoryId: 'common', createdAt: 1, tags: ['a'], description: '' },
    { id: 'dup', title: 'Duplicate', url: 'https://example.com', categoryId: 'common', createdAt: 2, tags: ['b'], description: '补充说明', note: '补充笔记' },
  );
  assert.deepEqual(result.tags, ['a', 'b']);
  assert.equal(result.description, '补充说明');
  assert.equal(result.note, '补充笔记');
});
