# wdworld

一个参考 `vvd.world` 公开介绍与公开演示结构、面向本地运行与长期归档的世界观构建软件。

项目目标不是复制线上服务本身，而是在本地环境里逐步做出一套接近其核心创作体验的工作台：你可以整理条目、摆放地图、梳理关系、阅读 Wiki，并把数据完整带走。

## 参考范围

参考页面：

- `https://www.vvd.world/`
- `https://app.vvd.world/`

基于公开页面的核对，`vvd.world` 首页重点强调这些方向：

- 组织世界设定与条目
- 创建交互式地图
- 可视化人物与事件关系
- 生成可阅读的自定义 Wiki
- 支持实时协作

公开演示里还能看到它围绕以下工作区组织体验：

- `Editor`
- `Maps`
- `Canvas`
- `Graphs`
- `Wiki`

演示条目包含类似这些字段：

- `Aliases`
- `Region`
- `Condition`
- `Occupants`
- `Overview`
- `Notes`

本项目会继续沿着这些公开可见结构去对齐体验，但不会涉及其私有源码、私有服务逻辑或未公开资产。

## 项目定位

`wdworld` 是一个面向 OC（原创角色）创作者、小说作者、TRPG 主持人的**本地化世界观构建工作台**。它参考 `vvd.world` 的核心创作体验，但完全脱离云端依赖，让用户在本地环境中长期、安全地维护自己的设定世界。

### 核心目标

| 目标 | 说明 |
|------|------|
| **本地优先** | 断网可用，数据自持 |
| **数据可带走** | 项目目录可复制、压缩、迁移 |
| **结构化管理** | 人物、地点、组织、事件等元素系统化管理 |
| **多视图联动** | 编辑、地图、图谱、百科共用同一数据源 |
| **长期归档** | 支持多年持续积累和定期备份 |

### 与 vvd.world 的差异

| 特性 | vvd.world | wdworld |
|------|-----------|---------|
| 部署方式 | 云端服务 | 本地桌面应用 |
| 数据存储 | 服务器数据库 | SQLite + 文件系统 |
| 协作模式 | 实时多人 | 局域网共享（后期） |
| 依赖网络 | 必需 | 可选 |
| 数据控制权 | 平台 | 用户完全掌控 |

## 功能模块

### 核心模块

- **项目管理**：新建项目、打开项目、最近项目列表
- **条目系统**：人物、地点、组织、物品、事件、设定、区域、笔记
- **关系系统**：显式关系、双向链接、反向引用、关系图谱
- **搜索系统**：标题搜索、全文检索、标签筛选、类型过滤
- **地图系统**：自定义地图底图、区域标注、锚点系统、条目落位
- **时间轴**：条目时间轴、世界时间轴、事件关联
- **百科视图**：阅读模式、目录导航、上下文联动
- **资源管理**：图片上传、附件管理
- **导出与备份**：JSON 导出、Markdown 导出、自动备份、静态 Wiki 导出

## 当前已实现（MVP 原型）

当前原型入口：

- [run-mvp.bat](./run-mvp.bat)
- [run-mvp.ps1](./run-mvp.ps1)
- [mvp/index.html](./mvp/index.html)
- [scripts/check-encoding.ps1](./scripts/check-encoding.ps1)

当前版本已经具备：

- 中文化的多视图工作台
- 条目创建、编辑、删除
- 搜索与类型过滤
- 本地自动保存
- JSON 导入导出
- 地图点位浏览与放置模式
- 画布式分栏浏览
- 关系图可视化
- 百科阅读视图
- 条目级时间轴编辑与展示
- 项目级世界时间轴
- 区域条目、区域概览与区域上下文联动
- 条目图片 URL 展示
- 《神秘复苏》增强版默认示例数据

## 产品原则

- 本地优先：断网也能完整使用
- 数据可带走：项目目录可以复制、压缩、备份、迁移
- 开放格式：优先使用 JSON / SQLite 等可控格式
- 结构先于皮肤：先把信息架构做稳，再继续做复杂界面
- 多视图共用同一数据源：编辑、地图、图谱、百科必须互相对得上

---

# 产品需求文档 (PRD)

## 1. 项目概述

`wdworld` 是一个面向 OC（原创角色）创作者、小说作者、TRPG 主持人的**本地化世界观构建工作台**。它参考 `vvd.world` 的核心创作体验，但完全脱离云端依赖，让用户在本地环境中长期、安全地维护自己的设定世界。

项目目标是将 `vvd.world` 所代表的在线世界观管理体验，迁移为一个本地优先、离线可用、数据可控、可整体搬迁的软件产品。首个版本聚焦单机闭环，不以平台化、社交化为优先方向。

## 2. 产品愿景

让创作者能够在本机长期、稳定、安全地维护自己的角色、地点、事件、地图与关系设定，并可以随时备份、导出、迁移和继续创作。

## 3. 目标用户

- 小说作者
- 原创世界观设定作者
- TRPG 主持人和模组作者
- 游戏策划与叙事设计人员
- 小型创作团队

## 4. 核心价值

- **本地优先**：断网可用，数据自持
- **数据可带走**：项目目录可复制、压缩、迁移
- **结构化管理**：人物、地点、组织、事件等元素系统化管理
- **多视图联动**：编辑、地图、图谱、百科共用同一数据源
- **长期归档**：支持多年持续积累和定期备份

## 5. 产品范围

### 5.1 MVP 范围（V0.1）

- 本地项目创建、打开、关闭
- 条目管理（人物、地点、组织、物品、事件、设定、区域、笔记）
- Markdown 正文编辑
- 标签和别名管理
- 显式关系管理
- 标题搜索与类型过滤
- 自动保存
- 项目导出与备份

