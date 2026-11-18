const assert = require('node:assert/strict')
const { File } = require('node:buffer')
const { webcrypto } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { test } = require('node:test')
const vm = require('node:vm')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const plain = value => JSON.parse(JSON.stringify(value))
const listing = '3af9fe24-263a-404d-b947-10644c1d1563'
const oldId = 'cf72dc31-ac4d-43fc-a8a1-fb67b7c1970a'
const draftId = '33209b4e-e868-4fbe-8ced-e88c19a80c0d'
const nextId = 'a00d255a-d765-440a-8f46-9845858fd130'
const adminPath = '/admin/listings/' + listing + '/floor-plan'
const publicUrl = 'https://api.example.test/listings/' + listing + '/floor-plan'
const header = { 'cache-control': 'no-store' }
const pdf = new File(['%PDF-1.7\nsynthetic exact bytes\n%%EOF'], 'example.pdf', { type: 'application/pdf' })
const asset = {
  id: draftId, content_type: pdf.type, byte_count: pdf.size,
  sha256: '3f79cbfab3d04fe70a7dcc4cdf1c9031c47966d4b3058bc8f113ce7aaf6f6325',
  created_at: '2026-11-17T09:14:01.123456Z',
}

function source(name, dependencies = {}, globals = {}) {
  const filename = path.join(root, name)
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename, reportDiagnostics: true, compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
    },
  })
  assert.deepEqual(compiled.diagnostics, [])
  const module = { exports: {} }
  vm.runInNewContext(compiled.outputText, {
    module, exports: module.exports, Blob, URL, crypto: webcrypto, ...globals,
    require(id) {
      assert.ok(Object.hasOwn(dependencies, id), id)
      return dependencies[id]
    },
  }, { filename })
  return module.exports
}

const contracts = source('packages/listing-floor-plans/index.ts')
const signal = () => new AbortController().signal

test('accept only verified media, bounded original bytes, and trusted configured API origins', async () => {
  const limit = contracts.FLOOR_PLAN_MAX_BYTES
  assert.equal(contracts.floorPlanFileType({ name: 'Floor.PNG', type: '', size: limit }), 'image/png')
  for (const entry of [
    { name: 'Floor.PNG', type: 'image/jpeg', size: 12 },
    { name: 'Floor.JPEG', type: 'image/jpeg', size: limit + 1 },
    { name: 'floor.svg', type: 'image/svg+xml', size: 12 },
    { name: 'cover.pdf', type: 'application/pdf', size: 0 },
  ]) {
    assert.equal(contracts.floorPlanFileType(entry), null)
  }
  assert.equal(contracts.floorPlanApiOrigin('http://127.0.0.1:8918/'), 'http://127.0.0.1:8918')
  assert.equal(contracts.floorPlanApiOrigin('https://api.example.test/'), 'https://api.example.test')
  assert.equal(contracts.floorPlanApiOrigin(undefined), null)
  for (const origin of ['http://api.example.test/', 'https://user:pass@api.example.test/', 'https://api.example.test/path',
    'https://api.example.test/?x=1', 'javascript:alert(1)']) assert.equal(contracts.floorPlanApiOrigin(origin), null)
  assert.deepEqual(plain(contracts.parseFloorPlanAsset(asset)), asset)
  assert.equal(contracts.parseFloorPlanAsset({ ...asset, created_at: '2026-11-17T05:14:01.123456-04:00' }).id, asset.id)
  for (const invalid of [{ ...asset, sha256: 'bogus' }, { ...asset, content_type: 'text/html' },
    { ...asset, byte_count: -1 }, { ...asset, created_at: 'not a calendar timestamp' }]) {
    assert.throws(() => contracts.parseFloorPlanAsset(invalid))
  }
  assert.throws(() => contracts.parseFloorPlanState({ draft: asset, published: asset }))
  assert.equal(await contracts.floorPlanHash(pdf, signal()), asset.sha256)
  assert.equal(await contracts.verifyFloorPlanContent(asset, pdf, 'private, no-store', signal()), pdf)
  await assert.rejects(contracts.verifyFloorPlanContent(asset, pdf, 'public, max-age=300', signal()))
  const replaced = new Blob(['x'.repeat(pdf.size)], { type: pdf.type })
  await assert.rejects(contracts.verifyFloorPlanContent(asset, replaced, 'no-store', signal()))
})

