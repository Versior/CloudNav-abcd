import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_HEALTH_SCHEDULE,
  getNextHealthRun,
  normalizeHealthSchedule,
  summarizeHealthRun,
} from '../services/healthSchedule.ts';
import { mergeHealthUpdates } from '../workers/health-cron.ts';

test('normalizes health schedule values and clamps the scan size', () => {
  assert.deepEqual(
    normalizeHealthSchedule({ enabled: true, frequency: 'invalid', scope: 'category', categoryId: 42, maxLinksPerRun: 9999 }),
    { ...DEFAULT_HEALTH_SCHEDULE, enabled: true, scope: 'category', maxLinksPerRun: 500 },
  );
});

test('calculates the next scheduled health run from the last run timestamp', () => {
  const now = Date.UTC(2026, 8, 9, 8, 0, 0);
  const config = normalizeHealthSchedule({ enabled: true, frequency: 'daily', lastRunAt: now - 60 * 60 * 1000 });
  assert.equal(getNextHealthRun(config, now), now + 23 * 60 * 60 * 1000);
  assert.equal(getNextHealthRun({ ...config, enabled: false }, now), null);
});

test('summarizes only checked link health results', () => {
  assert.deepEqual(
    summarizeHealthRun([
      { health: { status: 'ok', checkedAt: 10 } },
      { health: { status: 'broken', statusCode: 404, checkedAt: 10 } },
      { health: { status: 'unknown', statusCode: 429, checkedAt: 10 } },
      { health: { status: 'redirected', checkedAt: 10 } },
      {},
    ]),
    { checked: 4, ok: 1, broken: 1, soft: 1, redirected: 1 },
  );
});

test('health cron merges only probe fields into the latest link snapshot', () => {
  const latest = [{ id: 'a', title: '用户新标题', url: 'https://example.test/a', updatedAt: 20 }, { id: 'b', title: '保留', url: 'https://example.test/b' }];
  const scanned = [{ id: 'a', health: { status: 'ok', statusCode: 200, checkedAt: 99 }, title: '旧标题' }];
  assert.deepEqual(mergeHealthUpdates(latest, scanned, 100), [
    { id: 'a', title: '用户新标题', url: 'https://example.test/a', updatedAt: 100, health: { status: 'ok', statusCode: 200, checkedAt: 99 } },
    { id: 'b', title: '保留', url: 'https://example.test/b' },
  ]);
});
