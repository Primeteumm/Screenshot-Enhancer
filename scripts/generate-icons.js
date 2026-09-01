// Bagimsiz ikon ureteci: assets/ altindaki tum PNG/ICO dosyalarini sifirdan cizer.
// Harici bagimlilik yok - ham RGBA buffer + zlib ile PNG kodlama.
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const ASSETS = path.join(__dirname, '..', 'assets')

/* ---------- PNG kodlama ---------- */
const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}

function encodePNG(width, height, rgba) {
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

/* ---------- basit tuval ---------- */
class Canvas {
  constructor(w, h) {
    this.w = w
    this.h = h
    this.data = Buffer.alloc(w * h * 4)
  }

  blend(x, y, r, g, b, a) {
    if (a <= 0 || x < 0 || y < 0 || x >= this.w || y >= this.h) return
    const i = (y * this.w + x) * 4
    const sa = a / 255
    const da = this.data[i + 3] / 255
    const outA = sa + da * (1 - sa)
    if (outA <= 0) return
    this.data[i] = Math.round((r * sa + this.data[i] * da * (1 - sa)) / outA)
    this.data[i + 1] = Math.round((g * sa + this.data[i + 1] * da * (1 - sa)) / outA)
    this.data[i + 2] = Math.round((b * sa + this.data[i + 2] * da * (1 - sa)) / outA)
    this.data[i + 3] = Math.round(outA * 255)
  }

  // color: fn(x, y) -> [r, g, b, a]
  roundRect(rx, ry, rw, rh, radius, color) {
    const x1 = rx + rw
    const y1 = ry + rh
    for (let y = Math.max(0, Math.floor(ry)); y < Math.min(this.h, Math.ceil(y1)); y++) {
      for (let x = Math.max(0, Math.floor(rx)); x < Math.min(this.w, Math.ceil(x1)); x++) {
        if (!insideRound(x + 0.5, y + 0.5, rx, ry, x1, y1, radius)) continue
        const c = color(x, y)
        this.blend(x, y, c[0], c[1], c[2], c[3])
      }
    }
  }

  // kare tuvali kare hedefe kutu-filtre ile kucult (ucretsiz kenar yumusatma)
  downsample(target) {
    const factor = this.w / target
    const out = Buffer.alloc(target * target * 4)
    for (let y = 0; y < target; y++) {
      for (let x = 0; x < target; x++) {
        let r = 0, g = 0, b = 0, a = 0, n = 0
        for (let sy = Math.floor(y * factor); sy < Math.floor((y + 1) * factor); sy++) {
          for (let sx = Math.floor(x * factor); sx < Math.floor((x + 1) * factor); sx++) {
            const i = (sy * this.w + sx) * 4
            const sa = this.data[i + 3]
            r += this.data[i] * sa
            g += this.data[i + 1] * sa
            b += this.data[i + 2] * sa
            a += sa
            n++
          }
        }
        const o = (y * target + x) * 4
        if (a > 0) {
          out[o] = Math.round(r / a)
          out[o + 1] = Math.round(g / a)
          out[o + 2] = Math.round(b / a)
        }
        out[o + 3] = Math.round(a / n)
      }
    }
    return out
  }
}

function insideRound(px, py, x0, y0, x1, y1, r) {
  if (px < x0 || px > x1 || py < y0 || py > y1) return false
  const cx = px < x0 + r ? x0 + r : px > x1 - r ? x1 - r : px
  const cy = py < y0 + r ? y0 + r : py > y1 - r ? y1 - r : py
  if (cx === px && cy === py) return true
  const dx = px - cx
  const dy = py - cy
  return dx * dx + dy * dy <= r * r
}

const solid = (r, g, b, a = 255) => () => [r, g, b, a]

/* ---------- kose parantezleri (ekran goruntusu isareti) ---------- */
function drawBrackets(c, box, thick, len, color, radius) {
  const { x, y, w, h } = box
  const bars = [
    [x, y, len, thick], [x, y, thick, len],
    [x + w - len, y, len, thick], [x + w - thick, y, thick, len],
    [x, y + h - thick, len, thick], [x, y + h - len, thick, len],
    [x + w - len, y + h - thick, len, thick], [x + w - thick, y + h - len, thick, len]
  ]
  for (const bar of bars) c.roundRect(bar[0], bar[1], bar[2], bar[3], radius, color)
}

/* ---------- uygulama ikonu ---------- */
function buildAppIcon(size) {
  const S = 1024
  const c = new Canvas(S, S)
  c.roundRect(40, 40, S - 80, S - 80, 224, (x, y) => {
    const t = (x / S) * 0.35 + (y / S) * 0.65
    return [
      Math.round(91 + (139 - 91) * t),
      Math.round(140 + (92 - 140) * t),
      Math.round(255 + (246 - 255) * t),
      255
    ]
  })
  c.roundRect(40, 40, S - 80, (S - 80) / 2, 224, solid(255, 255, 255, 26))
  drawBrackets(c, { x: 236, y: 236, w: S - 472, h: S - 472 }, 46, 168, solid(255, 255, 255, 255), 22)
  c.roundRect(S / 2 - 96, S / 2 - 72, 192, 144, 28, solid(255, 255, 255, 235))
  return encodePNG(size, size, c.downsample(size))
}

/* ---------- tray ikonu ---------- */
function buildTrayIcon(size, rgb) {
  const S = 512
  const c = new Canvas(S, S)
  drawBrackets(c, { x: 56, y: 56, w: S - 112, h: S - 112 }, 54, 168, solid(rgb[0], rgb[1], rgb[2], 255), 24)
  c.roundRect(S / 2 - 92, S / 2 - 68, 184, 136, 30, solid(rgb[0], rgb[1], rgb[2], 255))
  return encodePNG(size, size, c.downsample(size))
}

/* ---------- ornek "sahte ekran goruntusu" (ayarlardaki test icin) ---------- */
function buildSample(w, h) {
  const c = new Canvas(w, h)
  c.roundRect(0, 0, w, h, 0, (x, y) => {
    const t = y / h
    return [Math.round(24 + 18 * t), Math.round(27 + 20 * t), Math.round(38 + 26 * t), 255]
  })
  c.roundRect(0, 0, w, 64, 0, solid(255, 255, 255, 14))
  const dots = [[236, 92, 92], [240, 190, 90], [90, 200, 130]]
  dots.forEach((d, i) => c.roundRect(28 + i * 34, 24, 18, 18, 9, solid(d[0], d[1], d[2], 255)))
  c.roundRect(40, 112, 300, 26, 13, solid(255, 255, 255, 160))
  c.roundRect(40, 164, 520, 16, 8, solid(255, 255, 255, 70))
  c.roundRect(40, 196, 430, 16, 8, solid(255, 255, 255, 55))
  c.roundRect(40, 228, 480, 16, 8, solid(255, 255, 255, 45))
  c.roundRect(40, 300, 340, 200, 20, solid(91, 140, 255, 190))
  c.roundRect(404, 300, 340, 200, 20, solid(139, 92, 246, 170))
  c.roundRect(40, 528, 704, 14, 7, solid(255, 255, 255, 40))
  c.roundRect(40, 560, 560, 14, 7, solid(255, 255, 255, 30))
  return encodePNG(w, h, c.data)
}

/* ---------- ICO ---------- */
function buildIco(pngs) {
  const head = Buffer.alloc(6)
  head.writeUInt16LE(0, 0)
  head.writeUInt16LE(1, 2)
  head.writeUInt16LE(pngs.length, 4)
  const entries = []
  let offset = 6 + pngs.length * 16
  for (const item of pngs) {
    const e = Buffer.alloc(16)
    e[0] = item.size >= 256 ? 0 : item.size
    e[1] = item.size >= 256 ? 0 : item.size
    e.writeUInt16LE(1, 4)
    e.writeUInt16LE(32, 6)
    e.writeUInt32LE(item.buf.length, 8)
    e.writeUInt32LE(offset, 12)
    entries.push(e)
    offset += item.buf.length
  }
  return Buffer.concat([head, ...entries, ...pngs.map(p => p.buf)])
}

fs.mkdirSync(ASSETS, { recursive: true })
const icoSizes = [16, 24, 32, 48, 64, 128, 256]
const appPngs = icoSizes.map(size => ({ size, buf: buildAppIcon(size) }))
fs.writeFileSync(path.join(ASSETS, 'icon.png'), appPngs[appPngs.length - 1].buf)
fs.writeFileSync(path.join(ASSETS, 'icon.ico'), buildIco(appPngs))
fs.writeFileSync(path.join(ASSETS, 'tray-light.png'), buildTrayIcon(16, [40, 44, 56]))
fs.writeFileSync(path.join(ASSETS, 'tray-light@2x.png'), buildTrayIcon(32, [40, 44, 56]))
fs.writeFileSync(path.join(ASSETS, 'tray-dark.png'), buildTrayIcon(16, [244, 246, 252]))
fs.writeFileSync(path.join(ASSETS, 'tray-dark@2x.png'), buildTrayIcon(32, [244, 246, 252]))
fs.writeFileSync(path.join(ASSETS, 'sample.png'), buildSample(784, 600))
console.log('assets olusturuldu: ' + fs.readdirSync(ASSETS).join(', '))
