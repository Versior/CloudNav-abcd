import test from 'node:test';
import assert from 'node:assert/strict';
import { appendRecoverySnapshot, createRecoverySnapshot, normalizeRecoverySnapshots } from '../services/recoverySnapshots.ts';
import { getLoginRateLimitDecision } from '../services/authSecurity.ts';

test('keeps the newest five local recovery snapshots', () => {
  const first = createRecoverySnapshot({ links: [], categories: [] }, 100);
  const result = appendRecoverySnapshot(Array.from({ length: 5 }, (_, index) => ({ ...first, id: `old-${index}`, createdAt: index })), first, 5);
  assert.equal(result.length, 5);
  assert.equal(result[0].id, first.id);
});

test('normalizes invalid recovery metadata', () => {
  assert.deepEqual(normalizeRecoverySnapshots([{ id: 'ok', createdAt: 10, links: [], categories: [] }, null, { id: 4 }]), [{ id: 'ok', createdAt: 10, links: [], categories: [], linkCount: 0, categoryCount: 0 }]);
});

test('blocks login attempts after the configured threshold within the window', () => {
  assert.deepEqual(getLoginRateLimitDecision(4, 1000, 5, 300000), { allowed: true, remaining: 0 });
  assert.equal(getLoginRateLimitDecision(5, 1000, 5, 300000).allowed, false);
  assert.equal(getLoginRateLimitDecision(5, 301001, 5, 300000).allowed, true);
});
