# NaviX — 项目总结

> CloudNav-abcd / NaviX | 生成日期：2026-07-13 | 项目路径：`D:\CloudNav-abcd`

---

## 1. 项目定位

NaviX 是一个基于 React + TypeScript + Cloudflare Pages 的全栈私有导航站 / 书签管理器。

定位：**从书签展示页升级为个人工作入口控制台。**

部署方式：Cloudflare Pages + KV，无需服务器，免费托管。

---

## 2. 技术栈

| 层 | 技术 |
|---|---|
| 前端框架 | React 19.2.0 |
| 语言 | TypeScript ~5.8.2 |
| 构建工具 | Vite ^6.2.0 |
| 样式 | TailwindCSS ^3.4.19 |
| 图标 | lucide-react ^0.554.0 |
| 拖拽排序 | @dnd-kit |
| 后端 | Cloudflare Pages Functions |
| 存储 | Cloudflare KV |
| 拼音搜索 | pinyin-pro ^3.28.1 |
| AI | @google/genai + OpenAI Compatible API |
| 备份 | WebDAV（坚果云 / InfiniCloud / Nextcloud） |
| PWA | Service Worker + manifest |
| 二维码 | qrcode ^1.5.4 |
| 打包 | jszip ^3.10.1 |

---

## 3. 项目结构

```
D:\CloudNav-abcd
├── App.tsx                    # 主入口（~2500 行，已显著减负）
├── index.html                 # HTML 入口
├── index.tsx                  # React 挂载
├── types.ts                   # 全部类型定义
├── vite.config.ts             # Vite 配置
├── tailwind.config.js         # Tailwind 配置
├── tsconfig.json              # TypeScript 配置
├── postcss.config.js          # PostCSS 配置
├── package.json               # 依赖清单
│
├── constants/
│   └── storageKeys.ts         # 全部存储 key 集中管理
│
├── hooks/
│   ├── useAuth.ts             # 认证状态管理
│   ├── useCloudSync.ts        # 云同步状态管理
│   └── useLocalData.ts        # 本地数据状态管理
│
├── services/
│   ├── searchService.tsx       # 搜索 + 高亮
│   ├── localStorageService.ts  # 本地数据加载 + 合并
│   ├── cloudSyncService.ts     # 云同步逻辑
│   ├── defaultSearchSources.ts # 默认搜索源（消除 300 行重复）
│   ├── bookmarkParser.ts       # 浏览器书签 HTML 解析
│   ├── geminiService.ts        # AI 服务（Gemini + OpenAI Compatible）
│   ├── webDavService.ts        # WebDAV 前端代理
│   ├── extensionAssets.ts      # 浏览器扩展生成
│   └── exportService.ts        # HTML 书签导出
│
├── components/
│   ├── CommandPalette.tsx      # Ctrl+K 全局命令面板（新增）
│   ├── LinkModal.tsx           # 新增/编辑链接弹窗
│   ├── AuthModal.tsx           # 登录弹窗
│   ├── BackupModal.tsx         # 备份与恢复
│   ├── ImportModal.tsx         # 导入书签
│   ├── SettingsModal.tsx       # 设置
│   ├── AISettingsTab.tsx       # AI 设置选项卡
│   ├── SiteSettingsTab.tsx     # 网站设置选项卡
│   ├── ExtensionToolsTab.tsx   # 扩展工具选项卡
│   ├── CategoryManagerModal.tsx# 分类管理
│   ├── CategoryAuthModal.tsx   # 分类密码验证
│   ├── CategoryActionAuthModal.tsx # 分类操作授权
│   ├── SearchConfigModal.tsx   # 搜索配置
│   ├── ContextMenu.tsx         # 右键菜单
│   ├── QRCodeModal.tsx         # 二维码弹窗
│   ├── Icon.tsx                # Lucide 图标包装
│   ├── IconSelector.tsx        # 图标选择器
│   └── useModalA11y.ts         # 可访问性 Hook
│
├── functions/api/              # Cloudflare Functions
│   ├── storage.ts              # KV 数据读写 + 配置管理
│   ├── link.ts                 # 浏览器扩展新增链接
│   ├── webdav.ts               # WebDAV 代理
│   └── fetchtitle.ts           # 服务端抓取网页标题
│
├── public/
│   ├── sw.js                   # Service Worker（navix-v2）
│   ├── manifest.webmanifest    # PWA manifest
│   └── icon.svg                # 应用图标
│
├── screenshots/                # 预览截图 SVG
├── doc/                        # 部署文档截图
├── dist/                       # 构建输出
└── README.md                   # 项目说明
```

---

## 4. 当前功能清单

### 核心功能
- [x] 链接管理（增删改查、拖拽排序、置顶）
- [x] 分类管理（增删改、排序、图标、颜色）
- [x] 分类加密锁（私有目录密码保护）
- [x] 批量编辑（全选、批量移动、批量删除）
- [x] 外部搜索源（必应、Google、百度等 10+ 搜索引擎）
- [x] 拼音搜索 + 标签搜索
- [x] 连接健康检查（数据模型已支持，UI 待完整实现）

