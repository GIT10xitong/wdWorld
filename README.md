# WD World

[English](README.en.md) | 简体中文

[![CI](https://github.com/actrox/wdWorld/actions/workflows/ci.yml/badge.svg)](https://github.com/actrox/wdWorld/actions/workflows/ci.yml)
[![Deploy GitHub Pages](https://github.com/actrox/wdWorld/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/actrox/wdWorld/actions/workflows/deploy-pages.yml)

本地优先的世界观构建工作台，面向 OC 创作者、小说作者和 TRPG 主持人。人物、地点、组织、事件、物品和世界规则都保存在本地，断网也能继续创作。

## 在线体验

- 预定发布地址：[WD World 在线 Demo](https://actrox.github.io/wdWorld/)
- 当前仓库尚未启用 GitHub Pages，因此首次发布前该地址会返回 404；推送本次工作流并启用 Pages 后即可访问。
- 在线版数据保存在当前浏览器中，不会上传到服务器。
- 首次启用时，请在 GitHub 仓库的 **Settings → Pages → Build and deployment** 中选择 **GitHub Actions**。之后推送到 `main` 会自动部署。

## 界面预览

### 欢迎页与示例世界

![WD World 欢迎页](docs/screenshots/welcome.png)

### 可交互地图

![WD World 地图视图](docs/screenshots/map-view.png)

## 功能

- 项目管理：创建空白世界、打开本地备份、最近项目与独立示例世界。
- 8 类条目：人物、地点、组织、物品、事件、设定、区域和笔记。
- 编辑工作区：百科式折叠目录、快速新建/删除、TipTap 富文本、别名、标签、自定义字段和内部链接。
- 卡片视图：封面化条目导航、纵向/横向布局、Markdown 与纯文本复制；人物竖图和地点横图均按原比例完整显示。
- 百科视图：按类型展开的阅读目录、标签筛选、关系上下文与内置封面。
- 关系图谱：显式关系、反向引用与自动布局。
- 地图视图：内置底图、自定义底图、缩放拖拽与条目落点。
- 时间轴：世界纪元、全局事件与条目事件。
- 导入导出：JSON 备份、静态 Wiki 与自动保存。
- 示例世界：“神秘复苏示例：雾港档案”，包含完整规则、人物、地点、关系、时间线与原创图片素材。

## 内置原创素材

示例世界自带以下图片，可直接作为对应条目的封面。素材由 OpenAI 内置 ImageGen 生成，不使用现有影视、游戏或小说角色形象。

| 人物：林默                            | 物品：黑伞                                    | 地点：雾港第七中学                                    |
| ------------------------------------- | --------------------------------------------- | ----------------------------------------------------- |
| ![林默](src/assets/sample/lin-mo.png) | ![黑伞](src/assets/sample/black-umbrella.png) | ![雾港第七中学](src/assets/sample/seventh-school.png) |

地图素材位于 [`src/assets/linjiang-investigation-map.png`](src/assets/linjiang-investigation-map.png)，其他素材位于 [`src/assets/sample/`](src/assets/sample/)。

## 技术栈

| 层级       | 技术                  |
| ---------- | --------------------- |
| 桌面外壳   | Electron              |
| 前端       | React 18 + TypeScript |
| 构建       | Vite                  |
| 样式       | Tailwind CSS          |
| 状态管理   | Zustand               |
| 富文本     | TipTap                |
| 本地数据库 | sql.js / SQLite WASM  |
| 测试       | Vitest + V8 Coverage  |
| 代码规范   | ESLint + Prettier     |

## 本地运行

需要 Node.js 20 或更高版本。

```bash
npm install
npm run dev
```

浏览器访问 `http://localhost:5173`。

## 质量检查

```bash
npm run format:check  # Prettier 格式检查
npm run lint          # ESLint
npm test              # 单元测试与集成测试
npm run test:coverage # 测试与覆盖率阈值
npm run build         # TypeScript 与生产构建
```

当前测试覆盖：工具函数、内置素材映射，以及示例世界初始化集成流程。覆盖率阈值定义在 [`vitest.config.ts`](vitest.config.ts)。

## CI/CD

- [`.github/workflows/ci.yml`](.github/workflows/ci.yml)：在推送和 Pull Request 时运行格式检查、Lint、测试覆盖率与生产构建。
- [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml)：将 `main` 分支构建结果自动部署到 GitHub Pages。

## 构建桌面版

```bash
npm run build
npm run package
npm run electron:build
```

## 数据说明

浏览器版使用 SQLite WASM、IndexedDB 和 localStorage 保存数据；Electron 版将项目数据保存在应用数据目录。应用不依赖云端，也不会主动上传世界设定。

可通过 JSON 备份在不同设备之间迁移项目。

## 基础占位素材

未设置条目封面时，编辑器、百科和卡片视图会按条目类型显示内置占位图；上传真实封面后会自动替换。所有视图均以完整适配方式展示封面，不会裁掉人物或地点主体。素材位于 [`src/assets/placeholders/`](src/assets/placeholders/)，可直接用于原型与界面演示。

| 人物                                                   | 地点                                                  | 组织                                                 | 物品                                              |
| ------------------------------------------------------ | ----------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------- |
| ![人物占位素材](src/assets/placeholders/character.png) | ![地点占位素材](src/assets/placeholders/location.png) | ![组织占位素材](src/assets/placeholders/faction.png) | ![物品占位素材](src/assets/placeholders/item.png) |
