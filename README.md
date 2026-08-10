# WD World

本地优先的世界观构建工作台。面向 OC 创作者、小说作者、TRPG 主持人，帮助你在本地长期、安全地维护角色、地点、组织、事件等设定资料。

所有数据保存在本地，断网可用，项目目录可整体复制、压缩、迁移。

## 功能特性

- **项目管理**：新建、打开、最近项目列表
- **条目系统**：人物、地点、组织、物品、事件、设定、区域、笔记 8 种类型
- **Markdown 编辑器**：基于 TipTap，支持内部链接 `[[条目标题]]`
- **标签与别名**：分类筛选与快速检索
- **关系系统**：显式关系管理、反向引用、关系图谱可视化
- **搜索**：标题搜索、标签筛选、类型过滤、全文检索
- **地图视图**：自定义底图、区域标注、锚点系统、条目落位
- **时间轴**：条目级时间轴与世界时间轴
- **百科视图**：阅读模式、目录导航、上下文联动
- **导出与备份**：JSON 导入导出、静态 Wiki 导出、自动保存

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面壳 | Electron |
| 前端框架 | React 18 + TypeScript |
| 构建工具 | Vite |
| 样式 | TailwindCSS 3 |
| 状态管理 | Zustand |
| 富文本编辑 | TipTap |
| 本地存储 | sql.js (SQLite WASM) + localStorage |
| 图标 | Lucide React |

## 快速开始

### 环境要求

- Node.js 18+
- npm

### 安装与运行

```bash
npm install
npm run dev
```

浏览器打开 `http://localhost:5173`。

### 打包发布

```bash
npm run build        # 构建生产版本到 dist/
npm run package      # 打包到 release/ 目录
npm run electron:build  # 打包 Electron 安装包
```

### MVP 原型

项目包含一个纯前端 MVP 原型（`mvp/` 目录），无需 Node.js 即可运行：

```bash
# Windows 下双击
run-mvp.bat
```

浏览器打开 `http://127.0.0.1:4173`。

## 项目结构

```text
vvdWorld/
├── electron/           # Electron 桌面壳
│   └── main.js
├── mvp/                # MVP 原型（vanilla JS）
│   ├── js/
│   ├── index.html
│   └── styles.css
├── scripts/            # 打包与工具脚本
│   ├── package.js
│   └── check-encoding.ps1
├── src/                # React 主应用源码
│   ├── components/     # UI 组件
│   ├── lib/            # 存储与工具
│   ├── store/          # Zustand 状态管理
│   ├── types/          # TypeScript 类型定义
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

## 数据存储

项目数据保存在本地浏览器 localStorage 中，桌面版使用 SQLite（sql.js）。不依赖云端，不上传任何用户数据。

项目目录可整体复制、压缩、迁移到其他设备。

## 条目类型

| 类型 | 说明 | 示例 |
|------|------|------|
| 人物 | 角色、NPC、生物 | 主角、反派 |
| 地点 | 具体场景、建筑 | 城堡、城镇 |
| 组织 | 势力、团体、机构 | 行会、王国 |
| 物品 | 道具、武器、神器 | 圣剑、遗物 |
| 事件 | 剧情事件、历史节点 | 战争、仪式 |
| 设定 | 规则、世界观背景 | 魔法体系 |
| 区域 | 地理区域、地图区域 | 大陆、森林 |
| 笔记 | 临时想法、待办事项 | 灵感记录 |

## 内部链接

在正文内容中使用双方括号语法创建内部链接：

```markdown
[[条目标题]]
[[条目标题|显示文本]]
```

点击链接可跳转到对应条目。

## 编码约定

- 项目文本文件统一使用 UTF-8 编码
- 如遇乱码或 BOM 问题，可运行编码检查脚本：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\check-encoding.ps1
```

## 文档

- [QUICKSTART.md](./QUICKSTART.md) - 快速入门指南

## 说明

本项目参考 `vvd.world` 公开页面的产品介绍与演示结构，用于本地化产品规划和原型实现，不涉及其私有源码或未公开资产。
