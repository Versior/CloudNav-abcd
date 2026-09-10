# CloudNav 全页面 UI 重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with review checkpoints.

**Goal:** 使用已安装的 `ui-ux-pro-max-github` 与 webdesign-agency 命令包，把 CloudNav 的桌面端壳层、工作台、网站库、RSS、灵感、稍后阅读、GitHub、收件箱和阅读台统一为高可读、平面、连续的产品界面。

**Architecture:** 保留现有 React 页面和数据流，新增一个加载在历史样式之后的 `styles/cloudnav-redesign.css` 作为统一视觉层；只对壳层与缺少语义标记的页面结构做小范围调整。设计系统由 `design-system/cloudnav/MASTER.md` 固化，所有页面共享 CSS tokens、列表语义和阅读面板语义。

**Tech Stack:** React 19.2, TypeScript, Vite, lucide-react, CSS custom properties, Node test runner.

## Global Constraints

- 桌面优先，1440px 与 1920px 是主要验收宽度。
- 不加入新的 UI 依赖，不使用渐变、玻璃拟态或连续复杂动画。
- 主要文字对比度至少 4.5:1；所有图标按钮具有 accessible name；所有交互控件保留可见 focus。
- 保留现有本地/云端存储格式和已有未提交功能，不重置、不清理、不覆盖历史备份。
- 任何列表改造使用稳定 ID 作为 key，不为了猜测性能而批量增加 memo/useMemo。
- 每个任务先写失败测试或 UI 合同断言，再改实现，再跑针对性测试。

---

### Task 1: 安装与设计资产固定

**Files:**
- Create: `design-system/cloudnav/MASTER.md`
- Create: `.claude/commands/webdesign-agency/*.md`
- Create: `docs/superpowers/specs/2026-09-10-cloudnav-ui-redesign-with-github-skills-design.md`
- Create: `docs/superpowers/plans/2026-09-10-cloudnav-ui-redesign-with-github-skills.md`
- Create: `.impeccable.md`

- [ ] **Step 1: 保存工具来源与设计上下文**
  - 记录两个 GitHub 来源、安装目录、CloudNav 面向桌面个人信息管理的设计目标。
  - `.impeccable.md` 明确禁止双重阴影、玻璃拟态、渐变和大片低对比灰字。
- [ ] **Step 2: 运行设计系统查询**
  - 使用 `ui-ux-pro-max-github/scripts/search.py` 读取 master 规则、UX 对比度规则、React 列表规则。
- [ ] **Step 3: 验证设计资产**
  - 确认 master 和五个 webdesign-agency 命令文件存在。

### Task 2: 先写 UI 合同测试并建立 token 层

**Files:**
- Create: `styles/cloudnav-redesign.css`
- Modify: `index.tsx`
- Test: `tests/desktopRewrite.test.mjs`
- Test: `tests/personalWorkspaceUi.test.mjs`

- [ ] **Step 1: 写失败断言**
  - 断言 `index.tsx` 在 `index.css` 后加载 `styles/cloudnav-redesign.css`。
  - 断言 token 层定义 `--cn-bg`, `--cn-ink`, `--cn-muted`, `--cn-primary`, `--cn-accent`, `--cn-line`。
  - 断言桌面壳层设置 `data-ui-skin="cloudnav-redesign"`，并存在 page-surface/section 标记。
- [ ] **Step 2: 运行 UI 测试并确认失败**
  - 运行 `npm.cmd test -- --test-name-pattern="redesign|desktop|workspace"`。
- [ ] **Step 3: 实现 token 层**
  - 在 `styles/cloudnav-redesign.css` 中定义浅色/深色 token、焦点态、按钮态、表格行、阅读区、空状态、浮层和 reduced-motion 规则。
  - 所有普通控件尺寸至少 36px；关键图标按钮至少 40px，避免文字压边。
