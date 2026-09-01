const { app, ipcMain, dialog, shell, clipboard, nativeImage, screen, globalShortcut } = require('electron')
const { execFile } = require('child_process')
const fs = require('fs')
const path = require('path')

const config = require('./config')
const store = require('./store')
const previewManager = require('./previewManager')
const clipboardWatcher = require('./clipboardWatcher')
const folderWatcher = require('./folderWatcher')
const settingsWindow = require('./settingsWindow')
const tray = require('./tray')

const ASSETS = path.join(__dirname, '..', '..', 'assets')

app.setAppUserModelId('com.enesaydin.screenshotenhancer')
global.__isQuitting = false

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  main()
}

function main() {
  app.on('second-instance', () => settingsWindow.show())
  // Tepside yasayan bir uygulama: bu dinleyicinin varligi, tum pencereler
  // kapandiginda Electron'un uygulamadan cikmasini engeller.
  app.on('window-all-closed', () => {})

  app.whenReady().then(() => {
    const firstRun = !fs.existsSync(config.file)
    config.load()
    if (firstRun) config.save()
    store.init()

    tray.create({
      quit: quitApp,
      testPreview: showTestPreview,
      showLast: showLastCapture,
      setPaused: paused => config.update({ capture: { paused } })
    })

    registerIpc()
    applyWatchers()
    applyLaunchAtLogin()
    applyShortcuts()
    config.on('change', () => {
      applyWatchers()
      applyLaunchAtLogin()
      applyShortcuts()
      previewManager.applyConfig()
      settingsWindow.broadcast('settings:changed', config.get())
    })

    const startedHidden = process.argv.includes('--hidden') || app.getLoginItemSettings().wasOpenedAtLogin
    // Ilk calistirmada kullanici uygulamanin acildigini gorsun.
    if (!startedHidden && (firstRun || !config.get().general.startHidden)) settingsWindow.show()
  })
}

function quitApp() {
  global.__isQuitting = true
  clipboardWatcher.stop()
  folderWatcher.stop()
  globalShortcut.unregisterAll()
  app.quit()
}

/* ---------------- yakalama ---------------- */

// Pano ve klasor olaylari ayni ekran goruntusunu iki kez uretmesin diye
// son yakalamalar kisa sure hafizada tutulur.
const recentCaptures = []

let lastCapture = null

function rememberCapture(record) {
  lastCapture = record
  recentCaptures.push(record)
  const cutoff = Date.now() - 8000
  while (recentCaptures.length && recentCaptures[0].createdAt < cutoff) recentCaptures.shift()
}

function findDuplicate(width, height) {
  const cutoff = Date.now() - 5000
  for (let i = recentCaptures.length - 1; i >= 0; i--) {
    const record = recentCaptures[i]
    if (record.createdAt < cutoff) break
    if (record.width === width && record.height === height) return record
  }
  return null
}

// Ayar penceresindeki her kaydirici hareketi config degistirir; izleyicileri
// yalnizca kendilerini ilgilendiren ayar degistiginde yeniden kur.
let watcherState = ''

function applyWatchers() {
  const capture = config.get().capture
  const signature = JSON.stringify([
    capture.watchClipboard,
    capture.pollInterval,
    capture.watchFolders,
    capture.extraFolders,
    capture.paused
  ])
  if (signature === watcherState) return
  watcherState = signature

  if (capture.watchClipboard && !capture.paused) clipboardWatcher.start(capture.pollInterval)
  else clipboardWatcher.stop()

  if (capture.watchFolders && !capture.paused) folderWatcher.start(capture.extraFolders)
  else folderWatcher.stop()
}

clipboardWatcher.on('image', (image, meta) => {
  const capture = config.get().capture
  // Ekran goruntusu modunda: panoda metin/HTML de varsa bu bir kopyala-yapistir
  // islemidir (ornegin tarayicidan resim kopyalama), ekran goruntusu degil.
  if (capture.clipboardMode === 'screenshots' && (meta.textOnClipboard || meta.htmlOnClipboard)) return

  try {
    const record = store.saveImage(image, { source: 'clipboard' })
    record.cursorPoint = screen.getCursorScreenPoint()
    rememberCapture(record)
    previewManager.add(record)
  } catch (err) {
    console.error('[capture] pano goruntusu kaydedilemedi:', err.message)
  }
})

