# CloudNav Product Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the remaining performance, security, health, search, workbench, PWA, and mobile improvements as one verified production upgrade.

**Architecture:** Keep new behavior in pure services first, then connect it to existing panels and `App.tsx`. Use Cloudflare KV only for server-side rate limiting/configuration; use localStorage/IndexedDB for user-local workbench and recovery state. Do not introduce a new frontend framework or visual system.

**Tech Stack:** React 19, TypeScript, Vite/Rollup, Cloudflare Pages Functions, Cloudflare KV, Cloudflare Worker Cron, IndexedDB, Node `node:test`.

## Global Constraints

- Keep current UI styling and default pinned-sites page.
- Keep API/auth responses out of the service-worker cache.
- All new mutation paths must preserve recycle-bin behavior.
- External weather requests are user-triggered and optional.
- New business logic is test-first; no production implementation before a failing test.

---

### Task 1: Bundle splitting and mobile/PWA surfaces

**Files:**
- Modify: `vite.config.ts`, `App.tsx`, `index.css`, `tests/ui.test.mjs`
- Create: `components/MobileBottomNav.tsx`, `components/InstallPrompt.tsx`

- [x] Add failing static tests for manual chunks, bottom navigation, install prompt, and quick-add entry.
- [x] Run the focused UI test and confirm failure.
- [x] Add Rollup manual chunks and render mobile-only navigation/install UI with graceful browser-event fallback.
- [x] Run UI tests, typecheck, and a production build.

### Task 2: Login rate limiting and local recovery snapshots

**Files:**
- Create: `services/recoverySnapshots.ts`, `tests/recoverySnapshots.test.ts`
- Modify: `functions/api/auth.ts`, `functions/_shared/auth.ts`, `App.tsx`, `components/BackupModal.tsx`, `package.json`

- [x] Write failing tests for bounded recovery snapshots and rate-limit window decisions.
- [x] Run the focused tests and confirm failure.
- [x] Implement five local snapshots and KV-backed failed-login limiting with a short expiry.
- [x] Trigger a snapshot before local mutations and expose a restore action in backup center.
- [x] Run full tests and typecheck.

### Task 3: Health retries and duplicate auto-merge

**Files:**
- Create: `tests/linkHealthService.test.ts`
- Modify: `services/linkHealthService.ts`, `services/duplicateService.ts`, `components/DuplicateLinksPanel.tsx`, `workers/health-cron.ts`, `package.json`

- [x] Write failing tests for retrying transient health failures and merging duplicate metadata.
- [x] Run focused tests and confirm failure.
- [x] Add bounded exponential retry and the metadata merge helper.
- [x] Replace duplicate hard deletion with recycle-bin soft deletion plus optional auto-merge.
- [x] Extend worker status handling for recovered links and notification events.
- [x] Run full tests and typecheck.

### Task 4: Indexed search and relevance ranking

**Files:**
- Create: `services/searchIndex.ts`, `tests/searchIndex.test.ts`
- Modify: `types.ts`, `services/searchService.tsx`, `App.tsx`, `components/LinkModal.tsx`, `tests/ui.test.mjs`, `package.json`

- [x] Write failing tests for index construction, aliases, and health-aware ranking.
- [x] Run focused tests and confirm failure.
- [x] Add `aliases` to link data, index normalized searchable fields, and use the index in internal search.
- [x] Add health/pinned/visit tie-breakers without changing external search behavior.
- [x] Run full tests and typecheck.

### Task 5: Workbench utility modules

**Files:**
- Create: `components/WorkbenchTools.tsx`, `services/workbenchTools.ts`, `tests/workbenchTools.test.ts`
- Modify: `types.ts`, `services/dashboardConfig.ts`, `functions/api/storage.ts`, `components/HomeDashboard.tsx`, `App.tsx`, `components/BackupModal.tsx`, `tests/ui.test.mjs`, `package.json`

- [x] Write failing tests for todo/notes/Markdown normalization and bounded list sizes.
- [x] Run focused tests and confirm failure.
- [x] Add clock, todo, notes, Markdown, and user-triggered weather cards with local persistence.
- [x] Add the tools widget to dashboard ordering/visibility and include its data in JSON backup/restore.
- [x] Run full tests and typecheck.

### Task 6: Full verification and release

**Files:**
- Modify: `docs/superpowers/plans/2026-09-09-cloudnav-product-expansion.md`

- [x] Run `npm.cmd test`.
- [x] Run `npm.cmd run typecheck`.
- [x] Run `npx.cmd vite build` and `npm.cmd run test:performance`.
- [x] Deploy Pages to `main` and redeploy the health Cron Worker.
- [x] Verify production HTML asset version, Service Worker, auth check, and protected API status.
