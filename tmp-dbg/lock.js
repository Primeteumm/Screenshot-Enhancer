const { app, nativeImage, clipboard } = require('electron')
const path = require('path')
app.on('window-all-closed', () => {})

app.whenReady().then(async () => {
  const a = nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'sample.png'))
  const b = a.resize({ width: 400 })            // farkli bir goruntu
  if (a.isEmpty() || b.isEmpty()) { console.log('gorseller bos'); return app.quit() }

  let mode = 'A'
  clipboard.readImage = () =>
    mode === 'A' ? a : mode === 'B' ? b : nativeImage.createEmpty()

  const watcher = require(path.join(__dirname, '..', 'src', 'main', 'clipboardWatcher.js'))
  let events = 0
  watcher.on('image', () => { events++ })
  const tick = () => watcher.tick()
  const say = (etiket, beklenen, oncesi) => {
    const oldu = events - oncesi
    console.log('  ' + etiket.padEnd(46) + ' olay=' + oldu + ' (beklenen ' + beklenen + ') ' +
      (oldu === beklenen ? 'TAMAM' : 'HATA'))
    return oldu === beklenen
  }

  let ok = true
  tick()                                            // referans
  let n = events; tick();                 ok = say('ayni goruntu tekrar', 0, n) && ok
  n = events; mode = 'okunamaz'; tick(); tick()
                                          ok = say('kilit ekrani (pano okunamiyor)', 0, n) && ok
  n = events; mode = 'A'; tick();         ok = say('kilit acildi, ayni goruntu', 0, n) && ok
  n = events; mode = 'okunamaz'; tick(); mode = 'A'; tick()
                                          ok = say('ikinci kilit/acilis dongusu', 0, n) && ok
  n = events; mode = 'B'; tick();         ok = say('GERCEKTEN yeni ekran goruntusu', 1, n) && ok
  n = events; mode = 'okunamaz'; tick(); mode = 'B'; tick()
                                          ok = say('yeni goruntuden sonra kilit dongusu', 0, n) && ok

  console.log(ok ? 'SONUC: hepsi gecti' : 'SONUC: BASARISIZ')
  app.quit()
})
