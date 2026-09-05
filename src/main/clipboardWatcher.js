const { clipboard } = require('electron')
const { EventEmitter } = require('events')

// Panodaki goruntunun ucuz bir parmak izi. toBitmap() kodlama yapmadigi icin
// toPNG()'ye gore cok daha hizli; bayt ornekleme ile hash maliyeti sabit tutuluyor.
function signature(image) {
  const size = image.getSize()
  let bitmap
  try {
    bitmap = image.toBitmap()
  } catch {
    return size.width + 'x' + size.height + ':?'
  }
  const stride = Math.max(1, Math.floor(bitmap.length / 4096))
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < bitmap.length; i += stride) {
    h1 = ((h1 ^ bitmap[i]) * 16777619) >>> 0
    h2 = ((h2 + bitmap[i] * (i % 251 + 1)) * 2654435761) >>> 0
  }
  return size.width + 'x' + size.height + ':' + bitmap.length + ':' + h1.toString(36) + h2.toString(36)
}

class ClipboardWatcher extends EventEmitter {
  constructor() {
    super()
    this.lastSignature = null
    this.primed = false
    this.suppressUntil = 0
    this.timer = null
  }

  start(intervalMs) {
    this.stop()
    this.timer = setInterval(() => this.tick(), Math.max(120, intervalMs || 350))
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  // Uygulama kendisi panoya yazdiginda tetiklenmemek icin.
  suppress(image) {
    this.suppressUntil = Date.now() + 1500
    if (image) {
      try { this.lastSignature = signature(image) } catch { /* onemsiz */ }
    }
  }

  tick() {
    let image = null
    try {
      image = clipboard.readImage()
    } catch {
      return
    }

    const empty = image.isEmpty()
    const size = empty ? { width: 0, height: 0 } : image.getSize()
    // 1x1 gibi anlamsiz goruntuleri ele
    const usable = !empty && size.width >= 16 && size.height >= 16

    const current = usable ? signature(image) : null
    const previous = this.lastSignature
    // Hatirlanan imza yalnizca okunabilir bir goruntu varken guncellenir.
    //
    // Eskiden kosulsuz atanıyordu ve kilit ekrani bunu bozuyordu: oturum
    // kilitliyken pano okunamadigi icin imza null'a dusuyor, kilit acilinca
    // panoda duran ayni ekran goruntusu "yeni" gorunup tekrar kart uretiyordu.
    // Her kilit acilisinda bir kez daha (olculdu). Goruntu panodan gercekten
    // kalktiginda imzayi tutmanin bir maliyeti yok: ayni kare yeniden
    // kopyalanirsa imza esit cikar ve zaten tekrar uretilmezdi.
    if (current) this.lastSignature = current

    // Ilk turda panoda ne varsa referans alinir, olay uretilmez.
    if (!this.primed) {
      this.primed = true
      return
    }
    if (Date.now() < this.suppressUntil) return
    if (!current || current === previous) return

    this.emit('image', image, {
      textOnClipboard: readSafe(() => clipboard.readText()),
      htmlOnClipboard: readSafe(() => clipboard.readHTML())
    })
  }
}

function readSafe(fn) {
  try {
    return (fn() || '').trim()
  } catch {
    return ''
  }
}

module.exports = new ClipboardWatcher()