- [ ] **Step 4: 通过针对性测试**
  - 运行 `npm.cmd test -- --test-name-pattern="redesign|desktop|workspace"`。

### Task 3: 重构全局壳层与桌面导航

**Files:**
- Modify: `App.tsx:2550-3445`
- Modify: `components/AppShell.tsx`
- Modify: `components/DesktopSidebar.tsx`
- Modify: `components/TopCommandBar.tsx`
- Modify: `components/TopWeather.tsx`
- Test: `tests/desktopRewrite.test.mjs`

- [ ] **Step 1: 写壳层结构断言**
  - 断言同一页面只出现一个桌面 sidebar、一个 topbar、一个 scroll content；断言天气、搜索、添加入口在 topbar。
- [ ] **Step 2: 实现壳层结构**
  - 给 `<aside>`, `<header>`, `<main>`, 主滚动容器补充稳定的 `data-redesign-*` 标记。
  - 统一导航 active、hover、focus 样式，不改变回调与 activeView 状态。
  - 保留移动端可访问性，但桌面端不再依赖 mobile bottom nav 视觉。
- [ ] **Step 3: 修复滚动与焦点**
  - 为主滚动区设置 `scroll-padding-top`；浮动待办不遮挡焦点和正文。
- [ ] **Step 4: 运行壳层测试**
  - 运行 `npm.cmd test -- --test-name-pattern="desktop|button"`。

### Task 4: 工作台与网站库改为连续编辑台/列表库

**Files:**
- Modify: `components/HomeDashboard.tsx`
- Modify: `components/DesktopLibraryPage.tsx`
- Modify: `components/PinnedSiteCard.tsx`
- Modify: `components/FloatingTodo.tsx`
- Test: `tests/personalWorkspaceUi.test.mjs`

- [ ] **Step 1: 写失败 UI 断言**
  - 断言工作台包含 activity stream、today focus、quick access 和 todo 浮层语义；置顶网站不渲染完整分类目录。
- [ ] **Step 2: 实现结构调整**
  - 工作台统计改为轻量指标行，目录改为可折叠目录条，最近访问保持时间线，待办变为可关闭且不遮挡内容的浮动面板。
  - 网站库使用表头与列表行，保留详情、编辑、删除、排序、打开、稍后阅读动作。
- [ ] **Step 3: 优化可读性**
  - 标题、来源、描述和状态使用三层文字 token；长标题以省略号展示并提供完整 title。
- [ ] **Step 4: 运行测试**
  - 运行 `npm.cmd test -- --test-name-pattern="personalWorkspace|desktop"`。

### Task 5: RSS 阅读中心改为来源—文章—阅读连续布局

**Files:**
- Modify: `components/RssReaderPage.tsx`
- Modify: `components/RssArticleReader.tsx`
- Modify: `components/RssSourceRail.tsx`
- Modify: `components/RssArticleList.tsx`
- Modify: `components/RssStateView.tsx`
- Test: `tests/rssPage.test.ts`
- Test: `tests/rssService.test.ts`

- [ ] **Step 1: 写失败断言**
  - 断言 RSS 桌面端同时具备 source drawer、article stream、reader panel；无内容、加载和错误状态都有文字，不以空白代替。
- [ ] **Step 2: 实现 RSS 结构**
  - 保留订阅添加/编辑/删除/刷新/导入/导出和精确文章跳转。
  - 统一文章行的标题、来源、时间、未读、收藏和 AI 状态。
  - 阅读面板固定正文宽度，按钮放入一个 action row，AI 摘要采用可折叠信息块。
- [ ] **Step 3: 处理滚动与性能**
  - 文章列表和正文各自有明确滚动边界；不让右侧阅读内容在页面下滑时消失。
  - 保持现有稳定 key，避免为每条 RSS 记录创建额外布局容器。
- [ ] **Step 4: 运行 RSS 测试**
  - 运行 `npm.cmd test -- --test-name-pattern="rss|RSS"`。

