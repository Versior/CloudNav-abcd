# CloudNav 全面重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with checkpoints. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 CloudNav 重构为桌面优先、三页面统一壳层、缓存优先加载的个人信息工作台，同时保持现有用户数据和功能兼容。

**Architecture:** 先建立 `AppShell`、页面状态和启动数据边界，再逐个迁移置顶网站、工作台和 RSS 页面。`App.tsx` 只保留应用级编排和兼容桥接；视图组件通过明确 props 接收数据，service 负责 API、缓存和归一化。

**Tech Stack:** React 19、TypeScript、Vite、Tailwind CSS 4、lucide-react、Node test runner、Cloudflare Pages/Functions。

## Global Constraints

- 置顶网站是默认首页，只显示置顶/常用入口，不显示全部链接网格。
- 工作台、置顶网站和 RSS 使用同一套应用壳层和导航。
- 保留现有 `localStorage` key、Cloudflare KV 字段、备份格式、认证、WebDAV、回收站和健康检测。
- 首屏先显示本地快照，远程配置和云端数据必须后台并行补水，单个请求失败不能阻塞首页。
- 默认 RSS 只保留中文 AI、GitHub、科技和产品订阅，不新增英文默认订阅。
- 桌面端优先，至少验证 1024px、1440px、1920px 三种宽度；移动端保留响应式布局。
- 不引入新的状态管理库，不复制第三方项目代码或视觉资产。
- 所有新增 UI 必须支持键盘焦点、可读对比度和 `prefers-reduced-motion`。
- 每个任务必须先写失败测试，再写实现；每个独立任务完成后单独提交。

---

### Task 1: 建立页面状态与启动数据边界

**Files:**
- Create: `services/appBootstrap.ts`
- Create: `hooks/useAppBootstrap.ts`
- Modify: `types.ts`
- Modify: `App.tsx:190-540`
- Test: `tests/appBootstrap.test.ts`
- Test: `tests/ui.test.mjs`

**Interfaces:**
- `services/appBootstrap.ts` produces `AppBootstrapSnapshot`, `readBootstrapSnapshot`, `writeBootstrapSnapshot`, and `mergeBootstrapData`.
- `hooks/useAppBootstrap.ts` produces `useAppBootstrap(): { snapshot: AppBootstrapSnapshot; status: 'local' | 'hydrating' | 'ready' | 'error'; error: string | null; refresh: () => Promise<void> }`.
- `App.tsx` consumes the hook and keeps existing callbacks for write operations until later tasks migrate them.

- [ ] **Step 1: Write the failing tests**

Add `tests/appBootstrap.test.ts` with these concrete cases:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeBootstrapData } from '../services/appBootstrap.ts';

test('bootstrap merge keeps local data when remote payload is unavailable', () => {
  const local = { links: [{ id: 'local', title: 'Local', url: 'https://local.test', categoryId: 'common' }], categories: [] };
  const merged = mergeBootstrapData(local, null);
  assert.equal(merged.links[0].id, 'local');
});

test('bootstrap merge prefers remote content but preserves local visit metadata', () => {
  const local = { links: [{ id: 'same', title: 'Old', url: 'https://old.test', categoryId: 'common', visitCount: 4, lastVisitedAt: 20 }], categories: [] };
  const remote = { links: [{ id: 'same', title: 'New', url: 'https://new.test', categoryId: 'common', visitCount: 1 }], categories: [] };
  const merged = mergeBootstrapData(local, remote);
  assert.equal(merged.links[0].title, 'New');
  assert.equal(merged.links[0].visitCount, 4);
  assert.equal(merged.links[0].lastVisitedAt, 20);
});
```

Extend `tests/ui.test.mjs` with a static boundary check that `App.tsx` imports `useAppBootstrap` and does not render a full-screen loading gate for ordinary cloud request failures.

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `node --experimental-strip-types --test tests/appBootstrap.test.ts tests/ui.test.mjs`

Expected: FAIL because `services/appBootstrap.ts` and `hooks/useAppBootstrap.ts` do not exist.

- [ ] **Step 3: Add the normalized snapshot types**

In `types.ts`, add:

```ts
export interface AppBootstrapSnapshot {
  links: LinkItem[];
  categories: Category[];
  dashboardConfig: DashboardConfig;
  workbenchTools: WorkbenchToolsState;
}

