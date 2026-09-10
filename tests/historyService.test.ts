import test from 'node:test';
import assert from 'node:assert/strict';
import { appendHistory, createHistorySnapshot, getStaleHistoryKeys, normalizeHistory } from '../services/historyService.ts';

test('creates a versioned snapshot summary without leaking credentials', () => {
  const snapshot = createHistorySnapshot({ version: 3, createdAt: 100, links: [{ id: '1' }, { id: '2' }], categories: [{ id: 'common' }] });
  assert.deepEqual(snapshot, { id: 'v3-100', version: 3, createdAt: 100, linkCount: 2, categoryCount: 1 });
});

test('normalizes and caps history entries at the newest 30 versions', () => {
  const entries = Array.from({ length: 32 }, (_, index) => ({ id: `v${index}`, version: index, createdAt: index, linkCount: index, categoryCount: 1 }));
  const normalized = normalizeHistory(entries);
  assert.equal(normalized.length, 30);
  assert.equal(normalized[0].version, 31);
  assert.equal(appendHistory(normalized, { id: 'v99', version: 99, createdAt: 99, linkCount: 1, categoryCount: 1 })[0].version, 99);
});

test('identifies orphaned cloud history keys without deleting retained versions', () => {
  const retained = [
    { id: 'v8-800', version: 8, createdAt: 800, linkCount: 1, categoryCount: 1 },
    { id: 'v7-700', version: 7, createdAt: 700, linkCount: 1, categoryCount: 1 },
  ];
  const keys = [
    'app_history:v8-800',
    'app_history:v7-700',
    'app_history:v6-600',
    'unrelated:key',
  ];

  assert.deepEqual(getStaleHistoryKeys(keys, retained), ['app_history:v6-600']);
});