### Task 6: 统一灵感、稍后阅读、GitHub、收件箱、阅读台

**Files:**
- Modify: `components/InspirationPage.tsx`
- Modify: `components/ReadLaterPage.tsx`
- Modify: `components/GithubPage.tsx`
- Modify: `components/InboxPage.tsx`
- Modify: `components/ReadingWorkspacePage.tsx`
- Test: `tests/personalWorkspaceUi.test.mjs`
- Test: `tests/readingWorkspace.test.ts`

- [ ] **Step 1: 写页面合同**
  - 断言每个页面存在统一 page header、filter/list/detail 三段语义，精确打开目标仍能选中正确项。
- [ ] **Step 2: 实现统一列表和详情样式**
  - 页面间共享标题、操作栏、列表行、状态徽标、AI 摘要和来源链接样式。
  - 清除旧的快捷笔记/Markdown 模块，保留真正的记录入口和阅读内容。
- [ ] **Step 3: 修复空状态与错误状态**
  - GitHub 无数据、RSS 无内容、收件箱清空、阅读台空库分别给出下一步动作，不能只留空白。
- [ ] **Step 4: 运行测试**
  - 运行 `npm.cmd test -- --test-name-pattern="personalWorkspace|readingWorkspace|github|inbox"`。

### Task 7: 模态框、浮层和无障碍一致性

**Files:**
- Modify: `components/LinkModal.tsx`
- Modify: `components/SettingsModal.tsx`
- Modify: `components/BackupModal.tsx`
- Modify: `components/ImportModal.tsx`
- Modify: `components/QuickCaptureModal.tsx`
- Modify: `components/LinkDetailsDrawer.tsx`
- Modify: `components/CommandPalette.tsx`
- Test: `tests/buttonAudit.test.mjs`
- Test: `tests/ui.test.mjs`

- [ ] **Step 1: 扫描按钮和输入**
  - 执行已有 button audit，记录缺失 accessible name、focus、disabled 和错误文案的控件。
- [ ] **Step 2: 应用统一浮层 token**
  - 仅保留一层浮层阴影；弹窗、抽屉和命令面板保持边界、焦点和关闭动作一致。
- [ ] **Step 3: 回归交互**
  - 验证 Escape、Tab、Enter、关闭、提交失败、取消编辑不会丢数据。

### Task 8: webdesign-agency 诊断、性能检查与交付

**Files:**
- Create: `docs/reports/2026-09-10-cloudnav-ui-redesign-audit.md`
- Modify: affected UI files after audit findings

- [ ] **Step 1: 启动本地站点并保存桌面截图/状态**
  - 使用现有 CUA 浏览器打开本地站点，至少检查 1440px 与 1920px。
- [ ] **Step 2: 按命令包顺序执行诊断**
  - 结构/视觉：`improve` 工作流中的 audit + critique。
  - 响应式：`responsive-check` 的主要断点检查。
  - 性能：`performance-audit` 对首屏、布局稳定性和交互响应做记录。
  - 当前环境若没有对应 MCP，则用现有浏览器状态、Node 测试和 build 输出替代，并在报告中标注限制。
- [ ] **Step 3: 应用 polish 结果**
  - 只修复诊断中真实存在的问题，不再继续堆叠新视觉效果。
- [ ] **Step 4: 最终验证**
  - 运行 `npm.cmd test`。
  - 运行 `npm.cmd run test:performance`。
  - 运行 `npm.cmd run build`。
  - 运行 `git diff --check`。
  - 浏览器硬刷新，验证工作台、网站库、RSS、阅读、添加/编辑、天气和主题切换。

## 回滚策略

开始实现前保留当前工作区已有备份和未提交修改；新增 UI 层独立于业务逻辑。若视觉重构导致回归，先回滚 `styles/cloudnav-redesign.css` 与结构标记，不触碰 RSS、搜索、同步和存储修复。
