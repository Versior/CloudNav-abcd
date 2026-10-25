# NaviX
**NaviX 是基于原同类导航项目持续改造的私有导航站，设置密码后需要输密访问，适合个人使用！**

---
#### 最新版本v1.7.1 (2026.1.16 )
- 1、搜索框右侧新增一键清空图标
- 2、在分类目录页面搜索时新增显示其他分类的内容
- 3、移除上游同步依赖，项目改为独立维护

---

<details>
<summary><strong>👉 点击查看更新记录</strong></summary>


#### 版本v1.7
- 1、同步更新设置页面的界面和功能
- 2、同步升级浏览器扩展工具浏览器插件（功能提升）
- 3、调整鼠标悬浮和排序状态下的站点卡片背景颜色
- 4、新增链接编辑页面网址图标实时预览效果
- 5、新增链接编辑页面网址图标实时预览效果


#### 版本v1.6
- 1、站外搜索网站的设置保存到服务器实现持久化
- 2、分类目录权限部分修改：`常用推荐`分类调整为可以移动位置，修改和删除存量分类需要再次输入访问密码授权
- 3、默认访问密码一周过期，可以在左下角网站设置页面修改过期时间

版本 v1.5.1:优化手机端访问时，顶部菜单栏搜索样式和功能

#### 版本 v1.5
更新内容：
- 增加站外搜索功能，可以配置多个站外搜索网站，同时可以点击搜索框左侧的图标弹出下拉框切换站外搜索网站
![v1.4](./doc/1.5.png)


#### 版本V1.4
更新内容：
- 1、右键菜单：当将鼠标移动到站点卡片后，可以点击鼠标右键调出右键菜单，右键菜单支持：复制链接、显示二维码、编辑链接、删除链接等快捷操作。
- 2、增加简约版和详情版的站点卡片样式切换

![v1.4](./doc/1.4.png)

#### 版本V1.3
更新内容：

- 1、修复移动端访问没有退出按钮
- 2、增加首次批量添加站点信息不关窗口开关，增加效率
- 3、分类名称旁增加该分类站点卡片数量
- 4、修复自定义网站名称不被版本升级重置
- 5、站点图标缓存优化

#### 版本V1.2
- 1、解决站点卡片标题文字超出卡片边框的问题
- 2、批量编辑增加全选功能
- 3、在某个分类下新增新链接自动默认归属到当前分类
- 4、添加新站点增加自动获取网站图标的功能
- 5、增加退出功能，非私有电脑保护隐私
- 6、Chrome 扩展菜单改为中文
- 7、Chrome 扩展菜单改为中文

#### 版本V1.1
更新内容：
- `批量编辑`增加批量删除和批量移动站点卡片
- 修复删除分类目录后没有“常用推荐”的问题
- 添加新站点网址自动补全 https://


---
## 首次修改内容
#### 一、编辑链接增加自动获取图标功能
填写网址后，点击`自动获取图标`按钮

![100](./doc/100.png)

#### 二、站点卡片支持拖拽排序

![101](./doc/101.png)

![102](./doc/102.png)


#### 三、导入导出增加 JSON 文件


![103](./doc/103.png)

![104](./doc/104.png)



#### 四、设置页面增加修改网站名称


![105](./doc/105.png)


#### 五、分类站点增加自定义图标功能


![106](./doc/106.png)

![107](./doc/107.png)

</details>

---

# NaviX - 智能私有导航站

<div align="center">

