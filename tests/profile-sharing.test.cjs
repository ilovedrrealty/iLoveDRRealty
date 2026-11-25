const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
function load(file, globals = {}, imports = {}) {
  const module = { exports: {} }
  const result = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    fileName: file, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  })
  vm.runInNewContext(result.outputText, { module, exports: module.exports, URL, URLSearchParams, Date, ...globals,
    require: id => { if (Object.hasOwn(imports, id)) return imports[id]; throw new Error(`Unexpected import: ${id}`) } })
  return module.exports
}
const plain = value => JSON.parse(JSON.stringify(value))
const sharing = load('packages/sharing/index.ts')
const links = load('packages/dashboard-links/index.ts')
const id = '00000000-0000-4000-8000-000000000071'
const cases = [
  ['member', '71', '/property-network?tab=people&member=71', 'member_profile=71', 'property-network'],
  ['professional', id, `/professional-directory?profile=${id}`, `professional_profile=${id}`, 'professional-directory'],
  ['contact', id, `/trade-contacts?workspace=admin&contact=${id}`, `trade_contact=${id}`, 'trade-contacts'],
]

test('shared profile links use canonical origins, fixed opaque paths and no browser/preview host', () => {
  for (const [kind, value, target] of cases) {
    assert.equal(sharing.profileSharePath(kind, value), target)
    assert.equal(sharing.canonicalShareUrl(undefined, target, 'https://app.ilovedrrealty.com'), 'https://app.ilovedrrealty.com' + target)
    assert.equal(sharing.canonicalShareUrl('https://canonical.example.com/', target, 'https://app.ilovedrrealty.com'), 'https://canonical.example.com' + target)
    for (const bad of ['http://localhost:4175', 'javascript:alert(1)', 'https://u:p@example.com', 'https://preview.example.com/?return=other', 'not a URL'])
      assert.equal(sharing.canonicalShareUrl(bad, target, 'https://app.ilovedrrealty.com'), 'https://app.ilovedrrealty.com' + target)
  }
  for (const bad of ['0', '01', '-1', '1000000000', 'user@example.com', '//evil.example']) assert.equal(sharing.profileSharePath('member', bad), null)
  for (const kind of ['professional', 'contact']) for (const bad of ['name', 'x@example.com', '../users', id + '&email=private@example.com']) assert.equal(sharing.profileSharePath(kind, bad), null)
  for (const bad of ['//evil.example', 'https://evil.example', '/users?name=private', '/team#member-x?email=private', '/trade-contacts?contact=' + id])
    assert.equal(sharing.canonicalShareUrl(undefined, bad, 'https://app.ilovedrrealty.com'), null)
  assert.equal(sharing.teamSharePath('amiel'), '/team#member-amiel')
  assert.equal(sharing.teamSharePath('<img>'), null)
})

test('manual email, WhatsApp and native link payload are the same generic message with no recipient or private metadata', () => {
  const url = 'https://app.ilovedrrealty.com' + cases[2][2], title = 'Private contact on iLoveDRRealty'
  const payload = sharing.linkSharePayload(url, title), drafts = sharing.linkComposeLinks(url, title)
  assert.deepEqual(plain(payload), { title, text: title + '\n' + url })
  const email = new URL(drafts.email), whatsapp = new URL(drafts.whatsapp)
  assert.equal(email.pathname, '')
  assert.equal(email.searchParams.get('body'), payload.text)
  assert.deepEqual([...email.searchParams.keys()], ['subject', 'body'])
  assert.equal(whatsapp.origin, 'https://wa.me')
  assert.equal(whatsapp.pathname, '/')
  assert.equal(whatsapp.searchParams.get('text'), payload.text)
  assert.deepEqual([...whatsapp.searchParams.keys()], ['text'])
  assert.equal(sharing.linkComposeLinks(url, 'X\r\nBcc: private@example.com'), null)
  assert.equal(sharing.linkSharePayload('javascript:alert(1)', title), null)
})

