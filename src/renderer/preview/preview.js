const stack = document.getElementById('stack')

const EASINGS = {
  linear: 'linear',
  smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
  soft: 'cubic-bezier(0.16, 1, 0.3, 1)',
  snappy: 'cubic-bezier(0.22, 1, 0.36, 1)',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  inOut: 'cubic-bezier(0.65, 0, 0.35, 1)'
}

const ICONS = {
  copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/></svg>',
  save: '<svg viewBox="0 0 24 24"><path d="M12 4v10"/><path d="M8 11l4 4 4-4"/><path d="M5 19h14"/></svg>',
  open: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6"/><path d="M20 4l-8 8"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/></svg>',
  reveal: '<svg viewBox="0 0 24 24"><path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2.5h7A1.5 1.5 0 0 1 19 10v7a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 3 17z"/></svg>',
  pin: '<svg viewBox="0 0 24 24"><path d="M15 3l6 6-3 1-4.5 4.5L13 19l-8-8 4.5-.5L14 6z"/><path d="M9 15l-4 4"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></svg>'
}

let layout = {
  align: 'right',
  direction: 'up',
  cardW: 220,
  cardMaxH: 220,
  gap: 12,
  pad: 30,
  travel: 56,
  theme: 'dark',
  showToolbar: true,
  autoHideSeconds: 9,
  animation: { enabled: true, enterDuration: 420, exitDuration: 220, easing: 'spring', travel: 56 }
}

let maxStack = 3

/* ---------------- yardimcilar ---------------- */

function easing() {
  return EASINGS[layout.animation.easing] || EASINGS.spring
}

function enterMs() {
  return layout.animation.enabled ? layout.animation.enterDuration : 1
}

function exitMs() {
  return layout.animation.enabled ? layout.animation.exitDuration : 1
}

// Kartin bagli oldugu kenara gore giris/cikis yonu
function shiftY() {
  return layout.direction === 'up' ? layout.travel : -layout.travel
}

function shiftX() {
  return layout.align === 'left' ? -layout.travel : layout.travel
}

function enterFrames() {
  switch (layout.animation.type) {
    case 'fade':
      return [{ opacity: 0 }, { opacity: 1 }]
    case 'pop':
      return [
        { transform: 'scale(0.72)', opacity: 0 },
        { transform: 'scale(1)', opacity: 1 }
      ]
    case 'side':
      return [
        { transform: 'translateX(' + shiftX() + 'px) scale(0.94)', opacity: 0 },
        { transform: 'translateX(0) scale(1)', opacity: 1 }
      ]
    default:
      return [
        { transform: 'translateY(' + shiftY() + 'px) scale(0.9)', opacity: 0 },
        { transform: 'translateY(0) scale(1)', opacity: 1 }
      ]
  }
}

function exitFrames() {
  switch (layout.animation.type) {
    case 'fade':
      return [{ opacity: 1 }, { opacity: 0 }]
    case 'pop':
      return [
        { transform: 'scale(1)', opacity: 1 },
        { transform: 'scale(0.82)', opacity: 0 }
      ]
    case 'side':
      return [
        { transform: 'translateX(0) scale(1)', opacity: 1 },
        { transform: 'translateX(' + shiftX() * 0.5 + 'px) scale(0.94)', opacity: 0 }
      ]
    default:
      return [
        { transform: 'translateY(0) scale(1)', opacity: 1 },
        { transform: 'translateY(' + shiftY() * 0.4 + 'px) scale(0.92)', opacity: 0 }
      ]
  }
}

// Yigin degistiginde kalan kartlari yeni yerlerine yumusak tasi (FLIP).
function reflow(mutate) {
  const before = new Map()
  for (const card of stack.children) before.set(card, card.getBoundingClientRect().top)
  mutate()
  if (!layout.animation.enabled) return
  for (const card of stack.children) {
    if (!before.has(card) || card.dataset.leaving === '1') continue
    const delta = before.get(card) - card.getBoundingClientRect().top
    if (!delta) continue
    card.animate(
      [{ transform: 'translateY(' + delta + 'px)' }, { transform: 'translateY(0)' }],
      { duration: enterMs(), easing: easing() }
    )
  }
}

