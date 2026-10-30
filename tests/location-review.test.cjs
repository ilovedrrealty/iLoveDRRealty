const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function load() {
  const calls = []
  const api = { get: async (...args) => { calls.push(['get', ...args]); return { data: { synthetic: true } } },
    patch: async (...args) => { calls.push(['patch', ...args]); return { data: { version: 3 } } } }
  const module = { exports: {} }
  const source = fs.readFileSync(path.resolve(__dirname, '../apps/dashboard/src/api/locationReview.ts'), 'utf8')
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText,
    { module, exports: module.exports, URL, require: name => { assert.equal(name, './axios'); return { __esModule: true, default: api } } })
  return { ...module.exports, calls }
}

test('Admin source links use the Maps share boundary and never accept credentials or key-bearing URLs', () => {
  const { safeLocationMapUrl } = load()
  for (const value of ['https://www.google.com/maps?q=19.75,-70.4', 'https://maps.google.com/?q=19.75,-70.4', 'https://maps.app.goo.gl/synthetic', 'https://goo.gl/maps/synthetic']) assert.equal(safeLocationMapUrl(value), true, value)
  for (const value of ['http://google.com/maps', 'https://user:secret@google.com/maps', 'https://google.com.evil.example/maps', 'https://google.com/maps?key=secret', 'https://maps.app.goo.gl/synthetic?access_token=secret', 'https://google.com/maps/api/staticmap?center=19,-70', 'https://google.com/maps/../url?q=secret', 'https://google.com:8443/maps', 'javascript:alert(1)', 'https://maps.app.goo.gl/']) assert.equal(safeLocationMapUrl(value), false, value)
})

test('Candidate extraction never derives a property from a viewport, city or unresolved short link', () => {
  const { locationDestinationCandidate } = load()
  const clone = value => JSON.parse(JSON.stringify(value))
  assert.deepEqual(clone(locationDestinationCandidate('https://maps.google.com/?q=19.7543%2C-70.4125')), { latitude: '19.7543000', longitude: '-70.4125000' })
  assert.deepEqual(clone(locationDestinationCandidate('https://google.com/maps/data=!3d19.7543!4d-70.4125')), { latitude: '19.7543000', longitude: '-70.4125000' })
  for (const value of ['https://google.com/maps/@19.7543,-70.4125,15z', 'https://maps.app.goo.gl/synthetic', 'https://google.com/maps?q=Cabarete', 'https://google.com/maps?q=91,-70', 'https://google.com/maps?q=19,-70&key=secret', 'https://google.com/maps?q=19,-70&destination=18.5,-69.9']) assert.equal(locationDestinationCandidate(value), null)
})

test('Review fetch and pagination use only the private Admin location contract', async () => {
  const api = load()
  const signal = new AbortController().signal
  await api.getLocationSummary({ listing_status: 'active' }, signal)
  await api.getLocationQueue({ listing_status: 'active', review_filter: 'missing', offset: 25, limit: 25 }, signal)
  await api.getLocationReview('synthetic/id', signal)
  assert.equal(api.calls[0][1], '/admin/location-review/summary')
  assert.equal(api.calls[1][1], '/admin/location-review')
  assert.equal(api.calls[1][2].params.review_filter, 'missing')
  assert.equal(api.calls[1][2].params.offset, 25)
  assert.equal(api.calls[2][1], '/admin/location-review/synthetic%2Fid')
  assert.equal(api.calls[2][2].signal, signal)
})

test('Saving retains the optimistic listing/review versions and explicit precision choice', async () => {
  const api = load()
  const body = { expected_version: 2, expected_listing_updated_at: '2026-10-25T12:00:00Z', public_precision: 'hidden',
    latitude: '19.75', longitude: '-70.4', source_type: 'partner_record', source_reference: 'Synthetic source', confirmed_property: true }
  await api.saveLocationReview('synthetic-id', body)
  assert.equal(api.calls.length, 1)
  assert.equal(api.calls[0][0], 'patch')
  assert.equal(api.calls[0][1], '/admin/location-review/synthetic-id')
  assert.equal(api.calls[0][2], body)
})

test('Static listing metadata does not bake precise location fields; public maps use current API pairs', () => {
  const page = fs.readFileSync(path.resolve(__dirname, '../apps/landing/src/app/listing/[id]/page.tsx'), 'utf8')
  const detail = fs.readFileSync(path.resolve(__dirname, '../apps/landing/src/views/PropertyDetail.tsx'), 'utf8')
  assert.doesNotMatch(page, /latitude|longitude|maps_url|initialListing/)
  assert.match(page, /<PropertyDetail id=\{id\}/)
  assert.doesNotMatch(detail, /function parseLatLng/)
  assert.doesNotMatch(detail, /mapsUrl\s*\?\s*parseLatLng/)
  assert.match(detail, /location_precision === 'hidden'/)
  const api = fs.readFileSync(path.resolve(__dirname, '../apps/landing/src/api/listings.ts'), 'utf8')
  assert.doesNotMatch(api, /headers:\s*\{\s*'Cache-Control'/)
})

test('Location editor languages have matching keys and describe private/approximate states', () => {
  const en = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../apps/dashboard/src/locale/en/location_review.json'), 'utf8'))
  const es = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../apps/dashboard/src/locale/es/location_review.json'), 'utf8'))
  function keys(value, prefix = '') { return Object.entries(value).flatMap(([key, item]) => typeof item === 'object' ? keys(item, prefix + key + '.') : [prefix + key]).sort() }
  assert.deepEqual(keys(en), keys(es))
  for (const lang of [en, es]) for (const key of ['precision', 'status', 'source']) assert.ok(lang[key])
  assert.ok(en.precision_help.includes('private'))
})
