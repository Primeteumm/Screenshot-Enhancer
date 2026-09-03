const { desktopCapturer, screen, BrowserWindow, ipcMain } = require('electron')
const path = require('path')

// Ekrani yakalar ve istenirse kullaniciya bolge sectirir. Windows'un kendi
// alinti aracina hic dokunmadan calisir; sonuc dogrudan uygulamaya gelir.

let overlay = null
let pending = null

function cursorDisplay() {
  return screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
}

// Ekranin tam cozunurluklu goruntusu. thumbnailSize fiziksel piksel cinsinden
// verilmezse Electron kucultulmus bir kare dondurur.
async function grabDisplay(display) {
  const scale = display.scaleFactor || 1
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: Math.round(display.size.width * scale),
      height: Math.round(display.size.height * scale)
    },
    fetchWindowIcons: false
  })
  const match = sources.find(source => String(source.display_id) === String(display.id)) || sources[0]
  if (!match || match.thumbnail.isEmpty()) return null
  return match.thumbnail
}

function closeOverlay() {
  if (overlay && !overlay.isDestroyed()) overlay.destroy()
  overlay = null
}

// Donmus ekran goruntusu uzerinde dikdortgen sectirir.
// CSS pikseli = DIP oldugu icin secim, olcek carpanıyla goruntu pikseline cevrilir.
function selectRegion(display, image) {
  return new Promise(resolve => {
    // Onceki secimden katman kaldiysa temizle. Eskiden burada resolve(null)
    // ile cikiliyordu; bayat bir katman bolge yakalamayi kalici olarak
    // devre disi birakabiliyordu.
    if (overlay) closeOverlay()
    pending = resolve

    overlay = new BrowserWindow({
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
      show: false,
      frame: false,
      resizable: false,
      movable: false,
      minimizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      hasShadow: false,
      backgroundColor: '#000000',
      alwaysOnTop: true,
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload', 'region.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    })
    overlay.setAlwaysOnTop(true, 'screen-saver')
    overlay.loadFile(path.join(__dirname, '..', 'renderer', 'region', 'index.html'))

    overlay.webContents.once('did-finish-load', () => {
      // JPEG yeterli: bu goruntu yalnizca secim ekraninda gosteriliyor,
      // kirpma her zaman kayipsiz asil kare uzerinden yapiliyor.
      overlay.webContents.send('region:image', {
        dataUrl: 'data:image/jpeg;base64,' + image.toJPEG(82).toString('base64'),
        width: display.bounds.width,
        height: display.bounds.height
      })
    })

    // Sayfa yuklenmezse region:ready hic gelmez ve katman gorunmez bir sekilde
    // asili kalirdi; secim de hicbir zaman cozulmezdi.
    setTimeout(() => {
      if (!overlay || overlay.isDestroyed()) return
      if (!overlay.isVisible()) {
        const done = pending
        pending = null
        closeOverlay()
        if (done) done(null)
      }
    }, 2500)

    overlay.on('closed', () => {
      overlay = null
      if (pending) {
        const done = pending
        pending = null
        done(null)
      }
    })
  })
}

function registerIpc() {
  ipcMain.on('region:ready', () => {
    if (overlay && !overlay.isDestroyed()) {
      overlay.show()
      overlay.focus()
    }
  })

  ipcMain.on('region:done', (event, selection) => {
    const done = pending
    pending = null
    closeOverlay()
    if (done) done(selection)
  })
}

// mode: 'region' | 'screen'
async function capture(mode) {
  const display = cursorDisplay()
  const image = await grabDisplay(display)
  if (!image) return null
  if (mode !== 'region') return image

  const selection = await selectRegion(display, image)
  if (!selection) return null

  const scale = display.scaleFactor || 1
  const size = image.getSize()
  const rect = {
    x: Math.max(0, Math.round(selection.x * scale)),
    y: Math.max(0, Math.round(selection.y * scale)),
    width: Math.round(selection.width * scale),
    height: Math.round(selection.height * scale)
  }
  rect.width = Math.min(rect.width, size.width - rect.x)
  rect.height = Math.min(rect.height, size.height - rect.y)
  if (rect.width < 4 || rect.height < 4) return null
  return image.crop(rect)
}

module.exports = { capture, registerIpc, closeOverlay }
