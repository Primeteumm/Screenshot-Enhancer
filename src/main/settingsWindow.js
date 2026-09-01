const { BrowserWindow } = require('electron')
const path = require('path')

let win = null

function create() {
  win = new BrowserWindow({
    width: 520,
    height: 720,
    minWidth: 460,
    minHeight: 520,
    show: false,
    frame: false,
    backgroundColor: '#12141c',
    title: 'Screenshot Enhancer',
    icon: path.join(__dirname, '..', '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'settings.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.loadFile(path.join(__dirname, '..', 'renderer', 'settings', 'index.html'))
  win.once('ready-to-show', () => win.show())
  // Kapatmak uygulamadan cikmaz; tepside calismaya devam eder.
  win.on('close', event => {
    if (!global.__isQuitting) {
      event.preventDefault()
      win.hide()
    }
  })
  win.on('closed', () => { win = null })
  return win
}

function show() {
  if (!win || win.isDestroyed()) create()
  else {
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  }
  return win
}

function get() {
  return win && !win.isDestroyed() ? win : null
}

function broadcast(channel, payload) {
  const target = get()
  if (target) target.webContents.send(channel, payload)
}

module.exports = { show, get, broadcast }
