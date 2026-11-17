const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const ts = require('typescript')

const landing = path.resolve(__dirname, '../apps/landing/src')
const clone = value => JSON.parse(JSON.stringify(value))

function load(file, dependencies = {}, window) {
  const filename = path.join(landing, file)
  const module = { exports: {} }
  const { outputText, diagnostics } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  })
  assert.deepEqual(diagnostics, [])
  vm.runInNewContext(outputText, {
    module, exports: module.exports, window, URLSearchParams, require: name => {
      assert.ok(Object.hasOwn(dependencies, name), name)
      return dependencies[name]
    },
  }, { filename })
  return module.exports
}

const valuation = load('data/sellerValuation.ts')
const route = value => valuation.isSellerValuationRoute(new URLSearchParams(value))
const form = changes => ({ ...valuation.blankSellerValuation(), property_type: 'villa', location: 'Los Tres Ojos', ...changes })

test('only the explicit seller valuation destination opens structured intake', () => {
  assert.equal(route(new URLSearchParams(valuation.SELLER_VALUATION_ROUTE)), true)
  assert.equal(route('intent=sell&request=valuation&internal_test=1'), true)
  for (const query of ['intent=sell', 'request=valuation', 'intent=buy&request=valuation', 'intent=sell&request=valuation&request=valuation', 'intent=sell&intent=rent&request=valuation']) {
    assert.equal(route(query), false)
  }
})

test('subject payload accepts broad names, localized decimals and explicit zero while omitting blanks', () => {
  assert.deepEqual(clone(valuation.prepareSellerValuation(form({ location: '  Ensanche 27 de Febrero  ' }))), {
    subject: { property_type: 'villa', location: 'Ensanche 27 de Febrero' },
  })
  assert.deepEqual(clone(valuation.prepareSellerValuation(form({ location: '  Cabarete ', area_m2: '89,75', bedrooms: '0', bathrooms: '2,5', condition: 'good' }))), {
    subject: { property_type: 'villa', location: 'Cabarete', area_m2: 89.75, bedrooms: 0, bathrooms: 2.5, condition: 'good' },
  })
})

test('unrecognized choices, invalid location, out-of-range area and invalid room increments are rejected', () => {
  for (const [field, value] of [
    ['property_type', 'unrecognized'],
    ['location', 'X'],
    ['location', 'a'.repeat(81)],
    ['location', 'name\u0000key'],
    ['area_m2', '0'],
    ['area_m2', '100000000'],
    ['area_m2', '2.001'],
    ['bedrooms', '2.5'],
    ['bedrooms', '1001'],
    ['bathrooms', '1.4'],
    ['bathrooms', '-1'],
    ['condition', 'unrecognized'],
  ]) assert.equal(valuation.prepareSellerValuation(form({ [field]: value })).issue, field)
})

function inquiryHarness() {
  const calls = [], conversions = []
  const legacyReceipt = { id: '00000000-0000-4000-8000-000000000003', status: 'new' }
  const receipt = { ...legacyReceipt, valuation_request_registered: true }
  let sequence = 0
  let denied = false
  let registered = true
  const api = load('api/inquiries.ts', {
    './axios': { __esModule: true, default: { async post(url, data) {
      calls.push({ url, data: clone(data) })
      if (denied) { denied = false; throw new Error('Synthetic interruption') }
      return { data: registered ? receipt : legacyReceipt }
    } } },
    '../lib/gtag': { trackFormConversion(value) { conversions.push(clone(value)) } },
    '../lib/measurementConsent': { getMeasurementConsent: () => 'denied' },
    '../lib/tracking': { captureTrackingParams() {}, getTrackingParams: () => ({}), trackingPagePath: () => '/get-started/' },
  }, {
    location: { search: '?intent=sell&request=valuation' },
    crypto: { randomUUID: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}` },
  })
  return { submit: api.submitContactLead, calls, conversions, receipt, interrupt: () => { denied = true },
    setRegistered: value => { registered = value } }
}

test('valuation retries use the same seller receipt and submission id while facts stay in the private subject', async () => {
  const view = inquiryHarness()
  const subject = valuation.prepareSellerValuation(form({ area_m2: '92.5', condition: 'fair' })).subject
  const input = { tab: 'seller', name: 'Synthetic seller', email: 'seller@example.test', interest: 'Property valuation',
    form: 'get_started', locale: 'en', contactConsent: true, valuationSubject: subject, attempt: {} }
  view.interrupt()
  await assert.rejects(view.submit(input), /Synthetic interruption/)
  assert.equal(await view.submit(input), view.receipt)
  assert.deepEqual(view.calls[0], view.calls[1])
  assert.equal(view.calls[0].url, '/leads')
  const wire = view.calls[0].data
  assert.equal(wire.type, 'seller_interest')
  assert.deepEqual(wire.valuation_subject, clone(subject))
  assert.equal(wire.message, 'Interest: Property valuation')
  assert.equal(wire.tracking.contact_consent, true)
  assert.doesNotMatch(JSON.stringify(wire.tracking), /Los Tres Ojos|92\.5|valuation_subject/)
  assert.deepEqual(view.conversions, [view.receipt])
})

test('ordinary inquiries omit the new field, and seller valuation cannot be submitted without consent', async () => {
  const view = inquiryHarness()
  const input = { name: 'Synthetic visitor', email: 'visitor@example.test', interest: 'Testing', contactConsent: true }
  for (const tab of ['seller', 'buyer', 'renter']) {
    const valuationSubject = tab === 'seller' ? undefined : valuation.prepareSellerValuation(form()).subject
    await view.submit({ ...input, tab, valuationSubject, attempt: {} })
  }
  assert.ok(view.calls.every(({ data }) => !Object.hasOwn(data, 'valuation_subject')))
  await assert.rejects(view.submit({ ...input, tab: 'seller', contactConsent: false,
    valuationSubject: valuation.prepareSellerValuation(form()).subject, attempt: {} }), /Contact consent/)
  assert.equal(view.calls.length, 3)
})

test('a receipt without the explicit registration acknowledgment preserves the retry id and records no conversion', async () => {
  const view = inquiryHarness()
  const input = { tab: 'seller', name: 'Synthetic seller', email: 'seller@example.test', interest: 'Property valuation',
    contactConsent: true, valuationSubject: valuation.prepareSellerValuation(form()).subject, attempt: {} }
  view.setRegistered(false)
  await assert.rejects(view.submit(input), /receipt could not be confirmed/)
  assert.deepEqual(view.conversions, [])
  view.setRegistered(true)
  assert.equal(await view.submit(input), view.receipt)
  assert.equal(view.calls[0].data.submission_id, view.calls[1].data.submission_id)
})

test('English and Spanish cover every valuation choice and validation field', () => {
  for (const locale of ['en', 'es']) {
    const { valuation: copy } = JSON.parse(fs.readFileSync(path.join(landing, 'locales', locale, 'get_started.json'), 'utf8'))
    assert.deepEqual(Object.keys(copy.types), Array.from(valuation.VALUATION_PROPERTY_TYPES))
    assert.deepEqual(Object.keys(copy.conditions), Array.from(valuation.VALUATION_CONDITIONS))
    assert.deepEqual(new Set(Object.keys(copy.errors)), new Set(Object.keys(valuation.blankSellerValuation())))
  }
})
