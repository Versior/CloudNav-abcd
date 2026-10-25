---
id: cloudnav-api
type: module-design
status: active
title: Pages API 与服务端信任边界
parent: cloudnav-architecture
tags: [cloudnav]
---

## 职责

Pages Functions 提供认证、规范化书签数据持久化、AI 代理、R2 最新备份和网页标题/扩展所需的受保护接口。所有动态接口属于同一个 Pages 项目。

## 安全与一致性

受保护路径统一使用共享认证。普通数据写入校验 `baseVersion`，冲突返回 409；写入数据会移除 `credentials`、健康字段并把 `__inbox__` 迁移到 `common`。API key 只从 `GEMINI_API_KEY` / `OPENAI_API_KEY` Secrets 读取。

R2 仅操作 `cloudnav/latest.json`，按数据哈希跳过重复 PUT；备份失败不回滚 KV，但返回可诊断状态。清理旧备份只允许匹配本项目命名空间，不触碰同 bucket 其他项目。

WebDAV、健康检测及其 API 已移出边界。Pages 不依赖 `workers/` 下的独立部署。