![React](https://img.shields.io/badge/React-18-blue?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.0-38bdf8?style=flat-square&logo=tailwindcss)
![Cloudflare Pages](https://img.shields.io/badge/Cloudflare-Pages-orange?style=flat-square&logo=cloudflare)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

<br/>

<!-- 请将下方的链接替换为您实际部署后的 Cloudflare Pages 域名 -->
[![Repository](https://img.shields.io/badge/GitHub-CloudNav--abcd-7c3aed?style=for-the-badge&logo=github)](https://github.com/Versior/CloudNav-abcd)

<br/>

**一个现代化、基于 AI 辅助的全栈个人导航站。**
**无需购买服务器，依托 Cloudflare 免费托管，实现多端数据实时同步。**

[项目仓库](https://github.com/Versior/CloudNav-abcd) • [功能特性](#-核心功能) • [项目展示](#-项目展示) • [部署教程](#-部署教程-免费) • [使用指南](#-使用指南)

</div>

---

<details>
<summary><strong>👉 点击查看项目功能介绍</strong></summary>

## ✨ 核心功能

### 🧠 AI 深度集成
*   **多模型支持**: 完美支持 **Google Gemini**、**OpenAI**、**DeepSeek**、**Claude** 等任何兼容 OpenAI 接口的模型。
*   **一键智能补全**: 在设置面板一键扫描，自动为成百上千个书签生成精准的中文简介。
*   **智能分类**: 添加链接时，AI 自动分析网页内容并推荐最合适的分类目录。

### ☁️ 数据同步与安全
*   **Cloudflare KV 同步**: 利用边缘存储技术实现多端数据同步。
*   **R2 最新备份**: 只保留本项目固定键 `cloudnav/latest.json`，数据未变化时跳过上传。
*   **隐私加密体系**:
    *   **全局锁**: 部署时设置访问密码，防止他人查看。
    *   **目录锁**: 支持对特定分类单独设置密码，隐藏敏感内容。
### 2. 配置 AI 服务
点击侧边栏底部的 **“设置”** -> **“AI 设置”**：
*   **提供商**: Google Gemini 或 OpenAI 兼容 (DeepSeek 等)。
*   **模型与地址**: 填写模型名称；OpenAI-compatible 还需填写 API 地址。
*   **Secret**: API Key 由 Cloudflare `GEMINI_API_KEY` / `OPENAI_API_KEY` Secret 提供，浏览器不保存 Key。
*   **一键补全**: 在 AI 设置中生成描述、分类或文件夹建议。

### 3. 本地数据导出
从命令面板选择 **“导出 HTML”** 或 **“导出 JSON”**。
*   生成的 HTML 文件兼容 Chrome、Edge、Firefox 等主流浏览器。
*   JSON 导入会自动去重，并清洗旧版本已移除字段。

### 🎨 极致体验
*   **Chrome 扩展插件**: 提供官方代码生成，支持点击浏览器图标后**手动选择分类**保存，体验媲美原生。
*   **置顶专区**: 常用网站一键置顶，在首页顶部常驻显示。
*   **无缝迁移**: 支持导入 Chrome/Edge 书签 HTML 文件（智能去重）。

---

## 📸 项目展示

> 以下为 NaviX 的实际运行界面预览。

### 🖥️ 桌面端概览
| 浅色模式 (Light Mode) | 深色模式 (Dark Mode) |
| :---: | :---: |
| ![Light Mode](screenshots/overview-light.svg) | ![Dark Mode](screenshots/overview-dark.svg) |
| *清爽明亮的日间视图* | *护眼沉浸的夜间视图* |

### 🛠️ 核心功能演示
| AI 智能设置 | 分类加密锁 | 移动端适配 |
| :---: | :---: | :---: |
| ![AI Settings](screenshots/overview-light.svg) | ![Security](screenshots/overview-dark.svg) | ![Mobile](screenshots/mobile-view.svg) |
| *一键批量生成描述* | *私密目录密码保护* | *完美适配手机浏览器* |

*(注：上方使用了项目生成的 SVG 矢量预览图，代表实际 UI 布局)*
</details>

---

## Cloudflare Pages 部署

CloudNav 由一个 Cloudflare Pages 项目提供前端和 Pages Functions。KV 保存当前数据，R2 只保存本项目的唯一最新对象 `cloudnav/latest.json`。

1. 在 Pages 创建项目，构建命令使用 `npm run build`，输出目录使用 `dist`。
2. 创建 KV 命名空间，并绑定为 `NAVIX_KV`。迁移期间也兼容旧绑定名 `CLOUDNAV_KV`。
3. 创建 R2 bucket，并绑定为 `NAVIX_BACKUPS`。
4. 配置 `PASSWORD`；需要 AI 时再配置 `GEMINI_API_KEY` 或 `OPENAI_API_KEY` Secret。AI key 不会写入浏览器、KV 或 R2。
5. 参考 `wrangler.toml.example` 检查绑定名称，重新部署 Pages。

书签实际发生变化时才会覆盖固定的 R2 对象；重复内容会跳过上传，不生成时间戳历史文件。旧的 `cloudnav/` 项目备份可以在确认只属于本项目后，通过受保护的 `pruneBackup` 路径清理，不会触碰 bucket 中其他前缀。

## 使用说明

- 导入导出支持 JSON 和浏览器 HTML 文件。
- AI 设置只填写提供商、模型和 OpenAI-compatible 地址；密钥由 Cloudflare Secret 提供。
- 页面首次打开、回到前台或重新获得焦点时低频读取云端版本，不使用后台轮询。
- WebDAV、健康检测、账号密码保险箱和待整理入口已移除。旧 `__inbox__` 书签会迁移到 `common`，旧 `credentials` 字段会在保存时丢弃。

---
<details>
<summary><strong>👉 点击查看部署方法（图文教程）</strong></summary>

### 📖 保姆级图文教程 (适合新手)

> 如果您是第一次使用 Cloudflare，请严格按照以下步骤操作。

#### 第一步：点击创建应用程序
![第一步](./doc/1.png)

#### 第二步：点击右下角 Get started
![第二步](./doc/2.png)

#### 第三步：导入现有你已经 fork 的仓库
![第三步](./doc/3.png)

#### 第四步：这里选你自己 fork 的仓库名称
![第四步](./doc/4.png)

#### 第五步：按图中填写，其他默认
![第五步](./doc/5.png)

#### 第六步：左侧找到 Workers KV 点击右侧新建
![第六步](./doc/6.png)

#### 第七步：空间名称填写 `NAVIX_DB`（建议复制）
![第七步](./doc/7.png)

#### 第八步：绑定 KV 数据库
回到刚才的 pages 设置页面找到绑定-右侧下滑找到 kv 命名空间，变量名称优先填写 `NAVIX_KV`（旧版 `CLOUDNAV_KV` 仍兼容，建议复制）
![第八步](./doc/8.png)

#### 第九步：设置访问密码
设置中找到变量和机密-填入 `PASSWORD`（建议复制）下面的值填入你自己要设置的密码，这一步是你登录导航页需要的登录密码
![第九步](./doc/9.png)

#### 第十步：添加自定义域名（可选项）
![第十步](./doc/10.png)

</details>

**🎉 所有设置结束后，请务必到部署页面点击“重新部署” (Create New Deployment)，项目即可正常使用！**

---

<details>
<summary><strong>👉 点击查看使用指南</strong></summary>

## ⚙️ 使用指南

### 1. Chrome 扩展程序 (推荐)
点击侧边栏左下角的 **“设置”** -> **“扩展工具”**。
系统会自动根据您的域名生成 3 个文件代码 (`manifest.json`, `popup.html`, `popup.js`)。
1. 在电脑新建文件夹，保存这 3 个文件。
2. 打开 Chrome 扩展管理页 (`chrome://extensions`)。
3. 开启右上角 **“开发者模式”**。
4. 点击 **“加载已解压的扩展程序”**，选择刚才的文件夹。
5. 以后浏览网页时，点击插件图标即可弹出窗口，**选择分类并保存**。

### 2. 配置 AI 服务
点击侧边栏底部的 **“设置”** -> **“AI 设置”**：
*   **提供商**: Google Gemini 或 OpenAI 兼容 (DeepSeek等)。
*   **Key & Model**: 输入 API Key 和模型名称。
*   **一键补全**: 点击底部的 **“一键补全所有描述”**，AI 将自动扫描所有无描述的链接并后台生成。

### 3. WebDAV 备份
点击侧边栏的 **“备份”** 图标，配置 WebDAV 信息 (如坚果云)，即可一键上传备份到云端。

### 4. 本地数据导出 (Local Data Export)
点击侧边栏的 **“备份”** 图标 -> **“导出 HTML”**。
*   生成的 HTML 文件完全兼容 **Chrome**、**Edge**、**Firefox** 等主流浏览器的导入格式。
*   完整保留您在 NaviX 中整理的分类目录结构。

**如何导入到浏览器 (以 Chrome 为例):**
1. 打开 Chrome 浏览器，点击右上角菜单 -> **书签与清单** -> **书签管理器**。
2. 点击页面右上角的三个点图标 -> **导入书签**。
3. 选择刚才从 NaviX 下载的 HTML 文件即可恢复所有书签。

</details>

---

<div align="center">

**如果您觉得项目不错，希望给本项目点一个免费的 Star ⭐️，感谢您的关注！**

**如果有 Bug 或改进的地方，请在 Issue 中提交您的建议。**

<br/>

Made with love by NaviX Team
</div>
