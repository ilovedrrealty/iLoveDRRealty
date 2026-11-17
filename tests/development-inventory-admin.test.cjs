const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { test } = require('node:test')
const vm = require('node:vm')
const ts = require('typescript')

const sourceRoot = path.resolve(__dirname, '../apps/dashboard/src')
const listingId = '10000000-0000-0000-0000-000000000001'
const root = `/admin/developments/${listingId}`
const clone = value => JSON.parse(JSON.stringify(value))

function loadApi() {
  const calls = []
  const result = { listing_id: listingId, version: 0, draft: null, published: null }
  const request = method => async (url, ...args) => {
    calls.push({ method, url, args })
    return { data: result }
  }
  const client = { get: request('get'), put: request('put'), post: request('post') }
  const source = fs.readFileSync(path.join(sourceRoot, 'api/developments.ts'), 'utf8')
  const built = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  })
  const module = { exports: {} }
  vm.runInNewContext(built.outputText, { module, exports: module.exports, require(id) {
    assert.equal(id, './axios')
    return client
  } })
  return { api: module.exports, calls, result }
}

test('only active sale and dual-purpose listings expose the development editor entry', () => {
  const { api } = loadApi()
  assert.equal(api.canManageDevelopment({ status: 'active', transaction: 'sale' }), true)
  assert.equal(api.canManageDevelopment({ status: 'active', transaction: 'both' }), true)
  for (const fields of [
    { status: 'active', transaction: 'rent' }, { status: 'pending', transaction: 'sale' },
    { status: 'archived', transaction: 'sale' }, { status: 'inactive', transaction: 'both' },
  ]) assert.equal(api.canManageDevelopment(fields), false)
})

test('Admin read and private revision preview are both scoped to the same listing', async () => {
  const { api, calls, result } = loadApi()
  const signal = new AbortController().signal
  assert.equal(await api.getDevelopment(listingId, signal), result)
  assert.equal(await api.getDevelopmentRevision(listingId, 3, signal), result)
  assert.deepEqual(calls.map(call => [call.method, call.url]), [
    ['get', root], ['get', `${root}/revisions/3`],
  ])
  assert.ok(calls.every(call => call.args[0].signal === signal))
})

test('saving a draft preserves the private evidence and supplies the expected version', async () => {
  const { api, calls } = loadApi()
  const signal = new AbortController().signal
  const draft = {
    project: { name_en: 'Synthetic development', phases: [] },
    evidence: { source_reference: 'Synthetic private verification', private_note: 'Admin only' },
  }
  await api.saveDevelopmentDraft(listingId, 0, draft, signal)
  assert.deepEqual(clone(calls[0].args[0]), { expected_version: 0, ...draft })
  assert.equal(calls[0].method, 'put')
  assert.equal(calls[0].url, `${root}/draft`)
  assert.equal(calls[0].args[1].signal, signal)
})

test('review and publication pin a revision, while withdrawal pins only the saved version', async () => {
  const { api, calls } = loadApi()
  const signal = new AbortController().signal
  await api.changeDevelopmentStatus(listingId, 8, { action: 'review', revision: 3 }, signal)
  await api.changeDevelopmentStatus(listingId, 9, { action: 'publish', revision: 3 }, signal)
  await api.changeDevelopmentStatus(listingId, 10, { action: 'withdraw' }, signal)
  assert.deepEqual(clone(calls.map(({ method, url, args }) => [method, url, args[0]])), [
    ['post', `${root}/review`, { expected_version: 8, revision: 3 }],
    ['post', `${root}/publish`, { expected_version: 9, revision: 3 }],
    ['post', `${root}/withdraw`, { expected_version: 10 }],
  ])
})

test('English and Spanish editor copy have matching fields and interpolation', () => {
  const entries = language => {
    const locale = fs.readFileSync(path.join(sourceRoot, 'locale', language, 'development_inventory.json'), 'utf8')
    const output = []
    function visit(node, prefix = '') {
      if (typeof node === 'string') output.push([prefix, [...node.matchAll(/\{\{(\w+)\}\}/g)].map(match => match[1]).sort()])
      else for (const [key, value] of Object.entries(node)) visit(value, prefix ? `${prefix}.${key}` : key)
    }
    visit(JSON.parse(locale))
    return output
  }
  assert.deepEqual(entries('en'), entries('es'))
})