folderWatcher.on('file', filePath => {
  let image
  try {
    image = nativeImage.createFromPath(filePath)
  } catch {
    return
  }
  if (!image || image.isEmpty()) return
  const size = image.getSize()

  // Win+PrtSc hem panoya kopyalar hem dosyaya yazar: ayni kareyi iki kez gosterme,
  // bunun yerine mevcut karti gercek dosyaya bagla (surukleyince o dosya gider).
  const duplicate = findDuplicate(size.width, size.height)
  if (duplicate) {
    store.relink(duplicate, filePath)
    return
  }

  const record = store.adoptFile(filePath, { source: 'file' })
  if (!record) return
  record.cursorPoint = screen.getCursorScreenPoint()
  rememberCapture(record)
  previewManager.add(record)
})

function showTestPreview() {
  const image = nativeImage.createFromPath(path.join(ASSETS, 'sample.png'))
  if (image.isEmpty()) return
  const record = store.saveImage(image, { source: 'test' })
  record.cursorPoint = screen.getCursorScreenPoint()
  previewManager.add(record)
}

/* ---------------- global kisayollar ---------------- */

// Kaydedilemeyen kisayollar (baska bir uygulama kapmis olabilir) ayar
// penceresinde uyari olarak gosterilir.
let shortcutErrors = []

function showLastCapture() {
  if (!store.revive(lastCapture)) return
  lastCapture.cursorPoint = screen.getCursorScreenPoint()
  previewManager.add(lastCapture)
}

function togglePause() {
  config.update({ capture: { paused: !config.get().capture.paused } })
}

function applyShortcuts() {
  globalShortcut.unregisterAll()
  shortcutErrors = []
  const shortcuts = config.get().shortcuts
  if (!shortcuts.enabled) return

  const bind = (accelerator, handler) => {
    if (!accelerator) return
    try {
      if (!globalShortcut.register(accelerator, handler)) shortcutErrors.push(accelerator)
    } catch {
      shortcutErrors.push(accelerator)
    }
  }
  bind(shortcuts.showLast, showLastCapture)
  bind(shortcuts.togglePause, togglePause)
}

/* ---------------- OCR ---------------- */

// Windows'un yerlesik OCR motoru PowerShell uzerinden cagriliyor; harici
// bagimlilik ya da ag yok. Dil paketleri kullanicinin Windows ayarlarindan.
function readTextFromImage(filePath) {
  return new Promise(resolve => {
    // Paketli surumde betik asar arsivinin icinde kalirsa PowerShell okuyamaz;
    // electron-builder asarUnpack ile disari cikariyor.
    const script = path
      .join(__dirname, '..', '..', 'scripts', 'ocr.ps1')
      .replace('app.asar' + path.sep, 'app.asar.unpacked' + path.sep)
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, '-Path', filePath],
      { timeout: 25000, maxBuffer: 4 * 1024 * 1024, windowsHide: true },
      (error, stdout) => resolve(error ? null : String(stdout).trim())
    )
  })
}

/* ---------------- baslangicta calistir ---------------- */

let lastLaunchAtLogin = null

function applyLaunchAtLogin() {
  const wanted = config.get().general.launchAtLogin
  if (wanted === lastLaunchAtLogin) return
  lastLaunchAtLogin = wanted
  try {
    app.setLoginItemSettings({
      openAtLogin: wanted,
      // Paketlenmemis calismada electron.exe kaydedilirse ise yaramaz;
      // yine de gelistirme sirasinda ayari denemeye izin veriyoruz.
      path: process.execPath,
      args: app.isPackaged ? ['--hidden'] : [path.resolve(process.argv[1] || '.'), '--hidden']
    })
  } catch (err) {
    console.error('[autostart]', err.message)
  }
}

/* ---------------- ekranlar ---------------- */

function listDisplays() {
  const primary = screen.getPrimaryDisplay().id
  return screen.getAllDisplays().map((display, index) => ({
    id: String(display.id),
    label: 'Ekran ' + (index + 1) + ' - ' + display.size.width + 'x' + display.size.height +
      (display.id === primary ? ' (birincil)' : '')
  }))
}

/* ---------------- IPC ---------------- */

