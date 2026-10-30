const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { isValidPhoneNumber } = require('libphonenumber-js')
const root = path.resolve(__dirname, '../apps/landing/src')
const clone = value => JSON.parse(JSON.stringify(value))
const listingId = '00112233-4455-4677-8899-aabbccddeeff'
const savedId = '10112233-4455-4677-8899-aabbccddeeff'
const receipt = eligible => ({ id: savedId, status: 'new', measurement: { eligible: !!eligible, reason: 'other_form', lead_type: 'other', intake_source: 'other' } })
function storage() {
  const values = new Map()
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) }
}
function environment(query = '') {
  const calls = [], requests = [], cache = new Map()
  let sequence = 0
  const window = { location: { hostname: 'ilovedrrealty.com', pathname: `/listing/${listingId}/`, search: query },
    localStorage: storage(), sessionStorage: storage(),
    dispatchEvent: () => true,
    crypto: { randomUUID: () => '00000000-0000-4000-8000-' + String(++sequence).padStart(12, '0') },
    gtag: (...args) => calls.push(clone(args)),
  }
  const api = { post: async (url, body) => { requests.push([url, clone(body)]); return { data: receipt() } } }
  function load(relative) {
    const file = path.resolve(root, relative)
    if (cache.has(file)) return cache.get(file).exports
    const module = { exports: {} }; cache.set(file, module)
    const source = fs.readFileSync(file, 'utf8')
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText,
      { module, exports: module.exports, require: name => name === './axios' ? { __esModule: true, default: api } : load(path.relative(root, path.resolve(path.dirname(file), name + '.ts'))),
        window, localStorage: window.localStorage, URL, URLSearchParams, Event, Date, Set, WeakMap }, { filename: file })
    return module.exports
  }
  return { window, api, calls, requests, load }
}
const form = changes => ({ name: ' Synthetic visitor ', email: '', phone: '+18095551234', message: '', contactConsent: true, ...changes })
const input = changes => ({ listing_id: listingId, name: 'Synthetic visitor', phone: '+18095551234', contactConsent: true, attempt: {}, ...changes })

test('property contact helper accepts phone, email or both and optional comments', () => {
  const prepare = environment().load('api/inquiries.ts').preparePropertyInquiry
  for (const fields of [form(), form({ phone: '+1', email: ' visitor@example.com ' }), form({ email: 'visitor@example.com' })]) {
    const prepared = prepare(fields, '1', isValidPhoneNumber)
    assert.equal(prepared.issue, null)
    assert.equal(prepared.name, 'Synthetic visitor')
    assert.equal(prepared.message, undefined)
  }
  assert.equal(prepare(form({ message: ' Optional description ' }), '1', isValidPhoneNumber).message, 'Optional description')
  assert.equal(prepare(form({ phone: '+1', email: 'visitor@example.com' }), '1', isValidPhoneNumber).phone, undefined)
})

test('missing/invalid contacts, dial code only, long comments and missing consent are visible validation issues', () => {
  const prepare = environment().load('api/inquiries.ts').preparePropertyInquiry
  for (const [change, issue] of [
    [{ name: ' ' }, 'name'], [{ phone: '' }, 'contact'], [{ phone: '+1' }, 'contact'],
    [{ phone: '+1', email: 'not an email' }, 'email'], [{ phone: '+123', email: 'valid@example.com' }, 'phone'],
    [{ email: 'invalid' }, 'email'], [{ message: 'x'.repeat(2001) }, 'message'], [{ contactConsent: false }, 'consent'],
  ]) assert.equal(prepare(form(change), '1', isValidPhoneNumber).issue, issue)
})

test('property submission posts once to canonical leads and preserves type, listing and plain comments', async () => {
  const e = environment(), submit = e.load('api/inquiries.ts').submitInquiry
  const saved = await submit(input({ email: ' synthetic@example.com ', message: ' Optional comments ', locale: 'es', conversionIntent: 'rent' }))
  assert.equal(saved.id, savedId)
  assert.equal(e.requests.length, 1)
  const [url, body] = e.requests[0]
  assert.equal(url, '/leads')
  assert.equal(body.type, 'property_inquiry'); assert.equal(body.property_id, listingId)
  assert.equal(body.message, 'Optional comments'); assert.equal(body.email, 'synthetic@example.com')
  assert.equal(body.tracking.form, 'property_inquiry'); assert.equal(body.tracking.locale, 'es')
  assert.equal(body.tracking.intent, 'rent'); assert.equal(body.tracking.contact_consent, true)
  assert.ok(body.submission_id)
})

test('unchanged explicit retry retains the same request ID; changed content or property starts another attempt', async () => {
  const e = environment(), submit = e.load('api/inquiries.ts').submitInquiry
  const requests = [], attempt = {}
  e.api.post = async (url, body) => { requests.push(clone(body)); if (requests.length === 1) throw new Error('synthetic lost response'); return { data: receipt() } }
  const original = input({ attempt, message: 'Original comments' })
  await assert.rejects(submit(original), /lost response/)
  await submit(original)
  assert.equal(requests.length, 2)
  assert.equal(requests[0].submission_id, requests[1].submission_id)
  await submit({ ...original, message: 'Changed comments' })
  assert.notEqual(requests[2].submission_id, requests[1].submission_id)
  await submit({ ...original, listing_id: '20112233-4455-4677-8899-aabbccddeeff' })
  assert.notEqual(requests[3].submission_id, requests[2].submission_id)
})

