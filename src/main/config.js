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
    extraFolders: []
  },
  preview: {
    // smart | bottom-right | bottom-left | top-right | top-left
    position: 'smart',
    margin: 28,
    size: 220,
    maxStack: 3,
    autoHideSeconds: 9,
    theme: 'dark',
    showToolbar: true
  },
  animation: {
    enabled: true,
    enterDuration: 420,
    exitDuration: 220,
    easing: 'spring',
    travel: 56
  },
  storage: {
    keepDays: 7,
    filenamePrefix: 'Screenshot'
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
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
      mergeInto(this.data, JSON.parse(raw), DEFAULTS)
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
