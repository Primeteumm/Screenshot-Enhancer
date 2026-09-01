const controls = [...document.querySelectorAll('[data-path]')]

let state = null
let autoFolders = []
let applying = false

/* ---------------- yardimcilar ---------------- */

function readPath(object, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), object)
}

function patchFor(path, value) {
  const keys = path.split('.')
  const patch = {}
  let node = patch
  keys.forEach((key, index) => {
    if (index === keys.length - 1) node[key] = value
    else node = node[key] = {}
  })
  return patch
}

function valueOf(control) {
  if (control.type === 'checkbox') return control.checked
  if (control.type === 'range') return Number(control.value)
  if (control.tagName === 'SELECT' && control.hasAttribute('data-numeric')) return Number(control.value)
  return control.value
}

function paint(control, value) {
  if (control.type === 'checkbox') control.checked = Boolean(value)
  else control.value = String(value)
  if (control.type === 'range') {
    const out = control.parentElement.querySelector('output')
    if (out) out.textContent = control.value + (control.dataset.suffix || '')
  }
}

function renderAll(config) {
  applying = true
  for (const control of controls) paint(control, readPath(config, control.dataset.path))
  applying = false
}

function formatBytes(bytes) {
  if (!bytes) return '0 KB'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return value.toFixed(value >= 10 || unit === 0 ? 0 : 1) + ' ' + units[unit]
}

/* ---------------- klasor listesi ---------------- */

function renderFolders() {
  const list = document.getElementById('folder-list')
  list.textContent = ''
  const extra = state.capture.extraFolders

  const entries = [
    ...autoFolders.filter(dir => !extra.includes(dir)).map(dir => ({ dir, auto: true })),
    ...extra.map(dir => ({ dir, auto: false }))
  ]

  if (!entries.length) {
    const empty = document.createElement('div')
    empty.className = 'folder auto'
    empty.innerHTML = '<span>Ekran görüntüsü klasörü bulunamadı</span>'
    list.appendChild(empty)
    return
  }

  for (const entry of entries) {
    const row = document.createElement('div')
    row.className = 'folder' + (entry.auto ? ' auto' : '')
    const label = document.createElement('span')
    label.textContent = entry.dir
    label.title = entry.dir
    row.appendChild(label)
    if (entry.auto) {
      const tag = document.createElement('em')
      tag.textContent = 'otomatik'
      row.appendChild(tag)
    } else {
      const remove = document.createElement('button')
      remove.textContent = '✕'
      remove.title = 'Listeden çıkar'
      remove.addEventListener('click', () => {
        const next = state.capture.extraFolders.filter(dir => dir !== entry.dir)
        save({ capture: { extraFolders: next } })
      })
      row.appendChild(remove)
    }
    list.appendChild(row)
  }
}

/* ---------------- ekran listesi ---------------- */

// Bagli monitorler "Gorumtunun alindigi ekran" ve "Birincil ekran"
// secenekleriyle ayni listeye eklenir.
function renderDisplays(displays) {
  const select = document.getElementById('display-select')
  for (const display of displays || []) {
    const option = document.createElement('option')
    option.value = display.id
    option.textContent = display.label
    select.appendChild(option)
  }
}

/* ---------------- 8 yonlu konum izgarasi ---------------- */

const anchorGrid = document.getElementById('anchor-grid')

function renderAnchor() {
  for (const button of anchorGrid.querySelectorAll('button')) {
    button.classList.toggle('on', button.dataset.anchor === state.preview.anchor)
  }
  // Sabit konum secili degilken izgara anlamsiz.
  anchorGrid.classList.toggle('disabled', state.preview.placement !== 'fixed')
}

anchorGrid.addEventListener('click', event => {
  const button = event.target.closest('button')
  if (!button) return
  save({ preview: { anchor: button.dataset.anchor } })
})

/* ---------------- kisayol kaydedici ---------------- */

const MODIFIER_CODES = ['ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight',
  'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight']

// KeyboardEvent.code -> Electron accelerator parcasi
function keyName(code) {
  let match = /^Key([A-Z])$/.exec(code)
  if (match) return match[1]
  match = /^Digit(\d)$/.exec(code)
  if (match) return match[1]
  match = /^F(\d{1,2})$/.exec(code)
  if (match) return 'F' + match[1]
  match = /^Arrow(Up|Down|Left|Right)$/.exec(code)
  if (match) return match[1]
  const direct = {
    Space: 'Space', Tab: 'Tab', Backquote: '`', Minus: '-', Equal: '=',
    BracketLeft: '[', BracketRight: ']', Semicolon: ';',
    Quote: "'", Comma: ',', Period: '.', Slash: '/',
    Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown',
    Insert: 'Insert', PrintScreen: 'PrintScreen'
  }
  return direct[code] || null
}

