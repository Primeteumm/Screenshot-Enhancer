const { app } = require('electron')
const fs = require('fs')
const path = require('path')
const os = require('os')
const chokidar = require('chokidar')
const { EventEmitter } = require('events')

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.bmp', '.webp'])
// Windows dili degistikce klasor adi da degisiyor; yaygin karsiliklari deniyoruz.
const SCREENSHOT_DIR_NAMES = ['Screenshots', 'Ekran Goruntuleri', 'Ekran Görüntüleri', 'Screen Shots']

function candidateRoots() {
  const roots = []
  const push = dir => {
    if (dir && !roots.includes(dir)) roots.push(dir)
  }
  try { push(app.getPath('pictures')) } catch { /* yok */ }
  push(path.join(os.homedir(), 'Pictures'))
  for (const key of ['OneDrive', 'OneDriveConsumer', 'OneDriveCommercial']) {
    if (process.env[key]) push(path.join(process.env[key], 'Pictures'))
  }
  return roots
}

function defaultFolders() {
  const found = []
  for (const root of candidateRoots()) {
    for (const name of SCREENSHOT_DIR_NAMES) {
      const dir = path.join(root, name)
      try {
        if (fs.statSync(dir).isDirectory() && !found.includes(dir)) found.push(dir)
      } catch { /* yok */ }
    }
  }
  return found
}

class FolderWatcher extends EventEmitter {
  constructor() {
    super()
    this.watcher = null
    this.folders = []
  }

  start(extraFolders = []) {
    this.stop()
    const folders = [...defaultFolders()]
    for (const dir of extraFolders) {
      try {
        if (dir && fs.statSync(dir).isDirectory() && !folders.includes(dir)) folders.push(dir)
      } catch { /* gecersiz yol */ }
    }
    this.folders = folders
    if (!folders.length) return

    this.watcher = chokidar.watch(folders, {
      ignoreInitial: true,
      depth: 0,
      awaitWriteFinish: { stabilityThreshold: 400, pollInterval: 80 }
    })
    this.watcher.on('add', filePath => {
      if (!IMAGE_EXT.has(path.extname(filePath).toLowerCase())) return
      // Toplu kopyalama / senkronizasyon sonrasi eski dosyalar icin tetiklenme.
      try {
        if (Date.now() - fs.statSync(filePath).mtimeMs > 20000) return
      } catch {
        return
      }
      this.emit('file', filePath)
    })
    this.watcher.on('error', err => console.error('[folderWatcher]', err.message))
  }

  stop() {
    if (this.watcher) {
      this.watcher.close().catch(() => {})
      this.watcher = null
    }
    this.folders = []
  }
}

module.exports = new FolderWatcher()
module.exports.defaultFolders = defaultFolders
