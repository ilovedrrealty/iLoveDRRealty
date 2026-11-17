const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const path = require('node:path')
const { test } = require('node:test')
const vm = require('node:vm')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const read = relative => readFileSync(path.join(root, relative), 'utf8')
const source = read('apps/dashboard/src/api/arrivalGuide.ts')

function load(client = {}) {
  const module = { exports: {} }
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  })
  vm.runInNewContext(output.outputText, { module, exports: module.exports, require: id => {
    assert.equal(id, './axios')
    return client
  } })
  return module.exports
}

const plain = value => JSON.parse(JSON.stringify(value))
const model = load()

test('blank drafts are not saves, and one translated field is enough', () => {
  const draft = model.emptyArrivalGuide()
  draft.es.directions = '  '
  assert.equal(model.prepareArrivalGuide(draft), null)
  assert.equal(model.prepareArrivalGuide({ en: {} }), null)

  draft.es.directions = '  Llegada por el lado este.\nUsa la entrada principal.  '
  const result = model.prepareArrivalGuide(draft)
  assert.equal(result.es.directions, 'Llegada por el lado este.\nUsa la entrada principal.')
  assert.equal(result.en.directions, '')
  assert.notEqual(result, draft)
  assert.equal(model.emptyArrivalGuide().es.directions, '')
})

test('instruction limit counts Unicode code points', () => {
  const draft = model.emptyArrivalGuide()
  draft.en.house_notes = '🌴'.repeat(1500)
  assert.ok(model.prepareArrivalGuide(draft))
  draft.en.house_notes += 'a'
  assert.equal(model.prepareArrivalGuide(draft), null)
})

test('guest display prefers the requested language per field, using translations that exist', () => {
  const guide = model.emptyArrivalGuide()
  guide.en.directions = 'Main entrance'
  guide.es.directions = 'Entrada principal'
  guide.es.check_out = 'Cierra la puerta'
  assert.deepEqual(plain(model.arrivalGuideFields(guide, 'en')), [
    { field: 'directions', language: 'en', value: 'Main entrance' },
    { field: 'check_out', language: 'es', value: 'Cierra la puerta' },
  ])
  assert.deepEqual(plain(model.arrivalGuideFields(guide, 'es')), [
    { field: 'directions', language: 'es', value: 'Entrada principal' },
    { field: 'check_out', language: 'es', value: 'Cierra la puerta' },
  ])
})

test('expiry requires an explicit offset and resolves to the same instant across offsets', () => {
  const expires = model.arrivalGuideExpiry('2026-11-20T10:00:00-04:00')
  assert.equal(expires, Date.UTC(2026, 10, 20, 14))
  assert.equal(expires, model.arrivalGuideExpiry('2026-11-20T14:00:00.000Z'))
  assert.ok(Number.isNaN(model.arrivalGuideExpiry('2026-11-20T10:00:00')))
  assert.ok(Number.isNaN(model.arrivalGuideExpiry('2026-11-20')))
  assert.ok(Number.isNaN(model.arrivalGuideExpiry(undefined)))
})

test('owner save and explicit clear use the private listing route and version, while guest reads by booking', async () => {
  const calls = []
  const controller = new AbortController()
  const draft = model.emptyArrivalGuide()
  draft.en.directions = 'Near the main road.'
  const guestData = { content: draft, available_until: '2026-11-20T10:00:00-04:00' }
  const api = load({
    async get(route, options) {
      assert.equal(options.signal, controller.signal)
      calls.push({ method: 'GET', route })
      return { data: route.includes('/listings/') ? { version: 0, content: null } : guestData }
    },
    async put(route, body, options) {
      assert.equal(options.signal, controller.signal)
      calls.push({ method: 'PUT', route, body })
      return { data: { version: body.expected_version + 1, content: body.content } }
    },
  })
  assert.deepEqual(plain(await api.getOwnerArrivalGuide('listing-id', controller.signal)), { version: 0, content: null })
  const saved = await api.saveOwnerArrivalGuide('listing-id', 0, draft, controller.signal)
  assert.deepEqual(plain(saved), { version: 1, content: plain(draft) })
  assert.deepEqual(plain(await api.saveOwnerArrivalGuide('listing-id', saved.version, null, controller.signal)), { version: 2, content: null })
  assert.deepEqual(plain(await api.getGuestArrivalGuide('booking-id', controller.signal)), plain(guestData))
  assert.deepEqual(plain(calls), [
    { method: 'GET', route: '/bookings/listings/listing-id/arrival-guide' },
    { method: 'PUT', route: '/bookings/listings/listing-id/arrival-guide', body: { expected_version: 0, content: plain(draft) } },
    { method: 'PUT', route: '/bookings/listings/listing-id/arrival-guide', body: { expected_version: 1, content: null } },
    { method: 'GET', route: '/bookings/booking-id/arrival-guide' },
  ])
})

test('the API reader rejects guide data without instructions or an absolute expiry', async () => {
  const api = load({ async get() { return { data: { content: model.emptyArrivalGuide(), available_until: '2026-11-22' } } } })
  await assert.rejects(api.getGuestArrivalGuide('booking-id', new AbortController().signal), /Invalid arrival guide response/)
})

test('English and Spanish have the same nonempty arrival guide messages', () => {
  const readLocale = language => JSON.parse(read(`apps/dashboard/src/locale/${language}/common.json`)).arrival_guide
  const en = readLocale('en')
  const es = readLocale('es')
  assert.deepEqual(Object.keys(en).sort(), Object.keys(es).sort())
  for (const key of [...model.ARRIVAL_GUIDE_FIELDS, 'title', 'manage', 'view', 'close', 'save', 'clear', 'unavailable']) {
    assert.ok(en[key].trim())
    assert.ok(es[key].trim())
  }
})
