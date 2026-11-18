const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { createHash } = require('node:crypto')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const clone = value => JSON.parse(JSON.stringify(value))
function load(relative, imports = {}) {
  const compiled = ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), {
    fileName: relative, compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  })
  const exports = {}
  vm.runInNewContext(compiled.outputText, { exports, URL, URLSearchParams, require(name) {
    assert.ok(Object.hasOwn(imports, name), `Missing leaf adapter: ${name}`)
    return imports[name]
  } })
  return exports
}
const area = (area_key = 'DO:sosua', record_count = 2) => ({ area_key, label: 'Sosúa', latitude: 19.75, longitude: -70.52,
  reference_country_code: 'DO', precision: 'area_reference', purpose: 'service_area', source_kind: 'existing_area_catalog',
  source_reference: 'apps/landing/src/data/searchData.ts@7ec86e649fa1830fa159274759e22212035469bb', area_kind: 'popular_locality', record_count })
const summary = () => ({ total: 3, mapped_total: 2, unmapped_total: 1, complete: true,
  areas: [area(), { ...area('DO:cabarete', 1), label: 'Cabarete', longitude: -70.41 }],
  catalog: { id: 'existing-dr-area-references-v1', reference_country_code: 'DO',
    source_reference: 'apps/landing/src/data/searchData.ts@7ec86e649fa1830fa159274759e22212035469bb', purpose: 'approximate_area_references' } })
function api(data = summary()) {
  const calls = []
  const client = { get: async (...args) => { calls.push(args); return { data } } }
  return { ...load('apps/dashboard/src/api/directoryMaps.ts', { './axios': { __esModule: true, default: client } }), calls }
}

test('area summaries retain distinct totals when professionals serve multiple areas', () => {
  const { readDirectoryMap } = api()
  assert.deepEqual(clone(readDirectoryMap(summary())), summary())
  const valid = summary()
  valid.areas[1].record_count = 2
  assert.equal(readDirectoryMap(valid).mapped_total, 2)
  assert.equal(readDirectoryMap({ ...summary(), total: 0, mapped_total: 0, unmapped_total: 0, areas: [] }).total, 0)
  const international = summary()
  international.catalog.reference_country_code = 'CA'
  international.areas[0] = { ...international.areas[0], reference_country_code: 'CA', latitude: 43.65, longitude: -79.38 }
  international.areas[1].reference_country_code = null
  assert.deepEqual(clone(readDirectoryMap(international)), international)
})

test('map reader refuses private record payloads, exact-office claims and incomplete or inconsistent aggregates', () => {
  const { readDirectoryMap } = api()
  for (const change of [value => { value.records = [{ name: 'PRIVATE' }] }, value => { value.areas[0].email = 'private@example.com' },
    value => { value.areas[0].precision = 'exact_office' }, value => { value.total++ }, value => { value.complete = false },
    value => { value.areas[0].latitude = NaN }, value => { value.areas[0].longitude = 181 },
    value => { value.areas.push(value.areas[0]) }, value => { value.areas[0].record_count = 4 },
    value => { value.catalog.reference_country_code = 'ca' }, value => { value.areas[0].reference_country_code = 'CAN' }]) {
    const value = summary(); change(value)
    assert.throws(() => readDirectoryMap(value), /Invalid directory map response/)
  }
})

test('Admin list and aggregate map send identical applied filters without map pagination', async () => {
  const a = api(), calls = []
  const client = { get: async (...args) => { calls.push(args); return { data: { items: [], total: 3 } } } }
  const contacts = load('apps/dashboard/src/api/tradeContacts.ts', { './axios': { __esModule: true, default: client } })
  const signal = new AbortController().signal
  const filters = { q: 'pump & filter', category: 'Piscinas', subtype: 'Maintenance', province: 'Puerto Plata', locality: 'Sosúa',
    service_area: 'North coast', verification_status: 'owner_source', contact_channel: 'phone', map_area: 'DO:sosua', location_status: 'mapped' }
  await contacts.listTradeContacts(filters, 50, signal)
  await a.getTradeContactMap(filters, signal)
  const { limit, offset, ...listed } = clone(calls[0][1].params)
  assert.deepEqual(clone(a.calls[0][1].params), listed)
  assert.equal(limit, 50); assert.equal(offset, 50)
  assert.equal(a.calls[0][0], '/admin/trade-contacts/map')
  assert.equal(a.calls[0][1].signal, signal)
  assert.equal(Object.hasOwn(a.calls[0][1].params, 'offset'), false)
})

