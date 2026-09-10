import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('home dashboard does not render the obsolete broken-link alert', () => {
  const source = readFileSync(new URL('../components/HomeDashboard.tsx', import.meta.url), 'utf8');
  assert.equal(source.includes('可批量检测无法访问的网站并清理'), false);
  assert.equal(source.includes('onOpenHealthCheck'), false);
});

test('workbench is a separate view and desktop library remains the default view', () => {
  const source = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  assert.match(source, /useState<[^>]*['"]links['"][^>]*>\(['"]links['"]\)/);
  assert.match(source, /工作台/);
  assert.match(source, /activeView === ['"]workbench['"]/);
  assert.match(source, /activeView === ['"]links['"]|<DesktopLibraryPage/);
  assert.match(source, /pinnedLinks/);
  assert.match(source, /readLocalData|readLocalCache/);
});

test('desktop library view replaces the old all-links grid with a directory and row list', () => {
  const source = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../components/DesktopLibraryPage.tsx', import.meta.url), 'utf8');
  assert.match(source, /<DesktopLibraryPage/);
  assert.match(page, /data-layout=["']desktop-library["']/);
  assert.match(page, /data-library-view=["']rows["']/);
  assert.doesNotMatch(page, /grid-cols-/);
});

test('desktop library opens an external link only once', () => {
  const page = readFileSync(new URL('../components/DesktopLibraryPage.tsx', import.meta.url), 'utf8');
  assert.match(page, /onClick=\{\(\) => onOpen\(link\)\}/);
  assert.doesNotMatch(page, /target=["']_blank["'][^>]*onClick/);
});

test('unified search keeps the exact result id for deep-link routing', () => {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  assert.match(app, /setUnifiedSearchTarget\(result\)/);
  assert.doesNotMatch(app, /if \(value\.trim\(\)\) setActiveView\(['"]links['"]\)/);
});

test('workbench uses the canonical inbox id', () => {
  const dashboard = readFileSync(new URL('../components/HomeDashboard.tsx', import.meta.url), 'utf8');
  assert.match(dashboard, /getNormalLinks/);
  assert.match(dashboard, /getInboxLinks/);
  assert.doesNotMatch(dashboard, /categoryId !== ['"]inbox['"]/);
});

test('workbench supports persisted module visibility and ordering', () => {
  const dashboard = readFileSync(new URL('../components/HomeDashboard.tsx', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  const storage = readFileSync(new URL('../functions/api/storage.ts', import.meta.url), 'utf8');
  assert.match(dashboard, /toggleWidget/);
  assert.match(dashboard, /config\.hidden/);
  assert.match(dashboard, /moveDashboardWidget/);
  assert.match(app, /DASHBOARD_CONFIG_KEY/);
  assert.match(app, /saveConfig: ['"]dashboard['"]/);
  assert.match(storage, /getConfig === ['"]dashboard['"]/);
  assert.match(storage, /saveConfig === ['"]dashboard['"]/);
});

test('workbench uses a desktop command surface with explicit content zones', () => {
  const source = readFileSync(new URL('../components/HomeDashboard.tsx', import.meta.url), 'utf8');
  const weather = readFileSync(new URL('../components/TopWeather.tsx', import.meta.url), 'utf8');
  assert.match(source, /data-dashboard-layout=["']command-center["']/);
  for (const zone of ['activity', 'folders', 'ai']) {
    assert.match(source, new RegExp(`data-dashboard-zone=["']${zone}["']`));
  }
  assert.match(weather, /data-top-weather/);
  assert.match(source, /data-workbench-layout=["']desktop-command-surface["']/);
});

test('workbench uses the shared inbox id for its counts and filters', () => {
  const page = readFileSync(new URL('../components/HomeDashboard.tsx', import.meta.url), 'utf8');
  assert.match(page, /INBOX_ID/);
  assert.doesNotMatch(page, /categoryId === ['"]inbox['"]/);
  assert.doesNotMatch(page, /categoryId !== ['"]inbox['"]/);
});

test('workbench and pinned websites share the same navigation chrome', () => {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /lg:w-\[82px\]/);
  assert.doesNotMatch(app, /lg:bg-\[#1b2a55\]/);
  assert.doesNotMatch(app, /isWorkbenchView \? 'lg:hidden'/);
});

test('RSS reader is a first-class view with safe discovery and daily feeds', () => {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  const reader = readFileSync(new URL('../components/RssReaderPage.tsx', import.meta.url), 'utf8');
  const articleReader = readFileSync(new URL('../components/RssArticleReader.tsx', import.meta.url), 'utf8');
  const api = readFileSync(new URL('../functions/api/rss.ts', import.meta.url), 'utf8');
  const service = readFileSync(new URL('../services/rssService.ts', import.meta.url), 'utf8');
  assert.match(app, /['"]rss['"]/);
  assert.match(app, /RSS资讯|资讯订阅/);
  assert.match(app, /RssPage|RssReaderPage/);
  assert.match(reader, /正在等待资讯|没有符合条件的文章/);
  assert.match(reader, /OPML/);
  assert.match(reader, /自动发现/);
  assert.match(reader, /RssArticleReader/);
  assert.match(articleReader, /明确事实/);
  assert.match(articleReader, /原文依据/);
  assert.match(service, /cdn\.jsdelivr\.net\/gh\/Hyraze\/trending-collection@main\/api\/daily\/all\.json/);
  assert.match(service, /qbitai\.com/);
  assert.match(service, /jiqizhixin\.xml|geekpark\.net\/rss|ithome\.com\/rss/);
  assert.doesNotMatch(service, /36kr\.com\/feed|rsshub\.app\/juejin\/trending/);
  assert.doesNotMatch(service, /hnrss\.org|github\.blog\/feed/);
  assert.match(api, /assertSafeExternalUrl/);
  assert.match(api, /fetchWithSafeRedirects/);
});

test('health settings expose scheduled scanning and recent run history', () => {
  const panel = readFileSync(new URL('../components/HealthSchedulePanel.tsx', import.meta.url), 'utf8');
  const storage = readFileSync(new URL('../functions/api/storage.ts', import.meta.url), 'utf8');
  assert.match(panel, /定时健康检测/);
  assert.match(panel, /healthSchedule/);
  assert.match(panel, /healthRuns/);
  assert.match(storage, /getConfig === ['"]healthSchedule['"]/);
  assert.match(storage, /getConfig === ['"]healthRuns['"]/);
});

test('backup center exposes versioned history restore', () => {
  const panel = readFileSync(new URL('../components/HistoryPanel.tsx', import.meta.url), 'utf8');
  const backup = readFileSync(new URL('../components/BackupModal.tsx', import.meta.url), 'utf8');
  const storage = readFileSync(new URL('../functions/api/storage.ts', import.meta.url), 'utf8');
  assert.match(panel, /restoreHistory/);
  assert.match(backup, /HistoryPanel/);
  assert.match(storage, /getConfig === ['"]history['"]/);
  assert.match(storage, /body\.restoreHistory/);
});

test('backup export uses versioned envelope and remains sensitive-data safe', () => {
  const backup = readFileSync(new URL('../components/BackupModal.tsx', import.meta.url), 'utf8');
  const webdav = readFileSync(new URL('../services/webDavService.ts', import.meta.url), 'utf8');
  assert.match(backup, /createBackupEnvelope/);
  assert.match(webdav, /createBackupEnvelope/);
  assert.match(webdav, /sanitizeBackupData/);
});

test('search supports recent queries and health/status operators', () => {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  const search = readFileSync(new URL('../services/searchService.tsx', import.meta.url), 'utf8');
  assert.match(app, /最近搜索/);
  assert.match(app, /SEARCH_HISTORY_KEY/);
  assert.match(search, /health:/);
  assert.match(search, /status:/);
});

test('PWA cache is versioned and never caches API or authentication responses', () => {
  const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(sw, /CACHE_NAME/);
  assert.match(sw, /\/api\//);
  assert.doesNotMatch(sw, /registration\.unregister/);
  assert.match(html, /serviceWorker\.register/);
});

test('recycle bin is a separate settings surface and deletion is soft', () => {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  const settings = readFileSync(new URL('../components/SettingsModal.tsx', import.meta.url), 'utf8');
  const panel = readFileSync(new URL('../components/RecycleBinPanel.tsx', import.meta.url), 'utf8');
  assert.match(settings, /回收站/);
  assert.match(panel, /恢复/);
  assert.match(panel, /永久删除/);
  assert.match(app, /softDeleteLinks/);
});

test('sync conflict uses a three-way merge base and offline queue', () => {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  assert.match(app, /mergeThreeWay/);
  assert.match(app, /cloudBaseRef/);
  assert.match(app, /enqueuePendingMutation/);
  assert.match(app, /flushPendingSync/);
});

test('health settings and cron worker include webhook notification delivery', () => {
  const panel = readFileSync(new URL('../components/HealthSchedulePanel.tsx', import.meta.url), 'utf8');
  const worker = readFileSync(new URL('../workers/health-cron.ts', import.meta.url), 'utf8');
  const storage = readFileSync(new URL('../functions/api/storage.ts', import.meta.url), 'utf8');
  assert.match(panel, /Webhook/);
  assert.match(worker, /getHealthNotificationEvent/);
  assert.match(storage, /healthNotification/);
});

test('product expansion includes mobile navigation, install prompt, search index, and workbench tools', () => {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  const vite = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
  const nav = readFileSync(new URL('../components/MobileBottomNav.tsx', import.meta.url), 'utf8');
  const prompt = readFileSync(new URL('../components/InstallPrompt.tsx', import.meta.url), 'utf8');
  const dashboard = readFileSync(new URL('../components/HomeDashboard.tsx', import.meta.url), 'utf8');
  assert.match(vite, /manualChunks/);
  assert.match(app, /MobileBottomNav/);
  assert.match(app, /InstallPrompt/);
  assert.match(nav, /快速添加/);
  assert.match(prompt, /beforeinstallprompt/);
  assert.match(dashboard, /WorkbenchTools/);
});

test('product expansion adds login rate limiting and recovery snapshots', () => {
  const auth = readFileSync(new URL('../functions/api/auth.ts', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  const backup = readFileSync(new URL('../components/BackupModal.tsx', import.meta.url), 'utf8');
  assert.match(auth, /rate/i);
  assert.match(app, /createRecoverySnapshot/);
  assert.match(backup, /本地恢复/);
});

test('App uses one spatial transition wrapper for the three main views', () => {
  const source = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  assert.match(source, /SpatialViewTransition/);
  assert.match(source, /viewKey=\{activeView\}/);
  assert.equal((source.match(/<SpatialViewTransition/g) || []).length, 1);
});

test('motion styles include reduced-motion fallback', () => {
  const source = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
  assert.match(source, /prefers-reduced-motion/);
  assert.match(source, /cloudnav-spatial-forward/);
});

test('details drawer exposes a trigger-aware spatial origin', () => {
  const drawer = readFileSync(new URL('../components/LinkDetailsDrawer.tsx', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  assert.match(drawer, /origin\?/);
  assert.match(drawer, /getDetailsOriginClass/);
  assert.match(app, /detailsOrigin/);
});

test('primary surfaces expose stable spatial identities', () => {
  const dashboard = readFileSync(new URL('../components/HomeDashboard.tsx', import.meta.url), 'utf8');
  const rss = readFileSync(new URL('../components/RssReaderPage.tsx', import.meta.url), 'utf8');
  const mobile = readFileSync(new URL('../components/MobileBottomNav.tsx', import.meta.url), 'utf8');
  assert.match(dashboard, /data-spatial-id/);
  assert.match(rss, /rss-article-/);
  assert.match(mobile, /mobile-nav-/);
});

test('mobile details drawer uses a bottom-sheet spatial exit path', () => {
  const drawer = readFileSync(new URL('../components/LinkDetailsDrawer.tsx', import.meta.url), 'utf8');
  assert.match(drawer, /translate-y-full/);
  assert.match(drawer, /bottom-0/);
  assert.match(drawer, /rounded-t/);
});

test('desktop shell has a visible continuity frame beyond motion-only changes', () => {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
  assert.match(app, /cloudnav-desktop-sidebar/);
  assert.match(app, /cloudnav-desktop-frame/);
  assert.match(css, /\.cloudnav-desktop-frame/);
  assert.match(css, /\.cloudnav-desktop-active/);
});

test('desktop pages avoid redundant shell banners and editorial header chrome', () => {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  const library = readFileSync(new URL('../components/DesktopLibraryPage.tsx', import.meta.url), 'utf8');
  const reader = readFileSync(new URL('../components/RssReaderPage.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /cloudnav-desktop-context/);
  assert.doesNotMatch(library, /DESKTOP LIBRARY/);
  assert.match(reader, /READING DESK/);
  assert.doesNotMatch(reader, /cloudnav-rss-metrics/);
});

test('app uses cache-first bootstrap without a full-screen remote loading gate', () => {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  const bootstrap = readFileSync(new URL('../hooks/useAppBootstrap.ts', import.meta.url), 'utf8');
  assert.match(app, /useAppBootstrap/);
  assert.match(bootstrap, /readBootstrapSnapshot/);
  assert.doesNotMatch(app, /isCheckingAuth && \(/);
});

test('application shell is split into focused desktop components', () => {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  const shell = readFileSync(new URL('../components/AppShell.tsx', import.meta.url), 'utf8');
  assert.match(app, /AppShell/);
  assert.match(shell, /DesktopSidebar/);
  assert.match(shell, /TopCommandBar/);
  assert.match(shell, /PageContainer/);
});

test('desktop library owns the pinned-only default boundary', () => {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../components/PinnedSitesPage.tsx', import.meta.url), 'utf8');
  const empty = readFileSync(new URL('../components/PinnedSitesEmptyState.tsx', import.meta.url), 'utf8');
  const card = readFileSync(new URL('../components/PinnedSiteCard.tsx', import.meta.url), 'utf8');
  assert.match(app, /<DesktopLibraryPage/);
  assert.match(page, /data-pinned-only/);
  assert.match(card, /cloudnav-pinned-site-card/);
  assert.match(empty, /添加置顶入口/);
  assert.match(empty, /前往分类目录/);
});

test('workbench has an explicit page boundary without duplicating the shell', () => {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../components/WorkbenchPage.tsx', import.meta.url), 'utf8');
  assert.match(app, /<WorkbenchPage/);
  assert.match(page, /data-page=["']workbench["']/);
  assert.match(page, /data-dashboard-layout=["']command-center["']/);
  assert.doesNotMatch(page, /DesktopSidebar|TopCommandBar/);
});

test('RSS page is split into source, list, reader, and state regions', () => {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../components/RssPage.tsx', import.meta.url), 'utf8');
  for (const file of ['RssSourceRail.tsx', 'RssArticleList.tsx', 'RssArticleReader.tsx', 'RssStateView.tsx']) {
    const source = readFileSync(new URL(`../components/${file}`, import.meta.url), 'utf8');
    assert.match(source, /data-rss-region/);
  }
  assert.match(app, /<RssPage/);
  assert.match(page, /data-page=["']rss["']/);
  assert.match(page, /RssReaderPage/);
});

test('full rebuild keeps the application entry focused on orchestration boundaries', () => {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  const shell = readFileSync(new URL('../components/AppShell.tsx', import.meta.url), 'utf8');
  const pages = [
    readFileSync(new URL('../components/PinnedSitesPage.tsx', import.meta.url), 'utf8'),
    readFileSync(new URL('../components/WorkbenchPage.tsx', import.meta.url), 'utf8'),
    readFileSync(new URL('../components/RssPage.tsx', import.meta.url), 'utf8'),
  ].join('\n');

  assert.match(app, /AppShell/);
  assert.match(app, /DesktopLibraryPage/);
  assert.match(app, /WorkbenchPage/);
  assert.match(app, /const RssPage = React\.lazy/);
  assert.match(shell, /DesktopSidebar/);
  assert.match(shell, /TopCommandBar/);
  assert.match(shell, /PageContainer/);
  assert.match(pages, /data-page=/);
  assert.doesNotMatch(pages, /\bfetch\s*\(/);
});

test('desktop command-desk skin is a visible visual system, not a wrapper-only refactor', () => {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

  assert.match(app, /cloudnav-command-desk/);
  assert.match(css, /cloudnav-command-desk/);
  assert.match(css, /cloudnav-command-desk.*cloudnav-desktop-sidebar/s);
  assert.match(css, /--cloud-sidebar:\s*#222a2f/);
  assert.match(css, /--cloud-accent:\s*#2f6b67/);
  assert.match(css, /command-desk-nav-item/);
});

test('local development serves the RSS API instead of falling through to the SPA shell', () => {
  const vite = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');

  assert.match(vite, /local-rss-api/);
  assert.match(vite, /\/api\/rss/);
  assert.match(vite, /onRequestGet/);
});

test('Vite local API imports use explicit TypeScript extensions for production config loading', () => {
  const vite = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
  const packageJson = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
  for (const endpoint of ['rss', 'weather', 'github', 'content']) {
    assert.match(vite, new RegExp(`\\./functions/api/${endpoint}\\.ts`));
  }
  assert.match(vite, /fileURLToPath\(import\.meta\.url\)/);
  assert.match(packageJson, /vite build --configLoader runner/);
});
