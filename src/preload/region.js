const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('region', {
  ready: () => ipcRenderer.send('region:ready'),
  done: selection => ipcRenderer.send('region:done', selection),
  onImage: handler => ipcRenderer.on('region:image', (event, payload) => handler(payload))
})
