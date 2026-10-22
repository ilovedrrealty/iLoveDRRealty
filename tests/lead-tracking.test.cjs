const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '../apps/landing/src')
const clone = value => JSON.parse(JSON.stringify(value))
function storage() {
  const entries = new Map()
  return { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, String(value)), removeItem: key => entries.delete(key) }
}
function environment(url = 'https://ilovedrrealty.com/get-started/') {
  const parsed = new URL(url)
  const calls = []
  const listeners = new Map()
  let sequence = 0
  const window = { location: { hostname: parsed.hostname, pathname: parsed.pathname, search: parsed.search },
    localStorage: storage(), sessionStorage: storage(),
    addEventListener(type, listener) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(listener) },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener) },
    dispatchEvent(event) { for (const listener of listeners.get(event.type) || []) listener(event) },
    crypto: { randomUUID: () => '00000000-0000-4000-8000-' + String(++sequence).padStart(12, '0') },
    gtag: (...args) => calls.push(clone(args)),
  }
  const api = { post: async () => ({ data: receipt() }) }
  function loader() {
    const cache = new Map()
    function load(file) {
      if (cache.has(file)) return cache.get(file).exports
      const module = { exports: {} }
      cache.set(file, module)
      const source = fs.readFileSync(file, 'utf8')
      const requireLocal = name => name.endsWith('/axios') || name === './axios' ? { __esModule: true, default: api } : load(path.resolve(path.dirname(file), name + '.ts'))
      vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText,
        { module, exports: module.exports, require: requireLocal, window, localStorage: window.localStorage, URL, URLSearchParams, Event, Date, Set }, { filename: file })
      return module.exports
    }
    return relative => load(path.join(root, relative))
  }
  const load = loader()
  return { window, calls, api, load, reload: loader }
}
function receipt(id = '00112233-4455-4677-8899-aabbccddeeff', eligible = true) {
  return { id, status: 'new', measurement: { eligible, reason: eligible ? 'eligible_inquiry' : 'internal_test', lead_type: 'buyer_interest', intake_source: 'get_started' } }
}

test('optional measurement defaults off, clearing old click storage before any choice', () => {
  const e = environment('https://ilovedrrealty.com/get-started/?gclid=synthetic-only')
  e.window.localStorage.setItem('ildr_ad_tracking', 'old identifiers')
  e.load('lib/tracking.ts').captureTrackingParams()
  assert.equal(e.window.localStorage.getItem('ildr_ad_tracking'), null)
  assert.deepEqual(clone(e.load('lib/tracking.ts').getTrackingParams()), {})
  assert.equal(e.load('lib/gtag.ts').trackFormConversion(receipt()), false)
  assert.equal(e.calls.length, 0)
})

test('consented tagged arrival survives navigation and a new campaign replaces rather than mixes IDs', () => {
  const e = environment('https://ilovedrrealty.com/es/?gclid=synthetic-click-one&utm_source=google&utm_campaign=buyers')
  e.load('lib/measurementConsent.ts').setMeasurementConsent('granted')
  const tracking = e.load('lib/tracking.ts')
  tracking.captureTrackingParams()
  e.window.location.search = ''
  tracking.captureTrackingParams()
  assert.equal(tracking.getTrackingParams().gclid, 'synthetic-click-one')
  e.window.location.search = '?utm_source=another-channel'
  tracking.captureTrackingParams()
  assert.deepEqual(clone(tracking.getTrackingParams()), { utm_source: 'another-channel' })
  e.load('lib/measurementConsent.ts').setMeasurementConsent('denied')
  assert.equal(e.window.localStorage.getItem('ildr_ad_tracking'), null)
})

test('expired/malformed tracking, obvious contact data and unrecognized URL values are discarded', () => {
  const e = environment('https://ilovedrrealty.com/get-started/?gclid=bad!id&utm_source=visitor%40example.com&utm_content=%2B18095551234&access_token=private#secret')
  e.load('lib/measurementConsent.ts').setMeasurementConsent('granted')
  const tracking = e.load('lib/tracking.ts')
  tracking.captureTrackingParams()
  assert.deepEqual(clone(tracking.getTrackingParams()), {})
  assert.equal(tracking.measurementPageLocation(), 'https://ilovedrrealty.com/get-started/')
  e.window.localStorage.setItem('ildr_ad_tracking', JSON.stringify({ version: 1, capturedAt: Date.now() - 31 * 86400000, params: { gclid: 'expired' } }))
  assert.deepEqual(clone(tracking.getTrackingParams()), {})
  assert.equal(e.window.localStorage.getItem('ildr_ad_tracking'), null)
  e.window.location.pathname = '/reset-password/'
  assert.equal(tracking.trackingPagePath(), '/other/')
})

