import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('desktop personal information workspace exposes capture, inspiration, reading queue and GitHub surfaces', () => {
  const app = read('App.tsx');
  const inspiration = read('components/InspirationPage.tsx');
  const later = read('components/ReadLaterPage.tsx');
  const github = read('components/GithubPage.tsx');
  const githubService = read('services/githubService.ts');
  const rss = read('components/RssReaderPage.tsx');
  const library = read('components/DesktopLibraryPage.tsx');
  const reader = read('components/ReadingWorkspacePage.tsx');
  assert.match(app, /activeView.*inspiration.*read-later.*github/);
  assert.match(app, /data-quick-capture-trigger/);
  assert.match(app, /onClick=\{openInspirationView\}/);
  assert.match(inspiration, /data-page=["']inspiration/);
  assert.match(inspiration, /AI 整理/);
  assert.match(later, /data-page=["']read-later/);
  assert.match(github, /data-page=["']github/);
  assert.match(githubService, /\/api\/github\?owner=/);
  assert.match(rss, /稍后阅读/);
  assert.match(rss, /记入灵感/);
  assert.match(library, /加入稍后阅读/);
  assert.match(app, /unifiedSearchResults/);
  assert.match(app, /data-unified-search-results/);
  assert.match(app, /ReadingWorkspacePage/);
  assert.match(app, /initialId=\{unifiedSearchTarget\?\.kind === ['"]reading['"]/);
  assert.match(reader, /data-page=["']reading-workspace/);
  assert.match(reader, /initialId\?: string/);
  assert.match(reader, /保存高亮/);
  assert.match(reader, /导出/);
});

test('workspace pages use a flat desktop three-column reading surface instead of embedded frames', () => {
  const css = read('index.css');
  const page = read('components/InspirationPage.tsx');
  assert.match(css, /\.cloudnav-inspiration-layout\s*\{/);
  assert.match(css, /grid-template-columns:\s*190px\s+minmax\(360px, 1fr\)\s+minmax\(320px, \.86fr\)/);
  assert.doesNotMatch(page, /iframe/);
});