### 5.2 V0.2 范围

- 反向引用
- 全文检索
- 图片资源管理
- 封面图设置
- 最近编辑与引用视图

### 5.3 V0.3 范围

- 地图标注
- 区域标注与锚点系统
- 条目落位
- 时间线
- 图谱视图

### 5.4 V0.4 范围

- 百科视图
- 目录导航
- 上下文联动
- 静态 Wiki 导出
- 局域网协作

### 5.5 非目标

- 首版本不做账号系统
- 首版本不做在线多人实时协同
- 首版本不强依赖云同步
- 首版本不做复杂权限体系
- 首版本不以移动端为主

## 6. 使用场景

### 场景 1：小说世界观整理

用户创建一个作品项目，在其中录入人物、地点、组织与关键事件，通过标签和双向链接维护资料网络，并通过全文搜索快速定位设定。

### 场景 2：TRPG 战役资料库

用户为每个战役创建项目，保存 NPC、城镇、派系、道具和线索事件。地图页面可用于标注地点，事件视图用于跟踪剧情推进。

### 场景 3：长期创作归档

用户希望在多年内持续积累设定，并定期把整个项目目录打包备份到网盘、移动硬盘或版本仓库中。

### 场景 4：区域化世界构建

用户创建区域条目，在地图上标注区域范围和关键锚点，将人物、地点挂靠到对应区域，形成结构化的地理层级。

## 7. 用户故事

### 项目管理

- 作为创作者，我希望新建一个本地项目，以便把一个世界观的所有资料保存在同一目录。
- 作为创作者，我希望直接打开已有项目目录，以便在不同机器之间迁移使用。
- 作为创作者，我希望看到最近打开的项目列表，以便快速继续工作。

### 条目系统

- 作为创作者，我希望创建人物、地点、组织、物品、事件、设定、区域、笔记等条目，以便结构化维护设定。
- 作为创作者，我希望为条目添加标签、别名和摘要，以便快速检索和阅读。
- 作为创作者，我希望引用其他条目，以便建立设定之间的连接。
- 作为创作者，我希望创建区域条目并在地图上标注，以便组织地理信息。

### 编辑与检索

- 作为创作者，我希望用 Markdown 编辑正文，以便兼顾结构化和可移植性。
- 作为创作者，我希望按标题、标签和正文搜索内容，以便在资料复杂时快速定位。

### 关系系统

- 作为创作者，我希望添加条目之间的显式关系，以便表达人物隶属、地点关联等语义。
- 作为创作者，我希望查看反向引用，以便知道哪些条目引用了当前条目。

### 备份与导出

- 作为创作者，我希望一键导出整个项目，以便做备份和迁移。
- 作为创作者，我希望导出单个条目为 Markdown 或 JSON，以便在其他工具中复用。

## 8. 功能需求

### 8.1 项目管理

- 支持创建新项目
- 支持选择目录打开项目
- 支持最近项目列表
- 支持读取项目元数据
- 支持检测项目结构是否有效

#### 验收标准

- 用户可在 3 步内创建一个新项目
- 项目目录中可见明确的数据文件和资源目录
- 移动项目目录后，软件仍可重新打开

### 8.2 条目管理

- 支持创建、编辑、删除、归档条目
- 支持条目类型切换和筛选
- 支持封面图
- 支持状态字段，例如草稿、完成、隐藏
- 支持区域归属字段
- 支持状态和占据者字段

#### 验收标准

- 用户可在 10 秒内新建一个条目
- 条目修改自动保存
- 删除条目时有明确确认或回收机制

### 8.3 编辑器

- 支持 Markdown 编辑
- 支持基础格式工具栏
- 支持插入本地图片
- 支持内部链接语法
- 支持预览模式

#### 验收标准

- 正文编辑过程不丢数据
- 图片插入后复制项目目录仍可正常显示
- 链接到其他条目后可点击跳转

### 8.4 搜索与浏览

- 支持标题搜索
- 支持标签筛选
- 支持按类型筛选
- 支持正文全文检索
- 支持按更新时间排序
- 支持最近编辑条目列表

#### 验收标准

- 1000 个条目规模下搜索响应应保持在可接受范围
- 检索结果至少展示标题、摘要和匹配信息

### 8.5 关系系统

- 支持手动添加实体之间的关系
- 支持自定义关系类型（隶属、对抗、合作等）
- 支持从正文引用中生成隐式链接
- 支持查看某条目的反向引用
- 支持关系图谱可视化

#### 验收标准

- 任一条目都可看到“它引用了谁”和“谁引用了它”
- 关系删除后视图实时更新
- 不同关系类型可区分显示

### 8.6 地图系统

- 支持自定义地图底图上传
- 支持区域几何编辑
- 支持区域锚点系统
- 支持条目落位到地图
- 支持图层过滤

#### 验收标准

- 用户可上传本地图片作为地图底图
- 区域标注后可在地图上清晰显示
- 条目可绑定到区域或锚点

### 8.7 时间轴

- 支持条目级时间轴
- 支持世界时间轴
- 支持事件关联
- 支持时间排序

#### 验收标准

- 用户可添加时间节点并关联事件
- 时间轴按顺序正确展示
- 时间节点可关联到条目

### 8.8 百科视图

- 支持阅读模式界面
- 支持目录导航（按类型分组）
- 支持上下文联动（同区域/同类型推荐）
- 支持内部链接跳转

#### 验收标准

- 条目阅读体验清晰舒适
- 目录导航可快速定位条目
- 内部链接可正常跳转

### 8.9 备份与导出

