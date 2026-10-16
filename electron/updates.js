const fs = require('node:fs')
const path = require('node:path')
const RELEASES = 'https://github.com/actrox/wdWorld/releases'
function newer(next, current) {
  if (!/^v?\d+\.\d+\.\d+$/.test(next)) return false
  const a = next.replace(/^v/, '').split('.').map(Number),
    b = current.split('.').map(Number)
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i]
  return false
}
function createUpdates({
  version,
  supported,
  updater,
  fetchImpl = fetch,
  notify = () => {},
  beforeInstall = async () => {},
  installFailed = () => {},
  getAutomatic = () => true,
  setAutomatic = () => {},
}) {
  let state = {
    phase: 'idle',
    current: version,
    version: '',
    percent: 0,
    supported,
    automatic: getAutomatic(),
    releases: RELEASES,
    error: '',
  }
  let busy = false
  const emit = (patch) => {
    state = { ...state, ...patch }
    notify(state)
    return state
  }
  if (updater) {
    updater.autoDownload = false
    updater.autoInstallOnAppQuit = false
    updater.allowDowngrade = false
    updater.allowPrerelease = false
    updater.on('update-available', (info) => emit({ phase: 'available', version: info.version, error: '' }))
    updater.on('update-not-available', () => emit({ phase: 'latest', error: '' }))
    updater.on('download-progress', (progress) =>
      emit({ phase: 'downloading', percent: Math.max(0, Math.min(100, progress.percent)) }),
    )
    updater.on('update-downloaded', (info) => emit({ phase: 'ready', version: info.version, percent: 100 }))
    updater.on('error', () => {
      if (state.phase === 'installing') installFailed()
      if (!busy) emit({ phase: 'error', error: 'update-failed' })
    })
  }
  async function latestRelease() {
    const response = await fetchImpl('https://api.github.com/repos/actrox/wdWorld/releases/latest', {
      headers: { Accept: 'application/vnd.github+json' },
      credentials: 'omit',
      redirect: 'error',
      signal: AbortSignal.timeout(20000),
    })
    if (!response.ok) throw new Error('release-unavailable')
    const chunks = []
    let size = 0
    for await (const chunk of response.body) {
      size += chunk.length
      if (size > 1024 * 1024) throw new Error('release-too-large')
      chunks.push(chunk)
    }
    const release = JSON.parse(Buffer.concat(chunks).toString())
    if (release.draft || release.prerelease || !/^v?\d+\.\d+\.\d+$/.test(release.tag_name))
      throw new Error('invalid-release')
    return release.tag_name.replace(/^v/, '')
  }
  async function check() {
    if (busy || ['ready', 'installing'].includes(state.phase)) return state
    busy = true
    emit({ phase: 'checking', error: '' })
    try {
      if (supported) await updater.checkForUpdates()
      else {
        const release = await latestRelease()
        emit({
          phase: newer(release, version) ? 'available' : 'latest',
          version: release,
        })
      }
    } catch {
      // Old releases may predate update manifests. Do not offer their installers as a downgrade.
      try {
        if (!supported) throw new Error('release-unavailable')
        const release = await latestRelease()
        if (newer(release, version)) throw new Error('missing-update-manifest')
        emit({ phase: 'latest', version: release, error: '' })
      } catch {
        emit({ phase: 'error', error: 'update-failed' })
      }
    } finally {
      busy = false
    }
    return state
  }
  return {
    state: () => state,
    check,
    async download() {
      if (!supported || busy || state.phase !== 'available') throw new Error('update-not-available')
      busy = true
      emit({ phase: 'downloading', percent: 0, error: '' })
      try {
        await updater.downloadUpdate()
      } catch {
        emit({ phase: 'error', error: 'update-failed' })
      } finally {
        busy = false
      }
      return state
    },
    async install() {
      if (!supported || busy || state.phase !== 'ready') throw new Error('update-not-ready')
      busy = true
      try {
        await beforeInstall()
        emit({ phase: 'installing' })
        updater.quitAndInstall(false, true)
      } catch {
        installFailed()
        emit({ phase: 'ready', error: 'save-before-update-failed' })
      } finally {
        busy = false
      }
      return state
    },
    automatic(value) {
      if (typeof value !== 'boolean') throw new Error('invalid-preference')
      setAutomatic(value)
      return emit({ automatic: value })
    },
  }
}
function registerUpdates({ app, ipcMain, BrowserWindow, shell, net, beforeInstall, installFailed }) {
  const settingsFile = path.join(app.getPath('userData'), 'updates.json')
  const supported =
    app.isPackaged &&
    process.platform === 'win32' &&
    fs.existsSync(path.join(process.resourcesPath, 'app-update.yml'))
  // Portable/source builds do not load updater dependencies or attempt self-replacement.
  const updater = supported ? require('electron-updater').autoUpdater : null
  const manager = createUpdates({
    version: app.getVersion(),
    supported,
    updater,
    beforeInstall,
    installFailed,
    fetchImpl: (url, options) => net.fetch(url, options),
    getAutomatic: () => {
      try {
        return JSON.parse(fs.readFileSync(settingsFile, 'utf8')).automatic !== false
      } catch {
        return true
      }
    },
    setAutomatic: (automatic) => {
      fs.mkdirSync(path.dirname(settingsFile), { recursive: true })
      fs.writeFileSync(settingsFile + '.tmp', JSON.stringify({ automatic }))
      fs.renameSync(settingsFile + '.tmp', settingsFile)
    },
    notify: (state) => {
      for (const win of BrowserWindow.getAllWindows())
        if (!win.isDestroyed()) win.webContents.send('updates:state', state)
    },
  })
  for (const method of ['state', 'check', 'download', 'install', 'automatic'])
    ipcMain.handle('updates:' + method, async (_event, input) => {
      try {
        return { ok: true, state: await manager[method](input) }
      } catch (e) {
        return { ok: false, error: e.message }
      }
    })
  ipcMain.handle('updates:releases', () => shell.openExternal(RELEASES))
  // Do not contact GitHub automatically from tests or source previews.
  if (app.isPackaged)
    app.whenReady().then(() =>
      setTimeout(() => {
        if (manager.state().automatic) void manager.check()
      }, 15000),
    )
  return manager
}
module.exports = { createUpdates, registerUpdates, newer }
