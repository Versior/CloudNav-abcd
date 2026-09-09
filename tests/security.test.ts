import test from 'node:test';
import assert from 'node:assert/strict';
import { isPrivateHostname, resolveRedirectTarget } from '../functions/_shared/urlSafety.ts';

test('blocks private, loopback, link-local, reserved, and IPv6 hosts', () => {
  for (const host of [
    'localhost',
    '127.0.0.1',
    '127.0.0.1.',
    '10.10.10.10',
    '172.16.0.1',
    '192.168.1.20',
    '169.254.169.254',
    '100.64.0.1',
    '198.18.0.1',
    '[::1]',
  ]) {
    assert.equal(isPrivateHostname(host), true, host);
  }
});

test('allows ordinary public hostnames', () => {
  assert.equal(isPrivateHostname('example.com'), false);
  assert.equal(isPrivateHostname('nav.006680.xyz'), false);
});

test('rejects redirects into private hosts', () => {
  assert.throws(
    () => resolveRedirectTarget('https://example.com/start', 'http://127.0.0.1/admin'),
    /private/i,
  );
});

test('resolves safe relative redirects', () => {
  assert.equal(
    resolveRedirectTarget('https://example.com/start', '/next').toString(),
    'https://example.com/next',
  );
});
