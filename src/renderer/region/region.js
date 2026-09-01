const shot = document.getElementById('shot')
const veil = document.getElementById('veil')
const box = document.getElementById('box')
const sizeLabel = document.getElementById('size')
const hint = document.getElementById('hint')

let origin = null
let current = null

window.region.onImage(payload => {
  shot.src = payload.dataUrl
  shot.onload = () => window.region.ready()
  // Goruntu bir sekilde yuklenmezse de ekran acilsin.
  setTimeout(() => window.region.ready(), 700)
})

function draw(rect) {
  box.hidden = false
  box.style.left = rect.x + 'px'
  box.style.top = rect.y + 'px'
  box.style.width = rect.width + 'px'
  box.style.height = rect.height + 'px'
  box.classList.toggle('tight', rect.y < 30)
  sizeLabel.textContent = Math.round(rect.width) + ' x ' + Math.round(rect.height)
  // Secim basladiginda tum ekrani karartan katman gereksiz: golge devrede.
  veil.hidden = true
}

function rectFrom(a, b) {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y)
  }
}

document.addEventListener('mousedown', event => {
  if (event.button !== 0) return window.region.done(null)
  origin = { x: event.clientX, y: event.clientY }
  current = origin
  hint.classList.add('gone')
  draw(rectFrom(origin, current))
})

document.addEventListener('mousemove', event => {
  if (!origin) return
  current = { x: event.clientX, y: event.clientY }
  draw(rectFrom(origin, current))
})

document.addEventListener('mouseup', () => {
  if (!origin) return
  const rect = rectFrom(origin, current)
  origin = null
  // Kazara tiklama secim sayilmasin.
  window.region.done(rect.width >= 5 && rect.height >= 5 ? rect : null)
})

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') window.region.done(null)
})

window.addEventListener('blur', () => window.region.done(null))
