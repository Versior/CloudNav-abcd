# CloudNav 工作台布局优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在保持现有蓝白风格和功能行为的前提下，把工作台改成清晰的主列/侧列分层布局。

**Architecture:** 只重构 `HomeDashboard` 的呈现层，复用现有数据计算、回调和 `WorkbenchTools`。通过稳定的 `data-dashboard-zone` 标记约束布局结构，使用 Tailwind 响应式网格实现桌面、平板和移动端适配，不引入新依赖。

**Tech Stack:** React 19、TypeScript、Tailwind CSS、Node `node:test`、Vite。

## Global Constraints

- 保持现有蓝白视觉方向、默认页面、导航、数据模型和工作台功能不变。
- 不修改置顶网站页面行为。
- 桌面端使用主列 + 侧列；中等宽度堆叠；移动端单列且不出现页面横向滚动。
- 所有现有交互回调必须继续使用：`onOpenInbox`、`onClickLink`、`onSelectCategory`、`onConfigChange`、`onWorkbenchToolsChange`。

---

### Task 1: 建立布局回归测试

**Files:**
- Modify: `tests/ui.test.mjs`
- Test: `tests/ui.test.mjs`

- [x] **Step 1: 写失败测试**

在现有 UI 静态测试中增加：

```js
test('workbench uses a layered layout with explicit content zones', () => {
  const source = readFileSync(new URL('../components/HomeDashboard.tsx', import.meta.url), 'utf8');
  assert.match(source, /data-dashboard-layout=["']layered["']/);
  for (const zone of ['intro', 'metrics', 'folders', 'recent', 'quick', 'tasks', 'notes']) {
    assert.match(source, new RegExp(`data-dashboard-zone=["']${zone}["']`));
  }
  assert.match(source, /grid-cols-1[\s\S]*xl:grid-cols-\[minmax\(0,1\.65fr\)_minmax\(270px,\.9fr\)\]/);
});
```

- [x] **Step 2: 运行测试确认失败**

运行：`node --experimental-strip-types --test tests/ui.test.mjs`

预期：新增测试失败，因为 `HomeDashboard.tsx` 还没有 layered 布局和区域标记。

### Task 2: 重构工作台结构

**Files:**
- Modify: `components/HomeDashboard.tsx`

- [x] **Step 1: 保留现有业务计算**

继续使用现有 `normalLinks`、`inboxLinks`、`brokenLinks`、`recentLinks`、`freqLinks`、`folderCards` 计算和所有现有回调，不改动数据来源。

- [x] **Step 2: 替换页面外层和标题区**

使用透明页面背景和 `data-dashboard-layout="layered"`，标题区添加 `data-dashboard-zone="intro"`，右侧保留自定义模块按钮和待整理入口；时间继续放在标题区右侧。

- [x] **Step 3: 调整指标和文件夹区域**

将统计卡收敛为三张指标卡并放入 `data-dashboard-zone="metrics"`；将文件夹改为横向紧凑按钮条并放入 `data-dashboard-zone="folders"`，点击仍调用 `onSelectCategory(folder.id)`。

- [x] **Step 4: 采用主列/侧列内容网格**

主列放最近访问并标记 `recent`；侧列依次放高频链接和待办，分别标记 `quick`、`tasks`；底部笔记和 Markdown 放入 `notes` 网格。所有链接点击仍调用 `onClickLink`，待办和工具继续交给 `WorkbenchTools`。

- [x] **Step 5: 保留自定义模块能力**

继续渲染 `config.hidden`、模块排序和恢复默认入口；只改变视觉分组，不删除原有模块切换行为。

### Task 3: 验证响应式和交互

**Files:**
- Modify: `tests/ui.test.mjs`
- Verify: `components/HomeDashboard.tsx`

- [x] **Step 1: 运行 UI 回归测试**

运行：`node --experimental-strip-types --test tests/ui.test.mjs`

预期：所有 UI 静态测试通过。

- [x] **Step 2: 运行全量测试和类型检查**

运行：`npm.cmd test`、`npm.cmd run typecheck`

预期：全部测试通过，TypeScript 无错误。

- [x] **Step 3: 生产构建**

运行：`$env:NODE_OPTIONS='--max-old-space-size=4096'; npx.cmd vite build`

预期：Vite 构建成功，无编译错误。

- [x] **Step 4: 浏览器检查**

在 `https://nav.006680.xyz/` 打开工作台，确认标题区、三张指标卡、文件夹条、最近访问主列、高频/待办侧列和底部工具区层级符合设计；再切换到置顶网站，确认其页面不显示所有链接。

- [x] **Step 5: 发布**

运行：`npx.cmd wrangler pages deploy dist --project-name cloudnav-abcd --branch main --commit-dirty=true`

预期：Cloudflare Pages 部署成功，自定义域名返回 HTTP 200。
