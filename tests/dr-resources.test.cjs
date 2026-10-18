const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const source = fs.readFileSync(require('node:path').resolve(__dirname, '../packages/website-settings/src/drResources.ts'), 'utf8')
const moduleState = { exports: {} }
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS,
} }).outputText, { exports: moduleState.exports, module: moduleState, URL, Set })
const { RECOMMENDED_DR_TOOLS: tools, publicWebsiteResources, recommendedDRToolsToAdd, safePublicResourceUrl } = moduleState.exports
const clone = value => JSON.parse(JSON.stringify(value))
const resource = (id, patch = {}) => ({ ...clone(tools[0]), id, url: 'https://example.com/' + id, ...patch })

test('curated collection separates public and specialist links with bilingual copy', () => {
  assert.equal(tools.length, 27)
  assert.equal(tools.filter(tool => tool.access === 'public').length, 22)
  assert.equal(new Set(tools.map(tool => tool.id)).size, tools.length)
  for (const tool of tools) {
    assert.equal(safePublicResourceUrl(tool.url), true, tool.url)
    for (const field of ['title', 'description', 'category']) {
      assert.ok(tool[field].en.trim()); assert.ok(tool[field].es.trim())
    }
  }
})

test('public collection excludes restricted, hidden and unsafe links and deduplicates', () => {
  const settings = {
    resources: [resource('guide'), resource('hidden', { enabled: false })],
    realtorTools: [
      resource('private', { access: 'realtor' }),
      resource('duplicate', { access: 'public', url: 'https://example.com/guide#read' }),
      resource('public', { access: 'public' }),
      resource('unsafe', { access: 'public', url: 'javascript:alert(1)' }),
    ],
  }
  assert.deepEqual(clone(publicWebsiteResources(settings).map(item => item.id)), ['guide', 'public'])
  assert.deepEqual(clone(publicWebsiteResources({})), [])
})

test('import preserves existing edits, disabled records, access and alternate ids for an existing URL', () => {
  const edited = { ...clone(tools[0]), enabled: false, title: { en: 'My edit', es: 'Mi cambio' }, access: 'realtor' }
  const sameUrl = { ...clone(tools[1]), id: 'owner-existing', url: tools[1].url + '#details' }
  const existing = [edited, sameUrl]
  const before = JSON.stringify(existing)
  const additions = recommendedDRToolsToAdd(existing)
  assert.equal(additions.length, 25)
  assert.equal(additions.some(item => item.id === tools[0].id || item.id === tools[1].id), false)
  assert.equal(JSON.stringify(existing), before)
  assert.equal(recommendedDRToolsToAdd([...existing, ...clone(additions)]).length, 0)
})

test('public link validation rejects credentials, local addresses, tokens and encoded controls', () => {
  for (const value of [
    'http://example.com', 'https://user:pass@example.com', 'https://localhost', 'https://127.0.0.1',
    'https://foo.internal', 'https://example.com:8443', 'https://example.com/?token=secret',
    'https://example.com/%0a', 'https://example.com/bad path', 'https:\\\\example.com',
  ]) assert.equal(safePublicResourceUrl(value), false, value)
  assert.equal(safePublicResourceUrl('https://example.com/service?lang=es'), true)
})

test('a hidden public resource remains hidden when importing the recommended tool collection', () => {
  const hiddenResource = { ...clone(tools[0]), id: 'owner-hidden-resource', enabled: false }
  delete hiddenResource.access; delete hiddenResource.mode
  const resources = [hiddenResource]
  const additions = recommendedDRToolsToAdd([...resources, ...[]])
  assert.equal(additions.some(item => item.url === hiddenResource.url), false)
  assert.equal(publicWebsiteResources({ resources, realtorTools: additions }).some(item => item.url === hiddenResource.url), false)
})