- 支持打包整个项目
- 支持导出单条目 Markdown
- 支持导出单条目 JSON
- 支持导出项目元数据清单
- 支持自动备份
- 支持静态 Wiki 导出

#### 验收标准

- 导出后可在新设备恢复
- 导出文件不依赖私有格式才能读取
- 自动备份可按设定周期执行

## 9. 非功能需求

### 9.1 可移植性

- 支持绿色运行
- 数据与程序分离
- 项目目录整体复制后可继续使用
- 跨平台支持（Windows / macOS / Linux）

### 9.2 性能

- 冷启动目标小于 3 秒
- 条目列表滚动流畅
- 1000 条目规模下搜索响应小于 300ms
- 自动保存延迟小于 1 秒

### 9.3 可靠性

- 自动保存
- 崩溃恢复
- 写入失败时可提示并保留现场
- Schema 迁移自动升级

### 9.4 数据安全

- 默认本地存储
- 不默认上传任何用户数据
- 支持本地备份
- 可选加密导出

### 9.5 可维护性

- 模块化架构
- 清晰的数据模型
- 支持未来扩展地图、图谱、插件
- 使用 ESLint + Prettier 保持代码风格一致

## 10. 主要页面

- 欢迎页 / 最近项目
- 项目主页 / 仪表盘
- 条目列表页
- 条目编辑页
- 搜索页
- 地图页
- 关系图谱页
- 时间轴页
- 百科阅读页
- 关系侧栏
- 设置页
- 导出 / 备份页

## 11. 关键交互流程

### 流程 A：创建项目

1. 用户打开应用
2. 点击“新建项目”
3. 输入项目名称和存储位置
4. 软件生成项目目录和默认结构（project.json、database.sqlite、assets/）
5. 自动进入项目主页

### 流程 B：创建条目

1. 用户选择条目类型
2. 输入标题
3. 软件创建初始条目
4. 用户补充摘要、正文、标签和关系
5. 修改自动保存（防抖机制）

### 流程 C：添加关系

1. 用户在条目编辑页打开关系面板
2. 选择目标条目
3. 设置关系类型
4. 保存关系
5. 双方条目均可看到该关系

### 流程 D：导出项目

1. 用户打开导出 / 备份页面
2. 选择导出格式（JSON / Markdown / 静态 Wiki）
3. 软件生成导出文件
4. 用户可将导出内容复制到其他设备

## 12. 指标

首版本建议关注这些指标：

- 创建项目成功率
- 条目创建到首次保存的完成率
- 本地搜索使用频率
- 项目导出成功率
- 平均单项目条目数

当前阶段这些指标主要用于产品设计评估，不一定需要一开始就做遥测上报。

---

# 技术架构文档

## 1. 架构目标

本项目架构需要同时满足以下要求：

- 本地优先
- 高可移植
- 跨平台
- 数据结构稳定
- 便于后续扩展地图、图谱、导出、插件

推荐基线架构为：`Tauri + React + TypeScript + SQLite`

## 2. 总体架构

```text
+------------------------------------------------------+
| Desktop Shell (Tauri)                               |
|  - window lifecycle                                 |
|  - native file system                               |
|  - dialogs / path access                            |
+---------------------------+--------------------------+
                            |
                            v
+------------------------------------------------------+
| Frontend App (React)                                |
|  - project workspace                                |
|  - entry list / editor / search / settings          |
|  - map / graph / timeline / wiki views              |
|  - local UI state                                   |
+---------------------------+--------------------------+
                            |
                            v
+------------------------------------------------------+
| Application Services                                |
|  - project service                                  |
|  - entry service                                    |
|  - relation service                                 |
|  - search service                                   |
|  - export service                                   |
|  - asset service                                    |
|  - map service                                      |
|  - timeline service                                 |
+---------------------------+--------------------------+
                            |
                            v
+------------------------------------------------------+
| Local Persistence                                   |
|  - SQLite                                           |
|  - markdown content / snapshots                     |
|  - asset files                                      |
|  - export files                                     |
+------------------------------------------------------+
```

## 3. 技术选型

### 3.1 桌面层

- `Tauri`

原因：

- 包体积小
- 跨平台能力好
- 对本地文件系统和原生对话框支持好
- 比 Electron 更适合“高可移植”目标

### 3.2 前端层

- `React 18`
- `TypeScript`
- `Vite`

原因：

- 生态成熟
- 组件化适合复杂编辑器和工作区
- TypeScript 有利于数据模型稳定
- Vite 提供快速开发体验

### 3.3 状态管理

- `Zustand`

原因：

- 轻量级
- 类型友好
- 不需要太多样板代码

### 3.4 数据层

- `SQLite`
- 可选 `SQLite FTS5`

原因：

- 单文件数据库，适合可移植场景
- 查询能力比纯 JSON 更稳
- 支持事务
- 后续可扩展搜索和迁移

### 3.5 UI 框架

- `TailwindCSS 3`

原因：

- 快速原型开发
- 响应式设计
- 现代设计语言

### 3.6 图标

- `Lucide React`

原因：

- 简洁现代的图标库
- 与 React 集成良好

### 3.7 富文本编辑

- `TipTap`

原因：

- Markdown 支持好
- 可扩展
- 与 React 集成良好

### 3.8 图谱可视化

- `D3.js` / `React Flow`

原因：

- D3.js 强大的图表能力
- React Flow 适合关系图谱

### 3.9 内容层

- 主正文以 Markdown 保存
- 元数据存于 SQLite
- 图片和附件存于项目目录 `assets/`

## 4. 模块划分

### 4.1 Shell / Native 模块

职责：

- 应用窗口管理
- 本地目录选择
- 文件读写桥接
- 应用配置目录定位
- 系统菜单和快捷键