test('member map uses the authenticated member endpoint with repeated category and area keys', async () => {
  const a = api(), axios = require('axios'), signal = new AbortController().signal
  await a.getProfessionalMap({ q: '', category: ['pool_service', 'plumbing'], area: ['sosua', 'cabarete'], language: 'es',
    map_area: '', location_status: 'all', offset: 48, limit: 24 }, signal)
  const [url, options] = a.calls[0]
  assert.equal(url, '/professionals/map'); assert.equal(options.signal, signal)
  const parsed = new URL(axios.getUri({ url, ...options }), 'https://example.com')
  assert.deepEqual(parsed.searchParams.getAll('category'), ['pool_service', 'plumbing'])
  assert.deepEqual(parsed.searchParams.getAll('area'), ['sosua', 'cabarete'])
  for (const key of ['offset', 'limit', 'map_area', 'location_status', 'q']) assert.equal(parsed.searchParams.has(key), false)
  assert.equal(Object.hasOwn(options, 'withCredentials'), false)
})

const geometry = load('apps/dashboard/src/lib/directoryMapGeometry.ts')
test('actual public-domain geography is unchanged and coordinate projection respects the current viewport', () => {
  const bytes = fs.readFileSync(path.join(root, 'apps/dashboard/src/data/natural-earth-countries-110m-v5.1.2.json'))
  assert.equal(createHash('sha256').update(bytes).digest('hex'), '0e63cc1512ccfd5a6b9febe578abff1588e74fdb2cc735c31c2f8fd3ad93bfa5')
  const data = JSON.parse(bytes)
  assert.equal(data.features.length, 177)
  const dominicanRepublic = data.features.find(feature => feature.properties.code === 'DOM')
  assert.ok(geometry.countryPath(dominicanRepublic.geometry).startsWith('M'))
  const bounds = geometry.directoryMapViews.dominican_republic
  assert.deepEqual(clone(geometry.mapPoint(bounds.north, bounds.west, bounds)), { left: 0, top: 0 })
  assert.deepEqual(clone(geometry.mapPoint(bounds.south, bounds.east, bounds)), { left: 100, top: 100 })
  assert.equal(geometry.mapPoint(90, 0, bounds), null)
  assert.equal(geometry.mapPoint(NaN, -70, bounds), null)
})

function elements(node) {
  if (!node || typeof node !== 'object') return []
  if (Array.isArray(node)) return node.flatMap(elements)
  return [node, ...elements(node.props?.children)]
}
test('real map component renders geographic paths and both pointer and keyboard-native area controls', () => {
  const actions = [], jsx = (type, props) => ({ type, props })
  const component = load('apps/dashboard/src/components/shared/DirectoryAreaMap.tsx', {
    react: { useId: () => 'synthetic-map', useState: initial => [initial, () => {}] },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-i18next': { useTranslation: () => ({ t: (key, options) => options ? `${key}:${JSON.stringify(options)}` : key }) },
    '../../data/natural-earth-countries-110m-v5.1.2.json': { __esModule: true, default: JSON.parse(fs.readFileSync(path.join(root, 'apps/dashboard/src/data/natural-earth-countries-110m-v5.1.2.json'))) },
    '../../lib/directoryMapGeometry': geometry,
    './ProfessionalFields': { professionalButton: 'button', professionalPrimary: 'primary' },
  })
  const tree = elements(component.DirectoryAreaMap({ summary: summary(), selectedArea: '', locationStatus: 'all',
    onArea: key => actions.push(['area', key]), onLocationStatus: status => actions.push(['location', status]), onClear: () => actions.push(['clear']) }))
  assert.equal(tree.filter(node => node.type === 'path').length, 177)
  const buttons = tree.filter(node => node.type === 'button')
  const markers = buttons.filter(node => String(node.props['aria-label']).startsWith('area_button:'))
  assert.equal(markers.length, 2)
  assert.ok(markers.every(node => node.props.type === 'button'))
  markers[0].props.onClick()
  const areaChoices = buttons.filter(node => node.props.className.includes('!justify-start'))
  areaChoices[1].props.onClick()
  const group = tree.find(node => node.props?.role === 'group' && node.props['aria-label'] === 'location_filter')
  const choices = elements(group).filter(node => node.type === 'button')
  choices[2].props.onClick(); choices[3].props.onClick()
  assert.deepEqual(actions, [['area', 'DO:sosua'], ['area', 'DO:cabarete'], ['location', 'unmapped'], ['clear']])
})

test('both languages explain area precision, overlapping service counts and unmapped records', () => {
  const copies = ['en', 'es'].map(language => JSON.parse(fs.readFileSync(path.join(root, `apps/dashboard/src/locale/${language}/professionals.json`))).directory_map)
  const paths = value => Object.entries(value).flatMap(([key, child]) => child && typeof child === 'object' ? paths(child).map(path => `${key}.${path}`) : [key]).sort()
  assert.deepEqual(paths(copies[0]), paths(copies[1]))
  for (const copy of copies) for (const key of ['help', 'scope_help', 'multiple_help', 'reference_source', 'no_references', 'clear_area', 'clear_all']) assert.ok(copy[key])
})