function prettyAccelerator(accelerator) {
  if (!accelerator) return 'Atanmadı'
  return accelerator.replace('CommandOrControl', 'Ctrl').replace(/\+/g, ' + ')
}

let recording = null

function renderHotkeys() {
  for (const button of document.querySelectorAll('[data-hotkey]')) {
    if (recording === button) continue
    button.textContent = prettyAccelerator(readPath(state, button.dataset.hotkey))
    button.classList.remove('recording')
  }
}

function stopRecording() {
  recording = null
  renderHotkeys()
}

for (const button of document.querySelectorAll('[data-hotkey]')) {
  button.addEventListener('click', () => {
    recording = button
    button.textContent = 'Tuş kombinasyonuna bas...'
    button.classList.add('recording')
  })
  button.addEventListener('blur', stopRecording)
}

window.addEventListener('keydown', event => {
  if (!recording) return
  event.preventDefault()
  if (event.code === 'Escape') return stopRecording()
  // Sil / geri: kisayolu kaldir
  if (event.code === 'Backspace' || event.code === 'Delete') {
    const path = recording.dataset.hotkey
    stopRecording()
    return save(patchFor(path, ''))
  }
  if (MODIFIER_CODES.includes(event.code)) return

  const key = keyName(event.code)
  if (!key) return
  const parts = []
  if (event.ctrlKey) parts.push('CommandOrControl')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')
  if (event.metaKey) parts.push('Super')
  // Degistirici olmadan global kisayol tum sistemde o tusu kapardi.
  if (!parts.length) return
  parts.push(key)

  const path = recording.dataset.hotkey
  stopRecording()
  save(patchFor(path, parts.join('+')))
}, true)

/* ---------------- kaydetme ---------------- */

async function save(patch) {
  state = await window.api.update(patch)
  renderAll(state)
  renderFolders()
  renderAnchor()
  renderHotkeys()
}

for (const control of controls) {
  const event = control.type === 'range' ? 'input' : 'change'
  control.addEventListener(event, () => {
    if (control.type === 'range') {
      const out = control.parentElement.querySelector('output')
      if (out) out.textContent = control.value + (control.dataset.suffix || '')
    }
    if (applying) return
    save(patchFor(control.dataset.path, valueOf(control)))
  })
}

/* ---------------- dugmeler ---------------- */

document.getElementById('btn-min').addEventListener('click', () => window.api.minimize())
document.getElementById('btn-close').addEventListener('click', () => window.api.close())
document.getElementById('btn-test').addEventListener('click', () => window.api.test())

document.getElementById('btn-reset').addEventListener('click', async () => {
  state = await window.api.reset()
  renderAll(state)
  renderFolders()
  renderAnchor()
  renderHotkeys()
})

document.getElementById('btn-add-folder').addEventListener('click', async () => {
  const dir = await window.api.chooseFolder()
  if (!dir) return
  if (state.capture.extraFolders.includes(dir)) return
  await save({ capture: { extraFolders: [...state.capture.extraFolders, dir] } })
})

document.getElementById('btn-sound').addEventListener('click', () => {
  // Acik/kapali ayarindan bagimsiz calar: amaci sesi dinletmek.
  if (typeof window.playChime === 'function') window.playChime(state.sound.volume || 40)
})

document.getElementById('btn-open-captures').addEventListener('click', () => window.api.openCaptures())

document.getElementById('btn-clear-captures').addEventListener('click', async () => {
  const stats = await window.api.clearCaptures()
  showStats(stats)
})

function showStats(stats) {
  document.getElementById('storage-stats').textContent =
    stats.count + ' dosya · ' + formatBytes(stats.bytes)
}

/* ---------------- baslangic ---------------- */

window.api.onChanged(config => {
  state = config
  renderAll(state)
  renderFolders()
  renderAnchor()
  renderHotkeys()
})

window.api.get().then(payload => {
  state = payload.config
  autoFolders = payload.watchedFolders
  renderDisplays(payload.displays)
  renderAll(state)
  renderFolders()
  renderAnchor()
  renderHotkeys()
  showStats(payload.stats)
  if (payload.shortcutErrors && payload.shortcutErrors.length) {
    const warning = document.getElementById('shortcut-warning')
    warning.textContent = 'Kaydedilemedi (başka uygulama kullanıyor): ' +
      payload.shortcutErrors.map(prettyAccelerator).join(', ')
    warning.classList.add('warn')
  }
  document.getElementById('version').textContent = 'v' + payload.version
  if (!payload.packaged) {
    document.getElementById('autostart-note').textContent =
      'Geliştirme modunda çalışıyor; bu ayar ancak kurulu sürümde güvenilir çalışır.'
  }
})
