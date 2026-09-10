import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('desktop link library is a true work surface, not the old tag grid', () => {
  const page = read('components/DesktopLibraryPage.tsx');
  const app = read('App.tsx');
  assert.match(page, /data-layout=["']desktop-library["']/);
  assert.match(page, /data-library-view=["']rows["']/);
  assert.doesNotMatch(page, /grid-cols-/);
  assert.doesNotMatch(page, /cloudnav-library-directory-nav/);
  assert.match(page, /cloudnav-library-results/);
  assert.doesNotMatch(page, /<a href=\{link\.url\}[^>]*onClick=\{\(\) => onOpen\(link\)\}/);
  assert.match(page, /aria-label=\{`打开 \$\{link\.title\}`\}/);
  assert.match(app, /<DesktopLibraryPage/);
});

test('RSS reader exposes a desktop reading layout and AI summary affordances', () => {
  const page = read('components/RssReaderPage.tsx');
  const rssPage = read('components/RssPage.tsx');
  assert.match(page, /data-rss-layout=["']focus-flow["']/);
  assert.match(page, /data-layout-version=["']reader-v5["']/);
  assert.match(page, /data-rss-ai-summary/);
  assert.match(page, /summarizeRssArticle/);
  assert.match(page, /startEditFeed/);
  assert.match(page, /保存修改/);
  assert.match(page, /cloudnav-rss-source-edit/);
  assert.match(page, /cloudnav-rss-source-subtitle/);
  assert.match(page, /data-rss-editor/);
  assert.match(rssPage, /aiConfig/);
});

test('RSS reader uses independent source and article drawers instead of a fixed three-column frame', () => {
  const css = read('index.css');
  assert.match(css, /cloudnav-rss-source-drawer-backdrop/);
  assert.match(css, /cloudnav-rss-reader-sheet-backdrop/);
  assert.match(css, /cloudnav-rss-reader-sheet \{ left: auto; right: 0/);
  assert.match(css, /cloudnav-rss-v5-stream/);
});

test('RSS reader v3 is a flat desktop reading canvas with visible feed controls', () => {
  const css = read('index.css');
  assert.match(css, /RSS reader v3/);
  assert.match(css, /grid-template-columns: 238px minmax\(360px, \.82fr\) minmax\(500px, 1\.18fr\)/);
  assert.match(css, /overflow: visible/);
  assert.match(css, /cloudnav-rss-source-item:hover \.cloudnav-rss-source-edit/);
  assert.match(css, /cloudnav-rss-source-edit,\n\s+\.cloudnav-command-v2 \.cloudnav-rss-source-remove/);
});

test('RSS reader v5 uses a dominant reading stream with collapsible sources and a hidden detail panel', () => {
  const page = read('components/RssReaderPage.tsx');
  const css = read('index.css');
  assert.match(page, /data-layout-version=["']reader-v5["']/);
  assert.match(page, /data-rss-region=["']article-stream["']/);
  assert.match(page, /isReaderOpen/);
  assert.match(page, /setIsReaderOpen\(true\)/);
  assert.match(page, /data-rss-toggle=["']reader["']/);
  assert.match(page, /data-rss-toggle=["']sources["']/);
  assert.match(css, /RSS reader v5/);
  assert.match(css, /cloudnav-rss-source-drawer/);
  assert.match(css, /cloudnav-rss-reader-sheet/);
});

test('RSS reader v5 is a single-flow desktop stream with independent drawers', () => {
  const page = read('components/RssReaderPage.tsx');
  const css = read('index.css');
  assert.match(page, /data-rss-layout=["']focus-flow["']/);
  assert.match(page, /data-layout-version=["']reader-v5["']/);
  assert.match(page, /data-rss-region=["']article-stream["']/);
  assert.match(page, /data-rss-region=["']source-drawer["']/);
  assert.match(page, /data-rss-region=["']reader-sheet["']/);
  assert.match(page, /role=["']dialog["']/);
  assert.match(page, /isSourceRailOpen, setIsSourceRailOpen\] = useState\(false\)/);
  assert.doesNotMatch(page, /cloudnav-rss-columns/);
  assert.match(css, /RSS reader v5/);
  assert.match(css, /cloudnav-rss-reader-v5/);
  assert.match(css, /cloudnav-rss-source-drawer/);
  assert.match(css, /cloudnav-rss-reader-sheet/);
  assert.match(css, /position: fixed/);
});

test('workbench is a desktop-first command surface without entry-card grids', () => {
  const page = read('components/HomeDashboard.tsx');
  assert.match(page, /data-workbench-layout=["']desktop-command-surface["']/);
  assert.match(page, /今日 AI 简报/);
  assert.doesNotMatch(page, /grid-cols-/);
});

test('desktop shell uses the restrained graphite and teal palette', () => {
  const css = read('index.css');
  const html = read('index.html');
  assert.match(css, /--cloud-sidebar:\s*#222a2f/);
  assert.match(css, /--cloud-accent:\s*#2f6b67/);
  assert.match(css, /cloudnav-command-desk \[class~="bg-blue-600"\]/);
  assert.match(css, /Readability pass/);
  assert.match(html, /theme-color" content="#2f6b67"/);
});

test('desktop pages expose the command-v2 layout contract', () => {
  const app = read('App.tsx');
  const library = read('components/DesktopLibraryPage.tsx');
  const workbench = read('components/HomeDashboard.tsx');
  const rss = read('components/RssReaderPage.tsx');
  const css = read('index.css');
  assert.match(app, /data-command-v2=["']true["']/);
  assert.match(library, /data-layout-version=["']workspace-v2["']/);
  assert.match(workbench, /data-layout-version=["']workbench-v2["']/);
  assert.match(rss, /data-layout-version=["']reader-v5["']/);
  assert.match(css, /command-v2/);
});

test('cloudnav redesign loads a single desktop visual system after legacy styles', () => {
  const entry = read('index.tsx');
  const app = read('App.tsx');
  const css = read('styles/cloudnav-redesign.css');
  assert.match(entry, /import ['"]\.\/styles\/cloudnav-redesign\.css['"]/);
  assert.match(app, /data-redesign-skin=["']cloudnav-redesign["']/);
  assert.match(css, /--cn-bg:/);
  assert.match(css, /--cn-ink:/);
  assert.match(css, /--cn-primary:/);
  assert.match(css, /--cn-line:/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test('cloudnav redesign keeps readable desktop regions for every product surface', () => {
  const css = read('styles/cloudnav-redesign.css');
  for (const selector of [
    '.cloudnav-command-desk',
    '.cloudnav-desktop-sidebar',
    '.cloudnav-desktop-header',
    '.cloudnav-workbench',
    '.cloudnav-library-page',
    '.cloudnav-rss-reader',
    '[data-page="inspiration"]',
    '[data-page="read-later"]',
    '[data-page="github"]',
    '[data-page="inbox"]',
    '[data-page="reading-workspace"]',
  ]) assert.match(css, new RegExp(selector.replace(/[.[\]"=]/g, '\\$&')));
  assert.doesNotMatch(css, /backdrop-filter\s*:/);
  assert.doesNotMatch(css, /linear-gradient\s*\(/);
});

test('layout-v3 removes nested page frames and preserves readable desktop gutters', () => {
  const css = read('index.css');
  assert.match(css, /Layout-v3 cleanup/);
  assert.match(css, /cloudnav-workbench-page/);
  assert.match(css, /padding: 40px 56px 88px/);
  assert.match(css, /cloudnav-workbench-side > \* \{/);
});

test('layout-v4 keeps the active desktop navigation state flat and single-color', () => {
  const css = read('index.css');
  assert.match(css, /Layout-v4 cleanup/);
  assert.match(css, /background: #2f6b67 !important/);
  assert.match(css, /box-shadow: none !important/);
});

test('layout-v5 gives the workbench a persistent floating todo surface', () => {
  const dashboard = read('components/HomeDashboard.tsx');
  const todo = read('components/FloatingTodo.tsx');
  const css = read('index.css');
  assert.match(dashboard, /FloatingTodo/);
  assert.match(todo, /data-todo-surface=["']floating["']/);
  assert.match(css, /cloudnav-floating-todo/);
});

test('workbench removes the retired quick note and markdown modules', () => {
  const dashboard = read('components/HomeDashboard.tsx');
  const tools = read('components/WorkbenchTools.tsx');
  assert.doesNotMatch(dashboard, /快捷笔记/);
  assert.doesNotMatch(tools, /快捷笔记|Markdown 模块/);
  assert.match(dashboard, /顶部天气/);
});

test('weather lives in the global top bar and refreshes automatically on entry', () => {
  const app = read('App.tsx');
  const weather = read('components/TopWeather.tsx');
  const dashboard = read('components/HomeDashboard.tsx');
  assert.match(app, /TopWeather/);
  assert.match(weather, /cloudnav-top-weather/);
  assert.match(weather, /api\/weather\?auto=1/);
  assert.match(weather, /setInterval/);
  assert.doesNotMatch(dashboard, /<WorkbenchTools/);
});

test('weather failures use a readable product message instead of leaking fetch errors', () => {
  const weather = read('components/TopWeather.tsx');
  assert.match(weather, /天气服务暂时不可用/);
  assert.doesNotMatch(weather, /setError\(reason instanceof Error \? reason\.message/);
});

test('layout-v6 raises desktop text contrast and scale', () => {
  const css = read('index.css');
  assert.match(css, /Layout-v6 readability/);
  assert.match(css, /font-size: 15px/);
  assert.match(css, /color: #183234 !important/);
  assert.match(css, /font-size: \.92rem/);
  assert.match(css, /RSS hierarchy/);
  assert.match(css, /cloudnav-rss-source-item\.is-error/);
});

test('website rows expose quick move controls and the page uses a website-specific AI summary', () => {
  const page = read('components/DesktopLibraryPage.tsx');
  const app = read('App.tsx');
  const prompts = read('services/aiPrompts.ts');
  assert.match(page, /summarizeWebsiteCollection/);
  assert.match(page, /移到最前/);
  assert.match(page, /清除搜索后排序/);
  assert.match(app, /handleQuickMoveLink/);
  assert.match(prompts, /适合人群/);
  assert.match(prompts, /不要把推测写成事实/);
});
