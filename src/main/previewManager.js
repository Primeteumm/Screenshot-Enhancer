const { BrowserWindow, screen } = require('electron')
const path = require('path')
const config = require('./config')

const PAD = 30 // pencere icinde golge/tasma icin ayrilan bosluk
const GAP = 12 // kartlar arasi bosluk
const DEBUG = Boolean(process.env.SE_DEBUG)
const POINTER_INTERVAL = 24 // imlec yoklama araligi (ms)
const HIT_INFLATE = 2 // kart kenarinda titremeyi onlemek icin pay
// Ust siralamanin yeniden dayatilma araligi (ms). Bkz. raise().
const RAISE_INTERVAL = 1000
// Tutamacla tasima en fazla bu kadar surer; mouseup kacarsa pencere imlece
// yapisik kalmasin diye emniyet freni.
const MOVE_TIMEOUT = 20000

// Sabit konum secenekleri: dikey x yatay
const ANCHORS = {
  'top-left': { v: 'top', h: 'left' },
  'top-center': { v: 'top', h: 'center' },
  'top-right': { v: 'top', h: 'right' },
  left: { v: 'middle', h: 'left' },
  right: { v: 'middle', h: 'right' },
  'bottom-left': { v: 'bottom', h: 'left' },
  'bottom-center': { v: 'bottom', h: 'center' },
  'bottom-right': { v: 'bottom', h: 'right' }
}

function clamp(value, min, max) {
  if (max < min) return min
  return Math.min(max, Math.max(min, value))
}

class PreviewManager {
  constructor() {
    this.win = null
    this.ready = false
    this.queue = []
    this.activeIds = new Set()
    this.currentDisplayId = null
    this.interactive = false
    // Kartlarin pencere icindeki dikdortgenleri (renderer bildirir).
    this.hitboxes = []
    this.hotId = null
    this.pointerTimer = null
    this.dragUntil = 0
    this.moveOrigin = null
    this.raisedAt = 0
  }

  /* ---------------- pencere ---------------- */

  ensureWindow() {
    if (this.win && !this.win.isDestroyed()) return this.win

    const metrics = this.metrics()
    this.win = new BrowserWindow({
      width: metrics.winW,
      height: metrics.winH,
      show: false,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      hasShadow: false,
      // Kullanicinin o an yazdigi uygulamadan odagi calmamak icin.
      focusable: false,
      acceptFirstMouse: true,
      alwaysOnTop: true,
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload', 'preview.js'),
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
        // Yakalama sesi kullanici etkilesimi olmadan calabilsin.
        autoplayPolicy: 'no-user-gesture-required'
      }
    })

    this.win.setAlwaysOnTop(true, 'screen-saver')
    this.win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    // Varsayilan: tiklamalar alttaki pencereye gecer. Imlec bir kartin uzerine
    // geldiginde ana surec bunu gecici olarak kapatir (bkz. trackPointer).
    // Not: setIgnoreMouseEvents'in "forward" secenegi Windows'ta mousemove
    // olaylarini renderer'a iletmedigi icin isabet testi burada yapiliyor.
    this.win.setIgnoreMouseEvents(true)
    this.win.loadFile(path.join(__dirname, '..', 'renderer', 'preview', 'index.html'))

    if (DEBUG) {
      this.win.webContents.on('console-message', (event, level, message, line) => {
        console.log('[dbg][renderer] ' + message + ' (satir ' + line + ')')
      })
    }

    this.win.on('closed', () => {
      this.stopPointerTracking()
      this.win = null
      this.ready = false
      this.activeIds.clear()
      this.hitboxes = []
      // Onbellege alinmis girdi durumu da sifirlanmali: yeni pencere
      // setIgnoreMouseEvents(true) ile dogar, bayrak "etkilesimli" kalirsa
      // setInteractive(true) erken donup pencere kalici olarak tiklama
      // gecirgen kalirdi.
      this.interactive = false
      this.hotId = null
      this.moveOrigin = null
      this.dragUntil = 0
      this.raisedAt = 0
    })

