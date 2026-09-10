import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

test('every JSX button surface has an explicit click or submit path', () => {
  const componentDir = fileURLToPath(new URL('../components/', import.meta.url));
  const files = [
    fileURLToPath(new URL('../App.tsx', import.meta.url)),
    ...readdirSync(componentDir)
      .filter(name => name.endsWith('.tsx'))
      .map(name => join(componentDir, name)),
  ];

  const report = [];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const buttons = (source.match(/<button\b/g) || []).length;
    if (!buttons) continue;
    const actionPaths = (source.match(/onClick=|onSubmit=|type="submit"/g) || []).length;
    assert.ok(actionPaths >= buttons, file + ' has ' + buttons + ' buttons but only ' + actionPaths + ' action paths');
    report.push(file.split(/[\\/]/).pop() + ':' + buttons);
  }
  assert.ok(report.length > 0);
});