function registerIpc() {
  /* --- onizleme penceresi --- */
  ipcMain.on('preview:ready', () => previewManager.onRendererReady())

  ipcMain.on('preview:hitboxes', (event, rects) => previewManager.setHitboxes(rects))

  ipcMain.on('preview:move-start', () => previewManager.startMove())
  ipcMain.on('preview:move-end', () => previewManager.endMove())

  ipcMain.on('preview:removed', (event, id) => {
    previewManager.onCardRemoved(id)
    store.remove(id, false)
  })

  // ids: tek kart ya da secili kartlarin tamami
  ipcMain.on('preview:drag', (event, ids) => {
    const list = (Array.isArray(ids) ? ids : [ids])
      .map(id => store.get(id))
      .filter(record => record && fs.existsSync(record.filePath))
    if (!list.length) return

    try {
      const icon = nativeImage.createFromPath(list[0].filePath).resize({ width: 128, quality: 'good' })
      // Surukleme boyunca pencere etkilesime acik kalmali.
      previewManager.beginDrag()
      // startDrag, Windows surukleme dongusu bitene kadar geri donmez.
      event.sender.startDrag(
        list.length > 1
          ? { files: list.map(record => record.filePath), icon }
          : { file: list[0].filePath, icon }
      )
    } catch (err) {
      console.error('[drag]', err.message)
    }
    previewManager.endDrag()
    event.sender.send('preview:dragend', list.map(record => record.id))
  })

  ipcMain.handle('preview:action', async (event, payload) => {
    const record = store.get(payload && payload.id)
    if (!record) return { ok: false }

    switch (payload.action) {
      case 'copy': {
        const image = nativeImage.createFromPath(record.filePath)
        if (image.isEmpty()) return { ok: false }
        clipboardWatcher.suppress(image)
        clipboard.writeImage(image)
        return { ok: true, message: 'Panoya kopyalandı' }
      }
      case 'open': {
        await shell.openPath(record.filePath)
        return { ok: true }
      }
      case 'reveal': {
        shell.showItemInFolder(record.filePath)
        return { ok: true }
      }
      case 'ocr': {
        const text = await readTextFromImage(record.filePath)
        if (text === null) return { ok: false, message: 'OCR kullanılamıyor' }
        if (!text) return { ok: false, message: 'Metin bulunamadı' }
        clipboardWatcher.suppress(null)
        clipboard.writeText(text)
        return { ok: true, message: 'Metin panoya kopyalandı' }
      }
      case 'save': {
        const result = await dialog.showSaveDialog({
          title: 'Ekran görüntüsünü kaydet',
          defaultPath: path.join(app.getPath('pictures'), record.fileName),
          filters: [{ name: 'PNG', extensions: ['png'] }]
        })
        if (result.canceled || !result.filePath) return { ok: false }
        fs.copyFileSync(record.filePath, result.filePath)
        return { ok: true, message: 'Kaydedildi' }
      }
      default:
        return { ok: false }
    }
  })

  /* --- ayarlar penceresi --- */
  ipcMain.handle('settings:get', () => ({
    config: config.get(),
    watchedFolders: folderWatcher.folders.length ? folderWatcher.folders : folderWatcher.defaultFolders(),
    stats: store.stats(),
    displays: listDisplays(),
    shortcutErrors,
    packaged: app.isPackaged,
    version: app.getVersion()
  }))

  ipcMain.handle('settings:update', (event, patch) => config.update(patch))
  ipcMain.handle('settings:reset', () => config.reset())
  ipcMain.handle('settings:test', () => {
    showTestPreview()
    return true
  })

  ipcMain.handle('settings:chooseFolder', async () => {
    const result = await dialog.showOpenDialog(settingsWindow.get() || undefined, {
      title: 'Izlenecek klasoru sec',
      properties: ['openDirectory']
    })
    if (result.canceled || !result.filePaths.length) return null
    return result.filePaths[0]
  })

  ipcMain.handle('settings:openCaptures', () => shell.openPath(store.dir))
  ipcMain.handle('settings:clearCaptures', () => {
    store.clearAll()
    return store.stats()
  })

  ipcMain.on('window:minimize', () => settingsWindow.get()?.minimize())
  ipcMain.on('window:close', () => settingsWindow.get()?.hide())
}
