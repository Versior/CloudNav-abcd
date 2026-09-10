# CloudNav Desktop Layout Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current card-heavy desktop shell with a readable, high-contrast Swiss-style workspace across Workbench, Pinned Sites, and RSS Reader without changing existing data flows.

**Architecture:** Keep the existing React routes, handlers, data services, and lazy boundaries. Replace the page presentation through a small set of explicit `command-v2` layout hooks and a final desktop design layer in `index.css`; add only the structural wrappers needed for asymmetric grids, section headers, and density controls. Preserve mobile fallback rules below 1024px.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS v4, lucide-react, Node test runner.

## Global Constraints

- Desktop is the primary target at 1440px and 1920px widths; mobile remains a fallback and must not drive desktop structure.
- No tag grid, no embedded web pages, no saturated blue/purple gradient, and no large editorial banner repeated inside pages.
- Keep existing callbacks, storage, RSS fetching, AI summarization, and link actions unchanged.
- Body copy must use at least 14px on desktop where it carries content; muted text must maintain readable contrast.
- Keep motion subtle and preserve `prefers-reduced-motion` behavior.

---

### Task 1: Lock the new page contracts with regression tests

**Files:**
- Modify: `tests/desktopRewrite.test.mjs`
- Modify: `tests/ui.test.mjs`

**Interfaces:**
- Produces stable assertions for `data-command-v2`, `data-layout="workspace-v2"`, `data-layout="reader-v2"`, and the desktop shell token.

- [ ] **Step 1: Add failing assertions** for the new shell and three page layout hooks.
- [ ] **Step 2: Run `npm.cmd test`** and confirm the new assertions fail because the hooks do not exist.

### Task 2: Rebuild the desktop shell and page surface geometry

**Files:**
- Modify: `App.tsx`
- Modify: `components/DesktopLibraryPage.tsx`
- Modify: `components/HomeDashboard.tsx`
- Modify: `components/RssReaderPage.tsx`
- Modify: `index.css`
- Modify: `index.html`
- Modify: `public/manifest.webmanifest`
- Modify: `public/sw.js`

**Interfaces:**
- Consumes: Existing page props and callbacks; no data API changes.
- Produces: One coherent command shell with `data-command-v2="true"`; page-specific layout hooks consumed by CSS and tests.

- [ ] **Step 1: Add structural hooks** to the shell, library workspace, workbench zones, and RSS reader regions.
- [ ] **Step 2: Replace the old desktop visual layer** with the high-contrast canvas, compact navigation rail, restrained borders, and asymmetric layouts.
- [ ] **Step 3: Update theme metadata and service-worker version** so deployed browsers receive the new CSS immediately.
- [ ] **Step 4: Run typecheck and targeted UI tests.**

### Task 3: Verify real desktop rendering and deployment

**Files:**
- Create: `dist-backup-20260909-layout-v2.zip`

- [ ] **Step 1: Run `npm.cmd test`, `npm.cmd run test:performance`, `npm.cmd run build`, and `git diff --check`.**
- [ ] **Step 2: Start a fresh local production preview and inspect the three routes in the browser at desktop width.**
- [ ] **Step 3: Create a dist backup before publishing.**
- [ ] **Step 4: Deploy to the existing Cloudflare Pages project.**
- [ ] **Step 5: Verify custom domain and preview status 200 plus the new CSS token and cache version.**

## Self-review

- Scope is limited to desktop layout/presentation; existing data and interaction code remains the source of truth.
- The plan covers all three main pages, their shared shell, tests, cache invalidation, backup, and live verification.
- No placeholder implementation steps remain.
