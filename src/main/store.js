const { app, nativeImage } = require('electron')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const config = require('./config')

const THUMB_WIDTH = 560

function pad(n) {
  return String(n).padStart(2, '0')
}

function stamp(date) {
  return (
    date.getFullYear() +
    '-' + pad(date.getMonth() + 1) +
    '-' + pad(date.getDate()) +
    ' ' + pad(date.getHours()) +
    '-' + pad(date.getMinutes()) +
    '-' + pad(date.getSeconds())
  )
}

class CaptureStore {
  constructor() {
    this.records = new Map()
  }

  get dir() {
    return path.join(app.getPath('userData'), 'captures')
  }

  init() {
    fs.mkdirSync(this.dir, { recursive: true })
    this.cleanup()
    // uzun sureli calisan oturumlar icin gunde bir temizlik
    this.timer = setInterval(() => this.cleanup(), 6 * 60 * 60 * 1000)
    this.timer.unref?.()
  }

  uniquePath(baseName) {
    let candidate = path.join(this.dir, baseName + '.png')
    let i = 2
    while (fs.existsSync(candidate)) {
      candidate = path.join(this.dir, baseName + ' (' + i + ').png')
      i++
    }
    return candidate
  }

  makeThumb(image) {
    const size = image.getSize()
    const target = Math.min(THUMB_WIDTH, size.width)
    const thumb = target < size.width ? image.resize({ width: target, quality: 'good' }) : image
    return thumb.toDataURL()
  }

  toRecord(image, filePath, meta) {
    const size = image.getSize()
    const record = {
      id: crypto.randomUUID(),
      filePath,
      fileName: path.basename(filePath),
      owned: Boolean(meta.owned),
      width: size.width,
      height: size.height,
      source: meta.source || 'clipboard',
      createdAt: Date.now(),
      thumb: this.makeThumb(image)
    }
    this.records.set(record.id, record)
    // bellekte cok fazla thumbnail birikmesin
    if (this.records.size > 40) {
      const oldest = [...this.records.values()].sort((a, b) => a.createdAt - b.createdAt)[0]
      this.records.delete(oldest.id)
    }
    return record
  }

  // Panodan gelen goruntuyu diske yazip kayit dondurur.
  saveImage(image, meta = {}) {
    const prefix = (config.get().storage.filenamePrefix || 'Screenshot').trim() || 'Screenshot'
    const filePath = this.uniquePath(prefix + ' ' + stamp(new Date()))
    fs.writeFileSync(filePath, image.toPNG())
    return this.toRecord(image, filePath, { ...meta, owned: true })
  }

  // Diskteki mevcut bir dosyayi (klasor izleyici) kayit haline getirir - kopyalamaz.
  adoptFile(filePath, meta = {}) {
    const image = nativeImage.createFromPath(filePath)
    if (image.isEmpty()) return null
    return this.toRecord(image, filePath, { ...meta, owned: false })
  }

  get(id) {
    return this.records.get(id)
  }

  // Pano yakalamasi ile ayni goruntunun diskteki gercek dosyasi bulunursa,
  // gecici kopyayi silip kaydi gercek dosyaya baglar.
  relink(record, filePath) {
    if (record.owned && record.filePath !== filePath) {
      try { fs.unlinkSync(record.filePath) } catch { /* onemsiz */ }
    }
    record.filePath = filePath
    record.fileName = path.basename(filePath)
    record.owned = false
  }

  remove(id, deleteFile = false) {
    const record = this.records.get(id)
    if (!record) return
    if (deleteFile && record.owned) {
      try { fs.unlinkSync(record.filePath) } catch { /* onemsiz */ }
    }
    this.records.delete(id)
  }

  stats() {
    let count = 0
    let bytes = 0
    try {
      for (const name of fs.readdirSync(this.dir)) {
        const stat = fs.statSync(path.join(this.dir, name))
        if (!stat.isFile()) continue
        count++
        bytes += stat.size
      }
    } catch { /* klasor yok */ }
    return { count, bytes, dir: this.dir }
  }

  clearAll() {
    try {
      for (const name of fs.readdirSync(this.dir)) {
        try { fs.unlinkSync(path.join(this.dir, name)) } catch { /* kilitli olabilir */ }
      }
    } catch { /* klasor yok */ }
    for (const record of [...this.records.values()]) {
      if (record.owned) this.records.delete(record.id)
    }
  }

  // Yalnizca bizim yazdigimiz gecici dosyalari siler; kullanicinin kendi
  // Ekran Goruntuleri klasorune asla dokunmaz.
  cleanup() {
    const days = config.get().storage.keepDays
    if (!days || days <= 0) return
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
    try {
      for (const name of fs.readdirSync(this.dir)) {
        const file = path.join(this.dir, name)
        try {
          const stat = fs.statSync(file)
          if (stat.isFile() && stat.mtimeMs < cutoff) fs.unlinkSync(file)
        } catch { /* onemsiz */ }
      }
    } catch { /* klasor yok */ }
  }
}

module.exports = new CaptureStore()
