# Windows 候选版验收

候选版使用 package.json 中的版本号。构建与本地验收不等同于公开发布，所有发布命令显式禁用上传。

## 检查与构建

1. 保存并提交源码，确认工作区干净。候选构建会将该提交写入产物清单。
2. 执行 `npm run format:check`、`npm run lint`、`npm run test:coverage`。
3. 执行 `npm run test:desktop:all`，随后执行 `npm run test:ui-layout`。前者构建一次并顺序运行九组桌面测试；后者单独检查中英文文件控件与四档窗口布局，尚未并入九组汇总。桌面测试应顺序执行，避免多个窗口互相干扰。
4. 执行 `npm run release:candidate`。构建便携目录与 x64 NSIS 安装包，校验更新清单，再分别启动实际打包程序进行数据迁移和保存恢复测试。

输出目录为 `release/v<版本>/`，包含便携目录、`installer/`、`candidate.json` 和 `SHA256SUMS.txt`。若目录已存在，构建直接停止；应保留旧产物并使用新版本号，或将失败构建目录明确归档后重试。不要直接覆盖已分发包。

`candidate.json` 记录版本、源码提交号、构建时间和安装 EXE、blockmap、latest.yml 的大小与摘要。安装包的 SHA-512 必须与 latest.yml 一致。当前候选版没有代码签名。

## 实际安装与升级验收

在没有 WD World 正式安装的 Windows 测试账号中运行：

```powershell
$candidateVersion = (Get-Content package.json | ConvertFrom-Json).version
./scripts/test-installer.ps1 -Installer "release/v$candidateVersion/installer/WDWorld-Setup-$candidateVersion.exe"
```

若有保存的上一版安装包，可增加 `-PreviousInstaller 'release/installer/WDWorld-Setup-1.10.0.exe'`。脚本先在临时目录安装旧版，再运行候选安装包验证升级。不会启动旧版程序；旧数据兼容性另由 1.7.0 项目样本检验。最后启动新安装程序，验证版本、更新能力、项目迁移、编辑保存与重启，然后卸载临时安装并检查注册信息清理。

如果已有正式安装或同名快捷方式，脚本停止，应改用干净测试账号。临时安装的卸载不会删除作者数据。测试项目留在系统临时目录中便于排错，不使用真实作品、模型密钥或外部模型服务。

打包程序的测试入口要求同时传入 `--wdworld-test-mode` 与 `WDWORLD_TEST_USER_DATA`，且目录必须位于系统临时目录、名称以 `wdworld-` 开头。普通启动忽略打包测试变量，沿用原用户数据位置。测试模式不自动联网检查更新。

## 旧项目样本

`tests/fixtures/legacy/project-1.7.0.json` 由原 1.7.0 构建的内置示例世界生成，包含一条明确的迁移测试标记，没有作者真实资料。`scripts/generate-legacy-fixture.js <旧版 resources/app 路径>` 可重新生成；源码包版本必须为 1.7.0。不要用真实项目替换提交到仓库的样本。

单元测试验证旧数据库到新数据库的读取、编辑、完整 JSON 备份和重新打开；打包测试还验证旧明文文件转为加密文件以及正常关闭后的重启恢复。已有加密存储测试覆盖文件损坏、密文篡改、跨项目错放和保存失败时拒绝覆盖。

## 自动化与结果

- `.github/workflows/ci.yml`：Linux 基础检查与 Windows 九组桌面回归。
- `.github/workflows/candidate.yml`：手动触发完整检查、候选打包、实际安装验收，并上传测试和安装包 artifacts；不创建公开 Release。
- `test-results/desktop-summary.json`：逐组桌面回归结果。
- `test-results/packaged-*.json`：实际打包程序的兼容性结果。
- `test-results/installer-acceptance.json`：安装与卸载验收结果。

覆盖率门槛统计六个关键文件：工具、Markdown、保存队列、自动保存、加密存储和测试隔离。它不是整个应用的覆盖率；数据库、备份、插件和联机另外有行为测试。后续再逐步扩大统计范围。

本地安装升级验证不代表从 GitHub 完成了在线自动更新。发布前仍需在真实发布源核对稳定版清单，并从较早的已安装版本验证下载、校验与重启更新。说明见 [应用更新](UPDATES.md)。
