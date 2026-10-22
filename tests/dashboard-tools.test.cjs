const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function load(relativePath) {
  const source = fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8')
  const state = { exports: {} }
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS,
  } }).outputText, { exports: state.exports, module: state, URL })
  return state.exports
}
const { workspaceToolCards, canOpenToolWorkspace } = load('apps/dashboard/src/data/toolHubs.ts')
const { landingBaseUrl, deactivationRedirectUrl } = load('apps/dashboard/src/lib/siteUrls.ts')
const translations = ['en', 'es'].map(language => JSON.parse(fs.readFileSync(path.resolve(__dirname, `../apps/dashboard/src/locale/${language}/tool_hubs.json`), 'utf8')))

test('tool workspaces follow the real account role, including all Admin views', () => {
  for (const role of ['buyer', 'owner', 'realtor', 'admin']) {
    assert.equal(canOpenToolWorkspace(role, 'Buyer'), true)
    assert.equal(canOpenToolWorkspace(role, 'Owner'), role === 'owner' || role === 'admin')
    assert.equal(canOpenToolWorkspace(role, 'Realtor'), role === 'realtor' || role === 'admin')
  }
  assert.equal(workspaceToolCards('Realtor', 'buyer').length, 0)
  assert.equal(workspaceToolCards('Owner', 'realtor').length, 0)
  assert.equal(workspaceToolCards('Buyer', 'buyer').some(card => ['leads', 'listings', 'pipeline', 'research'].includes(card.view)), false)
})

test('every accessible hub has usable destinations, map or listing access and bilingual instructions', () => {
  for (const workspace of ['Buyer', 'Owner', 'Realtor']) {
    const cards = workspaceToolCards(workspace, 'admin')
    assert.ok(cards.length >= 7)
    assert.equal(new Set(cards.map(card => card.id)).size, cards.length)
    assert.ok(cards.some(card => card.view === 'professional-directory'))
    assert.ok(cards.some(card => card.view === 'resources'))
    assert.ok(cards.some(card => card.path?.startsWith('/search/') || card.view === 'listings'))
    for (const locale of translations) {
      assert.ok(locale.workspaces[workspace].title.trim())
      assert.ok(locale.workspaces[workspace].start.trim())
      for (const card of cards) {
        assert.ok(locale.cards[card.id].title.trim(), card.id)
        assert.ok(locale.cards[card.id].description.trim(), card.id)
        assert.equal(Boolean(card.view) !== Boolean(card.path), true)
      }
    }
  }
})

test('empty and invalid landing build settings cannot crash map or research links', () => {
  for (const configured of [undefined, '', '  ', 'not a URL', 'javascript:alert(1)', 'https://user:pass@example.com']) {
    assert.equal(landingBaseUrl(configured), 'https://ilovedrrealty.com')
    assert.equal(new URL('/search/', landingBaseUrl(configured)).toString(), 'https://ilovedrrealty.com/search/')
  }
  assert.equal(landingBaseUrl('https://ilovedrrealty.com/'), 'https://ilovedrrealty.com')
  assert.equal(landingBaseUrl('http://127.0.0.1:3001/'), 'http://127.0.0.1:3001')
})

test('member directory sign-in links retain their destination when the landing setting is empty', () => {
  const login = new URL('/login?directory=professionals', landingBaseUrl(''))
  assert.equal(login.origin, 'https://ilovedrrealty.com')
  assert.equal(login.pathname, '/login')
  assert.equal(login.searchParams.get('directory'), 'professionals')
  assert.equal(new URL('/login?join=professional', landingBaseUrl(undefined)).searchParams.get('join'), 'professional')
})

test('account deactivation returns to the public site without relying on the dashboard host name', () => {
  for (const configured of [undefined, '', 'not a URL', 'javascript:alert(1)', 'https://user:pass@example.com']) {
    const destination = new URL(deactivationRedirectUrl(configured))
    assert.equal(destination.origin, 'https://ilovedrrealty.com')
    assert.equal(destination.pathname, '/')
    assert.equal(destination.searchParams.get('msg'), 'deactivated')
    assert.equal(destination.searchParams.size, 1)
  }
  assert.equal(deactivationRedirectUrl('https://ilovedrrealty.com/some/path?ignored=value'), 'https://ilovedrrealty.com/?msg=deactivated')
  assert.equal(deactivationRedirectUrl('http://127.0.0.1:3001/'), 'http://127.0.0.1:3001/?msg=deactivated')
})
