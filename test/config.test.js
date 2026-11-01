const test = require('node:test')
const assert = require('node:assert')
const config = require('../src/main/config')

const { DEFAULTS, validate, migrate, mergeInto } = config
const fresh = () => JSON.parse(JSON.stringify(DEFAULTS))

test('validate() replaces invalid enum values with defaults', () => {
  const data = fresh()
  data.general.language = 'klingon'
  data.preview.anchor = 'middle'
  data.animation.type = 'slide'
  validate(data)
  assert.strictEqual(data.general.language, DEFAULTS.general.language)
  assert.strictEqual(data.preview.anchor, DEFAULTS.preview.anchor)
  assert.strictEqual(data.animation.type, 'slide')
})

test('mergeInto() only takes known keys of the same type', () => {
  const data = fresh()
  mergeInto(data, {
    general: { language: 'de', unknown: true },
    preview: { size: '300', margin: 40 },
    extra: { anything: 1 }
  }, DEFAULTS)
  assert.strictEqual(data.general.language, 'de')
  assert.ok(!('unknown' in data.general))
  assert.strictEqual(data.preview.size, DEFAULTS.preview.size, 'string should not replace a number')
  assert.strictEqual(data.preview.margin, 40)
  assert.ok(!('extra' in data))
})

test('mergeInto() copies arrays instead of sharing them', () => {
  const data = fresh()
  const folders = ['C:\Shots']
  mergeInto(data, { capture: { extraFolders: folders } }, DEFAULTS)
  assert.deepStrictEqual(data.capture.extraFolders, folders)
  assert.notStrictEqual(data.capture.extraFolders, folders)
  mergeInto(data, { capture: { extraFolders: 'C:\Shots' } }, DEFAULTS)
  assert.deepStrictEqual(data.capture.extraFolders, folders, 'non-array should be ignored')
})

test('mergeInto() does not mutate DEFAULTS', () => {
  const before = JSON.stringify(DEFAULTS)
  mergeInto(fresh(), { preview: { size: 999 }, general: { language: 'fr' } }, DEFAULTS)
  assert.strictEqual(JSON.stringify(DEFAULTS), before)
})

test('migrate() converts the old preview.position setting', () => {
  assert.deepStrictEqual(migrate({ preview: { position: 'smart' } }).preview, { placement: 'cursor' })
  assert.deepStrictEqual(migrate({ preview: { position: 'top-left' } }).preview, { placement: 'fixed', anchor: 'top-left' })
})

test('migrate() leaves new or empty settings alone', () => {
  const current = { preview: { placement: 'fixed', anchor: 'left' } }
  assert.deepStrictEqual(migrate(JSON.parse(JSON.stringify(current))), current)
  assert.strictEqual(migrate(null), null)
  assert.deepStrictEqual(migrate({}), {})
})