### 4.2 Project 模块

职责：

- 创建项目
- 打开项目
- 校验项目结构
- 读取项目配置
- 升级项目 schema

### 4.3 Entry 模块

职责：

- 条目 CRUD
- 条目类型管理（人物、地点、组织、物品、事件、设定、区域、笔记）
- 标签、别名、摘要维护
- 正文加载与保存
- 区域归属维护
- 状态和占据者字段维护

### 4.4 Relation 模块

职责：

- 显式关系管理
- 隐式引用解析
- 反向引用查询
- 图谱视图数据聚合
- 自定义关系类型

### 4.5 Search 模块

职责：

- 标题检索
- 标签过滤
- 类型过滤
- 全文检索
- 搜索结果高亮

### 4.6 Asset 模块

职责：

- 图片导入
- 附件复制到项目目录
- 资源引用路径维护
- 资源清理策略
- 封面图管理

### 4.7 Export 模块

职责：

- 导出 Markdown
- 导出 JSON
- 导出项目包
- 自动备份
- 静态 Wiki 导出

### 4.8 Map 模块

职责：

- 地图底图管理
- 区域标注
- 锚点系统
- 条目落位
- 图层过滤

### 4.9 Timeline 模块

职责：

- 条目级时间轴
- 世界时间轴
- 事件关联
- 时间排序

### 4.10 Wiki 模块

职责：

- 阅读模式界面
- 目录导航
- 上下文联动
- 内部链接处理

## 5. 项目目录设计

推荐每个世界观项目使用独立目录：

```text
MyWorld/                    # 项目根目录
  project.json              # 项目元数据与版本信息
  database.sqlite           # 结构化数据主存储
  assets/                   # 资源文件目录
    images/                 # 图片资源
    attachments/            # 附件文件
  exports/                  # 导出文件
  backups/                  # 自动备份
  cache/                    # 可重建缓存
```

说明：

- `project.json`：项目元数据和 schema 版本
- `database.sqlite`：结构化内容主存储
- `assets/`：图片与附件
- `exports/`：导出结果
- `backups/`：本地备份
- `cache/`：可重建缓存，不作为关键数据

## 6. 运行时数据流

### 6.1 打开项目

1. 用户选择目录
2. Project 模块校验 `project.json`
3. 检查数据库文件和 schema 版本
4. 若需要则执行迁移
5. 加载项目主页数据

### 6.2 编辑条目

1. UI 读取条目元数据和正文
2. 用户修改内容
3. 编辑器触发防抖保存
4. Entry 模块写入数据库
5. Relation 模块更新引用索引
6. Search 模块更新检索索引

### 6.3 导入图片

1. 用户选择本地图片
2. Asset 模块复制到项目 `assets/images/`
3. 返回相对路径
4. 编辑器插入引用

### 6.4 添加关系

1. 用户在条目编辑页打开关系面板
2. 选择目标条目和关系类型
3. Relation 模块写入关系表
4. UI 实时更新关系视图

## 7. 数据存储策略

推荐方案：

- 核心元数据存入 SQLite
- 正文内容也存入 SQLite
- 大资源文件保留为文件系统存储
- 可选导出为 Markdown 作为开放副本

原因：

- 单一数据源更易查询和一致性维护
- 保持项目目录可整体搬迁
- 导出层可提供开放格式

## 8. Schema 版本与迁移

项目需要显式维护 schema 版本。

### 建议策略

- `project.json` 中记录 `schemaVersion`
- 应用启动时检测版本
- 若版本落后，执行顺序迁移脚本
- 迁移前先自动备份数据库

### 迁移原则

- 迁移必须幂等或具备失败回滚能力
- 旧版本尽量平滑升级
- 不直接依赖手工修改数据库

## 9. 状态管理建议

前端建议拆分两类状态：

- 服务器态风格数据
  - 当前项目
  - 条目列表
  - 条目详情
  - 搜索结果
  - 关系数据
- 本地 UI 状态
  - 侧栏展开
  - 当前筛选器
  - 当前标签页
  - 编辑器临时状态
  - 地图视图状态

原则：

- 持久化数据以数据库为准
- 页面状态不要和持久化状态混杂

## 10. 搜索架构

MVP 建议使用 SQLite 自身能力完成搜索。

### 方案

- 标题和摘要：普通索引
- 标签：关联表查询
- 类型：普通索引
- 正文：FTS5 全文索引

### 优点

- 无需额外服务
- 可移植性好
- 部署简单

## 11. 关系与链接架构

需要同时支持两种链接：

- 显式关系
  - 例如 `member_of`、`located_in`、`allied_with`
  - 用户手动添加的语义关系
- 隐式正文引用
  - 例如正文中通过内部链接语法引用条目

建议：

- 显式关系单独存表
- 隐式引用通过解析正文生成索引表
- UI 展示时统一聚合
- 支持自定义关系类型

## 12. 编辑器架构

MVP 先选 Markdown 编辑器，不直接做重型富文本内核。

### 设计原因

- 可移植性好
- 数据更开放
- 便于导出
- 可先完成闭环，再逐步增强所见即所得体验

### 未来可扩展

- 分屏预览
- 块级组件
- 内部链接自动补全
- 嵌入地图标记和关系卡片

## 13. 导出架构

导出层与业务层解耦。

### 导出类型

- 单条目 Markdown
- 单条目 JSON
- 整项目 ZIP
- 整项目 JSON
- 静态 Wiki HTML
- 自动备份

### 原则

- 导出不改变源数据
- 导出使用只读聚合模型
- 导出模板独立管理
- 自动备份可按设定周期执行

## 14. 错误处理策略

