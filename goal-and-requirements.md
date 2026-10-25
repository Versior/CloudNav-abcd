---
id: cloudnav-goals
type: goal-and-requirements
status: active
title: CloudNav 二开范围与目标
tags: [cloudnav]
---

## 目标

CloudNav 是个人私有导航与书签管理站。本轮二开以一个 Cloudflare Pages 项目为部署单元，使用 KV 保存当前数据、R2 保存本项目唯一的最新备份，并降低首屏体积、动态请求和维护复杂度。

书签实际修改时才覆盖 R2 `cloudnav/latest.json`；未修改不产生 R2 上传。不同设备首次打开或页面回到前台时读取云端版本，空书签集合也必须是有效状态。

## 范围

保留书签、分类、搜索、导入导出、登录、AI 辅助和手动编辑等核心能力。移除 WebDAV、健康检测、账号密码保险箱和待整理/InBox 工作流。已有 InBox 书签迁移到 `common`；保险箱 `credentials` 字段直接丢弃；普通书签字段不因功能裁剪而删除。

AI 统一经 Pages API 代理，密钥来自 Cloudflare Secrets，不进入浏览器存储、KV 或备份。R2 只处理本项目约定的对象，不触碰同一 bucket 中其他项目的数据。

## 源码与部署基线

源码仓库为 CloudNav-abcd，远端 main 基线为 `9bb1ccc`。部署目标是一个 Cloudflare Pages 项目；`functions/api` 随 Pages 一起部署，不部署仓库中的独立 `workers/` 实例。
