# CloudNav Resilience Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add recycle-bin recovery, deterministic three-way sync merge, health-failure notifications, and IndexedDB-backed offline synchronization without changing the current visual style.

**Architecture:** Keep business rules in small pure services with Node tests. Wire those services into the existing `App`, settings panels, Pages storage API, and health Cron Worker. Local UI remains optimistic; remote persistence is versioned and queued when offline.

**Tech Stack:** React 19, TypeScript, Cloudflare Pages Functions, Cloudflare KV, Cloudflare Worker Cron, IndexedDB, Node `node:test`, Vite.

## Global Constraints

- Keep the current UI visual language and keep pinned websites as the default page.
- Never put credentials or webhook secrets in client bundles or logs.
- Soft-deleted links stay in versioned cloud data until permanently removed.
- Webhook targets must pass the existing public URL safety checks.
- Every new behavior starts with a failing test, then minimal implementation, then the full suite.

---

### Task 1: Recycle-bin domain rules

**Files:**
- Create: `services/recycleBin.ts`
- Test: `tests/recycleBin.test.ts`
- Modify: `package.json`

- [x] Write tests for soft delete, restore, active filtering, and expiry purge.
- [x] Run `node --experimental-strip-types --test tests/recycleBin.test.ts` and confirm the module is missing.
- [x] Implement `softDeleteLinks`, `restoreLinks`, `filterActiveLinks`, `filterDeletedLinks`, and `purgeExpiredLinks`.
- [x] Run the focused test and then the full test command.

### Task 2: Recycle-bin UI and app integration

**Files:**
- Create: `components/RecycleBinPanel.tsx`
- Modify: `App.tsx`, `components/SettingsModal.tsx`, `components/LinkHealthPanel.tsx`, `tests/ui.test.mjs`

- [x] Add a failing static test for a recycle-bin settings tab and soft-delete calls.
- [x] Run the focused UI test and confirm it fails.
- [x] Add restore/permanent-delete controls and wire normal, context-menu, batch, and health cleanup to `deletedAt`.
- [x] Keep deleted links out of pinned, inbox, search, and category views.
- [x] Run UI tests and typecheck.

### Task 3: Three-way merge service

**Files:**
- Create: `services/mergeService.ts`
- Test: `tests/mergeService.test.ts`
- Modify: `App.tsx`, `components/SyncConflictModal.tsx`, `tests/ui.test.mjs`

- [x] Write tests for unchanged-side selection, field-level merge, conflict accounting, and category merge.
- [x] Run the focused test and confirm it fails.
- [x] Implement deterministic ID/field-based three-way merge.
- [x] Store the latest successful cloud snapshot as base and show conflict counts in the modal.
- [x] Retry merged data against the current cloud version.
- [x] Run the focused and full tests.

### Task 4: Health notification configuration and worker delivery

**Files:**
- Create: `services/healthNotifications.ts`
- Test: `tests/healthNotifications.test.ts`
- Modify: `types.ts`, `functions/api/storage.ts`, `components/HealthSchedulePanel.tsx`, `workers/health-cron.ts`, `tests/ui.test.mjs`

- [x] Write tests for normalization and “new broken links only” trigger behavior.
- [x] Run the focused test and confirm it fails.
- [x] Add authenticated config storage and a small settings form.
- [x] Send a safe JSON webhook after a meaningful health regression; notification errors must not fail the scan.
- [x] Run tests and typecheck.

### Task 5: IndexedDB offline queue

**Files:**
- Create: `services/offlineQueue.ts`, `services/offlineStore.ts`
- Test: `tests/offlineQueue.test.ts`
- Modify: `App.tsx`, `constants/storageKeys.ts`, `tests/ui.test.mjs`

- [x] Write tests for coalescing pending snapshots and removing flushed items.
- [x] Run the focused test and confirm it fails.
- [x] Implement IndexedDB storage with localStorage fallback.
- [x] Queue network failures, flush on `online`, and preserve current optimistic rendering.
- [x] Run the full test suite, typecheck, build, and performance test.

### Task 6: Release verification

**Files:**
- Modify: `docs/superpowers/plans/2026-09-09-cloudnav-resilience-upgrade.md`

- [x] Run `npm.cmd test`.
- [x] Run `npm.cmd run typecheck`.
- [x] Run `npx.cmd vite build` and `npm.cmd run test:performance`.
- [x] Deploy Pages and the health Cron Worker using the existing project configuration.
- [x] Verify production root, service worker, auth check, and protected config responses.