test('public lookup and exact current content are anonymous, uncached and refuse unsafe redirects or retired revisions', async () => {
  const calls = []
  const queue = [
    new Response(null, { status: 404 }),
    Response.json(asset, { headers: header }),
    new Response(pdf, { headers: { ...header, 'content-type': pdf.type, 'content-length': String(pdf.size) } }),
    new Response(null, { status: 404 }),
    new Response(pdf, { headers: { ...header, 'content-type': 'text/html' } }),
  ]
  const api = source('apps/landing/src/api/listingFloorPlans.ts', { '../../../../packages/listing-floor-plans': contracts }, {
    process: { env: { NEXT_PUBLIC_API_URL: 'https://api.example.test/' } },
    fetch(url, options) {
      calls.push({ url, options })
      return Promise.resolve(queue.shift())
    },
  })
  assert.equal(await api.getPublishedFloorPlan(listing, signal()), null)
  const current = await api.getPublishedFloorPlan(listing, signal())
  assert.deepEqual(plain(current), asset)
  assert.equal(await (await api.readPublishedFloorPlan(listing, current, signal())).text(), await pdf.text())
  assert.equal(await api.readPublishedFloorPlan(listing, current, signal()), null)
  await assert.rejects(api.readPublishedFloorPlan(listing, current, signal()))
  await assert.rejects(api.getPublishedFloorPlan('../admin', signal()))
  assert.equal(calls.length, 5)
  for (const [index, { url, options }] of calls.entries()) {
    assert.equal(url, index < 2 ? publicUrl : publicUrl + '/' + draftId + '/content')
    assert.equal(options.credentials, 'omit')
    assert.equal(options.cache, 'no-store')
    assert.equal(options.redirect, 'error')
    assert.ok(options.signal instanceof AbortSignal)
  }
})

test('Admin uses raw private draft upload and exact review receipts, then withdraws without deleting new staged work', async () => {
  const previous = { ...asset, id: oldId }
  const staged = { draft: asset, published: previous }
  const nextDraft = { ...asset, id: nextId }
  const queue = [{ data: staged }, { data: staged }, { data: pdf }, { data: { draft: null, published: asset } },
    { data: { draft: nextDraft, published: null } }, { data: staged }, { data: { draft: asset, published: null } }]
  const calls = []
  const client = Object.fromEntries(['get', 'put', 'post'].map(method => [method, async (...args) => {
    calls.push([method, ...args])
    return { headers: header, ...queue.shift() }
  }]))
  const api = source('apps/dashboard/src/api/listingFloorPlans.ts', {
    './axios': client, '../../../../packages/listing-floor-plans': contracts,
  })
  assert.deepEqual(plain(await api.readAdminFloorPlan(listing, signal())), staged)
  assert.deepEqual(plain(await api.stageAdminFloorPlan(listing, pdf, nextId, signal())), staged)
  const [, endpoint, body, settings] = calls[1]
  assert.equal(endpoint, adminPath + '/draft')
  assert.equal(body, pdf)
  assert.deepEqual(plain(settings.params), { replaces: nextId })
  assert.deepEqual(plain(settings.headers), { 'Content-Type': 'application/pdf' })
  assert.equal(await api.readAdminDraftContent(listing, asset, signal()), pdf)
  assert.equal(calls[2][1], adminPath + '/draft/' + draftId + '/content')
  assert.equal(calls[2][2].responseType, 'blob')
  assert.deepEqual(plain(await api.publishAdminFloorPlan(listing, draftId, oldId, signal())), {
    draft: null, published: asset,
  })
  assert.deepEqual(plain(calls[3][2]), { draft_id: draftId, expected_published_id: oldId, owner_permission_confirmed: true })
  assert.deepEqual(plain(await api.withdrawAdminFloorPlan(listing, draftId, signal())), { draft: nextDraft, published: null })
  assert.deepEqual(plain(calls[4][2]), { published_id: draftId })
  await assert.rejects(api.publishAdminFloorPlan(listing, draftId, oldId, signal()), /could not be verified/)
  await api.stageAdminFloorPlan(listing, pdf, null, signal())
  assert.equal(calls[6][3].params, undefined)
})

test('the normal Admin listing editor and the active exact property page mount both localized controls', () => {
  const read = name => fs.readFileSync(path.join(root, name), 'utf8')
  const admin = read('apps/dashboard/src/pages/admin/SubmitListing.tsx').split('export function AdminEditListing')[1]
  const property = read('apps/landing/src/views/PropertyDetail.tsx')
  assert.match(admin, /listing\.status === 'active' && <ListingFloorPlanEditor/)
  assert.match(property, /listing\.status === 'active' && isInquiryPropertyContext\(id, listing\.id\)[\s\S]*?<ListingFloorPlan/)
  for (const name of ['apps/dashboard/src/locale/LOCALE/admin.json', 'apps/landing/src/locales/LOCALE/property_detail.json']) {
    const english = JSON.parse(read(name.replace('LOCALE', 'en'))).floor_plan
    const spanish = JSON.parse(read(name.replace('LOCALE', 'es'))).floor_plan
    assert.deepEqual(Object.keys(english), Object.keys(spanish))
    assert.ok(Object.values(english).every(Boolean) && Object.values(spanish).every(Boolean))
  }
})
