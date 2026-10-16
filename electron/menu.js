const fs = require('node:fs')
const path = require('node:path')
let activeLanguage = 'zh-CN'
const menuText = (zh, en) => (activeLanguage === 'en' ? en : zh)
const nativeMessage = (text) => (activeLanguage === 'en' ? require('./messages.en.json')[text] || text : text)

function installMenu({ app, Menu, dialog, BrowserWindow, safeStorage, ipcMain }) {
  const file = path.join(app.getPath('userData'), 'preferences.json')
  let language = 'zh-CN'
  try {
    if (JSON.parse(fs.readFileSync(file, 'utf8')).menuLanguage === 'en') language = 'en'
  } catch {
    /* default Chinese */
  }
  activeLanguage = language
  let chooseLanguage
  const build = () => {
    const t = (zh, en) => (language === 'en' ? en : zh)
    const role = (name, zh, en) => ({ role: name, label: t(zh, en) })
    const choose = (value) => {
      if (!['en', 'zh-CN'].includes(value)) throw new Error('Invalid language')
      try {
        fs.mkdirSync(path.dirname(file), { recursive: true })
        fs.writeFileSync(file + '.tmp', JSON.stringify({ menuLanguage: value }), 'utf8')
        fs.renameSync(file + '.tmp', file)
        language = value
        activeLanguage = language
        build()
        for (const win of BrowserWindow.getAllWindows()) {
          win.webContents.send('settings:language', value)
          if (
            win.webContents.getURL().includes('index.html') ||
            win.webContents.getURL() === 'http://localhost:5173/'
          )
            win.setTitle(menuText('WD World · 世界创作', 'WD World · Worldbuilding'))
        }
      } catch {
        void dialog.showMessageBox({
          type: 'error',
          message: t('语言设置保存失败，请重试。', 'Could not save the language setting. Please retry.'),
        })
      }
    }
    chooseLanguage = choose
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        {
          label: t('文件', 'File'),
          submenu: [
            {
              id: 'switch-creation-mode',
              label: t('切换创作模式', 'Switch creation mode'),
              accelerator: 'CmdOrCtrl+Shift+M',
              click: () => {
                const win = BrowserWindow.getAllWindows().find(
                  (w) =>
                    w.webContents.getURL().includes('index.html') ||
                    w.webContents.getURL().startsWith('http://localhost:5173'),
                )
                win?.webContents.send('app:switch-mode')
              },
            },
            { type: 'separator' },
            role('close', '关闭窗口', 'Close Window'),
            { type: 'separator' },
            role('quit', '退出', 'Quit'),
          ],
        },
        {
          label: t('编辑', 'Edit'),
          submenu: [
            role('undo', '撤销', 'Undo'),
            role('redo', '重做', 'Redo'),
            { type: 'separator' },
            role('cut', '剪切', 'Cut'),
            role('copy', '复制', 'Copy'),
            role('paste', '粘贴', 'Paste'),
            role('selectAll', '全选', 'Select All'),
          ],
        },
        {
          label: t('视图', 'View'),
          submenu: [
            role('resetZoom', '实际大小', 'Actual Size'),
            role('zoomIn', '放大', 'Zoom In'),
            role('zoomOut', '缩小', 'Zoom Out'),
            { type: 'separator' },
            role('togglefullscreen', '全屏', 'Toggle Full Screen'),
          ],
        },
        {
          label: t('设置', 'Settings'),
          submenu: [
            {
              id: 'plugin-center',
              label: t('插件中心', 'Plugin center'),
              click: () => {
                const win = BrowserWindow.getAllWindows().find(
                  (w) =>
                    w.webContents.getURL().includes('index.html') ||
                    w.webContents.getURL().startsWith('http://localhost:5173'),
                )
                win?.webContents.send('app:plugins')
              },
            },
            {
              label: t('语言', 'Language'),
              submenu: [
                {
                  id: 'language-zh',
                  label: '简体中文',
                  type: 'radio',
                  checked: language === 'zh-CN',
                  click: () => choose('zh-CN'),
                },
                {
                  id: 'language-en',
                  label: 'English',
                  type: 'radio',
                  checked: language === 'en',
                  click: () => choose('en'),
                },
              ],
            },
            {
              id: 'security-status',
              label: t('本地数据保护', 'Local Data Protection'),
              click: () => {
                const encrypted =
                  safeStorage.isEncryptionAvailable() &&
                  safeStorage.getSelectedStorageBackend?.() !== 'basic_text'
                void dialog.showMessageBox(
                  BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0],
                  {
                    type: encrypted ? 'info' : 'error',
                    title: t('本地数据保护', 'Local Data Protection'),
                    message: encrypted
                      ? t('系统加密可用 · 默认保护已启用', 'System encryption available · Protection enabled')
                      : t(
                          '系统加密不可用，已阻止明文保存',
                          'Encryption unavailable. Plaintext saves are blocked.',
                        ),
                    detail: t(
                      '项目正文、设定、最近项目和自动备份在本机加密保存。旧项目在读取或保存时迁移，API 配置沿用系统加密。\n\n已启用页面沙箱、权限限制和消息来源校验。\n\n导出的 JSON 备份是明文，方便跨电脑恢复，请妥善保管。本机加密数据依赖原电脑的系统账号，不能替代导出备份。',
                      'Projects, settings, recent projects and automatic backups are encrypted locally. Legacy projects migrate when read or saved. API profiles use system encryption.\n\nPage sandboxing, permission restrictions and IPC source checks are enabled.\n\nExported JSON backups are plaintext for portability. Keep them private. Local encrypted files depend on the original computer and OS account; export backups before moving computers.',
                    ),
                  },
                )
              },
            },
          ],
        },
        {
          label: t('帮助', 'Help'),
          submenu: [
            {
              id: 'app-updates',
              label: t('检查应用更新', 'Application updates'),
              click: () => BrowserWindow.getAllWindows()[0]?.webContents.send('updates:open'),
            },
            {
              label: t('关于 WD World', 'About WD World'),
              click: () =>
                void dialog.showMessageBox({
                  title: 'WD World',
                  message: 'WD World ' + app.getVersion(),
                  detail: t(
                    '本地优先的小说创作与世界观工作台',
                    'A local-first novel and worldbuilding studio',
                  ),
                }),
            },
          ],
        },
      ]),
    )
  }
  build()
  ipcMain?.handle('settings:language:get', () => language)
  ipcMain?.handle('settings:language:set', (_event, value) => {
    chooseLanguage(value)
    return language
  })
}
module.exports = { installMenu, menuText, nativeMessage }
