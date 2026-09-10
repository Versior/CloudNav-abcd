# Reading Workspace v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重做 CloudNav 桌面阅读台的布局与滚动模型，消除横向来源条和多层滚动，让正文成为连续阅读的视觉中心。

**Architecture:** 保留 `ReadingWorkspacePage` 的数据、状态和事件处理，只重组 JSX 的页面区域，并把来源筛选从常驻横向 rail 改为页头抽屉。通过新的 v2 CSS 将页面限制为双列阅读区，队列和正文分别滚动，沉浸阅读只切换 CSS/布局状态，不改阅读数据模型。

**Tech Stack:** React 19、TypeScript、Vite、Lucide React、现有 `index.css` 和 Node test runner。

## Global Constraints

- 继续支持桌面端优先布局，1440px 以上不出现横向滚动。
- 不引入新的 UI 依赖，不改变阅读文档存储格式和已有快捷键。
- 保留现有 RSS、Inbox、灵感、GitHub 文档来源和笔记/高亮行为。
- 所有图标按钮必须保留 `title` 或 `aria-label`。
- 修改后必须运行 `npm.cmd test`、`npm.cmd run test:performance`、`npm.cmd run build` 和 `git diff --check`。

---

### Task 1: 固化阅读台 v2 的结构契约

**Files:**
- Modify: `tests/readingWorkspace.test.ts` 或现有最接近阅读台 UI 的测试文件
- Modify: `tests/desktopRewrite.test.mjs`（若当前契约测试集中在此处）

**Interfaces:**
- Consumes: 页面上的 `data-page="reading-workspace"`、`data-reading-region` 和阅读来源交互。
- Produces: 能验证 v2 没有横向来源 rail，并包含队列、正文、来源按钮和沉浸阅读入口的结构契约。

- [ ] **Step 1: 检查现有阅读台 UI 测试的归属和断言**

```powershell
rg -n "reading-workspace|阅读台|source-rail|ReadingWorkspace" tests
```

- [ ] **Step 2: 添加失败断言**

新增断言覆盖：`data-layout-version="reading-workspace-v2"`、`data-reading-region="queue"`、`data-reading-region="reader"`、来源抽屉触发按钮和沉浸阅读按钮；同时断言不再使用常驻 `cloudnav-reading-source-rail` 横向结构。

- [ ] **Step 3: 运行目标测试确认先失败**

```powershell
npm.cmd test -- --test-name-pattern="reading workspace v2"
```

预期：结构契约因 v2 标记和新区域尚不存在而失败。

### Task 2: 重组 ReadingWorkspacePage 的桌面阅读结构

**Files:**
- Modify: `components/ReadingWorkspacePage.tsx`

**Interfaces:**
- Consumes: 现有 `documents`、`visible`、`sourceSummaries`、`sourceFilter`、`selected` 和已有事件处理函数。
- Produces: v2 页面结构，新增 `showSources` 与 `immersive` 本地 UI 状态；保持 `selectDocument`、`handleReaderScroll`、`summarize`、`saveNote` 等行为不变。

- [ ] **Step 1: 增加两个纯 UI 状态**

```tsx
const [showSources, setShowSources] = useState(false);
const [immersive, setImmersive] = useState(false);
```

- [ ] **Step 2: 删除常驻横向来源 rail**

将旧的 `cloudnav-reading-source-rail` 区域替换为页头控制按钮：显示当前来源名称和数量；按钮打开来源抽屉。来源抽屉复用 `sourceSummaries` 和 `article/note/github` 分类，点击后设置 `sourceFilter` 并关闭抽屉。

- [ ] **Step 3: 重组控制条**

将状态切换、搜索、保存视图和批量操作放入单行 `cloudnav-reading-controls-v2`；快速收集条保留标题、网址和加入按钮，但不再与来源 chip 混排。

- [ ] **Step 4: 给主阅读区域添加稳定的区域身份**

```tsx
<div className={`cloudnav-reading-grid-v2 ${immersive ? 'is-immersive' : ''}`}>
  <aside data-reading-region="queue" className="cloudnav-reading-queue-v2">...</aside>
  <article data-reading-region="reader" className="cloudnav-reading-reader-v2">...</article>
</div>
```

