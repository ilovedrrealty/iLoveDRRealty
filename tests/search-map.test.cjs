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
const { listingMapPoint, mappedListings, areaSummaryPoints, clusterAreaSummaries, clusterMapListings } = loadFile(path.resolve(__dirname, '../apps/landing/src/data/searchMap.ts'))
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

test('approximate areas cluster across neighbouring grid boundaries and keep the largest known centre', () => {
  const areas = [{ location: 'Cabarete', count: 9 }, { location: 'Sosúa', count: 57 }, { location: 'Puerto Plata', count: 17 }]
  const overview = clusterAreaSummaries(areas, 8)
  assert.equal(overview.length, 1)
  assert.equal(overview[0].primaryLocation, 'Sosúa')
  assert.deepEqual(clone(overview[0].point), { lat: 19.7517, lng: -70.5168 })
  assert.equal(overview[0].count, 83)
  assert.deepEqual(clone(overview[0].locations).sort(), ['Cabarete', 'Puerto Plata', 'Sosúa'].sort())
  assert.equal(overview[0].distinctCentres, true)
  const detailed = clusterAreaSummaries(areas, 13)
  assert.equal(detailed.length, 3)
  assert.equal(detailed.reduce((sum, area) => sum + area.count, 0), 83)
})

test('area counts and filter members survive every zoom without fabricated anchors or overlapping bubbles', () => {
  const { REGION_COORDS } = loadFile(path.resolve(__dirname, '../apps/landing/src/data/searchData.ts'))
  const areas = Object.keys(REGION_COORDS).map((location, index) => ({ location, count: index + 1 }))
  const expected = areas.reduce((sum, area) => sum + area.count, 0)
  const pixels = (point, zoom) => {
    const scale = 256 * 2 ** zoom, latitude = point.lat * Math.PI / 180
    return { x: (point.lng + 180) / 360 * scale, y: (1 - Math.log(Math.tan(Math.PI / 4 + latitude / 2)) / Math.PI) / 2 * scale }
  }
  for (const zoom of [6, 7, 8, 9, 11, 14, 20]) {
    const groups = clusterAreaSummaries([...areas, { location: 'Unknown district', count: 100 }], zoom)
    assert.equal(groups.reduce((sum, group) => sum + group.count, 0), expected)
    assert.deepEqual(clone(groups.flatMap(group => group.locations)).sort(), areas.map(area => area.location).sort())
    for (const group of groups) assert.deepEqual(clone(group.point), clone(REGION_COORDS[group.primaryLocation]))
    for (let a = 0; a < groups.length; a++) for (let b = a + 1; b < groups.length; b++) {
      const one = pixels(groups[a].point, zoom), two = pixels(groups[b].point, zoom)
      assert.ok(Math.hypot(one.x - two.x, one.y - two.y) >= 66 - 0.00001)
    }
  }
})

test('identical known centres retain all stored area filters and require filtering rather than zooming forever', () => {
  for (const zoom of [6, 20]) {
    const groups = clusterAreaSummaries([{ location: 'Distrito Nacional', count: 1 }, { location: 'Santo Domingo', count: 1027 }], zoom)
    assert.equal(groups.length, 1)
    assert.equal(groups[0].count, 1028)
    assert.equal(groups[0].primaryLocation, 'Santo Domingo')
    assert.equal(groups[0].distinctCentres, false)
    assert.deepEqual(clone(groups[0].locations), ['Santo Domingo', 'Distrito Nacional'])
  }
})
