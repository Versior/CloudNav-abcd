import test from 'node:test';
import assert from 'node:assert/strict';
import { moveItem } from '../services/linkOrdering.ts';

const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];

test('quick move can place a website at the top, up, down, or bottom', () => {
  assert.deepEqual(moveItem(items, 'c', 'top').map(item => item.id), ['c', 'a', 'b', 'd']);
  assert.deepEqual(moveItem(items, 'c', 'up').map(item => item.id), ['a', 'c', 'b', 'd']);
  assert.deepEqual(moveItem(items, 'b', 'down').map(item => item.id), ['a', 'c', 'b', 'd']);
  assert.deepEqual(moveItem(items, 'b', 'bottom').map(item => item.id), ['a', 'c', 'd', 'b']);
});

test('quick move is immutable and ignores an unknown website', () => {
  const original = items.map(item => ({ ...item }));
  const moved = moveItem(items, 'missing', 'top');
  assert.deepEqual(moved, original);
  assert.deepEqual(items.map(item => item.id), ['a', 'b', 'c', 'd']);
  assert.notStrictEqual(moved, items);
});