    return this.win
  }

  // Pencereyi ust siralamada tutar.
  //
  // Windows'ta "her zaman ustte" tek bir kuyruktur: baska bir topmost pencere
  // one gectiginde (Discord/Razer bindirmesi, oyun katmani, uygulamanin kendi
  // bolge secim katmani kapandiginda...) bu pencere onlarin altina duser.
  // Kart gorunur kaldigi icin kullanici hala goruyor ama tiklamalar ustteki
  // pencereye gidiyor: dugmeler de surukle-birak da olu gorunuyor (olculdu).
  // Electron'un isAlwaysOnTop() bayragi bu durumda hala true dondugu icin
  // durum sessizce bozuluyor; bu yuzden bayraga guvenmeden yeniden dayatiyoruz.
  raise() {
    const win = this.win
    if (!win || win.isDestroyed() || !win.isVisible()) return
    this.raisedAt = Date.now()
    // Yalnizca moveTop() yetmiyor: bayrak zaten true oldugu icin Electron
    // setAlwaysOnTop'u yok sayabiliyor. Kapatip acmak pencereyi "her zaman
    // ustte" kumesinin en tepesine gercekten yeniden ekliyor.
    win.setAlwaysOnTop(false)
    win.setAlwaysOnTop(true, 'screen-saver')
    win.moveTop()
  }

  /* ---------------- imlec takibi ---------------- */

  setHitboxes(rects) {
    this.hitboxes = Array.isArray(rects) ? rects : []
    if (DEBUG) console.log('[dbg] hitboxes', JSON.stringify(this.hitboxes))
    if (!this.hitboxes.length) {
      this.setInteractive(false)
      if (this.hotId !== null) {
        this.hotId = null
        this.send('preview:hot', null)
      }
    }
  }

  startPointerTracking() {
    if (this.pointerTimer) return
    this.pointerTimer = setInterval(() => this.trackPointer(), POINTER_INTERVAL)
  }

  stopPointerTracking() {
    if (this.pointerTimer) clearInterval(this.pointerTimer)
    this.pointerTimer = null
  }

  trackPointer() {
    const win = this.win
    if (!win || win.isDestroyed() || !win.isVisible()) return
    // Yerel surukleme sirasinda fareyi Windows yakalar; bu sirada pencereyi
    // tekrar gecirgen yaparsak surukleme yarida kalir.
    if (Date.now() < this.dragUntil) return

    // Kart ekranda oldugu surece ust siralamayi tazele.
    if (this.activeIds.size && Date.now() - this.raisedAt > RAISE_INTERVAL) this.raise()

    if (this.moveOrigin) {
      // mouseup da blur da kacarsa pencere imlece yapisik kalirdi.
      if (Date.now() - this.moveOrigin.startedAt > MOVE_TIMEOUT) return this.endMove()
      const now = screen.getCursorScreenPoint()
      const origin = this.moveOrigin
      win.setBounds({
        x: origin.bounds.x + (now.x - origin.cursor.x),
        y: origin.bounds.y + (now.y - origin.cursor.y),
        width: origin.bounds.width,
        height: origin.bounds.height
      })
      return
    }

    const point = screen.getCursorScreenPoint()
    const bounds = win.getBounds()
    const x = point.x - bounds.x
    const y = point.y - bounds.y
    const hit = this.hitboxes.find(
      rect =>
        x >= rect.x - HIT_INFLATE &&
        x <= rect.x + rect.width + HIT_INFLATE &&
        y >= rect.y - HIT_INFLATE &&
        y <= rect.y + rect.height + HIT_INFLATE
    )
    const over = Boolean(hit)

    // Arac cubugunun gorunurlugu CSS :hover yerine bu isabet testine bagli.
    // Odak almayan + tiklama gecirgenligi surekli degisen bir pencerede
    // Chromium'un hover takibine guvenilmiyor.
    const hotId = hit ? hit.id : null
    if (hotId !== this.hotId) {
      this.hotId = hotId
      this.send('preview:hot', hotId)
    }
    if (DEBUG && this.debugTick !== over) {
      this.debugTick = over
      console.log('[dbg] imlec', point.x + ',' + point.y, 'pencere', JSON.stringify(bounds), 'yerel', x + ',' + y, 'uzerinde=' + over)
    }
    this.setInteractive(over)
  }

  // Tutamactan pencere tasima: imlecin ekran koordinati uzerinden yurutulur,
  // cunku pencere imleci takip ederken renderer'daki yerel koordinatlar sabit kalir.
  startMove() {
    const win = this.win
    if (!win || win.isDestroyed()) return
    this.moveOrigin = { cursor: screen.getCursorScreenPoint(), bounds: win.getBounds(), startedAt: Date.now() }
  }

  endMove() {
    this.moveOrigin = null
  }

  beginDrag() {
    this.dragUntil = Date.now() + 2000
    this.setInteractive(true)
  }

  endDrag() {
    this.dragUntil = 0
  }

  metrics() {
    const preview = config.get().preview
    const anim = config.get().animation
    const cardW = preview.size
    const cardH = preview.size // en kotu durum: kare gorsel
    const slots = Math.max(1, preview.maxStack)
    const stackH = slots * (cardH + GAP) - GAP
    const travel = anim.enabled ? anim.travel : 0
    return {
      cardW,
      cardH,
      gap: GAP,
      pad: PAD,
      travel,
      // Kart, bagli oldugu kenardan pad+travel kadar iceride durur. Yatayda da
      // ayni pay birakiliyor ki "yandan kayarak" animasyonu kirpilmasin.
      winW: cardW + (PAD + travel) * 2,
      winH: stackH + travel + PAD * 2
    }
  }

  // Kutucugun hangi ekranda cikacagi. Belirli bir ekran secildiyse imlec baska
  // ekranda olsa bile oraya konumlanir (kart zaten calisma alanina kirpiliyor).
  targetDisplay(point) {
    const pref = config.get().preview.display
    if (pref === 'primary') return screen.getPrimaryDisplay()
    if (pref && pref !== 'capture') {
      const match = screen.getAllDisplays().find(d => String(d.id) === pref)
      if (match) return match
    }
    return screen.getDisplayNearestPoint(point)
  }

  // Kartin oturacagi noktadan pencere sinirlarini hesaplar.
  computeBounds(cursorPoint) {
    const preview = config.get().preview
    const m = this.metrics()
    const point = cursorPoint || screen.getCursorScreenPoint()
    const display = this.targetDisplay(point)
    const wa = display.workArea
    const margin = preview.margin
    // Kartin baglandigi kenar ile pencere kenari arasindaki mesafe: golge payi +
    // giris animasyonunun kaydigi mesafe. Bu bosluk pencere icinde ayrilmazsa
    // animasyonun basi kirpilir.
    const edge = m.pad + m.travel

    const hPad = m.pad + m.travel
    const winH = Math.min(m.winH, wa.height + edge * 2)
    const winW = Math.min(m.winW, wa.width + hPad * 2)

    let align
    let direction
    let cardLeft
    let cardTop

    const minLeft = wa.x + margin
    const maxLeft = wa.x + wa.width - margin - m.cardW
    const minTop = wa.y + margin
    const maxTop = wa.y + wa.height - margin - m.cardH

    if (preview.placement === 'cursor') {
      // Kart, imlecin bittigi noktanin hemen yaninda; yigin ekranin icine buyur.
      align = point.x > wa.x + wa.width / 2 ? 'right' : 'left'
      direction = point.y > wa.y + wa.height / 2 ? 'up' : 'down'
      const anchorX = align === 'right' ? point.x + 20 : point.x - 20
      const anchorY = direction === 'up' ? point.y - 16 : point.y + 16
      cardLeft = clamp(align === 'right' ? anchorX - m.cardW : anchorX, minLeft, maxLeft)
      cardTop = clamp(direction === 'up' ? anchorY - m.cardH : anchorY, minTop, maxTop)
    } else {
      const spot = ANCHORS[preview.anchor] || ANCHORS['bottom-right']
      align = spot.h
      // Ust kenara baglandiysa yigin asagi, digerlerinde yukari buyur.
      direction = spot.v === 'top' ? 'down' : 'up'
      cardLeft = clamp(
        spot.h === 'left' ? minLeft
          : spot.h === 'right' ? maxLeft
            : wa.x + Math.round((wa.width - m.cardW) / 2),
        minLeft, maxLeft
      )
      cardTop = clamp(
        spot.v === 'top' ? minTop
          : spot.v === 'bottom' ? maxTop
            : wa.y + Math.round((wa.height - m.cardH) / 2),
        minTop, maxTop
      )
    }

    // Pencere seffaf ve tiklama gecirgen oldugu icin calisma alaninin biraz
    // disina tasabilir; boylece kart tam istenen noktaya oturur.
    const x = clamp(cardLeft - hPad, wa.x - hPad, wa.x + wa.width + hPad - winW)

    let y
    let offset = 0
    if (direction === 'up') {
      const cardBottom = cardTop + m.cardH
      y = clamp(cardBottom - winH + edge, wa.y - edge, wa.y + wa.height + edge - winH)
      // Yine de kirpildiysa, karti pencere icinde kaydirarak hedefte tut.
      offset = Math.max(0, y + winH - edge - cardBottom)
    } else {
      y = clamp(cardTop - edge, wa.y - edge, wa.y + wa.height + edge - winH)
      offset = Math.max(0, cardTop - y - edge)
    }

    return {
      bounds: { x: Math.round(x), y: Math.round(y), width: Math.round(winW), height: Math.round(winH) },
      layout: { align, direction, offset: Math.round(offset) },
      displayId: display.id
    }
  }

  layoutPayload(layout) {
    const cfg = config.get()
    const m = this.metrics()
    return {
      ...layout,
      cardW: m.cardW,
      cardMaxH: m.cardH,
      gap: m.gap,
      pad: m.pad,
      travel: m.travel,
      maxStack: cfg.preview.maxStack,
      opacity: Math.min(100, Math.max(35, cfg.preview.opacity)) / 100,
      sound: cfg.sound,
      theme: cfg.preview.theme,
      showToolbar: cfg.preview.showToolbar,
      autoHideSeconds: cfg.preview.autoHideSeconds,
      animation: cfg.animation
    }
  }

  send(channel, payload) {
    if (this.win && !this.win.isDestroyed()) this.win.webContents.send(channel, payload)
  }

  /* ---------------- kayitlar ---------------- */

  add(record) {
    const win = this.ensureWindow()
    const point = record.cursorPoint || screen.getCursorScreenPoint()
    const { bounds, layout, displayId } = this.computeBounds(point)

    // Acik kart yokken ya da baska ekrana gecildiginde yeniden konumlan.
    if (this.activeIds.size === 0 || displayId !== this.currentDisplayId) {
      win.setBounds(bounds)
      this.currentDisplayId = displayId
      this.lastLayout = layout
    }

    this.activeIds.add(record.id)
    const payload = { record: publicRecord(record), layout: this.layoutPayload(this.lastLayout || layout) }

    if (!this.ready) {
      this.queue.push(payload)
    } else {
      this.send('preview:add', payload)
    }

    if (!win.isVisible()) win.showInactive()
    // Her kartta yeniden dayat: pencere hic gizlenmedigi icin bunu yalnizca
    // "gorunur degilse" yapmak, ilk karttan sonra bir daha calismamak demekti.
    this.raise()
    this.startPointerTracking()
  }

  onRendererReady() {
    this.ready = true
    this.send('preview:layout', this.layoutPayload(this.lastLayout || { align: 'right', direction: 'up', offset: 0 }))
    const pending = this.queue.splice(0)
    for (const payload of pending) this.send('preview:add', payload)
  }

  onCardRemoved(id) {
    this.activeIds.delete(id)
    if (this.activeIds.size === 0) this.idle()
  }

  setInteractive(value) {
    if (!this.win || this.win.isDestroyed()) return
    if (this.interactive === value) return
    this.interactive = value
    if (DEBUG) console.log('[dbg] setIgnoreMouseEvents', !value)
    this.win.setIgnoreMouseEvents(!value)
  }

  // Son kart da gidince pencere kapatilmaz, sadece bosaltilir.
  //
  // Windows'ta bu pencereyi hide() edip yeniden gostermek girdi durumunu kalici
  // olarak bozuyor: sonrasinda setIgnoreMouseEvents(false) cagrilsa bile fare
  // olaylari renderer'a ulasmiyor, yani kartin dugmeleri olu kaliyor (olculdu).
  // Kartsizken pencere tamamen seffaf ve tiklama gecirgen oldugu icin acik
  // kalmasinin bir maliyeti yok; skipTaskbar sayesinde Alt+Tab listesinde de
  // gorunmuyor. Pencereyi her seferinde yeniden yaratmak ise ilk kartin
  // gecikmesine yol acardi.
  idle() {
    this.stopPointerTracking()
    this.setInteractive(false)
    this.hitboxes = []
    this.hotId = null
  }

  clear() {
    this.activeIds.clear()
    this.send('preview:clear')
    this.idle()
  }

  applyConfig() {
    if (!this.win || this.win.isDestroyed()) return
    const { bounds, layout } = this.computeBounds()
    this.lastLayout = layout
    if (this.activeIds.size) {
      // Acik kartlar varken pencereyi zıplatma; sadece boyutu guncelle.
      const current = this.win.getBounds()
      this.win.setBounds({
        x: current.x,
        y: layout.direction === 'up' ? current.y + current.height - bounds.height : current.y,
        width: bounds.width,
        height: bounds.height
      })
    } else {
      this.win.setBounds(bounds)
    }
    this.send('preview:layout', this.layoutPayload(layout))
  }
}

function publicRecord(record) {
  return {
    id: record.id,
    fileName: record.fileName,
    width: record.width,
    height: record.height,
    source: record.source,
    thumb: record.thumb
  }
}

module.exports = new PreviewManager()
