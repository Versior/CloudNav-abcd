# 工作台悬浮待办升级 Implementation Plan

> For agentic workers: use the plan task by task. Steps use checkbox syntax for tracking.

Goal: 将工作台待办升级为可拖拽、可吸附、可收起、可筛选且不遮挡内容的桌面悬浮工具。

Architecture: FloatingTodo 继续消费 WorkbenchToolsState，只新增独立的 UI 状态持久化和交互逻辑。待办数据仍由现有工作台状态保存；悬浮坐标、展开状态和筛选器写入独立 localStorage。CSS 使用 fixed 面板、内部滚动和视口边界约束，不改工作台数据模型。

Tech Stack: React 19, TypeScript, lucide-react, CSS, Node test runner.

## Global Constraints

- 保留桌面端悬浮待办，不改为普通工作台卡片。
- 不新增依赖，不修改 WorkbenchToolsState 数据结构。
- 所有可点击图标按钮提供 aria-label 或可见文字。
- 文字保持高对比度，动画尊重 prefers-reduced-motion。
- 不修改 RSS、阅读台和 Cloudflare 部署配置。

---

### Task 1: 补充悬浮待办行为测试

Files:
- Modify: tests/desktopRewrite.test.mjs

Interfaces:
- Consumes: components/FloatingTodo.tsx markup and index.css floating todo selectors.
- Produces: Static UI contract checks for drag handle, filter controls, clear-completed action, persistence key and bounded internal list.

Steps:
- [ ] 在现有 floating todo 测试后增加断言，要求组件包含 data-todo-drag-handle、data-todo-filter、清除已完成和 cloudnav-floating-todo-ui；CSS 包含 touch-action: none、max-height、overflow-y: auto 和 prefers-reduced-motion。
- [ ] 运行 npm.cmd test -- --test-name-pattern="floating todo"，确认新增断言先失败。
- [ ] 保留现有断言，不改变 data-todo-surface="floating" 和 cloudnav-floating-todo 兼容标记。

### Task 2: 实现悬浮待办状态和交互

Files:
- Modify: components/FloatingTodo.tsx

Interfaces:
- Consumes: WorkbenchToolsState、normalizeWorkbenchTools。
- Produces: 悬浮面板 DOM、拖拽吸附、筛选、清除已完成和独立 UI 状态持久化。

Steps:
- [ ] 新增 TodoFilter = all | active | done，以及只保存 open、filter、x、y 的 localStorage 结构；读取失败或坐标非法时回退到默认右下角。
- [ ] 为拖拽手柄添加 pointer events，记录起始坐标和面板位置；移动时限制在视口范围内，pointerup 时吸附到最近的左右边缘并保存。
- [ ] 根据 TodoFilter 生成可见待办；添加全部、进行中、已完成筛选；保留单项完成/恢复和删除；新增清除已完成动作。
- [ ] 保留 data-todo-surface="floating"，增加拖拽手柄、状态筛选、内部列表和收起态数量。所有只含图标的操作提供 aria-label。
- [ ] 运行 npm.cmd run typecheck，确认 TypeScript 检查通过。

### Task 3: 重做悬浮待办视觉和边界

Files:
- Modify: index.css

Interfaces:
- Consumes: Task 2 输出的 class/data 属性。
- Produces: 视口内稳定的悬浮面板、内部列表滚动、拖拽反馈、收起态和 reduced-motion 样式。

Steps:
- [ ] 保留 fixed 悬浮定位，默认 right: 24px 和 bottom: 24px；拖拽态使用坐标变量，同时限制面板最大宽度和最大高度。
- [ ] 使用一层边框和柔和阴影，强化标题、数量、筛选器和输入区层级；不新增嵌套卡片或渐变。
- [ ] 列表只在 cloudnav-floating-todo-list 内滚动；桌面端宽度不超过 360px；小屏幕距离边缘 12px。
- [ ] 手柄使用 touch-action: none 和 grab 光标；按钮有 hover/focus-visible；增加 prefers-reduced-motion 规则。
- [ ] 运行 npm.cmd test -- --test-name-pattern="floating todo"，确认 floating todo 合约通过。

### Task 4: 完整验证并提交

Files:
- Modify: components/FloatingTodo.tsx
- Modify: index.css
- Modify: tests/desktopRewrite.test.mjs
- Create: docs/superpowers/specs/2026-09-10-floating-workbench-design.md
- Create: docs/superpowers/plans/2026-09-10-floating-workbench-plan.md

Steps:
- [ ] 运行 npm.cmd test，确认所有测试通过。
- [ ] 运行 npm.cmd run build，确认类型检查和 Vite 构建成功。
- [ ] 运行 git diff --check，确认没有空白错误。
- [ ] 启动 Vite，在工作台验证悬浮面板、拖动吸附、收起、筛选和清除已完成；刷新后位置保持。
- [ ] 只提交本计划涉及的文件，提交信息为 feat: upgrade floating workbench todo。