function applyLayout(next) {
  layout = { ...layout, ...next }
  if (layout.maxStack) maxStack = Math.max(1, layout.maxStack)
  const root = document.documentElement.style
  root.setProperty('--card-w', layout.cardW + 'px')
  root.setProperty('--gap', layout.gap + 'px')
  root.setProperty('--pad', layout.pad + 'px')
  root.setProperty('--travel', layout.travel + 'px')
  root.setProperty('--offset', (layout.offset || 0) + 'px')
  stack.classList.toggle('up', layout.direction === 'up')
  stack.classList.toggle('down', layout.direction !== 'up')
  document.body.classList.toggle('light', layout.theme === 'light')
}

function cardHeight(record) {
  const ratio = record.height / record.width
  const raw = Math.round(layout.cardW * ratio)
  return Math.max(96, Math.min(layout.cardMaxH, raw))
}

/* ---------------- kart ---------------- */

function buildCard(record) {
  const card = document.createElement('div')
  card.className = 'card'
  card.dataset.id = record.id
  card.style.height = cardHeight(record) + 'px'
  card.draggable = true

  const img = document.createElement('img')
  img.src = record.thumb
  img.alt = record.fileName
  card.appendChild(img)

  const overlay = document.createElement('div')
  overlay.className = 'overlay'
  overlay.innerHTML =
    '<div class="scrim"></div>' +
    '<div class="grip" title="Pencereyi tasi"><i></i></div>' +
    '<button class="close" title="Kapat" data-act="close" draggable="false">' + ICONS.close + '</button>' +
    (layout.showToolbar
      ? '<div class="toolbar">' +
        '<button data-act="copy" title="Panoya kopyala" draggable="false">' + ICONS.copy + '</button>' +
        '<button data-act="save" title="Farkli kaydet" draggable="false">' + ICONS.save + '</button>' +
        '<button data-act="open" title="Ac" draggable="false">' + ICONS.open + '</button>' +
        '<button data-act="reveal" title="Klasorde goster" draggable="false">' + ICONS.reveal + '</button>' +
        '<button data-act="pin" title="Sabitle" draggable="false">' + ICONS.pin + '</button>' +
        '</div>'
      : '')
  card.appendChild(overlay)

  const toast = document.createElement('div')
  toast.className = 'toast'
  card.appendChild(toast)

  if (layout.autoHideSeconds > 0) {
    const progress = document.createElement('div')
    progress.className = 'progress'
    progress.innerHTML = '<i></i>'
    card.appendChild(progress)
    card._timer = progress.firstElementChild.animate(
      [{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }],
      { duration: layout.autoHideSeconds * 1000, easing: 'linear', fill: 'forwards' }
    )
    card._timer.onfinish = () => dismiss(card)
  }

  const grip = overlay.querySelector('.grip')
  grip.addEventListener('mousedown', event => {
    if (event.button !== 0) return
    event.preventDefault()
    if (card._timer) card._timer.pause()
    window.preview.moveStart()
  })

  card.addEventListener('dragstart', event => {
    if (event.target.closest('button') || event.target.closest('.grip')) {
      event.preventDefault()
      return
    }
    // HTML5 surukleme yerine Electron'un yerel dosya suruklemesi devreye girer,
    // boylece WhatsApp / tarayici yukleme alanlari dosyayi dogrudan alir.
    event.preventDefault()
    // Surukleme boyunca sayac duraklar; imlec karttan ayrildigi icin "hot"
    // durumu dusse bile geri baslamamali, yoksa kart elinizdeyken kaybolur.
    card._dragging = true
    if (card._timer) card._timer.pause()
    window.preview.startDrag(record.id)
  })

  card.addEventListener('dblclick', () => run(card, record.id, 'open'))

  overlay.addEventListener('click', async event => {
    const button = event.target.closest('button')
    if (!button) return
    event.stopPropagation()
    const act = button.dataset.act
    if (act === 'close') return dismiss(card)
    if (act === 'pin') {
      card._pinned = !card._pinned
      button.classList.toggle('pinned', card._pinned)
      if (card._timer) {
        if (card._pinned) card._timer.cancel()
        else card._timer.play()
      }
      showToast(card, card._pinned ? 'Sabitlendi' : 'Sabitleme kaldirildi')
      return
    }
    run(card, record.id, act)
  })

  return card
}

async function run(card, id, action) {
  // "Farkli kaydet" sistem diyalogu acar; kullanici onunla ugrasirken imlec
  // karttan ayrildigi icin sayac islerdi ve kart elinizin altindan kaybolurdu.
  card._busy = true
  if (card._timer) card._timer.pause()
  let result = null
  try {
    result = await window.preview.action(id, action)
  } finally {
    card._busy = false
    if (card._timer && !card._pinned && !card.classList.contains('hot')) card._timer.play()
  }
  if (result && result.message) showToast(card, result.message)
}