### 文件系统错误

- 路径无权限
- 磁盘空间不足
- 文件被占用

处理原则：

- 明确提示
- 不吞错误
- 允许用户重试或导出日志

### 数据库错误

- 写入失败
- 迁移失败
- schema 不兼容

处理原则：

- 先备份
- 失败回滚
- 不静默损坏数据

## 15. 插件扩展预留

即使首版本不做插件，也建议预留边界。

可扩展点：

- 导出器
- 条目模板
- 自定义字段
- 自动化命令
- 外部同步适配器

实现方式建议：

- 插件只读核心数据模型
- 通过命令式 API 调用受控能力
- 不允许插件直接随意改写数据库文件

## 16. 安全与隐私

- 默认不联网
- 不采集云端遥测
- 不上传正文内容
- 用户明确操作前不导出任何数据
- 可选加密导出

## 17. 建议代码结构

```text
src/
  app/                      # 主应用入口
  components/               # 通用组件
    common/                 # 基础组件
    editor/                 # 编辑器组件
    map/                    # 地图组件
    graph/                  # 关系图组件
    timeline/               # 时间轴组件
    wiki/                   # 百科组件
  features/                 # 功能模块
    project/                # 项目管理
    entries/                # 条目管理
    relations/              # 关系管理
    search/                 # 搜索功能
    assets/                 # 资源管理
    export/                 # 导出功能
    settings/               # 设置页面
    map/                    # 地图功能
    timeline/               # 时间轴功能
    wiki/                   # 百科功能
  lib/                      # 工具库
    storage/                # 存储抽象
    utils/                  # 通用工具
    hooks/                  # 自定义 Hooks
  styles/                   # 全局样式
  types/                    # TypeScript 类型定义

src-tauri/
  src/
    commands/               # Tauri 命令
    services/               # Rust 服务
    persistence/            # 数据持久化
    migrations/             # 数据库迁移
```

## 18. 架构结论

本项目最重要的架构原则是：

- 本地单机先闭环
- 数据目录可整体搬迁
- 数据模型先稳定
- UI 和持久化边界清晰
- 高复杂功能后置，不阻塞 MVP

只要遵守这些原则，后续无论扩展地图、图谱、时间轴还是导出系统，都会更稳。

---

# 数据模型文档

## 1. 设计目标

数据模型需要满足：

- 支持人物、地点、组织、物品、事件、设定、区域、笔记等多类条目
- 支持正文、标签、别名、关系、附件、区域归属
- 支持全文检索
- 支持 schema 升级
- 支持导出与跨设备迁移
- 支持地图区域和锚点系统
- 支持时间轴功能

推荐存储方式：

- 结构化数据：`SQLite`
- 资源文件：项目目录文件系统
- 项目元数据：`project.json`

## 2. 核心建模思路

MVP 阶段采用“统一条目表 + 扩展属性表 + 关系表”的方案。

优点：

- 上手快
- 可扩展性强
- 前期不需要为每种实体建立完全独立的数据表
- 便于后续扩展地图、时间轴等功能

## 3. 主要实体

### 3.1 Project

表示一个世界观项目。

核心字段：

- `id`
- `name`
- `slug`
- `description`
- `schemaVersion`
- `createdAt`
- `updatedAt`

### 3.2 Entry

表示任何世界观条目，例如人物、地点、组织、物品、事件、设定、区域、笔记。

核心字段：

- `id`
- `type`
- `title`
- `slug`
- `summary`
- `content`
- `status`
- `visibility`
- `region`
- `condition`
- `occupants`
- `coverAssetId`
- `mapPosition`
- `anchorId`
- `createdAt`
- `updatedAt`
- `archivedAt`

### 3.3 Region（区域条目扩展）

区域类型条目特有的扩展字段。

核心字段：

- `entryId`
- `regionShape`（包含 top, left, width, height, rotation）
- `anchors`（区域内锚点列表）

### 3.4 Tag

标签实体。

核心字段：

- `id`
- `name`
- `color`
- `createdAt`

### 3.5 Alias

条目别名。

核心字段：

- `id`
- `entryId`
- `value`
- `normalizedValue`

### 3.6 Relation

条目之间的显式关系。

核心字段：

- `id`
- `sourceEntryId`
- `targetEntryId`
- `type`
- `direction`
- `note`
- `createdAt`
- `updatedAt`

### 3.7 Asset

本地资源文件。

核心字段：

- `id`
- `kind`
- `filename`
- `relativePath`
- `mimeType`
- `size`
- `checksum`
- `createdAt`

### 3.8 Backlink

由正文引用解析出的隐式链接索引。

核心字段：

- `id`
- `sourceEntryId`
- `targetEntryId`
- `linkText`
- `createdAt`

### 3.9 TimelineEvent

时间轴事件。

核心字段：

- `id`
- `entryId`
- `pointLabel`
- `title`
- `sortValue`
- `description`
- `createdAt`

### 3.10 Anchor

区域锚点。

核心字段：

- `id`
- `entryId`
- `label`
- `x`
- `y`
- `notes`
- `createdAt`

## 4. 推荐枚举值

### Entry.type

- `character` - 人物
- `location` - 地点
- `faction` - 组织
- `item` - 物品
- `event` - 事件
- `lore` - 设定
- `region` - 区域
- `note` - 笔记

### Entry.status

- `draft`
- `active`
- `complete`
- `archived`

### Entry.visibility

- `private`
- `internal`
- `public_exportable`

### Asset.kind

- `cover`
- `image`
- `attachment`
- `map_image`

### Relation.direction

- `directed` - 单向关系
- `bidirectional` - 双向关系

## 5. SQLite 表设计

