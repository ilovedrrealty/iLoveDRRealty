const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const path = require('node:path')
function loadFile(file) {
  const source = fs.readFileSync(file, 'utf8')
  const moduleState = { exports: {} }
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS,
  } }).outputText, { exports: moduleState.exports, module: moduleState, require: id => loadFile(path.resolve(path.dirname(file), id + '.ts')) })
  return moduleState.exports
}
const { listingMapPoint, mappedListings, areaSummaryPoints, clusterMapListings } = loadFile(path.resolve(__dirname, '../apps/landing/src/data/searchMap.ts'))
const clone = value => JSON.parse(JSON.stringify(value))

test('pins retain the listing coordinates exactly without region offsets', () => {
  assert.deepEqual(clone(listingMapPoint({ latitude: 19.7543, longitude: -70.4125 })), { lat: 19.7543, lng: -70.4125 })
  assert.deepEqual(clone(listingMapPoint({ latitude: 0, longitude: 0 })), { lat: 0, lng: 0 })
})

test('missing, partial, malformed and out-of-range coordinates never invent a property location', () => {
  for (const value of [
    {}, { region: 'Cabarete' }, { latitude: null, longitude: null },
    { latitude: 19.75 }, { longitude: -70.41 }, { latitude: '19.75', longitude: '-70.41' },
    { latitude: NaN, longitude: -70 }, { latitude: 19, longitude: Infinity },
    { latitude: 91, longitude: -70 }, { latitude: -91, longitude: -70 },
    { latitude: 19, longitude: 181 }, { latitude: 19, longitude: -181 },
  ]) assert.equal(listingMapPoint(value), null, JSON.stringify(value))
})

test('map membership and missing count reflect saved coordinates without removing list results', () => {
  const properties = [
    { id: 'a', latitude: 19.75, longitude: -70.41 },
    { id: 'b', region: 'Cabarete' },
    { id: 'c', latitude: 18.4, longitude: -69.9 },
    { id: 'd', latitude: 100, longitude: -70 },
  ]
  const before = JSON.stringify(properties)
  const points = mappedListings(properties)
  assert.deepEqual(clone(points.map(item => item.listing.id)), ['a', 'c'])
  assert.equal(properties.length - points.length, 2)
  assert.equal(JSON.stringify(properties), before)
  assert.equal(points[0].listing, properties[0])
  assert.deepEqual(clone(mappedListings([])), [])
})

test('area bubbles are explicit area summaries and unknown areas never acquire a fallback property pin', () => {
  const areas = [{ location: 'Santo Domingo', count: 1027 }, { location: 'Punta Cana', count: 965 }, { location: 'An unknown place', count: 7 }]
  const points = areaSummaryPoints(areas)
  assert.deepEqual(clone(points.map(item => item.location)), ['Santo Domingo', 'Punta Cana'])
  assert.equal(points.reduce((sum, item) => sum + item.count, 0), 1992)
  assert.equal(points[0].point.lat, 18.4861)
  assert.equal(areas.reduce((sum, item) => sum + item.count, 0) - points.reduce((sum, item) => sum + item.count, 0), 7)
  assert.equal(Object.hasOwn(points[0], 'id'), false)
  const coincident = areaSummaryPoints([{ location: 'Santo Domingo', count: 1027 }, { location: 'Distrito Nacional', count: 1 }])
  assert.equal(coincident.length, 1)
  assert.equal(coincident[0].count, 1028)
  assert.deepEqual(clone(coincident[0].locations), ['Santo Domingo', 'Distrito Nacional'])
})

test('thousands of exact property positions create a bounded marker set without dropping members', () => {
  const items = Array.from({ length: 5000 }, (_, index) => ({ id: String(index), latitude: 17.5 + index % 100 * 0.025, longitude: -72 + Math.floor(index / 100) * 0.075 }))
  const groups = clusterMapListings(items, 18)
  assert.ok(groups.length <= 160)
  assert.equal(groups.reduce((sum, group) => sum + group.items.length, 0), 5000)
  assert.equal(new Set(groups.flatMap(group => group.items.map(item => item.id))).size, 5000)
  const viewport = clusterMapListings(items, 14, { south: 18.4, north: 18.6, west: -70.1, east: -69.9 })
  assert.ok(viewport.flatMap(group => group.items).every(item => item.latitude >= 18.4 && item.latitude <= 18.6 && item.longitude >= -70.1 && item.longitude <= -69.9))
  assert.equal(clusterMapListings(items.slice(0, 20), 18, null, 1).length, 1)
})

test('map requests retain all listing filters and comparable price settings without card pagination', async () => {
  let requested
  const client = { get: async (url, options) => { requested = { url, ...options }; return { data: { items: [{ id: 'test', price: '123.45' }], total: 1 } } } }
  client.default = client
  const moduleState = { exports: {} }
  const source = fs.readFileSync(path.resolve(__dirname, '../apps/landing/src/api/listings.ts'), 'utf8')
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText,
    { exports: moduleState.exports, module: moduleState, require: id => { assert.equal(id, './axios'); return client } })
  const response = await moduleState.exports.fetchListingMap({ page: 4, pageSize: 24, purpose: 'rent', locations: ['Cabarete', 'Sosúa'], types: ['Villa', 'Condo'], minPrice: 100, maxPrice: 2000, beds: 2, minRoi: 4, features: ['Pool'], priceCurrency: 'USD', usdToDop: 60, rentalPeriod: 'month' }, { south: 18, north: 20, west: -71, east: -68 })
  assert.equal(requested.url, '/listings/map')
  assert.deepEqual(clone(requested.params.types), ['villa', 'condo'])
  assert.deepEqual(clone(requested.params.locations), ['Cabarete', 'Sosúa'])
  assert.deepEqual(clone(requested.params.features), ['Pool'])
  assert.equal(requested.params.price_currency, 'USD')
  assert.equal(requested.params.usd_to_dop, 60)
  assert.equal(requested.params.rental_period, 'month')
  assert.equal(requested.params.south, 18)
  assert.equal(Object.hasOwn(requested.params, 'page'), false)
  assert.equal(Object.hasOwn(requested.params, 'page_size'), false)
  assert.equal(response.items[0].price, 123.45)
})
