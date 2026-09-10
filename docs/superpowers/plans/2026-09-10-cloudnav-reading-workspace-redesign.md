# CloudNav Reading Workspace Redesign Implementation Plan

> **For agentic workers:** Execute this plan task-by-task with a fresh test after each task.

**Goal:** Replace the RSS three-column embedded-frame layout with a desktop-first reading workspace whose source rail and article detail panel are optional.

**Architecture:** Keep `RssReaderPage` as the state owner and preserve all existing RSS actions. Replace the fixed reading grid with a v5 single-flow stream and two independent drawers keyed by `data-layout-version="reader-v5"`, so the new layout is isolated from legacy styles and can be verified without rewriting RSS services.

**Tech Stack:** React 19, TypeScript, lucide-react, Tailwind utility classes already present, CSS media queries, Node test runner.

## Global Constraints

- Preserve RSS state shape and existing service functions.
- Desktop is the primary target; mobile must remain usable.
- No nested page frame, gradient, card wall, or decorative shadow stack.
- Keep existing subscription editing, discovery, OPML import/export, refresh, AI summary, favorite, read-later, inspiration, and link-save handlers.
- Use stable article/feed IDs as React keys.
- Keep visible keyboard focus and `prefers-reduced-motion` support.

---

### Task 1: Lock the new layout contract with a failing test

**Files:**
- Modify: `tests/desktopRewrite.test.mjs`

- [x] Add assertions for `reader-v5`, `article-stream`, independent source/reader regions, `isReaderOpen`, `setIsReaderOpen(true)`, and source/reader toggle markers.
- [x] Run `node --test tests/desktopRewrite.test.mjs`.
- [x] Confirm the new test fails because the production component still exposes `reader-v3`.

### Task 2: Add reading-workspace state and markup

**Files:**
- Modify: `components/RssReaderPage.tsx`

**Interfaces:**
- `isSourceRailOpen: boolean` controls the source rail class.
- `isReaderOpen: boolean` controls whether the detail pane is visible.
- `selectArticle(article)` sets the selected ID, marks unread articles read, and opens the detail pane.

- [x] Add the two UI state values with source rail open and reader pane closed as defaults.
- [x] Add `setIsReaderOpen(true)` to the article selection handler.
- [x] Add close and toggle controls with `data-rss-toggle="sources"` and `data-rss-toggle="reader"`.
- [x] Change the root contract to `data-layout-version="reader-v5"`.
- [x] Replace the `reading-zone` three-column wrapper with `article-stream`, `source-drawer`, and `reader-sheet` regions.
- [x] Keep all existing handlers and article/feed rendering content intact.

### Task 3: Implement the v4 desktop visual system

**Files:**
- Modify: `index.css`

- [x] Add a `RSS reader v5` section keyed by `reader-v5`.
- [x] Make the article stream the default full-width content surface.
- [x] Render the reader as a fixed independent sheet, never as a right-side grid column.
- [x] Render the source list as a fixed independent drawer, never as a permanent rail in the reading flow.
- [x] Use flat canvas, clear separators, one teal accent, and readable typography.
- [x] Add responsive fallbacks for 1024–1280px and below 1024px.
- [x] Add reduced-motion rules for the detail panel.

### Task 4: Verify the feature and build

**Files:**
- Test: `tests/desktopRewrite.test.mjs`, full test suite

- [x] Run `node --test tests/desktopRewrite.test.mjs` and confirm the new test passes.
- [x] Run `npm.cmd run typecheck`.
- [x] Run `npm.cmd run build`.
- [x] Run the full `npm.cmd test` suite.
- [x] Inspect the git diff and ensure no RSS service/data behavior was removed.
