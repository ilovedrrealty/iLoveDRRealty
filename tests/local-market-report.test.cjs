const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const { createElement } = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const ts = require('typescript')

const base = path.resolve(__dirname, '../apps/landing/src')
const plain = value => JSON.parse(JSON.stringify(value))

function load(name, imports = {}, fetch) {
  const filename = path.join(base, name)
  const out = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename, reportDiagnostics: true, compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    },
  })
  assert.deepEqual(out.diagnostics, [])
  const module = { exports: {} }
  vm.runInNewContext(out.outputText, {
    module, exports: module.exports, Intl, Date, URLSearchParams, fetch,
    process: { env: { NEXT_PUBLIC_API_URL: 'https://api.example.test/api/' } },
    require: dependency => {
      assert.ok(Object.hasOwn(imports, dependency), dependency)
      return imports[dependency]
    },
  })
  return module.exports
}

const catalog = load('data/searchLocations.ts', {
  './searchData': load('data/searchData.ts', { '../design': { c: {} } }),
})
const region = 'Sosúa'
const villa = {
  property_type: 'villa', currency: 'USD', listing_count: 3, price_count: 2, size_count: 1,
  price_min: '210000.00', price_median: '210000.005', price_max: '210000.01',
  median_price_per_sqm: '1200.00', area_basis: 'living',
}
const land = {
  property_type: 'land', currency: 'DOP', listing_count: 2, price_count: 0, size_count: 0,
  price_min: null, price_median: null, price_max: null, median_price_per_sqm: null, area_basis: 'lot',
}
const snapshot = changes => ({
  as_of: '2026-11-18T02:30:00.125334Z', local_date: '2026-11-17', location: region,
  total_listings: 6, unclassified_currency_count: 1, groups: [villa, land], ...changes,
})
const response = (body, ok = true) => ({ ok, json: async () => body })
const api = fetch => load('api/marketReports.ts', { '../data/searchLocations': catalog }, fetch)

test('anonymous current requests use the exact fixed route and one catalogue region', async () => {
  const calls = []
  const { signal } = new AbortController()
  const client = api(async (url, options) => {
    calls.push(url)
    assert.equal(options.signal, signal)
    assert.deepEqual(plain(options), { cache: 'no-store', credentials: 'omit', redirect: 'error', signal: {} })
    return response(snapshot({ location: url.includes('?') ? region : null }))
  })
  assert.equal((await client.getMarketReport(null, signal)).location, null)
  const report = await client.getMarketReport(region, signal)
  assert.equal(report.local_date, '2026-11-17')
  assert.equal(report.groups[0].price_median, '210000.005')
  assert.equal(report.groups[1].price_min, null)
  await assert.rejects(client.getMarketReport('Sosua', signal), /Invalid market report/)
  await assert.rejects(client.getMarketReport('Sosúa&location=Cabarete', signal), /Invalid market report/)
  assert.deepEqual(calls, [
    'https://api.example.test/api/site/market-reports',
    'https://api.example.test/api/site/market-reports?location=Sos%C3%BAa',
  ])
  assert.equal(client.marketReportLink('es', region), '/local-guides/market-report/?lang=es&location=Sos%C3%BAa')
  assert.equal(client.marketReportSearchLink(region), '/search/?purpose=sale&location=Sos%C3%BAa')
  assert.equal(client.marketReportSearchLink(null), '/search/?purpose=sale')
})

