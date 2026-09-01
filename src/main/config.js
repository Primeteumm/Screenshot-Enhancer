const { app } = require('electron')
const fs = require('fs')
const path = require('path')
const { EventEmitter } = require('events')

const DEFAULTS = {
  version: 1,
  general: {
    launchAtLogin: false,
    startHidden: true
  },
  capture: {
    watchClipboard: true,
    // 'screenshots' -> panoda sadece resim varsa (ekran goruntusu imzasi)
    // 'allImages'   -> kopyalanan her resim
    clipboardMode: 'screenshots',
    pollInterval: 350,
    watchFolders: true,
    extraFolders: [],
    // Kisayolla ya da tepsiden gecici olarak durdurulur; izleyici ayarlarina
    // dokunmadigi icin duraklatma kalkinca eski duruma donulur.
    paused: false
  },
  preview: {
    // cursor -> ekran goruntusunun alindigi yerin yaninda
    // fixed  -> ekranda sabit bir konumda (bkz. anchor)
    placement: 'cursor',
    // 8 yon: top-left top-center top-right left right
    //        bottom-left bottom-center bottom-right
    anchor: 'bottom-right',
    margin: 28,
    size: 220,
    maxStack: 3,
    autoHideSeconds: 9,
    theme: 'dark',
    showToolbar: true,
    // yuzde: 35-100. Fare kartin uzerine gelince gecici olarak %100 olur.
    opacity: 100,
    // capture -> goruntunun alindigi ekran, primary -> birincil ekran,
    // ya da belirli bir ekranin kimligi (metin olarak)
    display: 'capture'
  },
  animation: {
    enabled: true,
    // slide (yukari kayarak) | side (yandan) | pop (buyuyerek) | fade
    type: 'slide',
    enterDuration: 420,
    exitDuration: 220,
    easing: 'spring',
    travel: 56
  },
  shortcuts: {
    enabled: true,
    // uygulamanin kendi yakalamasi
    captureRegion: 'CommandOrControl+Shift+A',
    captureScreen: 'CommandOrControl+Shift+F',
    showLast: 'CommandOrControl+Shift+V',
    togglePause: 'CommandOrControl+Shift+P'
  },
  sound: {
    enabled: false,
    volume: 40 // yuzde
  },
  storage: {
    keepDays: 7,
    filenamePrefix: 'Screenshot'
  }
}

// Serbest metin olarak kaydedilebilen ama sinirli deger kumesi olan alanlar.
// Bozuk/eski bir deger okunursa varsayilana donulur.
const ENUMS = {
  'preview.placement': ['cursor', 'fixed'],
  'preview.anchor': [
    'top-left', 'top-center', 'top-right',
    'left', 'right',
    'bottom-left', 'bottom-center', 'bottom-right'
  ],
  'preview.theme': ['dark', 'light'],
  'capture.clipboardMode': ['screenshots', 'allImages'],
  'animation.type': ['slide', 'side', 'pop', 'fade'],
  'animation.easing': ['linear', 'smooth', 'soft', 'snappy', 'spring', 'inOut']
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function readPath(object, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), object)
}

function writePath(object, path, value) {
  const keys = path.split('.')
  let node = object
  for (let i = 0; i < keys.length - 1; i++) node = node[keys[i]]
  node[keys[keys.length - 1]] = value
}

function validate(data) {
  for (const [path, allowed] of Object.entries(ENUMS)) {
    if (!allowed.includes(readPath(data, path))) writePath(data, path, readPath(DEFAULTS, path))
  }
  return data
}

// Eski surumden gecis: preview.position -> preview.placement + preview.anchor
function migrate(raw) {
  const preview = raw && raw.preview
  if (!preview || typeof preview.position !== 'string' || preview.placement) return raw
  if (preview.position === 'smart') {
    preview.placement = 'cursor'
  } else {
    preview.placement = 'fixed'
    preview.anchor = preview.position
  }
  delete preview.position
  return raw
}

// Sadece DEFAULTS icinde var olan anahtarlari, ayni tipte olmak kosuluyla birlestirir.
function mergeInto(target, patch, defaults) {
  for (const key of Object.keys(defaults)) {
    if (!(key in patch)) continue
    const dv = defaults[key]
    const pv = patch[key]
    if (dv && typeof dv === 'object' && !Array.isArray(dv)) {
      if (pv && typeof pv === 'object') mergeInto(target[key], pv, dv)
    } else if (Array.isArray(dv)) {
      if (Array.isArray(pv)) target[key] = pv.slice()
    } else if (typeof pv === typeof dv) {
      target[key] = pv
    }
  }
  return target
}

class Config extends EventEmitter {
  constructor() {
    super()
    this.data = clone(DEFAULTS)
    this.loaded = false
  }

  get file() {
    return path.join(app.getPath('userData'), 'settings.json')
  }

  load() {
    try {
      const raw = fs.readFileSync(this.file, 'utf8')
      mergeInto(this.data, migrate(JSON.parse(raw)), DEFAULTS)
      validate(this.data)
    } catch {
      /* ilk calistirma veya bozuk dosya: varsayilanlarla devam */
    }
    this.loaded = true
    return this.data
  }

  get() {
    if (!this.loaded) this.load()
    return this.data
  }

  save() {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true })
      fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2), 'utf8')
    } catch (err) {
      console.error('[config] kaydedilemedi:', err.message)
    }
  }

  update(patch) {
    mergeInto(this.data, patch, DEFAULTS)
    validate(this.data)
    this.save()
    this.emit('change', this.data)
    return this.data
  }

  reset() {
    this.data = clone(DEFAULTS)
    this.save()
    this.emit('change', this.data)
    return this.data
  }
}

module.exports = new Config()
module.exports.DEFAULTS = DEFAULTS
