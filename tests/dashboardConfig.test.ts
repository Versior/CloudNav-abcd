import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_DASHBOARD_CONFIG, normalizeDashboardConfig } from '../services/dashboardConfig.ts';

test('normalizes dashboard widgets, removes duplicates, and appends missing widgets', () => {
  assert.deepEqual(
    normalizeDashboardConfig({ order: ['activity', 'activity', 'unknown'], hidden: ['folders', 'unknown'] }),
    { order: ['activity', 'stats', 'folders', 'tools'], hidden: ['folders'] },
  );
});

test('falls back to the default dashboard when the stored value is invalid', () => {
  assert.deepEqual(normalizeDashboardConfig(null), DEFAULT_DASHBOARD_CONFIG);
  assert.deepEqual(normalizeDashboardConfig({ order: [] }), DEFAULT_DASHBOARD_CONFIG);
});