### 5.1 projects

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  schema_version INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### 5.2 entries

```sql
CREATE TABLE entries (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  summary TEXT DEFAULT '',
  content TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  visibility TEXT NOT NULL DEFAULT 'private',
  region TEXT DEFAULT '',
  condition TEXT DEFAULT '',
  occupants TEXT DEFAULT '',
  cover_asset_id TEXT,
  map_position_x REAL,
  map_position_y REAL,
  anchor_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (cover_asset_id) REFERENCES assets(id),
  FOREIGN KEY (anchor_id) REFERENCES anchors(id)
);
```

建议索引：

```sql
CREATE UNIQUE INDEX idx_entries_project_slug ON entries(project_id, slug);
CREATE INDEX idx_entries_project_type ON entries(project_id, type);
CREATE INDEX idx_entries_project_updated ON entries(project_id, updated_at DESC);
CREATE INDEX idx_entries_region ON entries(region);
```

### 5.3 entry_aliases

```sql
CREATE TABLE entry_aliases (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL,
  value TEXT NOT NULL,
  normalized_value TEXT NOT NULL,
  FOREIGN KEY (entry_id) REFERENCES entries(id)
);
```

### 5.4 tags

```sql
CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);
```

### 5.5 entry_tags

```sql
CREATE TABLE entry_tags (
  entry_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (entry_id, tag_id),
  FOREIGN KEY (entry_id) REFERENCES entries(id),
  FOREIGN KEY (tag_id) REFERENCES tags(id)
);
```

### 5.6 relations

```sql
CREATE TABLE relations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  source_entry_id TEXT NOT NULL,
  target_entry_id TEXT NOT NULL,
  type TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'directed',
  note TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (source_entry_id) REFERENCES entries(id),
  FOREIGN KEY (target_entry_id) REFERENCES entries(id)
);
```

建议索引：

```sql
CREATE INDEX idx_relations_source ON relations(source_entry_id);
CREATE INDEX idx_relations_target ON relations(target_entry_id);
CREATE INDEX idx_relations_type ON relations(type);
```

### 5.7 assets

```sql
CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  filename TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  checksum TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);
```

### 5.8 backlinks

```sql
CREATE TABLE backlinks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  source_entry_id TEXT NOT NULL,
  target_entry_id TEXT NOT NULL,
  link_text TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (source_entry_id) REFERENCES entries(id),
  FOREIGN KEY (target_entry_id) REFERENCES entries(id)
);
```

### 5.9 anchors

```sql
CREATE TABLE anchors (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL,
  label TEXT NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY (entry_id) REFERENCES entries(id)
);
```

### 5.10 timeline_events

```sql
CREATE TABLE timeline_events (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL,
  point_label TEXT DEFAULT '',
  title TEXT NOT NULL,
  sort_value REAL NOT NULL,
  description TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY (entry_id) REFERENCES entries(id)
);
```

建议索引：

```sql
CREATE INDEX idx_timeline_entry_sort ON timeline_events(entry_id, sort_value);
```

### 5.11 entry_fields

用于未来扩展自定义字段。

```sql
CREATE TABLE entry_fields (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL,
  field_key TEXT NOT NULL,
  field_type TEXT NOT NULL,
  value_text TEXT DEFAULT '',
  value_number REAL,
  value_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (entry_id) REFERENCES entries(id)
);
```

## 6. 全文检索设计

推荐使用 SQLite FTS5：

```sql
CREATE VIRTUAL TABLE entries_fts USING fts5(
  entry_id UNINDEXED,
  title,
  summary,
  content
);
```

同步策略：

- 创建条目时插入索引
- 更新条目时重建对应文档
- 删除条目时删除对应索引

## 7. project.json 设计

项目目录根部保留 `project.json`，用于快速识别项目和记录 schema 信息。

示例：

```json
{
  "id": "proj_9d4b9c1d",
  "name": "Ash Sea Chronicle",
  "slug": "ash-sea-chronicle",
  "schemaVersion": 1,
  "appVersion": "0.1.0",
  "createdAt": "2026-04-13T00:00:00Z",
  "updatedAt": "2026-04-13T00:00:00Z"
}
```

## 8. 内部链接语法建议

正文建议支持内部链接：

```text
[[条目标题]]
[[条目标题|显示文本]]
[[entry:char_hero_001]]
```

解析规则：

- 优先按显式 `id` 匹配
- 其次按当前项目中的 `title` 或 `alias` 匹配
- 解析后写入 `backlinks`

## 9. 关系类型建议

可先内置一批常用关系类型：

- `member_of`
- `leader_of`
- `located_in`
- `part_of`
- `allied_with`
- `enemy_of`
- `parent_of`
- `child_of`
- `owns`
- `created`
- `discovered`
- `participated_in`
- `caused`
- `mentions`
- `驻守于`
- `隶属`
- `对抗`
- `合作`

后续可开放自定义关系类型。

## 10. ID 规则建议

建议使用可读性较强的前缀 ID：

- `proj_xxx`
- `char_xxx`
- `loc_xxx`
- `fac_xxx`
- `item_xxx`
- `event_xxx`
- `lore_xxx`
- `region_xxx`
- `note_xxx`
- `asset_xxx`
- `rel_xxx`
- `anc_xxx`
- `t_xxx`

生成原则：

- 全局唯一
- 不依赖标题
- 标题变化不影响 ID

## 11. 时间字段约定

所有时间统一使用 ISO 8601 UTC 字符串，例如：

```text
2026-04-13T00:00:00Z
```

原因：

- 易于序列化
- 跨平台兼容性好
- 导出和迁移简单

## 12. 删除与归档策略