test('concurrent identical attempts coalesce into one POST; changed in-flight details cannot post again', async () => {
  const e = environment(), submit = e.load('api/inquiries.ts').submitInquiry
  let release, count = 0
  e.api.post = async () => { count += 1; return new Promise(resolve => { release = () => resolve({ data: receipt() }) }) }
  const original = input(), first = submit(original), second = submit(original)
  assert.equal(count, 1)
  await assert.rejects(submit({ ...original, message: 'Changed while sending' }), /already being submitted/)
  assert.equal(count, 1)
  release()
  assert.equal((await first).id, savedId); assert.equal((await second).id, savedId)
})

test('property tracking follows optional measurement choice, stays free of contact data and defaults to general intent', async () => {
  for (const choice of ['unset', 'denied', 'granted']) {
    const e = environment('?gclid=synthetic-click&utm_source=google&email=private%40example.com&internal_test=1')
    if (choice !== 'unset') e.load('lib/measurementConsent.ts').setMeasurementConsent(choice)
    await e.load('api/inquiries.ts').submitInquiry(input({ message: 'Synthetic private comments', email: 'private@example.com' }))
    const tracking = e.requests[0][1].tracking
    assert.equal(tracking.measurement_consent, choice)
    assert.equal(tracking.intent, 'general'); assert.equal(tracking.internal_test, true)
    assert.equal(tracking.page_path, `/listing/${listingId}/`)
    assert.equal(!!tracking.attribution.gclid, choice === 'granted')
    for (const privateValue of ['private@example.com', 'Synthetic private comments', '+18095551234']) assert.ok(!JSON.stringify(tracking).includes(privateValue))
  }
})

test('property inquiry never dispatches an ad conversion, even if an unexpected receipt is marked eligible', async () => {
  const e = environment(); e.load('lib/measurementConsent.ts').setMeasurementConsent('granted')
  e.api.post = async () => ({ data: receipt(true) })
  await e.load('api/inquiries.ts').submitInquiry(input())
  assert.equal(e.calls.length, 0)
})

test('contact consent is required before POST; unconfirmed receipts do not produce success or automatic retries', async () => {
  const e = environment(), submit = e.load('api/inquiries.ts').submitInquiry
  await assert.rejects(submit(input({ contactConsent: false })), /consent/)
  assert.equal(e.requests.length, 0)
  let count = 0
  e.api.post = async () => { count += 1; return { data: { status: 'new' } } }
  await assert.rejects(submit(input()), /receipt could not be confirmed/)
  assert.equal(count, 1)
  assert.equal(e.calls.length, 0)
})

test('property context guard accepts normalized UUIDs and rejects missing, invalid or different properties', () => {
  const guard = environment().load('api/inquiries.ts').isInquiryPropertyContext
  assert.equal(guard(listingId.toUpperCase(), listingId), true)
  assert.equal(guard(listingId, '20112233-4455-4677-8899-aabbccddeeff'), false)
  assert.equal(guard('', ''), false)
  assert.equal(guard('not-a-uuid', 'not-a-uuid'), false)
})

test('obsolete property success or failure cannot overwrite a newer property or record an obsolete view', async () => {
  const observe = environment().load('api/inquiries.ts').observeInquiryProperty
  const secondId = '20112233-4455-4677-8899-aabbccddeeff'
  const tick = () => new Promise(resolve => setImmediate(resolve))
  for (const obsoleteFails of [false, true]) {
    const results = [], errors = [], views = [], fetches = []
    let resolveFirst, rejectFirst, resolveSecond
    const first = new Promise((resolve, reject) => { resolveFirst = resolve; rejectFirst = reject })
    const second = new Promise(resolve => { resolveSecond = resolve })
    const fetch = id => { fetches.push(id); return id === listingId ? first : second }
    const accept = value => results.push(value.id), reject = () => errors.push(true)
    const recordView = async id => { views.push(id) }
    const stopFirst = observe(listingId, fetch, accept, reject, recordView)
    await tick()
    stopFirst()
    const stopSecond = observe(secondId, fetch, accept, reject, recordView)
    await tick()
    resolveSecond({ id: secondId }); await tick()
    if (obsoleteFails) rejectFirst(new Error('synthetic obsolete failure'))
    else resolveFirst({ id: listingId })
    await tick()
    assert.deepEqual(fetches, [listingId, secondId])
    assert.deepEqual(results, [secondId]); assert.deepEqual(views, [secondId]); assert.deepEqual(errors, [])
    stopSecond()
  }
})

test('unavailable or mismatched property context has no successful state or view side effect', async () => {
  const observe = environment().load('api/inquiries.ts').observeInquiryProperty
  const accepted = [], errors = [], views = [], fetches = []
  const fetch = async id => { fetches.push(id); return { id: '20112233-4455-4677-8899-aabbccddeeff' } }
  const callbacks = [value => accepted.push(value), () => errors.push(true), async id => views.push(id)]
  observe('', fetch, ...callbacks)
  observe(listingId, fetch, ...callbacks)
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(fetches, [listingId]); assert.deepEqual(accepted, []); assert.deepEqual(views, [])
  assert.equal(errors.length, 2)
})

test('English and Spanish expose matching property inquiry labels, validation and receipt copy', () => {
  const locale = language => JSON.parse(fs.readFileSync(path.join(root, `locales/${language}/property_detail.json`), 'utf8')).inquiry
  const keys = (value, prefix = '') => Object.entries(value).flatMap(([key, item]) => typeof item === 'object' ? keys(item, prefix+key+'.') : [prefix+key]).sort()
  const en = locale('en'), es = locale('es')
  assert.deepEqual(keys(en), keys(es))
  assert.ok(en.phone.includes('preferred')); assert.ok(es.phone.includes('preferido'))
  assert.ok(en.message.includes('optional')); assert.ok(es.message.includes('opcional'))
  assert.ok(en.reference.includes('{{id}}') && es.reference.includes('{{id}}'))
})
