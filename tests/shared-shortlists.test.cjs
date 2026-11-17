const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { test } = require('node:test')
const vm = require('node:vm')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const source = read('apps/dashboard/src/api/shortlists.ts')
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText
const documentId = '00000000-0000-4000-8000-000000000001'
const grantId = '00000000-0000-4000-8000-000000000002'
const listingId = '00000000-0000-4000-8000-000000000003'
const expiry = '2026-11-24T19:00:00Z'
const fields = { title: 'North coast', shared_notes: 'Near the beach', shared_preferences: 'Three bedrooms' }
const listing = { id: listingId, title: 'Synthetic villa', location: 'Cabarete', transaction: 'sale' }
const owned = { ...fields, id: documentId, version: 2, items: [listing], share: null }
const received = { ...fields, id: grantId, version: 2, items: [listing], expires_at: expiry }
const plain = value => JSON.parse(JSON.stringify(value))

function load() {
  const module = { exports: {} }
  const calls = []
  let response = {}
  const client = Object.fromEntries(['get', 'post', 'put'].map(method => [method, async (...args) => {
    calls.push([method, ...args])
    return response
  }]))
  vm.runInNewContext(code, { URL, module, exports: module.exports, require: id => {
    assert.equal(id, './axios')
    return client
  } })
  return { api: module.exports, calls, reply: (data, status = 200, cache = 'no-store') => {
    response = { data, status, headers: { 'cache-control': cache } }
  } }
}

test('named account code accepts the number shown in Settings and rejects broad searches or invalid numbers', () => {
  const { api } = load()
  assert.equal(api.shortlistMemberCode(' #0000071 '), 71)
  assert.equal(api.shortlistMemberCode('71'), 71)
  for (const invalid of ['004b', 'client@example.com', '0', '@realtor', '##71', '-71', '2147483648']) {
    assert.equal(api.shortlistMemberCode(invalid), null)
  }
})

test('a private link holds the grant UUID and uses the fixed dashboard route', () => {
  const { api } = load()
  assert.equal(api.shortlistShareUrl('https://app.example.com/bookings', grantId), `https://app.example.com/shortlists?grant=${grantId}`)
  assert.throws(() => api.shortlistShareUrl('https://app.example.com', '%2F%2Fother.example.com'), /Invalid shortlist grant/)
  assert.ok(Number.isNaN(api.shortlistExpiryAt('2026-11-24T19:00:00')))
  assert.equal(api.shortlistExpiryAt('2026-11-24T15:00:00-04:00'), Date.parse(expiry))
})

test('draft writes include the selected IDs only after an explicit change', () => {
  const { api } = load()
  assert.deepEqual(plain(api.prepareShortlist(fields)), fields)
  assert.deepEqual(plain(api.prepareShortlist(fields, [])), { ...fields, listing_ids: [] })
  assert.deepEqual(plain(api.prepareShortlist(fields, [listingId])), { ...fields, listing_ids: [listingId] })
  assert.equal(api.prepareShortlist(fields, [listingId, listingId]), null)
  assert.equal(api.prepareShortlist({ ...fields, title: ' ' }), null)
  assert.ok(api.prepareShortlist({ ...fields, shared_notes: '🌴'.repeat(2000) }))
  assert.equal(api.prepareShortlist({ ...fields, shared_notes: '🌴'.repeat(2001) }), null)
})

test('scoped reads require no-store and project only the explicit public and shared fields', async () => {
  const h = load()
  const controller = new AbortController()
  h.reply({ ...received, owner_email: 'should not display', items: [{ ...listing, private_notes: 'should not display' }] })
  assert.deepEqual(plain(await h.api.readReceivedShortlist(grantId, controller.signal)), received)
  assert.deepEqual(h.calls[0].slice(0, 2), ['get', `/shortlists/received/${grantId}`])
  assert.equal(h.calls[0][2].signal, controller.signal)
  h.reply({ ...received, id: documentId })
  await assert.rejects(h.api.readReceivedShortlist(grantId, controller.signal), /Invalid shortlist response/)
  h.reply(received, 200, 'private')
  await assert.rejects(h.api.readReceivedShortlist(grantId, controller.signal), /Invalid shortlist response/)
  h.reply({ items: [{ id: grantId, title: fields.title, expires_at: null }] })
  await assert.rejects(h.api.listShortlists('received', controller.signal), /Invalid shortlist response/)
})

test('owner and recipient calls encode roles in the route and preserve the version contract', async () => {
  const h = load()
  h.reply(owned, 201)
  await h.api.createShortlist({ ...fields, listing_ids: [listingId] })
  h.reply(owned)
  await h.api.editOwnedShortlist(documentId, 1, fields)
  h.reply(received)
  await h.api.editReceivedShortlist(grantId, 1, { ...fields, listing_ids: [] })
  const share = { id: grantId, recipient_user_code: 71, expires_at: expiry, state: 'active' }
  h.reply({ ...owned, share })
  assert.deepEqual(plain((await h.api.shareShortlist(documentId, 71, 7)).share), share)
  h.reply({ ...owned, share: { ...share, state: 'revoked' } })
  assert.equal((await h.api.revokeShortlist(documentId, grantId)).share.state, 'revoked')
  h.reply(undefined, 204)
  await h.api.archiveShortlist(documentId, 2)
  assert.deepEqual(plain(h.calls), [
    ['post', '/shortlists/owned', { ...fields, listing_ids: [listingId] }],
    ['put', `/shortlists/owned/${documentId}`, { ...fields, expected_version: 1 }],
    ['put', `/shortlists/received/${grantId}`, { ...fields, listing_ids: [], expected_version: 1 }],
    ['post', `/shortlists/owned/${documentId}/share`, { recipient_user_code: 71, expires_in_days: 7 }],
    ['post', `/shortlists/owned/${documentId}/shares/${grantId}/revoke`, {}],
    ['post', `/shortlists/owned/${documentId}/archive`, { expected_version: 2 }],
  ])
})

test('property picker reads the paginated public catalogue and excludes unrelated data', async () => {
  const h = load()
  const controller = new AbortController()
  h.reply({ items: [{ ...listing, draft: 'ignore irrelevant response fields' }], total: 27 })
  assert.deepEqual(plain(await h.api.shortlistCatalog(2, controller.signal)), { items: [listing], total: 27 })
  assert.equal(h.calls[0][1], '/listings')
  assert.equal(h.calls[0][2].signal, controller.signal)
  assert.deepEqual(plain(h.calls[0][2].params), { page: 2, page_size: 20, include_aggregates: false })
})

test('English and Spanish messages cover the same shortlist controls', () => {
  const messages = language => JSON.parse(read(`apps/dashboard/src/locale/${language}/common.json`)).shortlists
  const en = messages('en')
  const es = messages('es')
  assert.deepEqual(Object.keys(en).sort(), Object.keys(es).sort())
  for (const key of ['title', 'shared_notes', 'shared_preferences', 'unavailable', 'copy_link', 'confirm_revoke']) {
    assert.ok(en[key].trim())
    assert.ok(es[key].trim())
  }
})
