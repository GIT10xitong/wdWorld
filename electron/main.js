const { app, BrowserWindow, ipcMain, shell, safeStorage, dialog, Menu, session, net } = require('electron')
const path = require('path')
const fs = require('fs')
const { registerAI } = require('./ai')
const { pathToFileURL } = require('node:url')
const { createProjectStorage } = require('./protected-storage')
const { trustedSender, externalUrl } = require('./security')
const { installMenu, menuText, nativeMessage } = require('./menu')
const { registerLan } = require('./lan')
const { createPluginManager, registerPlugins } = require('./plugins')
const { registerUpdates } = require('./updates')
const { registerNovelHome } = require('./novel-home')
let installingUpdate = false

// Keep the same data location in source and packaged builds.
app.setPath('userData', path.join(app.getPath('appData'), 'wdworld'))
if (!app.isPackaged && process.env.WDWORLD_TEST_USER_DATA) {
  app.setPath('userData', path.resolve(process.env.WDWORLD_TEST_USER_DATA))
}

const appUrl =
  app.isPackaged || process.env.WDWORLD_PREVIEW === '1'
    ? pathToFileURL(path.join(__dirname, '../dist/index.html')).href
    : 'http://localhost:5173/'
const trustedIPC = {
  handle: (channel, handler) =>
    ipcMain.handle(channel, (event, ...args) => {
      if (!trustedSender(event, BrowserWindow.getAllWindows(), appUrl)) throw new Error('拒绝未知页面请求')
      return handler(event, ...args)
    }),
}
const ai = registerAI({ ipcMain: trustedIPC, app, safeStorage })
registerNovelHome({ app, ipcMain: trustedIPC, safeStorage })
let lan
const plugins = createPluginManager({
  root: app.getPath('userData'),
  safeStorage,
  appVersion: app.getVersion(),
  // Use system proxy settings without attaching session cookies to plugin requests.
  fetchImpl: (url, options) => net.fetch(url, { ...options, credentials: 'omit' }),
  guardChange: () => {
    if (lan?.state()) throw new Error('End the running room before changing plugins')
  },
})
lan = registerLan({
  ipcMain: trustedIPC,
  app,
  safeStorage,
  generate: ai.generate,
  requireMode: plugins.requireMode,
  getMemory: plugins.memoryContext,
})
registerPlugins({ ipcMain: trustedIPC, manager: plugins, getRoom: () => lan.state(), generate: ai.generate })
registerUpdates({
  app,
  ipcMain: trustedIPC,
  BrowserWindow,
  shell,
  net,
  beforeInstall: async () => {
    if (lan?.state()) throw new Error('End the room before installing')
    installingUpdate = true
  },
  installFailed: () => {
    installingUpdate = false
  },
})

