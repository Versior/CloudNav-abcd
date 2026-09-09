import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('shared UI states expose accessible loading, empty, and error semantics', () => {
  const loading = read('components/LoadingState.tsx');
  const empty = read('components/EmptyState.tsx');
  const error = read('components/ErrorState.tsx');
  const chip = read('components/StatusChip.tsx');

  assert.match(loading, /data-ui-state=["']loading["']/);
  assert.match(loading, /role=["']status["']/);
  assert.match(loading, /aria-live=["']polite["']/);
  assert.match(empty, /data-ui-state=["']empty["']/);
  assert.match(empty, /role=["']status["']/);
  assert.match(error, /data-ui-state=["']error["']/);
  assert.match(error, /role=["']alert["']/);
  assert.match(error, /onRetry/);
  assert.match(chip, /data-status-chip/);
});

test('RSS state view composes shared states instead of keeping a parallel visual language', () => {
  const rssState = read('components/RssStateView.tsx');
  const drawer = read('components/LinkDetailsDrawer.tsx');

  assert.match(rssState, /LoadingState/);
  assert.match(rssState, /EmptyState/);
  assert.match(rssState, /ErrorState/);
  assert.match(drawer, /StatusChip/);
});
