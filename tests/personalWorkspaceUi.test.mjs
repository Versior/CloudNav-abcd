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

test('reading workspace v2 removes the horizontal source rail and exposes a focused reader', () => {
  const page = read('components/ReadingWorkspacePage.tsx');
  const css = read('styles/cloudnav-redesign.css');
  assert.match(page, /data-layout-version=["']reading-workspace-v2["']/);
  assert.match(page, /data-reading-region=["']queue["']/);
  assert.match(page, /data-reading-region=["']reader["']/);
  assert.match(page, /打开来源|来源/);
  assert.match(page, /沉浸阅读|显示队列/);
  assert.match(css, /cloudnav-reading-grid-v2/);
  assert.match(css, /cloudnav-reading-source-popover/);
  assert.match(page, /showCapture/);
  assert.match(page, /cloudnav-reading-capture-toggle/);
  assert.match(css, /cloudnav-reading-search-v2 \{ flex: 0 1 380px/);
  assert.doesNotMatch(page, /cloudnav-reading-source-rail/);
});

test('desktop RSS, inbox, and reading surfaces expose selectable source controls', () => {
  const rss = read('components/RssReaderPage.tsx');
  const inbox = read('components/InboxPage.tsx');
  const reader = read('components/ReadingWorkspacePage.tsx');
  for (const page of [rss, inbox]) {
    assert.match(page, /buildRssSourceSummary/);
    assert.match(page, /data-[^>]*sources/);
    assert.match(page, /sourceFilter/);
  }
  assert.match(reader, /buildRssSourceSummary/);
  assert.match(reader, /cloudnav-reading-source-trigger/);
  assert.match(reader, /cloudnav-reading-source-popover/);
  assert.match(reader, /sourceFilter/);
});
