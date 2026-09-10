# CloudNav 个人信息工作台实施计划

> 先用纯函数和存储服务稳定数据边界，再接入桌面页面；每个任务先写失败测试，再实现。

## 任务 1：灵感与稍后阅读领域服务

- [x] 新增 `Inspiration`、`ReadLaterItem`、`GithubWatchItem` 类型和存储 key。
- [x] 新增 `services/inspirationService.ts`，实现归一化、排序、CRUD、标签筛选。
- [x] 新增 `services/readLaterService.ts`，实现按 URL 去重、状态转换和跨来源导入。
- [x] 新增 GitHub URL 解析与仓库元数据归一化服务。
- [x] 先运行领域测试确认红灯，再实现至绿灯。

## 任务 2：桌面灵感库与快速记录

- [x] 新增 `InspirationPage` 和 `QuickCaptureModal`，桌面三列布局，不使用 iframe。
- [x] 接入 `App.tsx` 的导航、命令面板、空间切换与快速记录。
- [x] 从 RSS 文章和网站链接预填记录，编辑后保存到本地。
- [x] 加入空态、错误态、离线可用提示和命令面板入口。

## 任务 3：稍后阅读与 GitHub 页面

- [x] 新增 `ReadLaterPage`，支持未读/已读/归档筛选与打开原文。
- [x] 新增 `GithubPage`，支持手动添加仓库、刷新 GitHub API、展示描述与错误状态。
- [x] 对 GitHub API 失败、限流和无 README 做明确状态展示。

## 任务 4：统一搜索与备份

- [x] 扩展搜索索引覆盖灵感、稍后阅读和 GitHub。
- [x] 备份 envelope 增加可选数据并保持旧备份可恢复。
- [x] 导入/恢复后执行各领域归一化，避免坏数据污染页面。

## 任务 5：验证与部署

- [x] 全量测试、类型检查、构建、性能测试。
- [x] 生成部署前备份，部署 Cloudflare Pages。
- [x] 验证首页、自定义域名、天气和新工作区关键文案。
