import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStoredData, isVersionConflict, normalizeStoredData } from '../functions/_shared/storageData.ts';

test('normalizes legacy app data without a version', () => {
  assert.deepEqual(
    normalizeStoredData({ links: [{ id: '1' }], categories: [{ id: 'common' }] }),
    { links: [{ id: '1' }], categories: [{ id: 'common' }], version: 0 },
  );
});

test('builds a bounded versioned payload', () => {
  assert.deepEqual(
    buildStoredData({ links: [{ id: '1' }], categories: [{ id: 'common' }], baseVersion: 4 }, 5),
    { links: [{ id: '1' }], categories: [{ id: 'common' }], version: 5 },
  );
});

test('detects stale writes only when a client supplied a version', () => {
  assert.equal(isVersionConflict(undefined, 3), false);
  assert.equal(isVersionConflict(3, 3), false);
  assert.equal(isVersionConflict(2, 3), true);
});
