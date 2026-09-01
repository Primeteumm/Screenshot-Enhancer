const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('preview', {
  ready: () => ipcRenderer.send('preview:ready'),
  // Kartlarin pencere icindeki dikdortgenleri; isabet testini ana surec yapar.
  hitboxes: rects => ipcRenderer.send('preview:hitboxes', rects),
  startDrag: id => ipcRenderer.send('preview:drag', id),
  moveStart: () => ipcRenderer.send('preview:move-start'),
  moveEnd: () => ipcRenderer.send('preview:move-end'),
  removed: id => ipcRenderer.send('preview:removed', id),
  action: (id, action) => ipcRenderer.invoke('preview:action', { id, action }),
  onAdd: handler => ipcRenderer.on('preview:add', (event, payload) => handler(payload)),
  onLayout: handler => ipcRenderer.on('preview:layout', (event, payload) => handler(payload)),
  onClear: handler => ipcRenderer.on('preview:clear', () => handler()),
  onDragEnd: handler => ipcRenderer.on('preview:dragend', (event, id) => handler(id)),
  // Imlecin uzerinde oldugu kart (ana surecin isabet testinden).
  onHot: handler => ipcRenderer.on('preview:hot', (event, id) => handler(id))
})
