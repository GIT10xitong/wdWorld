const { contextBridge, ipcRenderer } = require('electron')

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