test('accepted inquiry receipt requires backend UUID, consent and production host; dedup survives module reload', () => {
  const e = environment()
  e.load('lib/measurementConsent.ts').setMeasurementConsent('granted')
  const tag = e.load('lib/gtag.ts')
  assert.equal(tag.trackFormConversion(receipt('private@example.com')), false)
  assert.equal(tag.trackFormConversion(receipt(undefined, false)), false)
  assert.equal(tag.trackFormConversion(receipt()), true)
  assert.equal(tag.trackFormConversion(receipt()), false)
  assert.equal(e.reload()('lib/gtag.ts').trackFormConversion(receipt()), false)
  assert.equal(e.calls.length, 1)
  const sent = e.calls[0][2]
  assert.deepEqual(Object.keys(sent).sort(), ['intake_source', 'lead_type', 'page_location', 'page_title', 'send_to', 'transaction_id'])
  assert.equal(sent.transaction_id, receipt().id)
  for (const url of ['http://127.0.0.1:3002/get-started/', 'https://preview.vercel.app/get-started/']) {
    const preview = environment(url)
    preview.load('lib/measurementConsent.ts').setMeasurementConsent('granted')
    assert.equal(preview.load('lib/gtag.ts').trackFormConversion(receipt()), false)
    assert.equal(preview.calls.length, 0)
  }
})

test('API retry retains submission UUID, attribution stays separate, and only acceptance measures', async () => {
  const e = environment('https://ilovedrrealty.com/get-started/?utm_source=google&gclid=synthetic-test-only')
  e.load('lib/measurementConsent.ts').setMeasurementConsent('granted')
  const submit = e.load('api/inquiries.ts').submitContactLead
  const requests = []
  e.api.post = async (url, body) => { requests.push(clone(body)); if (requests.length === 1) throw new Error('synthetic lost response'); return { data: receipt() } }
  const attempt = {}
  const data = { tab: 'buyer', name: 'Synthetic person', phone: '+18095551234', interest: 'Buying', message: 'Synthetic private comments', contactConsent: true, form: 'get_started', attempt }
  await assert.rejects(submit(data), /lost response/)
  assert.equal(e.calls.length, 0)
  assert.equal((await submit(data)).id, receipt().id)
  assert.equal(requests[0].submission_id, requests[1].submission_id)
  assert.equal(requests[1].tracking.attribution.gclid, 'synthetic-test-only')
  assert.equal(requests[1].message.includes('gclid'), false)
  assert.equal(e.calls.length, 1)
  await submit({ ...data, message: 'A changed request' })
  assert.notEqual(requests[2].submission_id, requests[1].submission_id)
})

test('buyer seller renter and general-intent contact receipts preserve the same generic action with safe segmentation', () => {
  const e = environment()
  e.load('lib/measurementConsent.ts').setMeasurementConsent('granted')
  const tag = e.load('lib/gtag.ts')
  for (const [index, kind] of ['buyer_interest', 'seller_interest', 'rental_interest'].entries()) {
    const accepted = receipt('00112233-4455-4677-8899-aabbccddee0' + index)
    accepted.measurement.lead_type = kind
    accepted.measurement.intake_source = 'lead_popup'
    assert.equal(tag.trackFormConversion(accepted), true)
    assert.equal(e.calls[index][2].lead_type, kind)
    assert.equal(e.calls[index][2].intake_source, 'lead_popup')
  }
  assert.equal(new Set(e.calls.map(call => call[2].send_to)).size, 1)
})

