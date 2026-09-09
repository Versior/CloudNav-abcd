# CloudNav Spatial Continuity Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with verification checkpoints.

**Goal:** 将 CloudNav 的工作台、置顶网站、RSS、详情抽屉和移动导航统一到一套以“空间连续”为核心的页面过渡与微交互系统中。

**Architecture:** 保留现有 React/Vite/Tailwind 架构，不引入动画依赖。新增一个小型 motion token 模块和一个负责视图切换方向、共享页面容器的 `SpatialViewTransition` 组件；详情抽屉直接扩展现有 `LinkDetailsDrawer` 的触发源方向能力。现有业务组件继续持有自己的数据和事件逻辑，只接入统一壳层和 CSS 状态类。

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS v4, CSS transitions/keyframes, Node built-in test runner.

## Global Constraints

- 主方向固定为“空间连续”，不复用整页淡入、卡片上浮、弹跳和持续漂浮作为全站默认效果。
- 保留现有蓝白视觉基调和现有业务功能，不修改链接、RSS、健康检测、备份、同步数据模型。
- 不引入新的动画框架；优先使用 `transform`、`opacity` 和 `filter`，禁止动画中修改布局尺寸。
- 初次加载不播放整页入场动画；首屏优先显示结构和缓存内容，再局部替换数据。
- 所有动效在 `prefers-reduced-motion: reduce` 下关闭或降级为瞬时状态切换。
- 保留当前工作区已有未提交改动，不使用 reset、clean 或覆盖式重构。
- 每个阶段先写测试或可验证的 DOM 断言，再修改生产代码；使用 UTF-8 显式读写中文源码。

---

### Task 1: 建立 motion tokens 和可测试的空间状态工具

**Files:**
- Create: `services/motion.ts`
- Create: `tests/motion.test.ts`
- Modify: `index.css`

**Interfaces:**
- Produces `motionTokens`, `motionDirections`, `getSpatialViewClass()` and `getDetailsOriginClass()` for later UI components.
- Consumes no application state and must be safe to import in the Node test runner.

- [ ] **Step 1: Write the failing tests**

Create `tests/motion.test.ts` with real assertions for the exported constants and class mapping:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { getDetailsOriginClass, getSpatialViewClass, motionTokens } from '../services/motion.ts';

test('uses stable spatial timing tokens', () => {
  assert.equal(motionTokens.fast, 160);
  assert.equal(motionTokens.normal, 260);
  assert.equal(motionTokens.spatial, 360);
  assert.equal(motionTokens.stagger, 28);
});

test('maps view direction to a deterministic transition class', () => {
  assert.equal(getSpatialViewClass('forward'), 'cloudnav-spatial-forward');
  assert.equal(getSpatialViewClass('backward'), 'cloudnav-spatial-backward');
  assert.equal(getSpatialViewClass('same'), 'cloudnav-spatial-same');
});

test('maps detail trigger origin to a supported origin class', () => {
  assert.equal(getDetailsOriginClass('left'), 'cloudnav-details-from-left');
  assert.equal(getDetailsOriginClass('right'), 'cloudnav-details-from-right');
  assert.equal(getDetailsOriginClass('bottom'), 'cloudnav-details-from-bottom');
});
```

- [ ] **Step 2: Run the focused test and verify the expected failure**

Run:

```powershell
node --experimental-strip-types --test tests/motion.test.ts
```

Expected: FAIL because `services/motion.ts` does not exist yet.

- [ ] **Step 3: Implement the minimal motion module**

Create `services/motion.ts`:

```ts
export const motionTokens = {
  fast: 160,
  normal: 260,
  spatial: 360,
  stagger: 28,
  easeSpatial: 'cubic-bezier(0.22, 1, 0.36, 1)',
  easeExit: 'cubic-bezier(0.4, 0, 1, 1)',
} as const;

export type SpatialDirection = 'forward' | 'backward' | 'same';
export type DetailsOrigin = 'left' | 'right' | 'bottom';

export const motionDirections = {
  workbench: 'workbench',
  links: 'links',
  rss: 'rss',
} as const;

