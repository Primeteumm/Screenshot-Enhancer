const { app } = require('electron')
const config = require('./config')
const i18n = require('../renderer/shared/i18n')

// Ayardaki dil ("auto" ise sistem dilinden cozulur).
function lang() {
  const system = (app.getPreferredSystemLanguages && app.getPreferredSystemLanguages()[0]) || app.getLocale()
  return i18n.resolve(config.get().general.language, system)
}

function t(key, vars) {
  return i18n.translate(lang(), key, vars)
}

module.exports = { lang, t }
