---
id: cloudnav-services
type: module-design
status: active
title: 浏览器侧数据与外部能力适配
parent: cloudnav-architecture
tags: [cloudnav]
---

## 职责

此层提供书签解析与导出、搜索和去重、浏览器缓存、AI API 客户端及扩展资源适配。数据规范化负责把旧 InBox 迁移到 `common`，并在保存前丢弃 `credentials` 与健康状态等已移除字段。

## 边界

浏览器侧 AI 只请求同源 `/api/ai`，不直连供应商、不携带 API key。外部服务密钥只存在 Pages Secrets。WebDAV、健康检测、凭据加解密和旧同步实现不属于此层。

前端数据更新必须通过统一同步入口；不得在每个批量 AI 项目或 UI 组件中各自实现一套云端写入逻辑。
