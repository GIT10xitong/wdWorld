const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const fs = require('fs')

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'WD World',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, url) => {
    const currentUrl = win.webContents.getURL()
    if (url !== currentUrl && /^https?:\/\//i.test(url)) {
      event.preventDefault()
      void shell.openExternal(url)
    }
  })

  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  } else {
    win.loadURL('http://localhost:5173')
  }
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

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

function getProjectDir(projectId) {
  if (typeof projectId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(projectId)) {
    throw new Error('无效的项目 ID')
  }
  return path.join(getProjectsDir(), projectId)
}

function writeFileAtomic(filePath, data, encoding) {
  const tempPath = `${filePath}.tmp`
  const backupPath = `${filePath}.bak`
  fs.writeFileSync(tempPath, data, encoding)
  if (fs.existsSync(filePath)) fs.copyFileSync(filePath, backupPath)
  fs.renameSync(tempPath, filePath)
}

function getRecentProjectsFilePath() {
  return path.join(getWdWorldDir(), 'recent-projects.json')
}

ipcMain.handle('save-project', async (_event, projectId, projectJson, dbBase64) => {
  try {
    const projectDir = getProjectDir(projectId)
    fs.mkdirSync(projectDir, { recursive: true })

    const projectJsonPath = path.join(projectDir, 'project.json')
    writeFileAtomic(projectJsonPath, projectJson, 'utf-8')

    const dbPath = path.join(projectDir, 'database.db')
    const dbBuffer = Buffer.from(dbBase64, 'base64')
    writeFileAtomic(dbPath, dbBuffer)

    return { ok: true }
  } catch (error) {
    console.error('save-project error:', error)
    return { ok: false, error: error.message }
  }
})

ipcMain.handle('load-project', async (_event, projectId) => {
  try {
    const projectDir = getProjectDir(projectId)
    const projectJsonPath = path.join(projectDir, 'project.json')
    const dbPath = path.join(projectDir, 'database.db')

    if (!fs.existsSync(projectJsonPath) || !fs.existsSync(dbPath)) {
      return { ok: false, projectJson: null, dbBase64: null, error: '项目不存在或数据不完整' }
    }

    const projectJson = fs.readFileSync(projectJsonPath, 'utf-8')
    const dbBuffer = fs.readFileSync(dbPath)
    const dbBase64 = dbBuffer.toString('base64')

    return { ok: true, projectId, projectJson, dbBase64 }
  } catch (error) {
    console.error('load-project error:', error)
    return { ok: false, projectJson: null, dbBase64: null, error: error.message }
  }
})

ipcMain.handle('list-projects', async () => {
  try {
    const projectsDir = getProjectsDir()
    if (!fs.existsSync(projectsDir)) {
      return { ok: true, projects: [] }
    }

    const entries = fs.readdirSync(projectsDir, { withFileTypes: true })
    const projectIds = entries.filter((e) => e.isDirectory()).map((e) => e.name)

    const projects = []
    for (const projectId of projectIds) {
      const projectJsonPath = path.join(projectsDir, projectId, 'project.json')
      if (fs.existsSync(projectJsonPath)) {
        try {
          const projectJson = fs.readFileSync(projectJsonPath, 'utf-8')
          const project = JSON.parse(projectJson)
          projects.push({
            id: projectId,
            name: project.name,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
          })
        } catch (e) {
          console.error(`list-projects: skip ${projectId}`, e)
        }
      }
    }

    return { ok: true, projects }
  } catch (error) {
    console.error('list-projects error:', error)
    return { ok: false, projects: [], error: error.message }
  }
})

ipcMain.handle('delete-project', async (_event, projectId) => {
  try {
    const projectDir = getProjectDir(projectId)
    if (fs.existsSync(projectDir)) {
      fs.rmSync(projectDir, { recursive: true, force: true })
    }
    return { ok: true }
  } catch (error) {
    console.error('delete-project error:', error)
    return { ok: false, error: error.message }
  }
})

ipcMain.handle('save-recent-projects', async (_event, list) => {
  try {
    const wdworldDir = getWdWorldDir()
    fs.mkdirSync(wdworldDir, { recursive: true })
    const filePath = getRecentProjectsFilePath()
    writeFileAtomic(filePath, JSON.stringify(list, null, 2), 'utf-8')
    return { ok: true }
  } catch (error) {
    console.error('save-recent-projects error:', error)
    return { ok: false, error: error.message }
  }
})

ipcMain.handle('load-recent-projects', async () => {
  try {
    const filePath = getRecentProjectsFilePath()
    if (!fs.existsSync(filePath)) {
      return { ok: true, list: null }
    }
    const content = fs.readFileSync(filePath, 'utf-8')
    return { ok: true, list: JSON.parse(content) }
  } catch (error) {
    console.error('load-recent-projects error:', error)
    return { ok: false, list: null, error: error.message }
  }
})