test('native currencies, exact prices, area definitions and sample counts are validated together', async () => {
  const { signal } = new AbortController()
  for (const unsafe of [
    snapshot({ location: 'Cabarete' }),
    snapshot({ local_date: '2026-11-18' }),
    snapshot({ as_of: '2026-11-18T02:30:00' }),
    snapshot({ total_listings: 5 }),
    snapshot({ listing_contact: 'UNEXPECTED' }),
    snapshot({ groups: [villa, villa], total_listings: 7 }),
    ...[
      { currency: 'EUR' }, { area_basis: 'lot' }, { listing_count: 0 }, { size_count: 3 },
      { price_median: 210000.005 }, { price_median: '210000.03' }, { price_min: '0.00' },
      { median_price_per_sqm: null }, { size_count: 0, median_price_per_sqm: '0.00' },
    ].map(overrides => snapshot({ groups: [{ ...villa, ...overrides }, land] })),
  ]) await assert.rejects(api(async () => response(unsafe)).getMarketReport(region, signal), /Invalid market report/)
  const zeroRatio = await api(async () => response(snapshot({ groups: [{ ...villa, median_price_per_sqm: '0.00' }, land] })))
    .getMarketReport(region, signal)
  assert.equal(zeroRatio.groups[0].median_price_per_sqm, '0.00')
  const empty = await api(async () => response(snapshot({ total_listings: 0, unclassified_currency_count: 0, groups: [] })))
    .getMarketReport(region, signal)
  assert.deepEqual(plain(empty.groups), [])
})

test('display keeps exact fractional midpoints without converting USD or DOP values', () => {
  const { formatMarketMoney } = api()
  assert.match(formatMarketMoney('9999999999.985', 'USD', 'en'), /^USD\s9,999,999,999\.985$/)
  assert.match(formatMarketMoney('100000.000', 'DOP', 'en'), /^DOP\s100,000\.00$/)
  assert.match(formatMarketMoney('0.00', 'DOP', 'es'), /DOP.*0[.,]00/)
})

test('localized results show separate currency regions, priced and sized sample counts, and unavailable values', () => {
  const translations = Object.fromEntries(['en', 'es'].map(locale => [locale, Object.fromEntries(['blog', 'search'].map(namespace => [
    namespace, JSON.parse(fs.readFileSync(path.join(base, 'locales', locale, namespace + '.json'), 'utf8')),
  ]))]))
  const view = load('views/LocalMarketReport.tsx', {
    react: require('react'), 'react/jsx-runtime': require('react/jsx-runtime'),
    'next/link': ({ children, href }) => createElement('a', { href }, children), 'next/navigation': {},
    'react-i18next': { useTranslation: (namespace, options) => ({
      t(key, params) {
        const prefix = options?.keyPrefix
        const dictionary = translations[params.lng][namespace]
        const value = (prefix ? [prefix, ...key.split('.')] : key.split('.')).reduce((entry, part) => entry?.[part], dictionary)
        const result = value ?? dictionary[prefix]?.[key + (params.count === 1 ? '_one' : '_other')]
        assert.equal(typeof result, 'string', key)
        return result.replace(/\{\{(\w+)\}\}/g, (_, param) => String(params[param]))
      },
    }) },
    '../api/editorial': {}, '../api/marketReports': api(), '../data/searchLocations': catalog,
  })
  const english = renderToStaticMarkup(createElement(view.MarketReportSnapshot, { report: snapshot(), locale: 'en' }))
  assert.match(english, /id="market-currency-USD"[^>]*>USD/)
  assert.match(english, /id="market-currency-DOP"[^>]*>DOP/)
  assert.match(english, /USD\s210,000\.005/)
  assert.match(english, /Listings with a usable asking price<\/dt><dd[^>]*>2/)
  assert.match(english, /Listings used for price per m²<\/dt><dd[^>]*>1/)
  assert.match(english, /No asking prices are available for this group/)
  assert.match(english, /\/search\/\?purpose=sale&amp;location=Sos%C3%BAa/)
  assert.match(english, /Median asking price per m² · Living area/)
  assert.match(english, /Median asking price per m² · Lot area/)
  const spanish = renderToStaticMarkup(createElement(view.MarketReportSnapshot, { report: snapshot(), locale: 'es' }))
  assert.match(spanish, /Área habitable/)
  assert.match(spanish, /Área del terreno/)
  assert.match(spanish, /Buscar propiedades en venta en Sosúa/)
})
