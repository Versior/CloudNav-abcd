import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('home dashboard does not render the obsolete broken-link alert', () => {
  const source = readFileSync(new URL('../components/HomeDashboard.tsx', import.meta.url), 'utf8');
  assert.equal(source.includes('可批量检测无法访问的网站并清理'), false);
  assert.equal(source.includes('onOpenHealthCheck'), false);
});