### AI 能力
- [x] 多模型支持（Gemini / OpenAI / DeepSeek / Claude 等）
- [x] 一键批量补全链接描述
- [x] AI 智能分类建议
- [x] 添加链接时 AI 辅助（描述 + 分类）

### 数据同步与安全
- [x] Cloudflare KV 云同步（多端数据实时同步）
- [x] 乐观锁冲突检测（409 冲突自动合并重试）
- [x] 写前快照（`app_data_prev` 回滚）
- [x] 待同步队列（网络失败自动 30s 重试）
- [x] WebDAV 双重备份（覆盖 + 时间戳版本）
- [x] JSON / HTML 导入导出
- [x] Chrome / Firefox 浏览器扩展生成
- [x] PWA 离线缓存
- [x] 深色模式 / 浅色模式
- [x] 移动端适配

### 效率功能（本次新增）
- [x] **Ctrl+K 全局命令面板** — 搜索链接/分类，执行命令
- [x] **Inbox 待整理** — 新链接默认进入，集中整理
- [x] **标签系统** — 逗号分隔标签，搜索支持标签匹配
- [x] **访问追踪** — visitCount + lastVisitedAt，按频次排序

---

## 5. 数据模型

### LinkItem
```typescript
interface LinkItem {
  id: string;
  title: string;
  url: string;
  icon?: string;
  description?: string;
  categoryId: string;
  tags?: string[];           // 新增
  createdAt: number;
  updatedAt?: number;        // 新增
  deletedAt?: number;        // 新增（tombstone）
  pinned?: boolean;
  pinnedOrder?: number;
  order?: number;
  visitCount?: number;       // 新增
  lastVisitedAt?: number;    // 新增
  note?: string;             // 新增
}
```

### Category
```typescript
interface Category {
  id: string;
  name: string;
  icon: string;
  color?: string;
  password?: string;
  passwordHash?: string;     // 新增
  createdAt?: number;        // 新增
  updatedAt?: number;        // 新增
  deletedAt?: number;        // 新增
}
```

---

## 6. 构建状态

```
npm run build → 成功（1782 modules, 0 errors）

输出：
  dist/index.html                    1.40 kB
  dist/assets/index-*.css          283 kB
  dist/assets/index-*.js          2001 kB

警告：单 chunk 超过 500 kB，后续建议 manualChunks 拆分
```

---

## 7. 数据兼容

| 层 | 处理方式 |
|---|---|
| localStorage key | 保留 `cloudnav_*` 旧 key，不改坏存量用户数据 |
| Cloudflare KV binding | 支持 `NAVIX_KV`，fallback `CLOUDNAV_KV` |
| KV 内部 key | 不变（`app_data` / `search_config` 等） |
| WebDAV 备份 | 新备份写 `navix_backup.json`，兼容恢复 `cloudnav_backup.json` |
| 浏览器扩展 | 展示名改为 NaviX Pro，内部 ID 保留（`cloudnav_data` 等） |
| x-auth-password | 不变，保持前后端互通 |
| 默认标题 | 旧 `CloudNav - 我的导航` 自动升级为 `NaviX - 我的导航` |

---

## 8. 变更摘要

| 维度 | 变更 |
|---|---|
| 展示品牌 | CloudNav / 云航 → NaviX |
| 包名 | cloudnav-(云航) → navix |
| 存储 key | 常量集中到 `constants/storageKeys.ts` |
| 搜索源 | 提取为 `services/defaultSearchSources.ts`，消除 3 处重复（~300 行） |
| 搜索函数 | 提取为 `services/searchService.tsx` |
| 同步逻辑 | 提取为 `hooks/useCloudSync.ts` |
| 本地数据 | 提取为 `hooks/useLocalData.ts` + `services/localStorageService.ts` |
| 认证状态 | 提取为 `hooks/useAuth.ts` |
| 退出登录 | 补充清理 `lastLoginTime` + `unlockedCategoryIds` |
| JSON 导出 | 不再包含 AI apiKey |
| WebDAV | 明文密码警告 + 清除凭据按钮 |
| 扩展工具 | 安全提示 |
| 新增功能 | Ctrl+K 命令面板、Inbox 待整理、标签系统、访问追踪 |
| 数据模型 | tags、updatedAt、deletedAt、visitCount、lastVisitedAt、note、passwordHash |

---

## 9. 下一步建议

### 短期想改可以改
- `vite.config.ts` 增加 `manualChunks` 拆分大 chunk
- `git init && git add . && git commit -m "Initial NaviX"` 完成版本管理
- 更新 `README.md` 中的在线演示域名
- 更新 `doc/*.png` 截图（旧图含 CloudNav 水印）

### 想做更多功能可以选
- 链接健康检查 UI（数据模型已支持 `health?` 字段）
- 快照回滚界面（后端已有 `app_data_prev`）
- 移动端底部导航栏
- 工作区模式
- 语义 AI 搜索
- `useMemo` / `useCallback` 进一步优化渲染性能