function createWindow() {
  const win = new BrowserWindow({
    show: !process.env.WDWORLD_TEST_USER_DATA,
    width: 1440,
    height: 940,
    minWidth: 1100,
    minHeight: 720,
    title: menuText('WD World · 世界创作', 'WD World · Worldbuilding'),
    webPreferences: {
      backgroundThrottling: !process.env.WDWORLD_TEST_USER_DATA,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
      allowRunningInsecureContent: false,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  let canClose = false
  let closing = false
  let closeTimer
  win.on('close', (event) => {
    if (canClose || installingUpdate) return
    event.preventDefault()
    if (closing) return
    closing = true
    win.webContents.send('app:prepare-close')
    closeTimer = setTimeout(() => {
      closing = false
      dialog.showMessageBox(win, {
        type: 'error',
        message: menuText(
          '尚未收到保存完成确认，窗口已保留。请检查保存状态后重试。',
          'Save confirmation not received. The window remains open. Check save status and retry.',
        ),
      })
    }, 15000)
  })
  const onCloseReady = (event, ok) => {
    if (!trustedSender(event, [win], appUrl) || !closing) return
    clearTimeout(closeTimer)
    closing = false
    if (ok) {
      canClose = true
      win.close()
    } else
      dialog.showMessageBox(win, {
        type: 'error',
        message: menuText(
          '保存失败，窗口已保留。请重试保存或导出备份。',
          'Save failed. The window remains open. Retry saving or export a backup.',
        ),
      })
  }
  ipcMain.on('app:close-ready', onCloseReady)
  win.on('closed', () => {
    clearTimeout(closeTimer)
    ipcMain.removeListener('app:close-ready', onCloseReady)
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (externalUrl(url)) void shell.openExternal(url).catch(() => {})
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, url) => {
    if (url !== appUrl) {
      event.preventDefault()
      if (externalUrl(url)) void shell.openExternal(url).catch(() => {})
    }
  })
  win.webContents.on('will-redirect', (event) => event.preventDefault())
  win.webContents.on('will-attach-webview', (event) => event.preventDefault())

  if (app.isPackaged || process.env.WDWORLD_PREVIEW === '1') {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  } else {
    win.loadURL('http://localhost:5173')
  }
}

if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
    }
  })
  app.whenReady().then(() => {
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
    session.defaultSession.setPermissionCheckHandler(() => false)
    session.defaultSession.setDevicePermissionHandler(() => false)
    installMenu({ app, Menu, dialog, BrowserWindow, safeStorage, ipcMain: trustedIPC })
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

function getWdWorldDir() {
  return path.join(app.getPath('userData'), 'wdworld')
}

function getProjectsDir() {
  return path.join(getWdWorldDir(), 'projects')
}

const projectStorage = createProjectStorage(getWdWorldDir(), safeStorage)

trustedIPC.handle('save-project', async (_event, projectId, projectJson, dbBase64) => {
  try {
    projectStorage.save(projectId, projectJson, dbBase64)

    return { ok: true }
  } catch (error) {
    console.error('save-project error:', error)
    return { ok: false, error: error.message }
  }
})

trustedIPC.handle('load-project', async (_event, projectId) => {
  try {
    return { ok: true, projectId, ...projectStorage.load(projectId) }
  } catch (error) {
    console.error('load-project error:', error)
    void dialog.showMessageBox({
      type: 'error',
      message: menuText('无法打开项目', 'Could not open project'),
      detail: nativeMessage(error.message),
    })
    return { ok: false, projectJson: null, dbBase64: null, error: error.message }
  }
})

trustedIPC.handle('list-projects', async () => {
  try {
    const projectsDir = getProjectsDir()
    if (!fs.existsSync(projectsDir)) {
      return { ok: true, projects: [] }
    }

    const entries = fs.readdirSync(projectsDir, { withFileTypes: true })
    const projectIds = entries.filter((e) => e.isDirectory()).map((e) => e.name)

    const projects = []
    for (const projectId of projectIds) {
      try {
        const { projectJson } = projectStorage.load(projectId)
        const project = JSON.parse(projectJson)
        projects.push({
          id: projectId,
          name: project.name,
          mode: project.mode || 'free',
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
        })
      } catch (e) {
        console.error(`list-projects: skip ${projectId}`, e)
      }
    }

    return { ok: true, projects }
  } catch (error) {
    console.error('list-projects error:', error)
    return { ok: false, projects: [], error: error.message }
  }
})

trustedIPC.handle('delete-project', async (_event, projectId) => {
  try {
    const projectDir = projectStorage.projectDir(projectId)
    if (fs.existsSync(projectDir)) {
      fs.rmSync(projectDir, { recursive: true, force: true })
    }
    return { ok: true }
  } catch (error) {
    console.error('delete-project error:', error)
    return { ok: false, error: error.message }
  }
})

trustedIPC.handle('save-recent-projects', async (_event, list) => {
  try {
    projectStorage.saveRecent(list)
    return { ok: true }
  } catch (error) {
    console.error('save-recent-projects error:', error)
    return { ok: false, error: error.message }
  }
})

trustedIPC.handle('load-recent-projects', async () => {
  try {
    return { ok: true, list: projectStorage.loadRecent() }
  } catch (error) {
    console.error('load-recent-projects error:', error)
    void dialog.showMessageBox({
      type: 'error',
      message: menuText('无法读取最近项目', 'Could not load recent projects'),
      detail: nativeMessage(error.message),
    })
    return { ok: false, list: null, error: error.message }
  }
})
