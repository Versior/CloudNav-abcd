---
id: task-cloudnav-consolidation
type: task-spec
status: draft
title: CloudNav 云同步、R2 备份与功能收敛改造
parent: cloudnav-architecture
covers: [cloudnav-ui, cloudnav-services, cloudnav-api]
depends-on: [cloudnav-architecture]
tags: [cloudnav, r2, sync, ai, refactor]
---

## 请求

全面理解并优化 CloudNav：提升响应速度，收敛代码逻辑，改善界面布局，修复 AI；部署到一个 Cloudflare Pages 项目，使用 R2 保存唯一最新备份；仅在书签数据实际修改后备份；不同设备打开或回到页面时读取最新云端数据；移除 WebDAV、定时批量书签探测、账号密码保险箱和待整理功能。

## 已确认的源码事实

- 当前主写入逻辑在 App.tsx，Pages storage POST 直接覆盖 KV 的 app_data；旧 hooks/cloudSyncService 有版本逻辑但未接入。
- 当前仓库没有 R2 binding 或 R2 API；workers/ 下存在未确认部署关系的独立脚本。
- WebDAV UI/API/服务和 workers/ 多套实现重复；BackupModal 还调用未实现的历史/上一版本路径。
- AI 有 Pages 代理与浏览器直连两条路径，前端代理把 config 一并发送；服务端会从 KV 或环境读取 API key。OpenAI 地址需要规范化到 chat completions。
- 待整理由 INBOX_ID、HomeDashboard、OrganizeModeBar、AISettingsTab 和 App 编排共同实现。
- 账号保险箱由 LinkItem.credentials、credentialCrypto、LinkDetailsDrawer 和若干去重/备份逻辑共同实现。
- 健康检测包含手动 UI/API 和独立定时 Worker。

## 设计方案（已确认，待实施）

### 1. 部署与存储收敛

只保留一个 Cloudflare Pages 项目：静态资源和 functions/api 同属 Pages；不部署 workers/ 下的独立 Worker。统一 KV binding 名为 NAVIX_KV，并在代码中兼容旧 CLOUDNAV_KV 迁移窗口，避免 README 与实际代码不一致。

KV 保存当前书签数据、设置和轻量配置。R2 只保存 `latest.json` 一个对象，不保存时间戳文件、不列历史、不做定时任务。R2 binding 采用 `NAVIX_BACKUPS`。

书签写入成功后，服务端根据规范化书签数据的哈希判断是否真的变化。变化时覆盖 R2 `latest.json`；未变化时不上传。R2 备份失败不回滚已成功的 KV 保存，但向前端返回可识别的 backup 状态并记录安全错误信息。备份读写和恢复由 Pages API 统一处理，不再引入独立 Worker。

“只保留最新一份”只处理本项目约定的备份对象和旧备份命名，不触碰同一 R2 bucket 中其他项目的对象。项目自己的旧对象通过一次性受保护清理路径或明确的部署前清理步骤处理；不未经用户确认删除未知对象。

### 2. 跨设备同步

app_data 增加服务端版本号和更新时间。保存请求携带 `baseVersion`；版本不匹配时返回 409 和最新数据，前端显示可理解的冲突选择。空数组是有效云端数据，不能回退旧 localStorage。

页面首次加载读取云端；页面从后台回到前台或获得焦点时低频刷新一次，发现版本更新才替换本地数据。禁止高频轮询和定时同步，避免消耗账户级免费请求额度。书签修改采用防重复写入/顺序提交，避免多次快速操作互相覆盖。

### 3. AI 修复

保留 Gemini 与 OpenAI-compatible 两种可选提供商，但统一走 `/api/ai` 代理。API key 统一由 Cloudflare Secrets 提供，例如 `GEMINI_API_KEY` / `OPENAI_API_KEY`；浏览器不再把 API key 发到第三方、localStorage、KV 或备份。服务端只接受部署配置中的密钥。API 返回统一 `{ text, error, provider, retryable }` 形状，隐藏密钥和完整上游敏感响应。

统一模型名和 endpoint 校验，补充请求超时、响应 JSON 校验、错误分类及 429/503 的有限退避。批量 AI 操作串行或低并发、单次保存，避免当前每个书签更新都触发一次云端保存。AI 配置界面保留提供商、模型和接口自检，但不再提供 API key 输入框。

### 4. 功能移除与数据迁移

移除 WebDAV 设置、手动备份/恢复、历史备份列表、WebDAV API/service 和独立 WebDAV/自动备份 Worker。

全部移除健康检测：删除手动健康检测 UI/API、健康状态字段、健康服务及 health-cron Worker。不再从后台或用户操作探测书签。

移除账号密码保险箱 UI、加解密 service、LinkItem.credentials 相关类型和备份/搜索展示逻辑。已有 `credentials` 字段在迁移保存时直接丢弃，不提供导出入口；不影响普通书签字段。

移除待整理/InBox 工作流：不再创建 INBOX 分类、不显示待整理统计、OrganizeModeBar 和 AI 待整理入口。已有 `__inbox__` 书签默认迁移到 `common`，而不是删除；相关 AI 分类范围选项同步移除。

### 5. UI 与性能

把 App.tsx 的数据访问、同步和状态编排抽到明确的 hooks/services，删除未接入的重复同步实现。高成本弹窗（设置、导入、二维码等）按需加载；只保留需要的图标导入，避免整个 lucide-react 命名空间进入主包。首页保留搜索、置顶和分类主路径，压缩重复统计卡片和低频管理入口；移动端优先，保证主要操作在首屏可见。

所有行为保持在现有书签、分类、搜索、导入导出和登录契约内，除本任务明确移除的功能。加入最小单元/服务测试，至少覆盖同步版本冲突、空数据、R2 唯一对象、AI endpoint 和迁移清洗。

## 已确认的决策

- 健康检测：全部移除，包括手动 UI、API、状态字段与独立 Worker。
- AI 密钥：使用 Cloudflare Secrets；不保留浏览器输入 API key 的模式。
- 保险箱旧数据：直接丢弃 `credentials` 字段，不增加导出入口。
- R2 清理：仅保留本项目的 `latest.json`；同一 bucket 中其他项目对象不处理。

## 验收标准

- 一个 Pages 项目即可部署前端和 API；不需要部署 workers/ 下的独立实例。
- 书签未改变时不产生 R2 PUT；书签改变后只覆盖 `latest.json`，R2 不出现时间戳历史堆积。
- 空书签集可跨设备同步，不被旧本地缓存复活；版本冲突不会静默覆盖。
- AI 测试、描述、分类和保留功能在 Gemini/OpenAI-compatible 配置下有可诊断错误；API key 不进浏览器存储、KV 或备份。
- WebDAV、健康检测、账号保险箱、待整理功能及其入口均不再出现在构建产物和运行 UI 中。
- `npm run typecheck`、`npm run build` 和新增测试通过；构建包体积较当前 1.52 MB 主 JS 有可量化下降。