function showToast(card, message) {
  const toast = card.querySelector('.toast')
  if (!toast) return
  toast.textContent = ''
  toast.insertAdjacentHTML('afterbegin', ICONS.check)
  const label = document.createElement('span')
  label.textContent = message
  toast.appendChild(label)
  toast.classList.remove('show')
  void toast.offsetWidth // animasyonu yeniden baslat
  toast.classList.add('show')
}

function addCard(record) {
  const card = buildCard(record)
  reflow(() => stack.prepend(card))

  if (layout.animation.enabled) {
    card.animate(enterFrames(), { duration: enterMs(), easing: easing(), fill: 'backwards' })
  }

  while (stack.children.length > maxStack) {
    dismiss(stack.children[stack.children.length - 1], true)
  }

  schedulePublish(enterMs() + 60)
}

function dismiss(card, immediate = false) {
  if (!card || card.dataset.leaving === '1') return
  card.dataset.leaving = '1'
  if (card._timer) card._timer.cancel()

  const finish = () => {
    const id = card.dataset.id
    reflow(() => card.remove())
    window.preview.removed(id)
    schedulePublish(enterMs() + 60)
  }

  if (!layout.animation.enabled || immediate) return finish()

  const anim = card.animate(exitFrames(), {
    duration: exitMs(),
    easing: 'cubic-bezier(0.4, 0, 1, 1)',
    fill: 'forwards'
  })
  anim.onfinish = finish
  anim.oncancel = finish
}

/* ---------------- fare gecirgenligi ---------------- */

// Pencere normalde tiklamalari alta gecirir. Windows'ta
// setIgnoreMouseEvents(..., { forward: true }) mousemove olaylarini renderer'a
// iletmedigi icin isabet testini ana surec yapar; burada yalnizca kartlarin
// guncel dikdortgenleri bildirilir.
let publishFrame = null
let publishUntil = 0

function publishHitboxes() {
  const rects = []
  for (const card of stack.children) {
    if (card.dataset.leaving === '1') continue
    const box = card.getBoundingClientRect()
    if (box.width < 1 || box.height < 1) continue
    rects.push({ id: card.dataset.id, x: box.left, y: box.top, width: box.width, height: box.height })
  }
  window.preview.hitboxes(rects)
}

// Animasyon boyunca kartlar hareket ettigi icin kisa sure boyunca her karede
// yeniden bildir.
function schedulePublish(durationMs) {
  publishUntil = Math.max(publishUntil, performance.now() + durationMs)
  if (publishFrame) return
  const step = () => {
    publishHitboxes()
    if (performance.now() < publishUntil) {
      publishFrame = requestAnimationFrame(step)
    } else {
      publishFrame = null
    }
  }
  publishFrame = requestAnimationFrame(step)
}

/* ---------------- ana surecle koprü ---------------- */

window.preview.onLayout(payload => {
  applyLayout(payload)
  schedulePublish(80)
})

window.addEventListener('resize', () => schedulePublish(80))

window.preview.onAdd(payload => {
  applyLayout(payload.layout)
  addCard(payload.record)
})

window.preview.onClear(() => {
  for (const card of [...stack.children]) dismiss(card, true)
})

// Imlecin uzerinde oldugu kart: arac cubugunu goster ve sayaci duraklat.
window.preview.onHot(id => {
  for (const card of stack.children) {
    const hot = card.dataset.id === id
    card.classList.toggle('hot', hot)
    if (!card._timer || card._pinned || card._dragging || card._busy) continue
    if (hot) card._timer.pause()
    else card._timer.play()
  }
})

// Surukleme bittiginde otomatik gizleme sayaci kilitli kalmasin.
window.preview.onDragEnd(id => {
  const card = stack.querySelector('[data-id="' + id + '"]')
  if (!card) return
  card._dragging = false
  if (card._timer && !card._pinned) card._timer.play()
  schedulePublish(80)
})

// Tutamacla tasima biterken: dugme birakildiginda ya da pencere odagini
// kaybettiginde.
function endMove() {
  window.preview.moveEnd()
}

document.addEventListener('mouseup', endMove)
window.addEventListener('blur', endMove)

window.preview.ready()