MVP 不建议直接物理删除所有数据。

推荐策略：

- 条目删除优先走软删除或归档
- 资源文件先解除引用，再提供清理命令
- 备份导出保留历史副本

## 13. 示例条目 JSON 视图

虽然主存储在 SQLite 中，应用层仍建议维护统一 DTO。

```json
{
  "id": "char_yangjian_xxx",
  "type": "character",
  "title": "杨间",
  "slug": "yang-jian",
  "summary": "鬼眼刑警，主角",
  "content": "他具备鬼眼能力...",
  "status": "active",
  "visibility": "private",
  "region": "大昌市",
  "condition": "高压维持",
  "occupants": "鬼眼体系",
  "aliases": ["鬼眼杨间"],
  "tags": ["主角", "鬼眼", "刑警"],
  "coverAssetId": "asset_xxx",
  "mapPosition": { "x": 58, "y": 62 },
  "anchorId": "",
  "relations": [
    { "id": "rel_xxx", "targetEntryId": "loc_guangjiang", "type": "驻守于", "note": "长期驻守" }
  ],
  "timelineEvents": [
    { "id": "t_xxx", "pointLabel": "故事开端", "title": "获得鬼眼", "sortValue": 10 }
  ],
  "createdAt": "2026-07-05T00:00:00Z",
  "updatedAt": "2026-07-05T00:00:00Z"
}
```

## 14. DTO 建议

前后端之间建议至少定义这些对象：

- `ProjectSummary`
- `EntryListItem`
- `EntryDetail`
- `EntryEditorState`
- `RelationEdge`
- `SearchResult`
- `AssetRef`
- `TimelineEvent`
- `Anchor`

## 15. 数据模型结论

MVP 阶段最合适的方案，是以统一 `entries` 为核心，围绕标签、别名、关系、附件、区域、锚点、时间轴和全文索引构建一个稳定的数据底座。这样既能快速落地，也能支撑后续地图、图谱、百科和插件扩展。

---

# 开发路线图

## 1. 路线原则

本项目路线图遵循以下原则：

- 先做单机闭环，再做高级功能
- 先稳数据模型，再扩视觉能力
- 先保证可移植性，再考虑平台化
- 每个阶段都应形成可使用的版本
- 严格按优先级推进（P0 > P1 > P2）

## 2. 版本目标总览

### V0.1：项目初始化与核心闭环（预计 2 周）

目标：

- 实现从“创建项目”到“编辑条目”到“搜索资料”到“导出备份”的最小闭环

交付物：

- 工程骨架（Tauri + React + TypeScript）
- SQLite 数据库与基础表
- 项目管理（新建、打开、最近项目）
- 条目 CRUD（人物、地点、组织、物品、事件、设定、区域、笔记）
- 自动保存机制

### V0.2：编辑器与资源管理（预计 2 周）

目标：

- 完善条目编辑体验，支持图片资源管理

交付物：

- Markdown 编辑器（TipTap）
- 标签与别名管理
- 图片上传与本地引用
- 封面图设置
- 标题和标签搜索

### V0.3：关系系统与搜索增强（预计 2 周）

目标：

- 让条目之间真正形成结构化世界观网络

交付物：

- 显式关系管理
- 反向引用面板
- SQLite FTS5 全文检索
- 内部链接语法支持

### V0.4：地图与时间轴（预计 3 周）

目标：

- 让用户更直观地浏览世界观

交付物：

- 地图底图上传
- 区域标注与锚点系统
- 条目落位
- 条目级时间轴
- 世界时间轴

### V0.5：百科与关系图谱（预计 2 周）

目标：

- 提供阅读友好的百科视图和关系可视化

交付物：

- 百科阅读模式
- 目录导航（按类型分组）
- 上下文联动（同区域/同类型推荐）
- 关系图谱可视化

### V0.6：导出与发布（预计 2 周）

目标：

- 提升分发能力和长期可用性

交付物：

- 项目导出（JSON）
- 单条目导出（Markdown）
- 自动备份策略
- 静态 Wiki 导出
- Windows 安装包

## 3. 详细分期

### Phase 0：基础准备

预计目标：1 周

任务：

1. 选定技术栈（Tauri + React + TypeScript + SQLite）
2. 初始化工程骨架
3. 建立基础目录结构
4. 确定 SQLite 接入方式
5. 实现项目目录读写原型
6. 定义 schema version 机制

完成标志：

- 应用可启动
- 可在本地创建项目目录
- 可写入 `project.json`
- 可初始化 `database.sqlite`

### Phase 1：项目管理与条目核心

预计目标：1 到 2 周

任务：

1. 欢迎页与最近项目列表
2. 新建项目流程
3. 打开项目流程
4. 条目列表页
5. 新建 / 编辑 / 删除 / 归档条目
6. 条目类型筛选（人物、地点、组织、物品、事件、设定、区域、笔记）
7. 自动保存（防抖机制）

完成标志：

- 用户可以完整创建并维护一个项目
- 条目数据重启后仍可正确读取

### Phase 2：编辑器与资源管理

预计目标：1 到 2 周

任务：

1. Markdown 编辑器接入（TipTap）
2. 标题、摘要、正文编辑
3. 标签管理
4. 别名管理
5. 图片导入和本地引用
6. 封面图设置

完成标志：

- 用户可以写完整条目正文
- 图片资源在移动项目目录后仍有效

### Phase 3：搜索与引用

预计目标：1 周

任务：

1. 标题搜索
2. 标签筛选
3. 类型过滤
4. FTS5 全文检索
5. 内部链接语法支持
6. 反向引用面板

完成标志：

- 中小型项目检索体验可用
- 条目之间可通过链接互相跳转

