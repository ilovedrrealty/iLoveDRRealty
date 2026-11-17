const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const { renderToStaticMarkup } = require('react-dom/server')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const landing = 'apps/landing/src'
const id = '00000000-0000-4000-8000-000000000005'
const listing = {
  id, title: 'Synthetic residence', description: 'Synthetic source content', transaction: 'sale',
  construction_status: 'completed', currency: 'DOP', price: '8437500.00', location: 'Synthetic location',
  images: [], share_image_url: null, bedrooms: 2, bathrooms: 2, area_sqft: 1200, tag: null, tags: [], updated_at: null,
}

function load(file, imports = {}, fetch = () => { throw new Error('Unexpected request') }) {
  const source = fs.readFileSync(path.join(root, landing, file), 'utf8')
  const module = { exports: {} }
  const { outputText, diagnostics } = ts.transpileModule(source, { fileName: file, reportDiagnostics: true, compilerOptions: {
    target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } })
  assert.deepEqual(diagnostics, [])
  vm.runInNewContext(outputText, {
    module, exports: module.exports, URL, Date, fetch, process: { env: { NEXT_PUBLIC_API_URL: 'https://api.example.test/' } },
    require: name => {
      if (name === 'react/jsx-runtime') return require(name)
      assert.ok(Object.hasOwn(imports, name), name)
      return imports[name]
    },
  })
  return module.exports
}

test('public inventory uses the listing UUID without cached or authenticated reads and tolerates withdrawals', async () => {
  const calls = []
  const results = [
    { status: 200, ok: true, json: async () => ({ listing_id: id, revision: 1 }) },
    { status: 404, ok: false },
    { status: 200, ok: true, json: async () => ({ listing_id: 'unrelated-id', revision: 1 }) },
    { status: 503, ok: false },
  ]
  const api = load('api/developmentInventory.ts', {}, async (url, options) => {
    calls.push({ url, options })
    return results.shift()
  })
  const { signal } = new AbortController()
  assert.equal((await api.fetchDevelopmentInventory(id, signal)).revision, 1)
  assert.equal(await api.fetchDevelopmentInventory(id, signal), null)
  assert.equal(await api.fetchDevelopmentInventory(id, signal), null)
  await assert.rejects(api.fetchDevelopmentInventory(id, signal), /inventory unavailable/)
  for (const { url, options } of calls) {
    assert.equal(url, `https://api.example.test/listings/${id}/development`)
    assert.equal(options.signal, signal)
    assert.equal(options.credentials, 'omit')
    assert.equal(options.cache, 'no-store')
  }
})

test('a displayed availability snapshot expires at midnight in Santo Domingo and honors server unconfirmed status', () => {
  const api = load('api/developmentInventory.ts')
  const snapshot = { availability_current: true, availability_valid_through: '2026-12-09' }
  assert.equal(api.developmentAvailabilityEnd(snapshot.availability_valid_through), Date.parse('2026-12-10T04:00:00Z'))
  assert.equal(api.developmentAvailabilityCurrent(snapshot, Date.parse('2026-12-10T03:59:59.999Z')), true)
  assert.equal(api.developmentAvailabilityCurrent(snapshot, Date.parse('2026-12-10T04:00:00Z')), false)
  assert.equal(api.developmentAvailabilityCurrent({ ...snapshot, availability_current: false }, Date.parse('2026-12-09T15:00:00Z')), false)
})

test('floor plan links require HTTPS and no embedded credentials', () => {
  const api = load('api/developmentInventory.ts')
  assert.equal(api.developmentFloorPlanHref('https://example.test/developer/101.pdf'), 'https://example.test/developer/101.pdf')
  for (const value of [null, 'http://example.test/plan.pdf', '//example.test/plan.pdf', 'javascript:alert(1)', 'https://x:secret@example.test/plan.pdf']) {
    assert.equal(api.developmentFloorPlanHref(value), null)
  }
})

test('the listing route retains canonical URLs and ordinary currency while omitting static stock and undeveloped unit pricing', async () => {
  function route(item) {
    return load('app/listing/[id]/page.tsx', {
      '../../../lib/listingExport': {},
      '../../../views/PropertyDetail': { __esModule: true, default: () => null },
    }, async () => ({ ok: true, json: async () => item }))
  }
  const context = { params: Promise.resolve({ id }) }
  const ordinary = route(listing)
  const metadata = await ordinary.generateMetadata(context)
  assert.equal(metadata.title, '2BR Synthetic residence · RD$8,437,500')
  assert.equal(metadata.alternates.canonical, `https://ilovedrrealty.com/listing/${id}/`)
  const ordinaryHtml = renderToStaticMarkup(await ordinary.default(context))
  assert.match(ordinaryHtml, /"priceCurrency":"DOP"/)
  assert.doesNotMatch(ordinaryHtml, /InStock|availability/)
  for (const construction_status of ['pre_construction', 'Under-Construction']) {
    const development = route({ ...listing, construction_status })
    assert.equal((await development.generateMetadata(context)).title, '2BR Synthetic residence')
    const html = renderToStaticMarkup(await development.default(context))
    assert.doesNotMatch(html, /InStock|"offers"|8437500/)
  }
})

test('development vocabulary and placeholders match in both listing locales', () => {
  const dictionaries = ['en', 'es'].map(lang => JSON.parse(fs.readFileSync(path.join(root, landing, 'locales', lang, 'property_detail.json'), 'utf8')).development)
  function describe(value) {
    if (typeof value === 'string') return Array.from(value.matchAll(/{{\s*(\w+)\s*}}/g), ([, name]) => name).sort()
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, describe(value[key])]))
  }
  assert.deepEqual(describe(dictionaries[1]), describe(dictionaries[0]))
})
