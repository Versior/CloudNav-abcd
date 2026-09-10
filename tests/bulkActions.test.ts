import test from 'node:test';
import assert from 'node:assert/strict';
import { applyBulkAction } from '../services/bulkActions.ts';

test('applies a category and tag update only to selected links', () => {
  const links = [
    { id: '1', title: 'A', url: 'https://a.test', categoryId: 'old', tags: ['one'] },
    { id: '2', title: 'B', url: 'https://b.test', categoryId: 'old', tags: [] },
  ];
  assert.deepEqual(
    applyBulkAction(links, ['1'], { type: 'move', categoryId: 'new' }).map(link => ({ id: link.id, categoryId: link.categoryId })),
    [{ id: '1', categoryId: 'new' }, { id: '2', categoryId: 'old' }],
  );
  assert.deepEqual(applyBulkAction(links, ['1', '2'], { type: 'addTags', tags: ['one', 'two'] }).map(link => link.tags), [['one', 'two'], ['one', 'two']]);
});

test('supports pinning, archiving, and removing tags in one deterministic helper', () => {
  const link = { id: '1', title: 'A', url: 'https://a.test', categoryId: 'old', tags: ['one', 'two'] };
  assert.equal((applyBulkAction([link], ['1'], { type: 'setPinned', pinned: true })[0] as typeof link & { pinned?: boolean }).pinned, true);
  assert.equal((applyBulkAction([link], ['1'], { type: 'archive' })[0] as typeof link & { status?: string }).status, 'archived');
  assert.deepEqual(applyBulkAction([link], ['1'], { type: 'removeTags', tags: ['one'] })[0].tags, ['two']);
});