export const getSpatialViewClass = (direction: SpatialDirection) => `cloudnav-spatial-${direction}`;
export const getDetailsOriginClass = (origin: DetailsOrigin) => `cloudnav-details-from-${origin}`;
```

- [ ] **Step 4: Add the shared CSS states and reduced-motion fallback**

Append to `index.css` a small, namespaced layer:

```css
.cloudnav-spatial-stage { position: relative; isolation: isolate; }
.cloudnav-spatial-forward { animation: cloudnav-spatial-forward 360ms cubic-bezier(.22,1,.36,1) both; }
.cloudnav-spatial-backward { animation: cloudnav-spatial-backward 300ms cubic-bezier(.22,1,.36,1) both; }
.cloudnav-spatial-same { animation: cloudnav-spatial-settle 180ms ease-out both; }
@keyframes cloudnav-spatial-forward { from { opacity: .78; transform: translate3d(20px, 0, 0) scale(.992); } to { opacity: 1; transform: translate3d(0, 0, 0) scale(1); } }
@keyframes cloudnav-spatial-backward { from { opacity: .78; transform: translate3d(-16px, 0, 0) scale(.994); } to { opacity: 1; transform: translate3d(0, 0, 0) scale(1); } }
@keyframes cloudnav-spatial-settle { from { opacity: .88; } to { opacity: 1; } }
.cloudnav-details-from-left { transform-origin: left center; }
.cloudnav-details-from-right { transform-origin: right center; }
.cloudnav-details-from-bottom { transform-origin: center bottom; }
@media (prefers-reduced-motion: reduce) {
  .cloudnav-spatial-forward, .cloudnav-spatial-backward, .cloudnav-spatial-same { animation: none; }
}
```

- [ ] **Step 5: Run the focused test and typecheck**

Run:

```powershell
node --experimental-strip-types --test tests/motion.test.ts
npm.cmd run typecheck
```

Expected: both commands exit with code 0.

- [ ] **Step 6: Commit the isolated foundation**

```powershell
git add services/motion.ts tests/motion.test.ts index.css
git commit -m "feat: add spatial motion tokens"
```

### Task 2: Add one shared view transition wrapper to App

**Files:**
- Create: `components/SpatialViewTransition.tsx`
- Modify: `App.tsx`
- Modify: `tests/ui.test.mjs`

**Interfaces:**
- `SpatialViewTransition` props: `{ viewKey: 'links' | 'workbench' | 'rss'; children: React.ReactNode }`.
- `App` owns `activeView` and passes it to the wrapper; the wrapper owns only previous-view tracking and does not mutate navigation state.

- [ ] **Step 1: Add the failing UI contract test**

Extend `tests/ui.test.mjs` with source-level checks that guarantee a single wrapper and no duplicated view-specific shell:

```js
test('App uses one spatial transition wrapper for the three main views', () => {
  const source = read('App.tsx');
  assert.match(source, /SpatialViewTransition/);
  assert.match(source, /viewKey=\{activeView\}/);
  assert.equal((source.match(/<SpatialViewTransition/g) || []).length, 1);
});

test('motion styles include reduced-motion fallback', () => {
  const source = read('index.css');
  assert.match(source, /prefers-reduced-motion/);
  assert.match(source, /cloudnav-spatial-forward/);
});
```

- [ ] **Step 2: Run the targeted tests and verify the new assertions fail**

Run:

```powershell
node --test tests/ui.test.mjs
```

Expected: FAIL because the wrapper is not imported or rendered yet.

- [ ] **Step 3: Implement `SpatialViewTransition`**

Create `components/SpatialViewTransition.tsx`:

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { getSpatialViewClass } from '../services/motion';

type ViewKey = 'links' | 'workbench' | 'rss';
const order: Record<ViewKey, number> = { links: 0, workbench: 1, rss: 2 };

export default function SpatialViewTransition({ viewKey, children }: { viewKey: ViewKey; children: React.ReactNode }) {
  const previousView = useRef(viewKey);
  const [direction, setDirection] = useState<'forward' | 'backward' | 'same'>('same');

  useEffect(() => {
    if (previousView.current !== viewKey) {
      setDirection(order[viewKey] >= order[previousView.current] ? 'forward' : 'backward');
      previousView.current = viewKey;
    }
  }, [viewKey]);

  return <div className={`cloudnav-spatial-stage ${getSpatialViewClass(direction)}`} data-spatial-view={viewKey}>{children}</div>;
}
```

