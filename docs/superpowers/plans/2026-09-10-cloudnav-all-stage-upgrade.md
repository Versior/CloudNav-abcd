# CloudNav 全阶段升级实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把 CloudNav 从“网站收藏夹 + RSS 页面”升级为电脑端个人信息工作台，并完成验证与 Cloudflare 部署。

**Architecture:** 保留现有 React + Cloudflare Pages 结构，先在不破坏已有数据的前提下补齐统一本地事件、RSS 正文数据、快捷操作和按需加载；再把高频页面的数据访问收敛到可测试的服务函数。部署继续使用当前 Cloudflare Pages 项目，不改变用户已有入口与数据格式。

**Tech Stack:** React 19, TypeScript, Vite, Cloudflare Pages Functions, localStorage/IndexedDB, lucide-react, Node test runner。

## Global Constraints

- 电脑端优先；不新增 iframe、内嵌网页或大面积遮罩。
- 保留现有数据格式并提供向后兼容归一化，禁止清空用户数据。
- RSS 默认先显示本地缓存，网络刷新必须后台进行且单源失败不能阻塞其他源。
- AI 摘要只按需生成并缓存，不自动对所有文章调用模型。
- 敏感配置不得在 UI 或备份中泄露原始密钥。
- 每个功能必须有单元测试或交互审计覆盖，完成前运行完整测试、构建和生产预览验证。

---

### Task 1: 统一工作区本地事件与按需页面加载

**Files:**
- Create: `services/workspaceStorage.ts`
- Modify: `App.tsx`
- Modify: `components/InspirationPage.tsx`
- Modify: `components/ReadLaterPage.tsx`
- Modify: `components/GithubPage.tsx`
- Test: `tests/workspaceStorage.test.ts`

**Deliverable:** 跨页面写入后全局搜索和其他页面立即刷新；非首屏工作区按需加载，减少首页初始 JS。

### Task 2: RSS 正文与阅读质量

**Files:**
- Modify: `types.ts`
- Modify: `services/rssParser.ts`
- Modify: `services/rssService.ts`
- Modify: `components/RssReaderPage.tsx`
- Modify: `index.css`
- Test: `tests/rssParser.test.ts`
- Test: `tests/rssService.test.ts`

**Deliverable:** 保留 RSS 正文纯文本，阅读层优先展示正文；缺正文时明确降级到摘要；保留 AI、收藏、稍后阅读入口。

### Task 3: RSS 刷新并发、缓存与快捷键

**Files:**
- Modify: `services/rssService.ts`
- Modify: `components/RssReaderPage.tsx`
- Modify: `functions/api/rss.ts`
- Test: `tests/rssService.test.ts`
- Test: `tests/rssPage.test.ts`

**Deliverable:** 初次进入先显示缓存，刷新源限并发、单源超时隔离；RSS 阅读页支持 J/K/O/S/R 快捷键。

### Task 4: 统一收件箱与内容动作

**Files:**
- Modify: `types.ts`
- Create: `services/inboxService.ts`
- Create: `components/InboxPage.tsx`
- Modify: `App.tsx`
- Modify: `components/RssReaderPage.tsx`
- Modify: `components/ReadLaterPage.tsx`
- Modify: `index.css`
- Test: `tests/inboxService.test.ts`
- Test: `tests/personalWorkspaceUi.test.mjs`

**Deliverable:** RSS、网站、GitHub、灵感和待办能够进入一个可筛选的统一收件箱，并支持已读、收藏、归档、转灵感、转待办。

### Task 5: GitHub 项目雷达与服务端缓存边界

**Files:**
- Create: `functions/api/github.ts`
- Modify: `components/GithubPage.tsx`
- Modify: `services/githubService.ts`
- Modify: `vite.config.ts`
- Test: `tests/githubService.test.ts`

**Deliverable:** GitHub 元数据通过同源 API 获取并具备缓存/限流降级；前端保留手动追踪和刷新，不因 GitHub 限流阻塞其他工作区。

### Task 6: 安全、同步与性能收尾

**Files:**
- Modify: `functions/api/storage.ts`
- Modify: `App.tsx`
- Modify: `index.css`
- Modify: `public/sw.js`
- Modify: `index.html`
- Test: `tests/security.test.ts`
- Test: `tests/performance.test.mjs`

**Deliverable:** AI/WebDAV 密钥不再通过普通配置响应泄露；云同步写入防抖；旧 CSS 缓存失效；首页首包与路由加载预算保持可控。

### Task 7: 全量验证与 Cloudflare 发布

**Files:**
- Verify: all modified files and `dist/`

**Checks:**
- `npm.cmd test`
- `npm.cmd run test:performance`
- `npm.cmd run build`
- `git diff --check`
- local browser smoke test for links, RSS, inbox, inspiration, read-later, GitHub
- Cloudflare Pages deployment to `cloudnav-abcd` branch `main`
- verify preview URL and `https://nav.006680.xyz/`
