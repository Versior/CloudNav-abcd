import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeBootstrapData } from '../services/appBootstrap.ts';

const link = (overrides: Record<string, unknown> = {}) => ({
  id: 'same',
  title: 'Link',
  url: 'https://example.test',
  categoryId: 'common',
  createdAt: 1,
  ...overrides,
});

test('bootstrap merge keeps local data when remote payload is unavailable', () => {
  const local = { links: [link({ id: 'local', title: 'Local' })], categories: [] };
  const merged = mergeBootstrapData(local, null);

  assert.equal(merged.links[0].id, 'local');
});

test('bootstrap merge prefers remote content but preserves local visit metadata', () => {
  const local = { links: [link({ title: 'Old', url: 'https://old.test', visitCount: 4, lastVisitedAt: 20 })], categories: [] };
  const remote = { links: [link({ title: 'New', url: 'https://new.test', visitCount: 1 })], categories: [] };
  const merged = mergeBootstrapData(local, remote);

  assert.equal(merged.links[0].title, 'New');
  assert.equal(merged.links[0].visitCount, 4);
  assert.equal(merged.links[0].lastVisitedAt, 20);
});

test('bootstrap snapshot keeps legacy categories that do not have an icon', async () => {
  const previous = globalThis.localStorage;
  const values = new Map([[
    'cloudnav_data_cache',
    JSON.stringify({ links: [link()], categories: [{ id: 'legacy', name: '旧分类' }] }),
  ]]);
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) || null,
      setItem: () => undefined,
    },
  });

  const { readBootstrapSnapshot } = await import('../services/appBootstrap.ts');
  const snapshot = readBootstrapSnapshot();
  assert.equal(snapshot.categories[0].id, 'legacy');
  assert.equal(snapshot.categories[0].icon, 'Folder');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: previous });
});