export type AppBootstrapStatus = 'local' | 'hydrating' | 'ready' | 'error';
```

Import `WorkbenchToolsState` as a type from `services/workbenchTools.ts` without creating a runtime cycle.

- [ ] **Step 4: Implement the merge and local snapshot helpers**

Create `services/appBootstrap.ts` with these exact behaviors:

1. `readBootstrapSnapshot()` reads `cloudnav_data_cache`, `DASHBOARD_CONFIG_KEY`, and `WORKBENCH_TOOLS_KEY` inside independent `try/catch` blocks.
2. Invalid values fall back to existing `INITIAL_LINKS`, `DEFAULT_CATEGORIES`, `DEFAULT_DASHBOARD_CONFIG`, and `normalizeWorkbenchTools(null)`.
3. `mergeBootstrapData(local, remote)` returns local data when `remote` is null and merges remote links with `mergeLocalVisitState` semantics for `visitCount` and `lastVisitedAt`.
4. `writeBootstrapSnapshot(snapshot)` writes only the existing keys and never writes credentials.

- [ ] **Step 5: Implement `useAppBootstrap` without blocking the first render**

The hook must return the local snapshot synchronously, set status to `hydrating` in an effect, run the existing storage/config requests with `Promise.all`, and update only the relevant slice when a request succeeds. A rejected config request sets `error` but leaves the local snapshot rendered.

- [ ] **Step 6: Replace the duplicate initial-read path in `App.tsx`**

Use the hook for initial links/categories/dashboard/tools values. Keep existing write callbacks unchanged in this task. Delete only the duplicate reads that are now unreachable; do not delete authentication or RSS initialization.

- [ ] **Step 7: Run tests and typecheck**

Run: `node --experimental-strip-types --test tests/appBootstrap.test.ts tests/ui.test.mjs`

Expected: PASS.

Run: `npm.cmd run typecheck`

Expected: exit code 0.

- [ ] **Step 8: Commit**

```powershell
git add services/appBootstrap.ts hooks/useAppBootstrap.ts types.ts App.tsx tests/appBootstrap.test.ts tests/ui.test.mjs
git commit -m "refactor: add cache-first application bootstrap"
```

---

### Task 2: Extract the unified desktop and mobile shell

**Files:**
- Create: `components/AppShell.tsx`
- Create: `components/DesktopSidebar.tsx`
- Create: `components/TopCommandBar.tsx`
- Create: `components/PageContainer.tsx`
- Modify: `App.tsx:2318-2965`
- Modify: `index.css`
- Test: `tests/ui.test.mjs`

**Interfaces:**
- `AppShellProps` accepts `activeView`, `selectedCategory`, `siteSettings`, `categories`, `authToken`, `isOnline`, and navigation/action callbacks.
- `DesktopSidebar` owns only navigation/category display and emits `onViewChange`, `onCategoryChange`, `onOpenSettings`, `onOpenImport`, and `onOpenBackup`.
- `TopCommandBar` owns search controls and emits `onSearchChange`, `onSearchSubmit`, `onToggleTheme`, and `onAdd`.
- `PageContainer` accepts `{ children, title, eyebrow, status, actions }` and provides the desktop max-width and scroll contract.

- [ ] **Step 1: Write the failing shell tests**

Extend `tests/ui.test.mjs`:

```js
test('application shell is split into focused desktop components', () => {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  const shell = readFileSync(new URL('../components/AppShell.tsx', import.meta.url), 'utf8');
  assert.match(app, /AppShell/);
  assert.match(shell, /DesktopSidebar/);
  assert.match(shell, /TopCommandBar/);
  assert.match(shell, /PageContainer/);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --test tests/ui.test.mjs`

Expected: FAIL because the new shell files do not exist.

- [ ] **Step 3: Move the sidebar markup into `DesktopSidebar.tsx`**

Move the current logo, primary navigation, categories, hover submenu, footer actions, sync state, and GitHub link without changing callback behavior. Preserve the existing `activeView === 'links'`, `activeView === 'workbench'`, and `activeView === 'rss'` semantics.

- [ ] **Step 4: Move the header markup into `TopCommandBar.tsx`**

Move the current search mode switcher, search source popup, search history popup, view mode switcher, theme toggle, login/logout, and add button. Preserve all existing labels and keyboard shortcuts. Keep the external search behavior in `App.tsx` until the view controllers are extracted.

- [ ] **Step 5: Add `PageContainer` and `AppShell`**

`PageContainer` must render one `main` scroll surface with `cloudnav-page-container`, `max-w-[1600px]`, responsive padding, and a stable title/status row. `AppShell` composes the sidebar, top bar, page container, modal slot, and mobile navigation.

- [ ] **Step 6: Replace the old shell in `App.tsx`**

Replace only the moved JSX with `<AppShell ...>{view}</AppShell>`. Keep modals and data callbacks in `App.tsx` until later tasks. Do not change the default view or link rendering in this task.

- [ ] **Step 7: Add shell visual tokens and accessibility checks**

In `index.css`, define `cloudnav-shell`, `cloudnav-sidebar`, `cloudnav-topbar`, `cloudnav-page-container`, and `.dark` variants. Keep all buttons keyboard-focusable and add `aria-current="page"` to the active primary navigation item.

- [ ] **Step 8: Run tests, typecheck, and build**

Run: `node --test tests/ui.test.mjs`; `npm.cmd run typecheck`; `npm.cmd run build`.

Expected: all pass and the build completes with only the existing chunk-size warning.

- [ ] **Step 9: Commit**

```powershell
git add components/AppShell.tsx components/DesktopSidebar.tsx components/TopCommandBar.tsx components/PageContainer.tsx App.tsx index.css tests/ui.test.mjs
git commit -m "refactor: extract unified application shell"
```

---

### Task 3: Split the pinned websites page

**Files:**
- Create: `components/PinnedSitesPage.tsx`
- Create: `components/PinnedSiteCard.tsx`
- Create: `components/PinnedSitesEmptyState.tsx`
- Modify: `App.tsx:2990-3370`
- Modify: `tests/ui.test.mjs`

**Interfaces:**
- `PinnedSitesPageProps` accepts `links`, `categories`, `selectedCategory`, `searchQuery`, `cardStyle`, `isSortingPinned`, `isBatchEditMode`, `selectedLinks`, and the existing edit/delete/sort callbacks.
- `PinnedSiteCard` accepts `{ link, cardStyle, isSelected, isBatchEditMode, onOpen, onEdit, onToggleSelected }`.
- `PinnedSitesPage` renders only pinned/quick links when the page is in its default state; category/search results remain accessible through explicit filters.

- [ ] **Step 1: Write the failing pinned-page tests**

Add assertions that `PinnedSitesPage.tsx` contains `pinned`, `置顶 / 常用`, and does not contain a path that renders `displayedLinks` as the default all-links grid. Add a regression test that `App.tsx` renders `<PinnedSitesPage` when `activeView === 'links'`.

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test tests/ui.test.mjs`

Expected: FAIL because `PinnedSitesPage.tsx` does not exist.

- [ ] **Step 3: Move pinned header and card rendering**

Move the current pinned area, sorting controls, `renderLinkCard` path, batch selection controls, and the explicit category/search results into the new page. Keep all existing action callback names and do not change `LinkItem` shape.

- [ ] **Step 4: Create a focused card component**

Extract the visual card and interaction states into `PinnedSiteCard`. Use the existing `Icon`, `ExternalLink`, edit, delete, pin, and batch-selection affordances. Add `aria-label` for icon-only actions and visible focus rings.

- [ ] **Step 5: Add explicit empty states**

Create `PinnedSitesEmptyState` with two buttons: `添加置顶入口` and `前往分类目录`. The default empty state must not mention broken links or show a generic all-links grid.

- [ ] **Step 6: Replace the inline page in `App.tsx`**

Render `PinnedSitesPage` inside the existing `SpatialViewTransition`. The `links` view remains the initial state and preserves the current selected-category/search behavior.

- [ ] **Step 7: Run focused tests and browser smoke test**

Run: `node --test tests/ui.test.mjs`; `npm.cmd run typecheck`.

In the local browser at `http://127.0.0.1:5173/`, verify:

1. Refresh opens置顶网站.
2. Only pinned/quick links are visible in the default page.
3. Search and category navigation still reveal non-pinned results.
4. Add, edit, sort, batch select, and open actions still work.

- [ ] **Step 8: Commit**

```powershell
git add components/PinnedSitesPage.tsx components/PinnedSiteCard.tsx components/PinnedSitesEmptyState.tsx App.tsx tests/ui.test.mjs
git commit -m "refactor: isolate pinned websites page"
```

---

### Task 4: Rename and isolate the workbench page

**Files:**
- Create: `components/WorkbenchPage.tsx`
- Modify: `components/HomeDashboard.tsx`
- Modify: `App.tsx`
- Modify: `tests/ui.test.mjs`

**Interfaces:**
- `WorkbenchPageProps` keeps the current `HomeDashboardProps` contract and adds `pageStatus?: 'ready' | 'hydrating' | 'offline'`.
- `WorkbenchPage` owns workbench composition; `HomeDashboard` becomes either a compatibility export or a private dashboard widget renderer, not a second page shell.

- [ ] **Step 1: Write the failing workbench boundary test**

Assert that `App.tsx` renders `<WorkbenchPage` for `activeView === 'workbench'`, and that the workbench source still contains the six explicit zones: `hero`, `metrics`, `folders`, `recent`, `focus`, and `tools`.

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test tests/ui.test.mjs`

Expected: FAIL because `WorkbenchPage.tsx` does not exist.

- [ ] **Step 3: Extract `HomeDashboard` into `WorkbenchPage`**

Move the page-level section and keep existing widget configuration, `moveDashboardWidget`, `WorkbenchTools`, quick entry filtering, and callbacks. Preserve `data-dashboard-layout="command-center"` and all widget IDs so persisted configurations remain compatible.

- [ ] **Step 4: Keep compatibility without duplicate UI**

Export `HomeDashboard` as a thin alias only if other imports require it. It must not render a second shell, header, or navigation. `App.tsx` uses `WorkbenchPage` directly.

- [ ] **Step 5: Add loading and offline status slots**

Use the `pageStatus` prop to show a compact status chip in the hero, never a full-screen loading blocker. Local tools remain editable while cloud data hydrates.

- [ ] **Step 6: Run tests, typecheck, and performance test**

Run: `node --test tests/ui.test.mjs tests/workbenchTools.test.ts`; `npm.cmd run typecheck`; `npm.cmd run test:performance`.

- [ ] **Step 7: Commit**

```powershell
git add components/WorkbenchPage.tsx components/HomeDashboard.tsx App.tsx tests/ui.test.mjs
git commit -m "refactor: isolate workbench page"
```

---

### Task 5: Rebuild the RSS page around source, feed, and reader states

**Files:**
- Create: `components/RssPage.tsx`
- Create: `components/RssSourceRail.tsx`
- Create: `components/RssArticleList.tsx`
- Create: `components/RssArticleReader.tsx`
- Create: `components/RssStateView.tsx`
- Modify: `components/RssReaderPage.tsx`
- Modify: `services/rssService.ts`
- Modify: `types.ts`
- Test: `tests/rssPage.test.ts`
- Modify: `tests/rssService.test.ts`
- Modify: `tests/ui.test.mjs`

**Interfaces:**
- `RssPageProps` accepts `onSaveArticle` and optional `initialArticleId`.
- `RssSourceRailProps` accepts `{ feeds, selectedFeedId, articles, onSelectFeed, onRefresh }`.
- `RssArticleListProps` accepts `{ articles, selectedArticleId, onSelect, onToggleRead, onToggleStar }`.
- `RssArticleReaderProps` accepts `{ article, onOpenExternal, onSave }`.
- `RssStateView` accepts `{ state: 'loading' | 'empty' | 'error' | 'offline'; title; description; action }`.

- [ ] **Step 1: Write failing RSS state and empty-content tests**

Create `tests/rssPage.test.ts` with pure helper tests for:

1. Feed status returns `empty` when a feed has no articles and no error.
2. Feed status returns `error` when `feed.error` exists.
3. Article selection prefers the first unread article, then the newest article.

Add static UI assertions for `RssSourceRail`, `RssArticleList`, `RssArticleReader`, `RssStateView`, and the Chinese-only preset labels.

- [ ] **Step 2: Run the tests and verify they fail**

Run: `node --experimental-strip-types --test tests/rssPage.test.ts tests/rssService.test.ts tests/ui.test.mjs`

Expected: FAIL because the page modules and helpers do not exist.

- [ ] **Step 3: Add pure RSS view-model helpers**

In `services/rssService.ts`, add:

```ts
export type RssFeedViewState = 'loading' | 'ready' | 'empty' | 'error' | 'offline';
export const getRssFeedViewState = (feed: RssFeed | undefined, articles: RssArticle[], online: boolean): RssFeedViewState => { /* deterministic state mapping */ };
export const chooseInitialRssArticle = (articles: RssArticle[]): RssArticle | undefined => { /* unread first, newest fallback */ };
```

Use existing normalized feed/article types and never treat malformed API content as a successful feed.

- [ ] **Step 4: Split the RSS UI into three focused regions**

Move current source controls and import/discovery actions into `RssSourceRail`. Move article filtering and row actions into `RssArticleList`. Move summary, metadata, save, read/star controls, and external open into `RssArticleReader`.

- [ ] **Step 5: Add explicit state views**

Render one of the five states instead of blank content. The `empty` state must explain that the source currently has no usable articles and offer `刷新来源`; the `error` state shows the source title and retry action; the `offline` state keeps cached articles readable.

- [ ] **Step 6: Preserve Chinese-only defaults**

Keep the current preset IDs and URLs unless a test demonstrates they are malformed. Do not add English defaults. Keep OPML import/export and automatic discovery available from the source rail.

- [ ] **Step 7: Replace the inline RSS page**

Render `<RssPage onSaveArticle={saveRssArticleToLinks} />` from `App.tsx`, retaining the lazy import and spatial transition.

- [ ] **Step 8: Run tests, typecheck, build, and RSS browser smoke test**

Run: `node --experimental-strip-types --test tests/rssPage.test.ts tests/rssService.test.ts tests/ui.test.mjs`; `npm.cmd run typecheck`; `npm.cmd run build`.

In the browser, open RSS and verify loading, empty feed, failed feed, retry, article selection, save-to-links, OPML, and source discovery states.

- [ ] **Step 9: Commit**

```powershell
git add components/RssPage.tsx components/RssSourceRail.tsx components/RssArticleList.tsx components/RssArticleReader.tsx components/RssStateView.tsx components/RssReaderPage.tsx services/rssService.ts types.ts tests/rssPage.test.ts tests/rssService.test.ts tests/ui.test.mjs App.tsx
git commit -m "refactor: rebuild RSS reading surface"
```

---

### Task 6: Centralize common UI states, motion, and accessibility

**Files:**
- Create: `components/LoadingState.tsx`
- Create: `components/EmptyState.tsx`
- Create: `components/ErrorState.tsx`
- Create: `components/StatusChip.tsx`
- Modify: `components/LinkDetailsDrawer.tsx`
- Modify: `components/SpatialViewTransition.tsx`
- Modify: `index.css`
- Test: `tests/uiStates.test.ts`
- Modify: `tests/ui.test.mjs`

**Interfaces:**
- `LoadingStateProps`: `{ label: string; compact?: boolean }`.
- `EmptyStateProps`: `{ title: string; description: string; action?: React.ReactNode; icon?: React.ReactNode }`.
- `ErrorStateProps`: `{ title: string; description: string; onRetry?: () => void }`.
- `StatusChipProps`: `{ tone: 'neutral' | 'success' | 'warning' | 'danger'; children: React.ReactNode }`.

- [ ] **Step 1: Write failing state component tests**

Assert that all state components expose text labels, retry buttons use `type="button"`, and `SpatialViewTransition` retains reduced-motion support.

- [ ] **Step 2: Verify the tests fail**

Run: `node --experimental-strip-types --test tests/uiStates.test.ts tests/ui.test.mjs`

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement the four small components**

Use existing Tailwind tokens, no new dependency, and keep minimum interactive target size at 44px for buttons. Apply `aria-live="polite"` to loading/error status text where appropriate.

- [ ] **Step 4: Replace duplicated inline states**

Update page components and `LinkDetailsDrawer` to use the shared state components. Keep existing copy where it is already correct; change only duplicate markup and inconsistent loading/error presentation.

- [ ] **Step 5: Add motion/accessibility regression checks**

Verify `prefers-reduced-motion`, visible focus rings, `aria-current`, `aria-label` for icon-only actions, and no hover-only primary actions.

- [ ] **Step 6: Run tests and commit**

Run: `node --experimental-strip-types --test tests/uiStates.test.ts tests/ui.test.mjs`; `npm.cmd run typecheck`.

```powershell
git add components/LoadingState.tsx components/EmptyState.tsx components/ErrorState.tsx components/StatusChip.tsx components/LinkDetailsDrawer.tsx components/SpatialViewTransition.tsx index.css tests/uiStates.test.ts tests/ui.test.mjs
git commit -m "refactor: unify UI states and accessibility feedback"
```

---

### Task 7: Remove migration leftovers and verify the full product

**Files:**
- Modify: `App.tsx`
- Modify: `components/HomeDashboard.tsx`
- Modify: `components/RssReaderPage.tsx`
- Modify: `vite.config.ts` only if bundle inspection proves a real split is missing
- Modify: `tests/performance.test.mjs`
- Modify: `tests/ui.test.mjs`
- Create: `tests/e2e-smoke.mjs` only if the existing browser smoke path cannot cover the three views

- [ ] **Step 1: Write the migration cleanup test**

Assert that `App.tsx` imports the page components and does not contain the old inline page markers for pinned cards, workbench zones, or RSS article loops. Assert that no page component imports `fetch` directly for app bootstrap data.

- [ ] **Step 2: Verify the test fails**

Run: `node --test tests/ui.test.mjs`

Expected: FAIL until the migration leftovers are removed.

- [ ] **Step 3: Delete only unreachable duplicate markup**

Remove old inline render branches after the new page components are live. Keep compatibility exports only when `rg` confirms another file imports them. Do not delete existing service functions or data keys.

- [ ] **Step 4: Confirm code splitting and first-load budget**

Run: `npm.cmd run build`; inspect `dist/assets` and keep `RssPage`, settings, backups, import, and QR code modules out of the initial entry when Vite can split them without changing behavior.

- [ ] **Step 5: Run the full verification suite**

Run in order:

```powershell
git diff --check
npm.cmd run typecheck
npm.cmd test
npm.cmd run test:performance
npm.cmd run build
```

Expected: all tests pass, performance test passes, typecheck succeeds, and production build succeeds.

- [ ] **Step 6: Run browser acceptance checks**

At `http://127.0.0.1:5173/` verify:

1. Default refresh lands on置顶网站.
2. Desktop 1024px, 1440px and 1920px layouts share one shell.
3. Workbench and RSS switch without full-page loading blockers.
4. Local cached links appear before cloud hydration completes.
5. RSS empty/error/offline states are explicit.
6. Dark mode, keyboard focus, mobile bottom navigation, and reduced motion still work.

- [ ] **Step 7: Commit the cleanup**

```powershell
git add App.tsx components/HomeDashboard.tsx components/RssReaderPage.tsx vite.config.ts tests/performance.test.mjs tests/ui.test.mjs tests/e2e-smoke.mjs
git commit -m "refactor: finish CloudNav product rebuild"
```

## Self-review checklist

- Spec requirement coverage: Tasks 1–2 cover cache-first loading and unified shell; Task 3 covers pinned-only default view; Task 4 covers workbench isolation; Task 5 covers RSS states and Chinese defaults; Task 6 covers shared states and motion; Task 7 covers cleanup and acceptance.
- Data compatibility: Task 1 preserves existing storage keys and merges visit metadata; Tasks 3–5 retain existing callbacks and normalized types.
- Performance: Task 1 removes blocking bootstrap behavior; Task 5 keeps RSS lazy; Task 7 verifies bundle budget.
- Scope: No new backend service or state-management dependency is introduced; the work stays within the current React/Vite/Cloudflare architecture.
- Placeholder scan: no unfinished marker or unspecified implementation step remains in this plan.
