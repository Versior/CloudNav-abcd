import test from 'node:test';
import assert from 'node:assert/strict';
import { coalescePendingMutations, createPendingMutationId, takeNextMutation } from '../services/offlineQueue.ts';

const mutation = (id: string, createdAt: number) => ({ id, createdAt, links: [{ id }], categories: [], baseVersion: createdAt });

test('coalesces offline mutations into the latest snapshot', () => {
  const result = coalescePendingMutations([mutation('a', 1), mutation('b', 2)], mutation('c', 3));
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'c');
});

test('takes the oldest queued mutation and leaves newer mutations queued', () => {
  const [next, rest] = takeNextMutation([mutation('new', 2), mutation('old', 1)]);
  assert.equal(next?.id, 'old');
  assert.deepEqual(rest.map(item => item.id), ['new']);
});

test('creates a unique id for every offline mutation', () => {
  const first = createPendingMutationId();
  const second = createPendingMutationId();
  assert.notEqual(first, second);
  assert.match(first, /^mutation-/);
});