### Phase 4：关系系统

预计目标：1 周

任务：

1. 显式关系表单
2. 常用关系类型（隶属、对抗、合作等）
3. 关系列表视图
4. 条目详情中的关系侧栏
5. 自定义关系类型

完成标志：

- 用户可维护人物、地点、组织、事件之间的显式连接

### Phase 5：地图系统

预计目标：2 周

任务：

1. 地图图片导入
2. 地图标点
3. 区域标注与区域几何编辑
4. 锚点系统
5. 条目落位到区域和锚点
6. 图层过滤

完成标志：

- 用户可在地图上组织地点和人物
- 区域层级结构清晰

### Phase 6：时间轴与可视化

预计目标：1 到 2 周

任务：

1. 条目级时间轴
2. 世界时间轴
3. 基础关系图谱
4. 条目概览仪表板

完成标志：

- 用户不止能“存资料”，还能“浏览资料结构”

### Phase 7：导出与备份

预计目标：1 周

任务：

1. 导出单条目 Markdown
2. 导出单条目 JSON
3. 整项目打包导出（JSON）
4. 自动备份策略
5. 恢复流程设计

完成标志：

- 用户可以把整个项目迁移到另一台设备

### Phase 8：百科与发布

预计目标：2 周

任务：

1. 百科阅读模式界面
2. 目录导航（按类型分组）
3. 上下文联动（同区域/同类型推荐）
4. 静态 Wiki 导出
5. Windows 发布包
6. 绿色版目录分发

完成标志：

- 可向外部分发测试版
- 用户无需开发环境即可使用

## 4. 优先级矩阵

| 优先级 | 功能模块 | 说明 |
|--------|----------|------|
| **P0** | 项目管理 | 核心闭环必需 |
| **P0** | 条目 CRUD | 核心闭环必需 |
| **P0** | 搜索基础 | 核心闭环必需 |
| **P0** | 关系系统 | 世界观核心 |
| **P1** | 编辑器 | 创作体验核心 |
| **P1** | 资源管理 | 基础能力 |
| **P1** | 地图系统 | 可视化核心 |
| **P1** | 时间轴 | 叙事组织 |
| **P1** | 百科视图 | 阅读体验 |
| **P2** | 关系图谱 | 高级可视化 |
| **P2** | 模板系统 | 效率提升 |
| **P2** | 静态 Wiki | 发布能力 |
| **P2** | 局域网协作 | 团队功能 |

## 5. 当前建议的开发顺序

如果你是一个人推进，建议按这个顺序做：

1. 工程初始化
2. SQLite 和项目目录
3. 条目 CRUD
4. Markdown 编辑器
5. 标签 / 别名 / 资源
6. 搜索
7. 链接与关系
8. 导出备份
9. 地图 / 图谱 / 时间轴
10. 百科视图

## 6. 里程碑验收标准

### V0.1：能用

- 可以新建项目
- 可以创建多个条目（各种类型）
- 可以保存和重开
- 条目数据不丢失

### V0.2：好用

- 可以搜索（标题、标签、类型）
- 可以链接（内部链接）
- 可以导入图片
- 可以管理关系

### V0.3：可迁移

- 可以导出备份（JSON）
- 可以在新机器恢复
- 项目目录可整体复制使用

### V0.4：可展示

- 可以用地图和图谱浏览世界观
- 可以用时间轴查看历史
- 可以导出面向阅读的资料形式

## 7. 风险清单

### 风险 1：过早追求复杂 UI

应对：

- 先把条目与数据闭环做好
- 地图和图谱后置

### 风险 2：数据模型频繁变化

应对：

- 尽早实现迁移机制
- 把实体共性先抽稳
- 保留 schema 版本字段

### 风险 3：一个人开发节奏过散

应对：

- 每个阶段结束都形成可运行版本
- 优先交付闭环，不追求一次做全
- 使用 TODO 列表跟踪进度

### 风险 4：地图和图谱复杂度过高

应对：

- 作为第二阶段功能
- MVP 不阻塞于可视化模块
- 优先保证数据结构稳定

### 风险 5：跨平台兼容性问题

应对：

- 使用 Tauri 标准 API
- 在各平台测试关键流程
- 优先保证 Windows 稳定性

## 8. 建议的近期 TODO

最适合现在立刻开始的任务是：

1. 初始化 `Tauri + React + TypeScript` 工程
2. 建立 `project.json` 和 `database.sqlite` 初始化逻辑
3. 创建 `entries`、`tags`、`relations`、`assets`、`backlinks`、`anchors`、`timeline_events` 等表
4. 做欢迎页和项目打开流程
5. 做条目列表和条目编辑页

## 9. 结论

这份路线图的核心思想很简单：

先把它做成一个真正稳定可靠的本地资料库，再把它慢慢长成一个完整的世界观创作平台。

只要第一版把"项目管理 + 条目编辑 + 搜索 + 导出"做好，就已经具备真实使用价值。后续可以逐步扩展地图、图谱、时间轴和协作能力，让工具越来越强大。

---

## 编码约定

- 项目文本文件统一使用 `UTF-8`
- 如果怀疑出现乱码或重复 BOM，可运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\check-encoding.ps1
```

## 当前运行方式

如果你的 PowerShell 被执行策略拦住，优先使用：

- [run-mvp.bat](./run-mvp.bat)

它会自动以更稳妥的方式启动本地静态服务并打开页面。

## 文档

- [QUICKSTART.md](./QUICKSTART.md) - 快速入门指南

## 说明

这个仓库参考的是 `vvd.world` 公开页面里可观察到的产品介绍与演示结构，用于本地化产品规划和原型实现。