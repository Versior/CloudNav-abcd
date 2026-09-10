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

test('desktop reading workspace keeps the reader visible while the queue and article scroll independently', () => {
  const page = read('components/ReadingWorkspacePage.tsx');
  const redesign = read('styles/cloudnav-redesign.css');
  assert.match(page, /className="cloudnav-reading-reader"[^>]*onScroll=\{handleReaderScroll\}/);
  assert.doesNotMatch(page, /className="cloudnav-reader-body"[^>]*onScroll=/);
  assert.match(redesign, /\[data-page="reading-workspace"\][\s\S]*?height: calc\(100vh - 172px\) !important;/);
  assert.match(redesign, /\.cloudnav-reading-grid \{[\s\S]*?min-height: 0 !important;[\s\S]*?overflow: hidden !important;/);
  assert.match(redesign, /\.cloudnav-reading-reader \{[\s\S]*?height: 100% !important;[\s\S]*?overflow-y: auto !important;/);
});

test('desktop RSS, inbox, and reading surfaces expose the same selectable source rail', () => {
  const rss = read('components/RssReaderPage.tsx');
  const inbox = read('components/InboxPage.tsx');
  const reader = read('components/ReadingWorkspacePage.tsx');
  for (const page of [rss, inbox, reader]) {
    assert.match(page, /buildRssSourceSummary/);
    assert.match(page, /data-[^>]*sources/);
    assert.match(page, /sourceFilter/);
  }
});
