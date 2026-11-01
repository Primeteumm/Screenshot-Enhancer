const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')
const i18n = require('../src/renderer/shared/i18n')
const config = require('../src/main/config')

const { STRINGS, LANGUAGES, resolve, translate } = i18n
const placeholders = (s) => (s.match(/\{\w+\}/g) || []).sort()
const tags = (s) => s.match(/<[^>]+>/g) || []

test('every language has exactly the same keys as English', () => {
  const reference = Object.keys(STRINGS.en).sort()
  for (const lang of LANGUAGES) {
    assert.deepStrictEqual(Object.keys(STRINGS[lang]).sort(), reference, `keys differ in "${lang}"`)
  }
})

test('translations keep the placeholders and HTML tags of English', () => {
  for (const lang of LANGUAGES) {
    for (const [key, text] of Object.entries(STRINGS.en)) {
      assert.deepStrictEqual(placeholders(STRINGS[lang][key]), placeholders(text), `placeholders differ in ${lang}:${key}`)
      assert.deepStrictEqual(tags(STRINGS[lang][key]), tags(text), `HTML differs in ${lang}:${key}`)
    }
  }
})

test('every language is allowed in settings and offered in the language select', () => {
  const allowed = config.ENUMS['general.language']
  const html = fs.readFileSync(path.join(__dirname, '../src/renderer/settings/index.html'), 'utf8')
  for (const lang of LANGUAGES) {
    assert.ok(allowed.includes(lang), `"${lang}" missing from general.language in config.js`)
    assert.match(html, new RegExp(`<option value="${lang}">`), `"${lang}" missing from the settings language select`)
  }
})

test('resolve() keeps an explicit language', () => {
  assert.strictEqual(resolve('de', 'tr-TR'), 'de')
  assert.strictEqual(resolve('tr', 'en-US'), 'tr')
})

test('resolve() picks the system language for "auto" when supported', () => {
  assert.strictEqual(resolve('auto', 'tr-TR'), 'tr')
  assert.strictEqual(resolve('auto', 'TR'), 'tr')
  assert.strictEqual(resolve('auto', 'de_AT'), 'de')
  assert.strictEqual(resolve('auto', 'en-GB'), 'en')
})

test('resolve() falls back to English', () => {
  assert.strictEqual(resolve('auto', 'xx-XX'), 'en')
  assert.strictEqual(resolve('auto', ''), 'en')
  assert.strictEqual(resolve('auto', undefined), 'en')
  assert.strictEqual(resolve('bogus', 'zz'), 'en')
})

test('translate() fills placeholders and leaves unknown ones alone', () => {
  assert.strictEqual(translate('en', 'storage.stats', { count: 3, size: '2 MB' }), '3 files · 2 MB')
  assert.strictEqual(translate('en', 'storage.stats', { count: 3 }), '3 files · {size}')
})

test('translate() falls back to Turkish, then to the key', () => {
  assert.strictEqual(translate('xx', 'tray.quit'), STRINGS.tr['tray.quit'])
  assert.strictEqual(translate('en', 'no.such.key'), 'no.such.key')
})
