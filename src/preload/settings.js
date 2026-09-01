const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  get: () => ipcRenderer.invoke('settings:get'),
  update: patch => ipcRenderer.invoke('settings:update', patch),
  reset: () => ipcRenderer.invoke('settings:reset'),
  test: () => ipcRenderer.invoke('settings:test'),
  chooseFolder: () => ipcRenderer.invoke('settings:chooseFolder'),
  openCaptures: () => ipcRenderer.invoke('settings:openCaptures'),
  clearCaptures: () => ipcRenderer.invoke('settings:clearCaptures'),
  onChanged: handler => ipcRenderer.on('settings:changed', (event, cfg) => handler(cfg)),
  minimize: () => ipcRenderer.send('window:minimize'),
  close: () => ipcRenderer.send('window:close')
})