test('declined and internal-test receipts do not trigger conversion; tag failure cannot fail accepted lead', async () => {
  const e = environment('https://ilovedrrealty.com/get-started/?internal_test=1&gclid=synthetic-test-only')
  const submit = e.load('api/inquiries.ts').submitContactLead
  const requests = []
  e.api.post = async (url, body) => { requests.push(clone(body)); return { data: receipt(undefined, false) } }
  const data = { tab: 'renter', name: 'Synthetic', email: 'synthetic@example.com', interest: 'Rent', contactConsent: true, attempt: {} }
  await submit(data)
  assert.equal(requests[0].tracking.internal_test, true)
  assert.deepEqual(requests[0].tracking.attribution, {})
  assert.equal(e.calls.length, 0)
  e.load('lib/measurementConsent.ts').setMeasurementConsent('granted')
  e.api.post = async () => ({ data: receipt() })
  e.window.gtag = () => { throw new Error('synthetic blocked tag') }
  assert.equal((await submit({ ...data, tab: 'buyer' })).id, receipt().id)
})

test('all four inquiry forms use the shared receipt path, independent contact consent and no direct conversion call', () => {
  for (const file of ['views/GetStarted.tsx', 'views/Contact.tsx', 'views/SpanishLandingPage.tsx', 'components/LeadCaptureModal.tsx']) {
    const source = fs.readFileSync(path.join(root, file), 'utf8')
    assert.match(source, /submitContactLead\(/, file)
    assert.match(source, /contactConsent:/, file)
    assert.doesNotMatch(source, /trackFormConversion|getTrackingReferenceLine|client\.post\(['"]\/leads/, file)
  }
  const layout = fs.readFileSync(path.join(root, 'app/layout.tsx'), 'utf8')
  assert.doesNotMatch(layout, /googletagmanager|gtag\('config'/)
  assert.match(layout, /MeasurementPreferences/)
})

test('two tabs honor latest persisted consent, exact-key updates and storage clear before future events', () => {
  const first = environment('https://ilovedrrealty.com/get-started/?gclid=synthetic-tab-test')
  const second = environment()
  second.window.localStorage = first.window.localStorage
  const a = first.load('lib/measurementConsent.ts')
  const b = second.load('lib/measurementConsent.ts')
  a.setMeasurementConsent('granted')
  first.load('lib/tracking.ts').captureTrackingParams()
  assert.equal(first.load('lib/gtag.ts').trackFormConversion(receipt()), true)
  const changes = []
  const unsubscribe = a.subscribeToMeasurementStorage(() => {
    changes.push(a.getMeasurementConsent())
    first.load('lib/tracking.ts').captureTrackingParams()
  })
  b.setMeasurementConsent('denied')
  // Even before the storage-event callback, event guards re-read this value.
  assert.equal(a.getMeasurementConsent(), 'denied')
  assert.equal(first.load('lib/gtag.ts').trackFormConversion(receipt('00112233-4455-4677-8899-aabbccddeef1')), false)
  first.window.dispatchEvent({ type: 'storage', key: a.MEASUREMENT_CONSENT_STORAGE_KEY })
  assert.deepEqual(changes, ['denied'])
  assert.equal(first.window.localStorage.getItem('ildr_ad_tracking'), null)
  first.window.dispatchEvent({ type: 'storage', key: 'unrelated-setting' })
  assert.equal(changes.length, 1)
  b.setMeasurementConsent('granted')
  first.window.dispatchEvent({ type: 'storage', key: a.MEASUREMENT_CONSENT_STORAGE_KEY })
  assert.equal(a.getMeasurementConsent(), 'granted')
  second.window.localStorage.removeItem(a.MEASUREMENT_CONSENT_STORAGE_KEY)
  first.window.dispatchEvent({ type: 'storage', key: null })
  assert.deepEqual(changes, ['denied', 'granted', 'unset'])
  assert.equal(a.getMeasurementConsent(), 'unset')
  assert.equal(first.load('lib/gtag.ts').trackFormConversion(receipt('00112233-4455-4677-8899-aabbccddeef2')), false)
  unsubscribe()
  first.window.dispatchEvent({ type: 'storage', key: null })
  assert.equal(changes.length, 3)
})

test('blocked storage retains an explicit session choice and a later decline always wins', () => {
  const e = environment()
  e.window.localStorage.getItem = e.window.localStorage.setItem = () => { throw new Error('synthetic unavailable storage') }
  const consent = e.load('lib/measurementConsent.ts')
  consent.setMeasurementConsent('granted')
  assert.equal(consent.getMeasurementConsent(), 'granted')
  consent.setMeasurementConsent('denied')
  assert.equal(consent.getMeasurementConsent(), 'denied')
  assert.equal(e.load('lib/gtag.ts').trackFormConversion(receipt()), false)
})
