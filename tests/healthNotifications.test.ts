import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_HEALTH_NOTIFICATION, getHealthNotificationEvent, normalizeHealthNotification } from '../services/healthNotifications.ts';

test('normalizes notification settings and rejects invalid webhook URLs', () => {
  assert.deepEqual(normalizeHealthNotification({ enabled: true, webhookUrl: 'not-a-url' }), DEFAULT_HEALTH_NOTIFICATION);
  assert.deepEqual(normalizeHealthNotification({ enabled: true, webhookUrl: 'https://hooks.example.test/cloudnav', onlyNewBroken: false }), {
    enabled: true,
    webhookUrl: 'https://hooks.example.test/cloudnav',
    onlyNewBroken: false,
  });
});

test('notifies when new broken links appear or broken count increases', () => {
  assert.equal(getHealthNotificationEvent({ checked: 2, ok: 2, broken: 0, soft: 0, redirected: 0 }, { checked: 2, ok: 1, broken: 1, soft: 0, redirected: 0 })?.reason, 'new_broken');
  assert.equal(getHealthNotificationEvent({ checked: 2, ok: 1, broken: 1, soft: 0, redirected: 0 }, { checked: 2, ok: 1, broken: 1, soft: 0, redirected: 0 }), null);
});

test('notifies when broken links recover', () => {
  assert.equal(getHealthNotificationEvent({ checked: 2, ok: 0, broken: 2, soft: 0, redirected: 0 }, { checked: 2, ok: 2, broken: 0, soft: 0, redirected: 0 })?.reason, 'recovered');
});
