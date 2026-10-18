# WD World 1.10.2

1.10.2 为源码更新版（2026-10-18），重点改善世界书编辑、工作台导航、文件选择翻译与小窗口布局。详见 [1.10.2 版本说明](docs/RELEASE-NOTES-1.10.2.md)。本轮未生成或公开发布 1.10.2 安装包；打包与安装验收见[候选版流程](docs/RELEASE-CANDIDATE.md)。

界面整理：小说书架负责作品管理、写作进度与跨作品灵感；打开作品后，在写作台使用章节、资料和 AI 工具。本章资料可收起，专注模式扩大正文区域。OC、TRPG、酒馆、世界观、局域网与插件页面统一使用简洁的蓝灰日夜主题。详见[界面与模块分工](docs/UI-GUIDE.md)。

最新源码进一步整理酒馆、TRPG 与 OC 工作台：按分区切换编辑内容，世界书采用可搜索、筛选的双栏目录，收藏与副本库支持搜索。创作主页、保存和 AI 设置集中到插件中心所在顶栏，跨模块返回恢复编辑位置；这些改动需从源码启动查看，已有候选安装包不随源码更新。

1.10.0 新增统一的小说界面与日夜主题、小说资料到世界观的确认式同步、智能体候选追加正文，以及所有模式的 WD WORLD 返回主页入口。外层插件中心仅安装酒馆／TRPG 完整模式，小插件在各模式的扩展页下载。详见[主题与模式扩展](docs/THEMES-AND-EXTENSIONS.md)和[小说工作台](docs/NOVEL-DESK.md)。

[English](README.en.md) | 简体中文

[![CI](https://github.com/actrox/wdWorld/actions/workflows/ci.yml/badge.svg)](https://github.com/actrox/wdWorld/actions/workflows/ci.yml)

本地优先的世界观与 AI 创作桌面工具，支持小说、OC、TRPG、酒馆和自由模式。手动创作可离线使用，连接自己的模型接口后可辅助写作、检查矛盾、推演世界变更和主持局域网互动。

## 下载与开始

当前源码版本为 **1.10.2**。运行 `npm run desktop` 启动，`npm run package` 生成便携目录，`npm run electron:build` 生成支持应用内更新的 NSIS 安装包。本轮未上传或发布 GitHub Release；下载时请核对[发布页](https://github.com/actrox/wdWorld/releases)中的实际版本。当前构建未签名。便携版迁移到安装版后可下载更新并确认重启安装。

启动时默认只提供自由、OC、小说模式。通过「插件中心」安装 TRPG、酒馆后才显示对应入口。专用模式进入对应创作界面；自由模式使用内置工具与已安装插件。菜单「文件 → 切换创作模式」或 `Ctrl+Shift+M` 返回模式选择。界面和原生菜单支持简体中文、English。

OC、TRPG 和酒馆拥有独立项目库与创作主页，提供资料统计、准备清单、当前草稿和编辑入口。点击顶部 WD WORLD 保存并返回本模式主页；主题开关切换白天／夜晚。详见[三种模式主页](docs/MODE-HOMES.md)。

- [快速入门](QUICKSTART.md)
- [完整使用说明](docs/NOVEL-STUDIO.md)
- [发布说明](CHANGELOG.md)
- [1.10.2 版本说明与升级方式](docs/RELEASE-NOTES-1.10.2.md)
- [小说书架与写作台](docs/NOVEL-DESK.md)
- [GitHub 更新与发布](docs/UPDATES.md)
- [主题、主页与模式扩展](docs/THEMES-AND-EXTENSIONS.md)

## 功能

小说首页汇总书架、写作进度和灵感便笺，打开作品进入章节写作台。提供结构卡片、资源库、作者记忆、自定义笔记面板、可编辑的策划／写作／审校智能体、文风修订、TXT／Markdown 拆书与设定体检。资料可确认同步到本书世界观，AI 工具结果先存为待确认笔记；智能体候选经作者确认后追加到章节并保留版本。七阶段创作旅程仍可使用。

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

TRPG 支持多人回合等待、暂离与主持人推进、d20／d100 检定；酒馆支持剧情状态栏、行动建议和主持人修订。操作与规则边界见[使用说明](docs/NOVEL-STUDIO.md)。

## 模式包与模式内扩展

「设置 → 插件中心」仅安装酒馆／TRPG 完整模式包。小插件在对应模式的「插件扩展 → 管理与下载扩展」中获取，酒馆入口名为「酒馆扩展」。两处均支持从[独立插件仓库](https://github.com/actrox/wdWorld-plugins)下载、导入 JSON／HTTPS 地址、预览权限、启用、停用与卸载，并校验适用模式。主程序保留编辑、存储和联机引擎，模式包提供模式声明、提示词和独立资源。停用不删除项目，运行房间期间不能更换插件。

酒馆模式另有「酒馆扩展」界面，可安装项目记忆、文字转图片和文字转语音。记忆经过作者确认后用于本项目的自动回复；图片、语音使用独立的加密服务配置。第三方可提供 WDWorld v1 声明式插件包和 HTTP 服务适配器。SillyTavern 原生 JS 不能直接运行，需按[插件 API](https://github.com/actrox/wdWorld-plugins/blob/main/docs/API.md)适配。项目备份不包含插件密钥与记忆，迁移记忆需手动复制。

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

源码和 Electron 依赖齐全时，`start-desktop.cmd` 优先构建并启动当前代码，避免旧桌面包掩盖界面更新；否则依次尝试本机 `release/v1.10.2/WDWorld-Desktop-1.10.2/` 和旧的 `release/v1.10.1/WDWorld-Desktop-1.10.1/` 桌面包。旧包不包含本轮修复。`package` 拒绝覆盖同版本输出目录。二进制不提交到源码仓库。

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
npm run test:plugins    # 默认模式、安装权限、加密记忆、图片、音频与重启恢复
npm run test:novel-desk # 小说工具、主题、世界观联动与加密恢复
npm run test:mode-homes # OC、TRPG、酒馆主页和项目库
npm run test:theme      # 日夜主题、实际鼠标悬停和弹窗配色
npm run test:ui-layout  # 文件选择翻译、重复导入与四档窗口布局
npm run test:desktop:all # 构建一次，顺序运行全部九组桌面回归
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

[CI](.github/workflows/ci.yml) 检查格式、Lint、关键文件覆盖率、构建和 Windows 桌面回归；[候选构建](.github/workflows/candidate.yml) 手动运行打包与安装验收；[Pages](.github/workflows/deploy-pages.yml) 部署 main 的浏览器版本。构建、报告、测试截图、日志和本地配置均不进入源码仓库。

## 清理本地产物

在 PowerShell 运行 `./scripts/clean-generated.ps1` 预览清单，核对后加 `-Apply` 执行。脚本仅清理已识别的旧版打包目录、旧安装包、测试报告、启动日志和已废弃的 WASM 副本；保留 package.json 指定版本的便携版、安装包、源码、开发依赖和 dist。检测到用户密文或目录链接时中止。完整软件文档位于 docs，打包时与根目录入门和版本说明一起分发。
