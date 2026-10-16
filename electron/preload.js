const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('novelHome', {
  load: () => ipcRenderer.invoke('novel-home:load'),
  save: (data) => ipcRenderer.invoke('novel-home:save', data),
})
contextBridge.exposeInMainWorld('appUpdates', {
  ...Object.fromEntries(
    ['state', 'check', 'download', 'install', 'automatic', 'releases'].map((method) => [
      method,
      (input) => ipcRenderer.invoke('updates:' + method, input),
    ]),
  ),
  onState: (callback) => {
    const handler = (_event, state) => callback(state)
    ipcRenderer.on('updates:state', handler)
    return () => ipcRenderer.removeListener('updates:state', handler)
  },
  onOpen: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('updates:open', handler)
    return () => ipcRenderer.removeListener('updates:open', handler)
  },
})
contextBridge.exposeInMainWorld(
  'wdPlugins',
  Object.fromEntries(
    [
      'list',
      'catalog',
      'prepare',
      'install',
      'change',
      'configure',
      'invoke',
      'cancel',
      'memory',
      'summarize',
    ].map((method) => [method, (input) => ipcRenderer.invoke('plugins:' + method, input)]),
  ),
)
contextBridge.exposeInMainWorld('lanRoom', {
  start: (input) => ipcRenderer.invoke('lan:start', input),
  state: () => ipcRenderer.invoke('lan:state'),
  action: (input) => ipcRenderer.invoke('lan:action', input),
  stop: () => ipcRenderer.invoke('lan:stop'),
  archive: () => ipcRenderer.invoke('lan:archive'),
  archiveStatus: () => ipcRenderer.invoke('lan:archive-status'),
  history: (projectId) => ipcRenderer.invoke('lan:history', projectId),
})
contextBridge.exposeInMainWorld('appPreferences', {
  onPlugins: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('app:plugins', handler)
    return () => ipcRenderer.removeListener('app:plugins', handler)
  },
  onSwitchMode: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('app:switch-mode', handler)
    return () => ipcRenderer.removeListener('app:switch-mode', handler)
  },
  getLanguage: () => ipcRenderer.invoke('settings:language:get'),
  setLanguage: (value) => ipcRenderer.invoke('settings:language:set', value),
  onLanguage: (callback) => {
    const handler = (_event, value) => callback(value)
    ipcRenderer.on('settings:language', handler)
    return () => ipcRenderer.removeListener('settings:language', handler)
  },
})

contextBridge.exposeInMainWorld('novelAI', {
  getSettings: (provider) => ipcRenderer.invoke('ai:settings:get', provider),
  listModels: (input) => ipcRenderer.invoke('ai:models', input),
  testModel: (input) => ipcRenderer.invoke('ai:test', input),
  saveSettings: (input) => ipcRenderer.invoke('ai:settings:save', input),
  generate: (input) => ipcRenderer.invoke('ai:generate', input),
  cancel: (id) => ipcRenderer.invoke('ai:cancel', id),
  onDelta: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('ai:delta', handler)
    return () => ipcRenderer.removeListener('ai:delta', handler)
  },
  onProgress: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('ai:progress', handler)
    return () => ipcRenderer.removeListener('ai:progress', handler)
  },
})
contextBridge.exposeInMainWorld('desktopLifecycle', {
  onBeforeClose: (callback) => {
    const handler = async () => {
      try {
        ipcRenderer.send('app:close-ready', await callback())
      } catch {
        ipcRenderer.send('app:close-ready', false)
      }
    }
    ipcRenderer.on('app:prepare-close', handler)
    return () => ipcRenderer.removeListener('app:prepare-close', handler)
  },
})

contextBridge.exposeInMainWorld('wdAPI', {
  isElectron: () => true,
  saveProject: (projectId, projectJson, dbBase64) =>
    ipcRenderer.invoke('save-project', projectId, projectJson, dbBase64),
  loadProject: (projectId) => ipcRenderer.invoke('load-project', projectId),
  listProjects: () => ipcRenderer.invoke('list-projects'),
  deleteProject: (projectId) => ipcRenderer.invoke('delete-project', projectId),
  saveRecentProjects: (list) => ipcRenderer.invoke('save-recent-projects', list),
  loadRecentProjects: () => ipcRenderer.invoke('load-recent-projects'),
})
