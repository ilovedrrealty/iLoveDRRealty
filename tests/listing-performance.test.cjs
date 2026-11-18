const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const { renderToStaticMarkup } = require('react-dom/server')
const { createElement } = require('react')
const ts = require('typescript')

const root = path.resolve(__dirname, '../apps/dashboard/src')
const plain = value => JSON.parse(JSON.stringify(value))
const copy = language => JSON.parse(fs.readFileSync(path.join(root, 'locale', language, 'listing_performance.json'), 'utf8'))
const listing = '00000000-0000-4000-8000-000000000031'
const request = '00000000-0000-4000-8000-000000000032'
const today = '2026-12-09'

function load(file, dependencies = {}) {
  const filename = path.join(root, file)
  const module = { exports: {} }
  const { outputText, diagnostics } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename, reportDiagnostics: true, compilerOptions: {
      target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    },
  })
  assert.deepEqual(diagnostics, [])
  vm.runInNewContext(outputText, { module, exports: module.exports, require: name => {
    if (name === 'react/jsx-runtime') return require(name)
    assert.ok(Object.hasOwn(dependencies, name), name)
    return dependencies[name]
  } })
  return module.exports
}

function harness() {
  const requests = []
  const report = {
    listing_id: listing, title: 'Synthetic property', status: 'active', can_record: false,
    range: { start: '2026-12-08', end: today, time_zone: 'America/Santo_Domingo' },
    views: { lifetime: 45, range_total: null, tracked_from: null, coverage: 'unavailable',
      days: [{ date: '2026-12-08', count: null, coverage: 'unavailable' }] },
    totals: { property_inquiries: 2, confirmed_viewings: 3, recorded_completed_showings: 0 },
    milestones: [], entries: [], milestones_truncated: false, entries_truncated: false,
  }
  const http = Object.fromEntries(['get', 'post'].map(method => [method, async (url, ...args) => {
    requests.push([method, url, ...args])
    return { data: report }
  }]))
  const axios = { isAxiosError: error => error?.isAxiosError === true }
  const management = load('api/propertyManagement.ts', { './axios': http, axios })
  const api = load('api/listingPerformance.ts', { './axios': http, './propertyManagement': management, axios })
  return { api, report, requests }
}

test('the default uses 30 inclusive Santo Domingo days and range validation honors exact limits', () => {
  const { api } = harness()
  const now = new Date('2026-12-10T03:59:59Z')
  assert.deepEqual(plain(api.initialPerformanceRange(now)), { start: '2026-11-10', end: today })
  assert.equal(api.validPerformanceRange({ start: '2026-01-01', end: '2027-01-01' }, today), true)
  assert.equal(api.validPerformanceRange({ start: '2026-01-01', end: '2027-01-02' }, today), false)
  assert.equal(api.validPerformanceRange({ start: '2026-12-10', end: '2026-12-10' }, today), true)
  assert.equal(api.validPerformanceRange({ start: '2028-01-01', end: '2028-01-02' }, today), false)
  assert.equal(api.validPerformanceRange({ start: '2026-02-29', end: '2026-03-01' }, today), false)
})

test('completed showings send the date only and owner notes require explicit sharing', () => {
  const { api } = harness()
  const fields = { date: today, note: '  Synthetic owner-safe progress  ', sharingConfirmed: true, kind: 'completed_showing' }
  assert.deepEqual(plain(api.preparePerformanceEntry(fields, request, today)), {
    request_id: request, occurred_on: today, kind: 'completed_showing',
  })
  assert.deepEqual(plain(api.preparePerformanceEntry({ ...fields, kind: 'marketing_update' }, request, today)), {
    request_id: request, occurred_on: today, kind: 'marketing_update', text: 'Synthetic owner-safe progress', share_with_owner: true,
  })
  assert.equal(api.preparePerformanceEntry({ ...fields, kind: 'owner_feedback', sharingConfirmed: false }, request, today), null)
  assert.equal(api.preparePerformanceEntry({ ...fields, kind: 'owner_feedback', note: ' '.repeat(15) }, request, today), null)
  assert.equal(api.preparePerformanceEntry({ ...fields, kind: 'owner_feedback', note: 'f'.repeat(1001) }, request, today), null)
  assert.equal(api.preparePerformanceEntry({ ...fields, date: '2026-12-10' }, request, today), null)
})

test('listing context, date bounds, cancellation and request ID go through the scoped no-estimate contract', async () => {
  const { api, report, requests } = harness()
  const { signal } = new AbortController()
  const bounds = { start: '2026-12-08', end: today }
  const entry = { request_id: request, occurred_on: today, kind: 'completed_showing' }
  assert.equal(await api.getListingPerformance(listing, bounds, signal), report)
  await api.recordListingPerformance(listing, entry, signal)
  await api.recordListingPerformance(listing, entry, signal)
  const resource = `/listings/${listing}/performance`
  assert.deepEqual(requests[0].slice(0, 2), ['get', resource])
  assert.deepEqual(plain(requests[0][2].params), bounds)
  assert.equal(requests[0][2].signal, signal)
  assert.equal(requests[1][1], resource + '/entries')
  assert.equal(requests[1][3].signal, signal)
  assert.deepEqual(requests[1], requests[2])
  const err = status => ({ isAxiosError: true, response: { status } })
  assert.ok([401, 403, 404].every(status => api.performanceAccessDenied(err(status))))
  assert.equal(api.performanceAccessDenied(err(409)), false)
})

test('visible report distinguishes lifetime requests, unavailable dated counts, confirmed and completed', () => {
  const { report } = harness()
  const dictionary = copy('en')
  const t = key => key.split('.').reduce((value, part) => value?.[part], dictionary) ?? key
  const { ListingPerformanceReport } = load('components/listings/ListingPerformanceReport.tsx', {
    'react-i18next': { useTranslation: () => ({ t, i18n: { language: 'en' } }) },
    '../network/NetworkShared': { NetworkDate: ({ value }) => value },
  })
  const html = renderToStaticMarkup(createElement(ListingPerformanceReport, { report }))
  assert.match(html, /Lifetime view requests<\/dt><dd[^>]*>45<\/dd>/)
  assert.match(html, /Tracked view requests<\/dt><dd[^>]*>Unavailable<\/dd>/)
  assert.match(html, /Confirmed appointments<\/dt><dd[^>]*>3<\/dd>/)
  assert.match(html, /Recorded completed showings<\/dt><dd[^>]*>0<\/dd>/)
  assert.doesNotMatch(html, /revenue|profit|estimated price/i)
})

test('the workspace keeps all labels paired in English and Spanish', () => {
  function keys(value) {
    return typeof value === 'string' ? [] : Object.fromEntries(Object.keys(value).sort().map(key => [key, keys(value[key])]))
  }
  assert.deepEqual(keys(copy('es')), keys(copy('en')))
})