队列保留全选、复选框、标题、摘要、来源和进度；正文保留 AI 摘要、正文、笔记、高亮及状态操作。

- [ ] **Step 5: 加入沉浸阅读入口**

在正文操作条加入有文字的“沉浸阅读/显示队列”按钮，切换 `immersive`。按钮必须有 `aria-pressed`，不改变 `selected` 或文档持久化。

### Task 3: 实现 v2 CSS 阅读布局

**Files:**
- Modify: `index.css`

**Interfaces:**
- Consumes: Task 2 输出的 `cloudnav-reading-* v2` 类名和 `data-reading-region`。
- Produces: 无横向滚动、双列独立垂直滚动、正文限宽、沉浸阅读居中和低装饰视觉层级。

- [ ] **Step 1: 添加 v2 设计 token**

使用现有 CSS 变量体系，补充队列宽度、正文最大宽度、阅读背景、细分隔线和单一强调色，不在 JSX 写新的 raw hex。

- [ ] **Step 2: 设置桌面滚动边界**

```css
.cloudnav-reading-grid-v2 { min-height: min(720px, calc(100vh - 16rem)); overflow: hidden; }
.cloudnav-reading-queue-v2, .cloudnav-reading-reader-v2 { min-height: 0; overflow: auto; overscroll-behavior: contain; }
.cloudnav-reading-reader-v2 { overflow-wrap: anywhere; }
```

正文和队列各自滚动，外层不产生第三条滚动条；宽度不足时使用纵向布局，不使用横向滚动。

- [ ] **Step 3: 实现正文排版层级**

正文标题控制在 2.25–2.75rem，正文最大宽度 760px、字号至少 1rem、行高至少 1.85；元数据使用较小但可读的次要色，摘要与正文之间使用留白而不是大面积卡片。

- [ ] **Step 4: 实现来源抽屉和沉浸态**

来源抽屉使用页内绝对定位/弹层，不参与主列宽度；沉浸态隐藏队列并将正文限制在适合阅读的宽度，保留返回队列按钮。

- [ ] **Step 5: 加入 reduced-motion 和响应式规则**

在 `prefers-reduced-motion: reduce` 下关闭抽屉和沉浸态过渡；在 980px 以下切换为单列，避免内容压边。

- [ ] **Step 6: 运行 UI 契约与构建**

```powershell
npm.cmd test
npm.cmd run test:performance
npm.cmd run build
```

预期：全部通过，构建产物生成成功。

### Task 4: 浏览器验收、提交和部署

**Files:**
- Modify: 无新增业务文件；只提交 Task 1–3 的改动

**Interfaces:**
- Consumes: v2 页面和构建产物。
- Produces: 可验证的 Git 提交和 Cloudflare Pages 生产部署。

- [ ] **Step 1: 做静态检查**

```powershell
git diff --check
git status --short
```

- [ ] **Step 2: 本地浏览器验收**

打开阅读台，确认来源按钮、来源抽屉、队列选择、正文滚动、沉浸阅读、AI 摘要按钮、笔记保存和 `j/k` 快捷键均可用；确认没有横向滚动条和文字压边。

- [ ] **Step 3: 提交并推送当前分支**

```powershell
git add components/ReadingWorkspacePage.tsx index.css tests docs/superpowers
git commit -m "refactor: redesign desktop reading workspace"
git push origin codex/cloudnav-fixes
```

- [ ] **Step 4: 发布 Cloudflare Pages**

```powershell
npx.cmd wrangler pages deploy dist --project-name cloudnav-abcd --branch main --commit-dirty=true
```

- [ ] **Step 5: 验证线上资源**

确认 Cloudflare deployment source 为新提交，生产域名返回 HTTP 200，HTML 引用新构建资源；记录部署地址和验证结果。

## Self-review

- 所有设计要求均映射到 Task 2 和 Task 3：去横向来源条、双列阅读、沉浸模式、正文层级、来源抽屉和滚动边界。
- 没有新增数据结构或第三方依赖，避免影响现有同步和备份。
- 没有使用 TBD/TODO 或未定义的函数名；现有函数保持原名，新增状态和区域身份已明确。
