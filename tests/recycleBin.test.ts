import test from 'node:test';
import assert from 'node:assert/strict';
import { filterActiveLinks, filterDeletedLinks, purgeExpiredLinks, restoreLinks, softDeleteLinks } from '../services/recycleBin.ts';

const links = [
  { id: 'a', title: 'A', deletedAt: undefined },
  { id: 'b', title: 'B', deletedAt: 100 },
  { id: 'c', title: 'C', deletedAt: 200 },
];

test('soft deletes selected links without removing their records', () => {
  const result = softDeleteLinks(links, ['a'], 300);
  assert.equal(result.find(link => link.id === 'a')?.deletedAt, 300);
  assert.equal(result.length, links.length);
});

test('restores selected links and separates active/deleted views', () => {
  const restored = restoreLinks(links, ['b']);
  assert.equal(restored.find(link => link.id === 'b')?.deletedAt, undefined);
  assert.deepEqual(filterActiveLinks(restored).map(link => link.id), ['a', 'b']);
  assert.deepEqual(filterDeletedLinks(restored).map(link => link.id), ['c']);
});

test('purges only deleted links older than the retention cutoff', () => {
  assert.deepEqual(purgeExpiredLinks(links, 250, 100).map(link => link.id), ['a', 'c']);
});
