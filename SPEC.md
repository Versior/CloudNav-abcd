---
id: cloudnav-ui
type: module-design
status: active
title: 导航界面与应用编排
parent: cloudnav-architecture
tags: [cloudnav]
---

## 职责与边界

应用层协调导航展示、分类和链接编辑、搜索、导入导出、认证状态、AI 设置和同步反馈。App 负责组合状态与交互，不直接承载重复的存储协议实现；数据迁移与同步细节归服务/API 边界。

UI 不再展示 WebDAV、健康检测、账号密码保险箱或待整理/InBox 入口。设置弹窗包含网站、备份与恢复、AI、重复检测和扩展工具页面；备份页提供 JSON 导入/导出，并说明 R2 自动备份策略。弹窗和低频管理面板按需加载，首屏聚焦搜索、置顶、分类和书签卡片。

## 数据行为

用户修改先更新界面和本地缓存，再向 API 提交带 `baseVersion` 的规范化数据。云端空数据覆盖本地旧缓存；页面恢复可见时按版本刷新，不使用高频轮询。
