import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('production entry bundle stays below the first-load budget', () => {
  const distRoot = path.join(projectRoot, 'dist');
  const indexPath = path.join(distRoot, 'index.html');
  assert.ok(fs.existsSync(indexPath), 'run npm run build before the performance test');

  const html = fs.readFileSync(indexPath, 'utf8');
  const entryMatches = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"[^>]*>/g)];
  assert.ok(entryMatches.length > 0, 'production HTML should reference an entry script');

  const entryFiles = entryMatches.map(([, src]) => path.join(distRoot, src.replaceAll('/', path.sep)));
  const entryBytes = entryFiles.reduce((total, file) => total + fs.statSync(file).size, 0);

  assert.ok(
    entryBytes < 1_000_000,
    `initial JavaScript is ${entryBytes} bytes; keep it below the 1 MB first-load budget`,
  );
});
