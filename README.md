# WD World 1.7

[English](README.en.md) | 简体中文

[![CI](https://github.com/actrox/wdWorld/actions/workflows/ci.yml/badge.svg)](https://github.com/actrox/wdWorld/actions/workflows/ci.yml)

本地优先的世界观与 AI 创作桌面工具，支持小说、OC、TRPG、酒馆和自由模式。手动创作可离线使用，连接自己的模型接口后可辅助写作、检查矛盾、推演世界变更和主持局域网互动。

## 下载与开始

从 [GitHub Releases](https://github.com/actrox/wdWorld/releases) 下载 **WDWorld-Desktop-1.7.0-win-x64.zip**，完整解压后运行 `WD World.exe`。保留整个目录，不能只复制 EXE。Windows 桌面包未签名，目前没有自动更新。

启动时选择模式，再新建或打开世界。专用模式进入对应创作界面；自由模式进入世界观并开放全部工具。菜单「文件 → 切换创作模式」或 `Ctrl+Shift+M` 返回模式选择。界面和原生菜单支持简体中文、English。

- [快速入门](QUICKSTART.md)
- [完整使用说明](docs/NOVEL-STUDIO.md)
- [发布说明](CHANGELOG.md)

## 功能

| 模式              | 主要功能                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------ |
| 世界观 / 自由模式 | 八类条目、富文本、百科、关系图、地图、时间轴、模板、静态 Wiki 和 JSON 备份                       |
| 小说 AI 辅助      | 故事想法 → 人物与规则 → 大纲 → 章节 → 写作 → 矛盾检查 → 作者确认设定；阶段上下文、摘要和正文版本 |
| OC 创作者         | 角色概念、外貌、性格、动机、经历、关系、成长弧线                                                 |
| TRPG 主持人       | 随机世界、副本库、文件导入、秘密资料隔离、玩家背景、团务记录、局域网自动叙事与主持人干预         |
| 酒馆制作          | 整套世界、角色卡与世界书、角色场景卡、收藏与导入导出、入场开场白及玩家发言后的 AI 回复           |

生成设定自动显示在世界观中，先标记「AI 待确认」，采纳后成为正式设定。世界变更支持逐条确认、拒绝和撤销，过期候选不能覆盖后续人工修改。创作草稿每 10 秒自动保存，也可手动保存。

TRPG 内置三套原创、无系统短篇：奇幻探索《雾钟遗迹》、悬疑调查《无声旅馆》、科幻求生《最后一班信标》。支持本软件副本 JSON、世界观导出 JSON、TXT、Markdown。酒馆支持 V2 / 旧版角色卡 JSON、世界书 JSON 和本软件场景卡 JSON。暂不解析 PNG 角色卡、PDF 或 Word。

## AI 与局域网

桌面版「AI 设置」支持 DeepSeek、MiMo、OpenAI / Codex、Gemini、自定义及本机服务，适配 Chat Completions、Responses、Gemini 原生协议。填写自己的接口与密钥，获取模型后选择并测试。软件不附带 API 密钥或额度。

创作生成发送所选上下文到配置的服务，长资料会分段整理。开启局域网自动回复后，玩家的角色发言会触发模型调用。房主可暂停、接管、修改引导或编辑预览后发布；TRPG 未发布的秘密不自动进入公开叙事上下文。

房主在桌面端开房，玩家用浏览器、局域网地址和房间码加入。支持最多 16 名玩家、角色认领、OOC、聊天、掷骰、场景和资料；TRPG 另有先攻和团务记录。房间使用 HTTP，仅适用于可信局域网，不自动配置防火墙或公网映射。

## 数据与备份

桌面项目、恢复备份、最近项目列表、API 配置和房间档案加密保存在本机。加密依赖系统账号与应用环境；跨电脑或系统账号迁移前请导出完整项目 JSON。导出是明文，不包含 API 密钥，需自行保管。

[浏览器演示](https://actrox.github.io/wdWorld/)支持手动创作，数据保存在当前浏览器。桌面 AI、房主功能和桌面加密不在网页版启用。

## 从源码运行

需要 Node.js 22.12+ 和 npm。Windows PowerShell 可使用 `npm.cmd`。

```sh
npm ci
npm run desktop        # 构建并启动桌面版
npm run dev            # 浏览器开发，通常为 localhost:5173
npm run package        # Windows 可移动桌面目录
npm run electron:build # Windows NSIS 安装包
```

`start-desktop.cmd` 优先打开本机 `release/v1.7.0/WDWorld-Desktop-1.7.0/` 桌面包；否则从源码启动，需先安装依赖。`package` 拒绝覆盖同版本输出目录。二进制通过 GitHub Release 分发，不提交到源码仓库。

## 开发检查

```sh
npm run format:check
npm run lint
npm run test:coverage
npm run build
```

桌面端到端测试在 Windows 隔离目录中运行，使用本机模拟模型服务：

```sh
npm run test:desktop    # 小说、分段上下文、保存恢复
npm run test:studio     # 创作模式和世界推演
npm run test:world      # 整套世界、待确认设定和模式入口
npm run test:lan        # 双玩家联机、资料隔离和界面语言
npm run test:automation # 自动回复、场景卡、副本和主持人控制
```

常规测试不调用真实模型。`scripts/test-live-ai.js` 需显式设置 `WDWORLD_LIVE_AI=1`，才使用本机配置进行真实模型测试，可能产生 API 用量。

## 项目结构

```text
electron/       桌面、模型接口、加密存储、局域网服务和玩家网页
src/features/   小说、创作模式和房主界面
src/components/ 世界观编辑与资料视图
src/lib/        数据库、保存队列、国际化和公共逻辑
src/assets/     内置示例与占位素材
tests/          单元与集成测试
scripts/        启动、打包及桌面回归脚本
docs/           使用说明
```

技术栈：Electron、React 18、TypeScript、Vite、Tailwind CSS、Zustand、TipTap、sql.js、Vitest、Playwright。内置素材保留，SQLite WASM 直接从依赖构建。

[CI](.github/workflows/ci.yml) 检查格式、Lint、覆盖率和构建；[Pages](.github/workflows/deploy-pages.yml) 部署 main 的浏览器版本。构建、报告、测试截图、日志和本地配置均不进入源码仓库。
