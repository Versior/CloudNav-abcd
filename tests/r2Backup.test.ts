import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBundle, decideUpload, describeResult, R2_DAILY_COOLDOWN_MS } from '../services/r2BackupService.ts';

test('manual mode uploads when content changed', () => {
  const decision = decideUpload({ mode: 'manual', lastUploadedAt: 0, localHash: 'a', remoteHash: 'b' });
  assert.deepEqual(decision, { allowed: true, reason: 'manual' });
});

test('unchanged content is skipped in both modes', () => {
  for (const mode of ['manual', 'daily'] as const) {
    const decision = decideUpload({ mode, lastUploadedAt: 0, localHash: 'same', remoteHash: 'same' });
    assert.deepEqual(decision, { allowed: false, reason: 'unchanged' });
  }
});

test('daily mode respects the 24h cooldown', () => {
  const now = 10 * R2_DAILY_COOLDOWN_MS;
  const decision = decideUpload({
    mode: 'daily',
    lastUploadedAt: now - R2_DAILY_COOLDOWN_MS / 2,
    localHash: 'new',
    remoteHash: 'old',
    now,
  });
  assert.deepEqual(decision, { allowed: false, reason: 'cooldown' });
});

test('daily mode uploads once the cooldown has elapsed', () => {
  const now = 10 * R2_DAILY_COOLDOWN_MS;
  const decision = decideUpload({
    mode: 'daily',
    lastUploadedAt: now - R2_DAILY_COOLDOWN_MS - 1,
    localHash: 'new',
    remoteHash: 'old',
    now,
  });
  assert.deepEqual(decision, { allowed: true, reason: 'manual' });
});

test('manual mode ignores the cooldown entirely', () => {
  const now = 10 * R2_DAILY_COOLDOWN_MS;
  const decision = decideUpload({
    mode: 'manual',
    lastUploadedAt: now - 1000,
    localHash: 'new',
    remoteHash: 'old',
    now,
  });
  assert.equal(decision.allowed, true);
});

test('bundle carries current and rollback generations with a stable hash', () => {
  const bundle = buildBundle({
    current: { hash: 'h2', createdAt: 2, data: { links: [] } },
    rollback: { hash: 'h1', createdAt: 1, data: { links: [] } },
  }, 1234);

  assert.equal(bundle.schemaVersion, 1);
  assert.equal(bundle.bundleHash, 'h2');
  assert.equal(bundle.updatedAt, 1234);
  assert.equal(bundle.rollback?.hash, 'h1');
});

test('an empty snapshot still produces a usable bundle', () => {
  const bundle = buildBundle({ current: null, rollback: null }, 1);
  assert.equal(bundle.bundleHash, 'empty');
  assert.equal(bundle.current, null);
});

test('result messages match the upload outcome', () => {
  assert.equal(describeResult({ allowed: true, reason: 'manual', uploaded: true, bundleHash: 'x' }, 'daily'), 'R2 每日备份已更新');
  assert.equal(describeResult({ allowed: true, reason: 'manual', uploaded: true, bundleHash: 'x' }, 'manual'), 'R2 备份已更新');
  assert.equal(describeResult({ allowed: false, reason: 'cooldown', uploaded: false, bundleHash: 'x' }, 'daily'), 'R2 仍在冷却期，本次未上传');
  assert.equal(describeResult({ allowed: false, reason: 'unchanged', uploaded: false, bundleHash: 'x' }, 'manual'), 'R2 内容未变化，无需上传');
});
