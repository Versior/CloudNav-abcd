# CloudNav Full Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with verification checkpoints.

**Goal:** 将 CloudNav 升级为带有定时链接健康检测、可回滚历史、批量整理、版本化备份、增强搜索、离线缓存和安全审计的个人导航工作台。

**Architecture:** 保留现有 React + Cloudflare Pages Functions + KV 架构。把数据处理拆成纯函数服务，先用单元测试锁定行为，再接入现有 `App.tsx` 和设置弹窗。定时任务使用独立 Cloudflare Worker 读取同一 KV 命名空间，避免依赖浏览器常驻；前端只负责配置和展示。

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS, Cloudflare Pages Functions, Cloudflare KV, Cloudflare Workers Cron, Node test runner。

## Global Constraints

- 保留现有 UI 视觉风格，不重做主导航和置顶网站页面。
- 首屏继续使用本地缓存立即渲染，远程配置不得阻塞链接展示。
- 只有明确 404/410 才允许批量清理，403/429/5xx/超时必须保留为待确认。
- 所有 KV 写入继续经过认证；定时 Worker 使用独立的 Cron secret 或同一 KV 绑定，不暴露 PASSWORD。
- 不把 Global API Key、PASSWORD 或 WebDAV 密码写入源码、日志、备份下载文件或最终回复。
- 每个新增纯函数先写失败测试，再实现最小代码，再跑全量测试。

---

### Task 1: 健康检测数据模型与定时扫描核心

**Files:**
- Create: `services/healthSchedule.ts`
- Create: `workers/health-cron.ts`
- Create: `wrangler.health-cron.toml`
- Modify: `types.ts`
- Modify: `functions/api/storage.ts`
- Modify: `functions/api/link.ts`
- Test: `tests/healthSchedule.test.ts`

**Interfaces:**
- `normalizeHealthSchedule(value: unknown): HealthScheduleConfig`
- `getNextHealthRun(config: HealthScheduleConfig, now: number): number | null`
- `summarizeHealthRun(links: LinkItem[]): HealthRunSummary`
- KV keys: `health_schedule_config`, `health_last_run`, `health_run_history`。

- [ ] 写测试：无效配置回退默认值、间隔计算、扫描摘要计数和只清理 404/410。
- [ ] 运行 `node --experimental-strip-types --test tests/healthSchedule.test.ts`，确认因模块不存在或断言失败而 RED。
- [ ] 实现纯函数和共享类型。
- [ ] 让 Pages API 认证读写健康检测配置和最近扫描结果。
- [ ] 实现 Worker Cron：读取 `app_data` 和配置，按并发上限探测公开 URL，更新链接 health、保存摘要与历史，跳过未启用或未到时间的扫描。
- [ ] 运行单测、类型检查和 Worker 构建检查。

### Task 2: 健康检测设置与工作台入口

**Files:**
- Create: `components/HealthSchedulePanel.tsx`
- Modify: `components/SettingsModal.tsx`
- Modify: `App.tsx`
- Modify: `components/HomeDashboard.tsx`
- Test: `tests/ui.test.mjs`

- [ ] 写静态 UI 测试：设置面板包含启用、频率、范围、立即检测、最近运行信息。
- [ ] 运行 UI 测试确认 RED。
- [ ] 实现面板，保存到 `health_schedule_config`，立即检测复用现有 `checkLinkHealth`。
- [ ] 工作台增加健康状态卡片，但不恢复旧的“13 个链接可能已失效”告警。
- [ ] 验证设置保存、首屏本地数据和检测状态不会互相阻塞。

### Task 3: 数据历史、快照与回滚

**Files:**
- Create: `services/historyService.ts`
- Create: `components/HistoryPanel.tsx`
- Modify: `functions/api/storage.ts`
- Modify: `App.tsx`
- Modify: `components/BackupModal.tsx`
- Test: `tests/historyService.test.ts`

