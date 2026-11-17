const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const ts = require('typescript')

const root = path.resolve(__dirname, '../apps/dashboard/src')
const plain = value => JSON.parse(JSON.stringify(value))
const lead = '00000000-0000-4000-8000-000000000021'
const listing = '00000000-0000-4000-8000-000000000022'
const comparable = '00000000-0000-4000-8000-000000000023'
const followUp = '00000000-0000-4000-8000-000000000024'
const subject = { property_type: 'condo', location: 'Synthetic neighborhood', area_m2: '83.20', bedrooms: 0, bathrooms: '1.5', condition: 'good' }
const draft = { lead_id: lead, version: 0, started: false, intake_subject: null, subject, comparables: [], review: null, follow_ups: [] }
const base = `/staff/leads/${lead}/valuation`

function load(file, dependencies) {
  const filename = path.join(root, file)
  const module = { exports: {} }
  const { outputText, diagnostics } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename, reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  })
  assert.deepEqual(diagnostics, [])
  vm.runInNewContext(outputText, { module, exports: module.exports, require: name => {
    assert.ok(Object.hasOwn(dependencies, name), name)
    return dependencies[name]
  } })
  return module.exports
}

function harness() {
  const requests = []
  const client = Object.fromEntries(['get', 'put', 'post', 'delete'].map(method => [method, async (url, ...args) => {
    requests.push([method, url, ...args])
    return { data: method === 'get' && url.endsWith('/asking-candidates') ? { items: [{ listing_id: listing }] } : draft }
  }]))
  const api = load('api/sellerValuation.ts', { './axios': client, axios: { isAxiosError: error => error?.isAxiosError === true } })
  return { api, requests }
}

test('case lookup and filtered asking candidates use the current lead and cancellable private reads', async () => {
  const { api, requests } = harness()
  const { signal } = new AbortController()
  assert.equal(await api.getSellerValuation(lead, signal), draft)
  assert.deepEqual(await api.getValuationCandidates(lead, { q: 'Synthetic', property_type: 'condo' }, signal), [{ listing_id: listing }])
  assert.equal(requests[0][1], base)
  assert.equal(requests[1][1], base + '/asking-candidates')
  assert.equal(requests[0][2].signal, signal)
  assert.equal(requests[1][2].signal, signal)
  assert.deepEqual(plain(requests[1][2].params), { q: 'Synthetic', property_type: 'condo', limit: 20 })
})

test('staff mutations preserve the captured listing vs sold evidence distinction and include exact expected versions', async () => {
  const { api, requests } = harness()
  const { signal } = new AbortController()
  const { condition, ...facts } = subject
  const sold = { ...facts, price: '7450000.50', currency: 'DOP', closed_on: '2026-10-05', source_label: 'Synthetic closing evidence', source_reference: 'Synthetic documentation ID' }
  await api.saveSellerValuation(lead, 0, subject, signal)
  await api.addValuationAsking(lead, 1, listing, signal)
  await api.addValuationSold(lead, 2, sold, signal)
  await api.reviewValuationSold(lead, 3, comparable, 'verified', 'Matched amount and date in synthetic evidence', signal)
  await api.reviewSellerValuation(lead, 4, { outcome: 'insufficient_evidence', notes: 'More current evidence is needed.' }, signal)
  await api.scheduleValuationFollowUp(lead, 5, '2026-11-30', 'Confirm additional comparable evidence.', signal)
  await api.completeValuationFollowUp(lead, 6, followUp, signal)
  await api.removeValuationComparable(lead, 7, comparable, signal)
  assert.deepEqual(plain(requests.slice(0, 7).map(request => request.slice(0, 3))), [
    ['put', base + '/draft', { expected_version: 0, subject }],
    ['post', base + '/comparables/asking', { expected_version: 1, listing_id: listing }],
    ['post', base + '/comparables/sold', { expected_version: 2, ...sold }],
    ['put', base + `/comparables/${comparable}/sold-review`, { expected_version: 3, decision: 'verified', review_note: 'Matched amount and date in synthetic evidence' }],
    ['post', base + '/review', { expected_version: 4, outcome: 'insufficient_evidence', notes: 'More current evidence is needed.' }],
    ['post', base + '/follow-ups', { expected_version: 5, follow_up_on: '2026-11-30', note: 'Confirm additional comparable evidence.' }],
    ['post', base + `/follow-ups/${followUp}/complete`, { expected_version: 6 }],
  ])
  assert.ok(requests.slice(0, 7).every(request => request[3].signal === signal))
  assert.equal(requests[7][1], base + `/comparables/${comparable}`)
  assert.deepEqual(plain(requests[7][2].params), { expected_version: 7 })
  assert.equal(requests[7][2].signal, signal)
})

test('evidence counts include only verified sales and distinguish access loss from a version conflict', () => {
  const { api } = harness()
  const items = [
    { kind: 'asking' }, { kind: 'asking' }, { kind: 'sold' }, { kind: 'sold', sold_review: { decision: 'rejected' } },
    { kind: 'sold', sold_review: { decision: 'verified' } },
  ]
  assert.deepEqual(plain(api.valuationEvidenceCounts(items)), { asking: 2, sold: 1 })
  const http = status => ({ isAxiosError: true, response: { status } })
  assert.ok([401, 403, 404].every(status => api.valuationAccessDenied(http(status))))
  assert.equal(api.valuationAccessDenied(http(409)), false)
  assert.equal(api.valuationErrorStatus(http(409)), 409)
})

test('English and Spanish workspace labels and placeholders remain aligned', () => {
  function keys(value) {
    if (typeof value === 'string') return Array.from(value.matchAll(/{{\s*(\w+)\s*}}/g), ([, parameter]) => parameter).sort()
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, keys(value[key])]))
  }
  const copy = language => JSON.parse(fs.readFileSync(path.join(root, 'locale', language, 'seller_valuation.json'), 'utf8'))
  assert.deepEqual(keys(copy('es')), keys(copy('en')))
})
