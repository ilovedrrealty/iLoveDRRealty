const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const load = (file, dependencies = {}) => {
  const module = { exports: {} }
  const { outputText, diagnostics } = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    fileName: file,
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  })
  assert.deepEqual(diagnostics, [])
  vm.runInNewContext(outputText, { module, exports: module.exports, URL, URLSearchParams, require: name => {
    assert.ok(Object.hasOwn(dependencies, name), name)
    return dependencies[name]
  } })
  return module.exports
}

const dashboard = 'apps/dashboard/src'
const siteUrls = load(`${dashboard}/lib/siteUrls.ts`)
const normalize = value => JSON.parse(JSON.stringify(value))
const slug = 'synthetic-neighborhood'
const id = '00000000-0000-4000-8000-000000000001'
const source = { label: 'Public map', url: 'https://example.org/verified-map' }
const state = { id, slug, kind: 'guide', version: 3, draft_revision: 2, reviewed_revision: null, published_revision: null }

function harness() {
  const calls = []
  const replies = []
  const client = Object.fromEntries(['get', 'post', 'put'].map(method => [method, async (...args) => {
    calls.push([method, ...args])
    return { data: replies.shift() }
  }]))
  const api = load(`${dashboard}/api/editorial.ts`, {
    './axios': client,
    '../lib/siteUrls': siteUrls,
    '../data/websiteEditorDefaults': {
      isPublicHttps(url) {
        try {
          const value = new URL(url)
          return value.protocol === 'https:' && value.hostname === 'example.org' && !value.username && !value.password
        } catch { return false }
      },
    },
  })
  return { api, calls, replies }
}

test('admin requests are scoped to the selected entry and explicitly page private index and history', async () => {
  const { api, calls, replies } = harness()
  const { signal } = new AbortController()
  const draft = api.blankEditorialDraft()
  const detail = { ...state, ...draft }
  const revision = { revision: 1, saved_at: '2026-11-17T14:30:00Z' }
  replies.push({ items: [{ ...state, title: '' }] }, detail, { items: [revision] }, { ...draft, revision: 1 })
  assert.equal((await api.listEditorial(2, signal))[0].id, id)
  assert.equal(await api.getEditorial(id, signal), detail)
  assert.equal((await api.listEditorialRevisions(id, 3, signal))[0], revision)
  assert.equal((await api.previewEditorialRevision(id, 1, signal)).revision, 1)
  assert.deepEqual(calls.map(([method, location, options]) => [method, location, normalize(options.params ?? null)]), [
    ['get', '/admin/editorial', { page: 2, page_size: 20 }],
    ['get', `/admin/editorial/${id}`, null],
    ['get', `/admin/editorial/${id}/revisions`, { page: 3, page_size: 20 }],
    ['get', `/admin/editorial/${id}/revisions/1/preview`, null],
  ])
  assert.ok(calls.every(call => call[2].signal === signal))
})

test('draft and lifecycle requests send the precise compare-and-swap payloads', async () => {
  const { api, calls } = harness()
  const { signal } = new AbortController()
  const draft = api.blankEditorialDraft()
  draft.content.en.title = 'Partial draft'
  await api.createEditorial(slug, 'guide', draft, signal)
  await api.saveEditorialDraft(id, 3, draft, signal)
  await api.changeEditorialStatus(id, 4, { action: 'review', revision: 2 }, signal)
  await api.changeEditorialStatus(id, 5, { action: 'publish', revision: 2 }, signal)
  await api.changeEditorialStatus(id, 6, { action: 'unpublish' }, signal)
  await api.changeEditorialStatus(id, 7, { action: 'restore', revision: 1 }, signal)
  assert.deepEqual(normalize(calls.map(call => call.slice(0, 3))), normalize([
    ['post', '/admin/editorial', { slug, kind: 'guide', ...draft }],
    ['put', `/admin/editorial/${id}/draft`, { expected_version: 3, ...draft }],
    ['post', `/admin/editorial/${id}/review`, { expected_version: 4, revision: 2 }],
    ['post', `/admin/editorial/${id}/publish`, { expected_version: 5, revision: 2 }],
    ['post', `/admin/editorial/${id}/unpublish`, { expected_version: 6 }],
    ['post', `/admin/editorial/${id}/restore`, { expected_version: 7, revision: 1 }],
  ]))
  assert.ok(calls.every(call => call[3].signal === signal))
})

test('review needs both complete translations and a source while publication requires the exact reviewed revision', () => {
  const { api } = harness()
  const doc = { ...state, ...api.blankEditorialDraft() }
  const text = { title: 'A guide', summary: 'Short summary', body: 'Longer body' }
  const flags = options => normalize(api.editorialActions({ ...doc, ...options }))
  assert.deepEqual(flags({}), { review: false, publish: false, unpublish: false })
  assert.equal(flags({ content: { en: text, es: { ...text, body: '  \n' } }, sources: [source] }).review, false)
  doc.content = { en: text, es: text }
  assert.equal(flags({}).review, false)
  doc.sources = [source]
  assert.deepEqual(flags({ published_revision: 1, reviewed_revision: 1 }), { review: true, publish: false, unpublish: true })
  assert.deepEqual(flags({ published_revision: 1, reviewed_revision: 2 }), { review: false, publish: true, unpublish: true })
  assert.deepEqual(flags({ published_revision: 2, reviewed_revision: 2 }), { review: false, publish: false, unpublish: true })
})

test('source validation drops blank rows and rejects incomplete or invalid links', () => {
  const { api } = harness()
  assert.deepEqual(normalize(api.normalizeEditorialSources([{ label: ' ', url: '' }, { label: ' Public map ', url: source.url }])), [source])
  for (const invalid of [
    [{ label: '', url: source.url }],
    [{ label: source.label, url: 'http://example.org/' }],
    [{ label: source.label, url: 'https://user:secret@example.org/' }],
    [{ label: source.label, url: 'https://example.org/' + 'a'.repeat(800) }],
    [{ label: source.label, url: 'https://example.org/unsafe\\' }],
    Array(9).fill(source),
  ]) assert.equal(api.normalizeEditorialSources(invalid), null)
})

test('public links stay on the configured landing origin and carry only the slug and chosen language', () => {
  const { api } = harness()
  assert.equal(api.publicEditorialLink(slug, 'es', 'https://preview.example.org/path'), `https://preview.example.org/local-guides/read/?slug=${slug}&lang=es`)
  assert.equal(api.publicEditorialLink(slug, 'en', undefined), `https://ilovedrrealty.com/local-guides/read/?slug=${slug}&lang=en`)
})

test('the editorial vocabulary and interpolation parameters match in both locales', () => {
  function translations(lang) {
    return JSON.parse(fs.readFileSync(path.join(root, dashboard, 'locale', lang, 'editorial.json'), 'utf8'))
  }
  function shape(value) {
    return typeof value === 'string'
      ? [...value.matchAll(/{{\s*(\w+)\s*}}/g)].map(([, key]) => key).sort()
      : Object.fromEntries(Object.keys(value).sort().map(key => [key, shape(value[key])]))
  }
  assert.deepEqual(shape(translations('es')), shape(translations('en')))
})
