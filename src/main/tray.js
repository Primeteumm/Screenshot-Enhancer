const { Tray, Menu, nativeImage, nativeTheme, app, shell } = require('electron')
const fs = require('fs')
const path = require('path')
const config = require('./config')
const store = require('./store')
const settingsWindow = require('./settingsWindow')
const previewManager = require('./previewManager')

const ASSETS = path.join(__dirname, '..', '..', 'assets')

let tray = null

function trayImage() {
  // Gorev cubugu koyuysa acik renkli ikon, tersi durumda koyu ikon.
  const variant = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  const image = nativeImage.createEmpty()
  for (const [scale, suffix] of [[1, ''], [2, '@2x']]) {
    const file = path.join(ASSETS, 'tray-' + variant + suffix + '.png')
    try {
      image.addRepresentation({ scaleFactor: scale, buffer: fs.readFileSync(file) })
    } catch { /* ikon yoksa bos kalir */ }
  }
  return image.isEmpty() ? nativeImage.createFromPath(path.join(ASSETS, 'icon.png')).resize({ width: 16 }) : image
}

function buildMenu(actions) {
  const cfg = config.get()
  return Menu.buildFromTemplate([
    { label: 'Screenshot Enhancer', enabled: false },
    { type: 'separator' },
    { label: 'Bölge yakala', click: () => actions.captureRegion() },
    { label: 'Tüm ekranı yakala', click: () => actions.captureScreen() },
    { type: 'separator' },
    {
      label: 'Yakalamayı duraklat',
      type: 'checkbox',
      checked: cfg.capture.paused,
      click: menuItem => actions.setPaused(menuItem.checked)
    },
    {
      label: 'Son görüntüyü tekrar göster',
      click: () => actions.showLast()
    },
    {
      label: 'Onizlemeyi test et',
      click: () => actions.testPreview()
    },
    {
      label: 'Acik onizlemeleri kapat',
      click: () => previewManager.clear()
    },
    { type: 'separator' },
    { label: 'Ayarlar...', click: () => settingsWindow.show() },
    { label: 'Yakalama klasorunu ac', click: () => shell.openPath(store.dir) },
    { type: 'separator' },
    { label: 'Cikis', click: () => actions.quit() }
  ])
}

function updateTooltip() {
  if (!tray || tray.isDestroyed()) return
  tray.setToolTip(config.get().capture.paused
    ? 'Screenshot Enhancer - yakalama duraklatıldı'
    : 'Screenshot Enhancer')
}

function refresh(actions) {
  if (!tray) return
  tray.setImage(trayImage())
  tray.setContextMenu(buildMenu(actions))
  updateTooltip()
}

function create(actions) {
  tray = new Tray(trayImage())
  tray.setToolTip('Screenshot Enhancer')
  updateTooltip()
  tray.setContextMenu(buildMenu(actions))
  tray.on('click', () => settingsWindow.show())
  tray.on('double-click', () => settingsWindow.show())
  nativeTheme.on('updated', () => {
    if (tray && !tray.isDestroyed()) tray.setImage(trayImage())
  })
  config.on('change', () => refresh(actions))
  app.on('before-quit', () => {
    if (tray && !tray.isDestroyed()) tray.destroy()
    tray = null
  })
  return tray
}

module.exports = { create, refresh }