test('signed-out links round trip through one narrowly validated authentication intent', () => {
  for (const [, , target, hint, view] of cases) {
    assert.equal(links.dashboardLoginHint(view, new URL(target, 'https://app.example').searchParams), '?' + hint)
    assert.equal(links.dashboardDestination(new URLSearchParams(hint)), target)
    assert.deepEqual(plain(links.profileAuthParams(new URLSearchParams(hint))), Object.fromEntries(new URLSearchParams(hint)))
    for (const other of ['shortlist=' + id, 'viewing=' + id, 'viewing_shortlist=' + id, 'shortlist_scope=owned', 'join=professional', 'directory=professionals', 'professional_profile=' + id]) {
      assert.equal(links.dashboardDestination(new URLSearchParams(hint + '&' + other)), null)
    }
    assert.equal(links.dashboardDestination(new URLSearchParams(hint + '&' + hint)), null)
    assert.equal(links.dashboardDestination(new URLSearchParams(hint + '&return_url=https://evil.example')), target)
  }
  for (const hint of ['member_profile=0', 'member_profile=01', 'member_profile=1000000000', 'professional_profile=not-a-uuid', 'trade_contact=https://evil.example'])
    assert.equal(links.dashboardDestination(new URLSearchParams(hint)), null)
})

function authHarness(search) {
  const store = new Map(), window = { location: { search } }
  const sessionStorage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) }
  const api = load('apps/landing/src/lib/professionalJoin.ts', { window, sessionStorage }, { '../../../../packages/dashboard-links': links })
  return { api, window, store }
}
test('Login, Signup and verification retain only typed targets with a one-hour expiry and clear them after use', () => {
  for (const [, , target, hint] of cases) {
    const h = authHarness('?' + hint)
    assert.deepEqual(plain(h.api.professionalAuthParams()), Object.fromEntries(new URLSearchParams(hint)))
    h.window.location.search = '?email=synthetic@example.com'
    assert.deepEqual(plain(h.api.professionalAuthParams()), Object.fromEntries(new URLSearchParams(hint)))
    assert.equal(h.api.dashboardAfterAuth('https://app.example.com'), 'https://app.example.com' + target)
    assert.equal(h.store.size, 0)
    assert.equal(h.api.dashboardAfterAuth('https://app.example.com'), 'https://app.example.com')
  }
  const h = authHarness('?member_profile=71'); h.api.professionalAuthParams()
  h.store.set('ildr.shared-profile.v1', JSON.stringify({ at: Date.now() - 3600001, hint: { member_profile: '71' } }))
  h.window.location.search = ''
  assert.equal(h.api.dashboardAfterAuth('https://app.example.com'), 'https://app.example.com')
  h.store.set('ildr.shared-profile.v1', JSON.stringify({ at: Date.now(), hint: { return_url: 'https://evil.example' } }))
  assert.equal(h.api.dashboardAfterAuth('https://app.example.com'), 'https://app.example.com')
})

test('contact deep links fetch exactly the validated private ID and preserve abort signals', async () => {
  const calls = [], entry = { id, name: 'Synthetic private contact' }, signal = new AbortController().signal
  const api = load('apps/dashboard/src/api/tradeContacts.ts', {}, { './axios': { get: async (...args) => { calls.push(args); return { data: entry } } } })
  assert.deepEqual(plain(await api.getTradeContact(id.toUpperCase(), signal)), entry)
  assert.equal(calls[0][0], '/admin/trade-contacts/' + id)
  assert.equal(calls[0][1].signal, signal)
  for (const bad of ['not-an-id', id + '?name=private', '../users']) await assert.rejects(api.getTradeContact(bad))
  assert.equal(calls.length, 1)
})

test('contact names retain complete supported registry names without expanding the shared field set', () => {
  const source = fs.readFileSync(path.join(root, 'apps/dashboard/src/lib/contactShare.ts'), 'utf8')
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
    { module, exports: module.exports, require: id => { assert.equal(id, 'libphonenumber-js'); return { parsePhoneNumberFromString: () => null } } })
  assert.equal(module.exports.shareableContact({ name: 'A'.repeat(184), source_details: { private: 'PRIVATE' } }).name.length, 184)
  assert.deepEqual(Object.keys(module.exports.shareableContact({ name: 'A', notes: 'PRIVATE' })).sort(), ['email', 'name', 'phone'])
})