- [ ] 写测试：生成快照摘要、限制保留数量、按版本回滚、拒绝越界版本。
- [ ] 运行测试确认 RED。
- [ ] 每次成功保存 app data 前写入带版本号和摘要的快照，保留最近 30 个版本。
- [ ] 增加历史列表、差异摘要、恢复前确认和恢复后自动生成新版本。
- [ ] 让现有“回滚上一版本”改为打开历史面板，而不是只支持一个 prev 快照。

### Task 4: 批量整理与增强搜索

**Files:**
- Create: `services/bulkActions.ts`
- Modify: `App.tsx`
- Modify: `components/AdvancedSearchBar.tsx`
- Modify: `components/CommandPalette.tsx`
- Modify: `services/searchService.tsx`
- Test: `tests/bulkActions.test.ts`
- Test: `tests/searchService.test.ts`

- [ ] 写测试：批量分类、批量标签、批量置顶、批量归档和排序结果稳定性。
- [ ] 运行测试确认 RED。
- [ ] 实现纯函数批量变更，统一走现有 `updateData` 和版本冲突处理。
- [ ] 增加标签、分类、访问次数、健康状态、未整理和最近访问过滤。
- [ ] 增加最近搜索和键盘快捷键，并保持拼音库按需加载。

### Task 5: 版本化备份与恢复保护

**Files:**
- Modify: `components/BackupModal.tsx`
- Modify: `services/webDavService.ts`
- Modify: `App.tsx`
- Modify: `types.ts`
- Test: `tests/backupService.test.ts`

- [ ] 写测试：备份元数据、敏感字段脱敏、文件名排序和恢复前校验。
- [ ] 运行测试确认 RED。
- [ ] 备份包含 schemaVersion、createdAt、linkCount、categoryCount 和 app data version。
- [ ] WebDAV 列表按时间排序，恢复前展示差异摘要并要求确认。
- [ ] 保留 JSON/HTML 导出兼容性，不导出原始 AI key、PASSWORD 或 WebDAV 密码。

### Task 6: 加载性能、PWA 和离线体验

**Files:**
- Modify: `public/sw.js`
- Modify: `index.html`
- Modify: `public/manifest.webmanifest`
- Modify: `App.tsx`
- Test: `tests/performance.test.mjs`
- Test: `tests/ui.test.mjs`

- [ ] 写测试：生产入口预算、manifest、Service Worker 不缓存 API/认证响应。
- [ ] 运行测试确认 RED。
- [ ] 使用版本化缓存缓存静态 shell，导航 network-first，API 始终 network-only。
- [ ] 增加在线/离线状态与“最后同步时间”，离线仍可打开本地置顶网站。
- [ ] 保持首屏入口小于 1 MB，非首屏弹窗继续动态加载。

### Task 7: 安全审计与发布验证

**Files:**
- Modify: `public/_headers`
- Modify: `functions/_shared/auth.ts`
- Modify: `functions/api/storage.ts`
- Modify: `functions/api/link.ts`
- Modify: `tests/security.test.ts`
- Modify: `README.md`

- [ ] 写测试：认证接口 no-store、Cron secret 不回显、健康检测禁止内网地址、导出脱敏、CSP 不阻断应用。
- [ ] 运行安全测试确认 RED。
- [ ] 增加 CSP、Permissions-Policy、Referrer-Policy 和更严格的缓存头。
- [ ] 增加会话注销后的前端缓存清理和敏感配置内存清理。
- [ ] 运行 `npm.cmd test`、`npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run test:performance`。
- [ ] 使用 Wrangler 发布 Pages 和 Cron Worker，验证主页、鉴权接口、健康配置接口、历史接口均返回预期状态。

## Verification Gates

每个 Task 完成后必须先通过对应测试，再进入下一 Task。最终发布前必须验证：

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:performance
git diff --check
```

计划已按“纯函数与后端能力 → 设置 UI → 数据历史 → 批量搜索 → 备份 → PWA → 安全发布”顺序执行，任何一项失败都先修复测试和根因，再继续发布。
