// Yakalama sesi. Dosya yerine Web Audio ile sentezleniyor: ne ek varlık ne de
// CSP izni gerekiyor. Hem önizleme penceresi hem ayarlardaki "dinle" düğmesi
// aynı kaynağı kullansın diye burada duruyor.
//
// Tasarım: iki kısa sinüs (yükselen beşli aralık), alçak geçirgen süzgeçten
// geçiyor. Zarf 12 ms'lik yumuşak girişle başlayıp üstel sönüyor - anlık
// başlayan/biten bir zarf hoparlörde tık sesi üretirdi.
;(function () {
  let context = null

  const NOTES = [
    { freq: 1046.5, start: 0, duration: 0.13, gain: 0.6 },   // C6
    { freq: 1568.0, start: 0.055, duration: 0.17, gain: 0.42 } // G6
  ]

  // ctx dışarıdan verilirse (OfflineAudioContext ile ölçüm) oraya çizer.
  function render(ctx, volume, at) {
    const level = Math.min(100, Math.max(0, volume)) / 100
    if (!level) return 0
    const now = (at === undefined ? ctx.currentTime : at) + 0.005

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 3200
    filter.Q.value = 0.7

    const out = ctx.createGain()
    out.gain.value = 0.5
    filter.connect(out)
    out.connect(ctx.destination)

    let end = 0
    for (const note of NOTES) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = note.freq

      const envelope = ctx.createGain()
      const start = now + note.start
      const stop = start + note.duration
      envelope.gain.setValueAtTime(0.0001, start)
      envelope.gain.exponentialRampToValueAtTime(level * note.gain, start + 0.012)
      envelope.gain.exponentialRampToValueAtTime(0.0001, stop)

      osc.connect(envelope)
      envelope.connect(filter)
      osc.start(start)
      osc.stop(stop + 0.02)
      end = Math.max(end, stop + 0.02)
    }
    return end
  }

  window.playChime = function playChime(volume) {
    try {
      if (!context) context = new AudioContext()
      if (context.state === 'suspended') context.resume()
      render(context, volume)
    } catch {
      /* ses çıkmazsa akış bozulmasın */
    }
  }

  // ölçüm/test için
  window.renderChime = render
})()