- [ ] **Step 4: Wrap only the main content view in App**

In `App.tsx`, import `SpatialViewTransition` and wrap the existing `activeView` conditional block beginning with the `HomeDashboard` branch and ending after the pinned/search link branches. Keep the header, sidebar, modal layers, mobile nav, and existing data/event handlers outside the wrapper. Do not duplicate the wrapper around each view.

The resulting shape must be:

```tsx
<SpatialViewTransition viewKey={activeView}>
  {activeView === 'workbench' && <HomeDashboard ... />}
  {activeView === 'rss' && <React.Suspense ...><RssReaderPage ... /></React.Suspense>}
  {activeView === 'links' && /* existing pinned/category/search content */}
</SpatialViewTransition>
```

- [ ] **Step 5: Run focused UI tests and typecheck**

Run:

```powershell
node --test tests/ui.test.mjs
npm.cmd run typecheck
```

Expected: both pass and no existing UI contract regresses.

- [ ] **Step 6: Commit the view transition**

```powershell
git add components/SpatialViewTransition.tsx App.tsx tests/ui.test.mjs
git commit -m "feat: add spatial transitions between main views"
```

### Task 3: Convert details drawer and modal entry into spatial layers

**Files:**
- Modify: `components/LinkDetailsDrawer.tsx`
- Modify: `App.tsx`
- Modify: `tests/ui.test.mjs`

**Interfaces:**
- Add optional `origin?: 'left' | 'right' | 'bottom'` to `LinkDetailsDrawerProps`; default is `right` to preserve desktop behavior.
- `App` tracks the last clicked link source with `detailsOrigin` and clears it with `selectedLinkId`.

- [ ] **Step 1: Write failing contract tests**

Add assertions to `tests/ui.test.mjs`:

