---
id: cloudnav-architecture
type: architecture-design
status: active
title: CloudNav 现有系统架构
parent: cloudnav-goals
tags: [cloudnav]
---

## 拓扑与边界

一个 Cloudflare Pages 项目同时提供静态前端和 Pages Functions。浏览器入口装配 React 应用；应用编排调用浏览器侧数据模型、组件和同源 API。KV 保存规范化的当前书签数据及配置，R2 只保存 `cloudnav/latest.json` 最新快照。

Pages API 统一负责认证、数据版本控制、配置读取、AI 代理和 R2 最新备份。前端不直连 AI 服务，也不保存服务端 AI 密钥。独立 `workers/` 不属于部署拓扑。

## 数据一致性

`app_data` 携带 `version` 与 `updatedAt`。写请求携带 `baseVersion`，版本不匹配返回 409 和云端数据；空 `links` 数组是有效数据。服务端保存成功后按规范化数据哈希决定是否覆盖 R2，R2 键固定，不生成历史对象。

页面首次加载以及回到前台/获得焦点时低频读取云端；禁止后台定时轮询。KV 的最终一致性意味着跨地点读取可能有传播延迟，前端必须使用版本号避免旧响应覆盖新状态。

## 功能边界

保留书签编辑、分类、搜索、导入导出、登录和 AI 辅助。WebDAV、手动及定时健康检测、账号密码保险箱和待整理/InBox 工作流均不再是系统边界。旧 InBox 数据迁移到 `common`；旧 `credentials` 数据在规范化保存时丢弃。

## 运行与验证约束

KV binding 首选 `NAVIX_KV`，兼容迁移期旧名 `CLOUDNAV_KV`；R2 binding 为 `NAVIX_BACKUPS`。AI Secrets 使用 `GEMINI_API_KEY` 和 `OPENAI_API_KEY`。

`npm run build` 必须通过 TypeScript 检查和 Vite 构建。测试必须覆盖数据规范化、版本冲突、AI endpoint 和 R2 唯一对象行为；不把 `npm test` 占位脚本视为覆盖。