```js
test('details drawer exposes a trigger-aware spatial origin', () => {
  const drawer = read('components/LinkDetailsDrawer.tsx');
  const app = read('App.tsx');
  assert.match(drawer, /origin\?/);
  assert.match(drawer, /cloudnav-details-from-/);
  assert.match(app, /detailsOrigin/);
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```powershell
node --test tests/ui.test.mjs
```

Expected: FAIL because `origin` and `detailsOrigin` are not present.

- [ ] **Step 3: Implement the origin prop and accessible transition**

In `LinkDetailsDrawer.tsx`, import `getDetailsOriginClass`, add the optional prop, and replace the hard-coded transform class with a combined class that keeps `translate-x-full` for closed state and `cloudnav-details-from-${origin}` for the transform origin. Keep the existing close button, focus handling, and width behavior unchanged.

The open shell should keep one stable panel node:

```tsx
<div className={`fixed inset-y-0 right-0 ... cloudnav-details-from-${origin} ${isOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}>
```

Use `origin={detailsOrigin}` in `App.tsx`. Set the origin to `bottom` when a mobile card opens, otherwise `right`; do not change the link opening behavior itself.

- [ ] **Step 4: Run focused tests and typecheck**

```powershell
node --test tests/ui.test.mjs
npm.cmd run typecheck
```

Expected: pass.

- [ ] **Step 5: Commit the spatial details layer**

```powershell
git add components/LinkDetailsDrawer.tsx App.tsx tests/ui.test.mjs
git commit -m "feat: anchor details drawer to trigger origin"
```

### Task 4: Unify dashboard, link cards and RSS micro-interactions

**Files:**
- Modify: `components/HomeDashboard.tsx`
- Modify: `components/RssReaderPage.tsx`
- Modify: `components/MobileBottomNav.tsx`
- Modify: `index.css`
- Modify: `tests/ui.test.mjs`

**Interfaces:**
- Existing callbacks and data props remain unchanged.
- Add stable `data-spatial-id` attributes to matching visual elements: `dashboard`, `recent-link-${id}`, `rss-article-${id}`, and `mobile-nav-${view}`.

- [ ] **Step 1: Add failing source contract tests**

Add to `tests/ui.test.mjs`:

```js
test('primary surfaces expose stable spatial identities', () => {
  const dashboard = read('components/HomeDashboard.tsx');
  const rss = read('components/RssReaderPage.tsx');
  const mobile = read('components/MobileBottomNav.tsx');
  assert.match(dashboard, /data-spatial-id/);
  assert.match(rss, /rss-article-/);
  assert.match(mobile, /mobile-nav-/);
});
```

- [ ] **Step 2: Run the targeted test and verify failure**

```powershell
node --test tests/ui.test.mjs
```

Expected: FAIL because the stable spatial identities have not been added.

- [ ] **Step 3: Add stable identities and restrained state transitions**

In `HomeDashboard.tsx`, add `data-spatial-id="dashboard"` to the root and `data-spatial-id={`recent-link-${link.id}`}` to each recent link row. Replace only the existing generic hover motion on `EntryCard` with the namespaced class `cloudnav-spatial-card`, keeping color, spacing and content unchanged.

In `RssReaderPage.tsx`, add `data-spatial-id={`rss-article-${article.id}`}` to each article and add `cloudnav-spatial-card` to the article hover target. Keep feed refresh behavior, content loading, and Chinese-only source data unchanged.

In `MobileBottomNav.tsx`, add `data-spatial-id={`mobile-nav-${activeView}`}` to the active navigation item and use one shared active indicator class. Do not create a second mobile-only navigation visual language.

Add to `index.css`:

```css
.cloudnav-spatial-card { transition: transform 220ms cubic-bezier(.22,1,.36,1), border-color 180ms ease, box-shadow 220ms ease; }
.cloudnav-spatial-card:hover { transform: translateY(-2px); }
@media (prefers-reduced-motion: reduce) { .cloudnav-spatial-card { transition: none; } .cloudnav-spatial-card:hover { transform: none; } }
```

- [ ] **Step 4: Run targeted tests and typecheck**

```powershell
node --test tests/ui.test.mjs
npm.cmd run typecheck
```

Expected: pass.

- [ ] **Step 5: Commit the shared micro-interactions**

```powershell
git add components/HomeDashboard.tsx components/RssReaderPage.tsx components/MobileBottomNav.tsx index.css tests/ui.test.mjs
git commit -m "feat: unify spatial card interactions"
```

### Task 5: Verify first paint, accessibility and production build

**Files:**
- Modify: `tests/performance.test.mjs` only if an existing assertion needs to cover the new wrapper.
- Modify: `tests/ui.test.mjs` for final behavior checks if needed.
- No production source changes unless a verification failure identifies a concrete regression.

**Interfaces:**
- No new runtime interfaces.

- [ ] **Step 1: Run the full test suite**

```powershell
npm.cmd test
```

Expected: exit code 0 with no failing tests.

- [ ] **Step 2: Run the performance suite**

```powershell
npm.cmd run test:performance
```

Expected: exit code 0; existing first-paint and search/index budgets remain within their current thresholds.

- [ ] **Step 3: Run the production build**

```powershell
npm.cmd run build
```

Expected: typecheck and Vite build both exit with code 0 and produce a fresh `dist` bundle.

- [ ] **Step 4: Perform browser-facing smoke checks**

Start the existing dev server and verify these paths without waiting for remote RSS data:

1. Open `/` and confirm cached navigation structure appears before remote data finishes.
2. Switch workbench → pinned websites → RSS and confirm the same shell remains visible while only the content stage transitions.
3. Open a link detail from a card and confirm the drawer opens from its trigger side and closes back without losing scroll position.
4. Refresh RSS and confirm only the feed/article content updates.
5. Enable reduced motion in browser settings and confirm view/card transitions become instant while all controls remain usable.
6. Check mobile width and confirm the bottom navigation uses the same active state language as desktop navigation.

- [ ] **Step 5: Review the diff and verify no unrelated files changed**

```powershell
git diff --check
git status --short
git diff --stat HEAD~4..HEAD
```

Expected: only the planned motion files, listed UI components, tests, and CSS appear in the new implementation commits; earlier user work remains intact.

- [ ] **Step 6: Final commit if smoke-check-only fixes were required**

```powershell
git add index.css App.tsx components/SpatialViewTransition.tsx components/LinkDetailsDrawer.tsx components/HomeDashboard.tsx components/RssReaderPage.tsx components/MobileBottomNav.tsx services/motion.ts tests/motion.test.ts tests/ui.test.mjs tests/performance.test.mjs
git commit -m "test: verify spatial continuity UI rollout"
```
