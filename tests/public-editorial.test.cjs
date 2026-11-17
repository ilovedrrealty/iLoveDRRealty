const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const vm = require('node:vm')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const source = file => fs.readFileSync(path.join(root, file), 'utf8')
const model = {
  slug: 'synthetic-neighborhood', kind: 'neighborhood', title: 'Synthetic area',
  summary: 'An example area summary.', body: 'First paragraph.\n\nSecond paragraph.',
  sources: [{ label: 'Example source', url: 'https://source.example.test/facts' }],
  published_at: '2031-01-07T15:00:00Z', review_note: 'PRIVATE_SYNTHETIC_NOTE',
}

function api(fetch) {
  const exports = {}
  const compiled = ts.transpileModule(source('apps/landing/src/api/editorial.ts'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  })
  vm.runInNewContext(compiled.outputText, {
    exports, fetch, URL, URLSearchParams, process: { env: { NEXT_PUBLIC_API_URL: 'https://api.example.test/api/' } },
  })
  return exports
}

function response(data, status = 200) {
  return { ok: status === 200, status, json: async () => data }
}

function neighborhoodApi(fetch) {
  const shared = {}
  function compile(file) {
    return ts.transpileModule(source(file), {
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
    }).outputText
  }
  vm.runInNewContext(compile('packages/editorial-neighborhoods/index.ts'), { exports: shared })
  const exports = {}
  vm.runInNewContext(compile('apps/landing/src/api/neighborhoods.ts'), {
    exports, fetch, URL, URLSearchParams, process: { env: { NEXT_PUBLIC_API_URL: 'https://api.example.test/api/' } },
    require(name) {
      if (name === './editorial') return api(fetch)
      if (name === '../../../../packages/editorial-neighborhoods') return shared
      assert.fail(name)
    },
  })
  return exports
}

test('edition URLs get stable safe slug, language and page values', () => {
  const { editorialSlug, editorialLink } = api()
  assert.equal(editorialSlug('local-public-guide'), 'local-public-guide')
  for (const bad of ['../private', 'mixed_Case', 'route%2fadmin', 'space here', 'slug\n', 'a'.repeat(81)]) {
    assert.equal(editorialSlug(bad), null)
  }
  assert.equal(editorialLink('es', 'local-public-guide'), '/local-guides/read/?lang=es&slug=local-public-guide')
  assert.equal(editorialLink('en', undefined, 2), '/local-guides/?lang=en&page=2')
})

test('public directory uses anonymous no-store requests and whitelists the summary', async () => {
  const controller = new AbortController()
  const { listPublishedEditorial } = api(async (url, options) => {
    assert.equal(url, 'https://api.example.test/api/site/editorial?locale=es&page=3&page_size=20')
    assert.equal(options.credentials, 'omit')
    assert.equal(options.cache, 'no-store')
    assert.equal(options.redirect, 'error')
    assert.equal(options.signal, controller.signal)
    return response({ items: [model], total: 41 })
  })
  const result = await listPublishedEditorial('es', 3, controller.signal)
  assert.equal(result.total, 41)
  assert.equal(Object.keys(result.items[0]).sort().join(','), 'kind,published_at,slug,summary,title')
})

test('the same entry disappears on its next request after a published edition is withdrawn', async () => {
  let published = true
  const { getPublishedEditorial } = api(async (url, options) => {
    assert.equal(url, 'https://api.example.test/api/site/editorial/synthetic-neighborhood?locale=en')
    assert.equal(options.cache, 'no-store')
    return published ? response(model) : response({}, 404)
  })
  const signal = new AbortController().signal
  const result = await getPublishedEditorial('synthetic-neighborhood', 'en', signal)
  assert.equal(result.body, model.body)
  assert.equal(result.sources[0].url, model.sources[0].url)
  assert.equal(Object.hasOwn(result, 'review_note'), false)
  published = false
  assert.equal(await getPublishedEditorial('synthetic-neighborhood', 'en', signal), null)
})

test('unsafe evidence URLs and unrelated entry payloads fail closed', async () => {
  const signal = new AbortController().signal
  const sources = ['javascript:alert(1)', 'http://example.test/a', 'https://name:secret@example.test/a']
  for (const url of sources) {
    const { getPublishedEditorial } = api(async () => response({ ...model, sources: [{ label: 'Invalid', url }] }))
    await assert.rejects(getPublishedEditorial(model.slug, 'en', signal), /Invalid editorial data/)
  }
  const mismatch = api(async () => response({ ...model, slug: 'different-public-slug' }))
  await assert.rejects(mismatch.getPublishedEditorial(model.slug, 'en', signal), /Invalid editorial data/)
})

test('the fixed reader remains outside the sitemap and renders owner-written fields as text', () => {
  assert.match(source('apps/landing/src/app/local-guides/read/page.tsx'), /robots:\s*{\s*index:\s*false/)
  const sitemap = source('apps/landing/src/app/sitemap.ts')
  assert.ok(sitemap.includes('/local-guides/') && !sitemap.includes('/local-guides/read/'))
  const reader = source('apps/landing/src/views/Editorial.tsx')
  assert.doesNotMatch(reader, /dangerouslySetInnerHTML|\.innerHTML/)
  assert.match(reader, /getPublishedEditorial/)
})

test('published neighborhood discovery and detail use anonymous current reads and narrow projections', async () => {
  const calls = []
  const signal = new AbortController().signal
  const neighborhood = { ...model, listing_location: 'Sosúa & Cabarete' }
  const facts = [{ topic: 'access', text: 'Synthetic reviewed fact', checked_on: '2026-11-17', source: model.sources[0] }]
  let withdrawn = false
  const client = neighborhoodApi(async (url, options) => {
    calls.push(url)
    assert.equal(options.cache, 'no-store')
    assert.equal(options.credentials, 'omit')
    assert.equal(options.redirect, 'error')
    assert.equal(options.signal, signal)
    if (url.includes('/' + model.slug + '?')) return withdrawn ? response({}, 404) : response({ ...neighborhood, facts })
    return response({ items: [neighborhood], total: 21 })
  })
  const catalog = await client.listNeighborhoods('es', 2, signal)
  const detail = await client.getNeighborhood(model.slug, 'es', signal)
  assert.deepEqual(calls, [
    'https://api.example.test/api/site/neighborhoods?locale=es&page=2&page_size=20',
    'https://api.example.test/api/site/neighborhoods/synthetic-neighborhood?locale=es',
  ])
  assert.equal(Object.keys(catalog.items[0]).sort().join(','), 'listing_location,published_at,slug,summary,title')
  assert.equal(Object.keys(detail).sort().join(','), 'facts,listing_location,published_at,slug,summary,title')
  assert.equal(detail.facts[0].checked_on, '2026-11-17')
  assert.equal(detail.facts[0].source.url, model.sources[0].url)
  assert.equal(client.neighborhoodCompareLink('es'), '/local-guides/compare/?lang=es')
  assert.equal(client.neighborhoodListingLink(detail.listing_location), '/search/?location=Sos%C3%BAa+%26+Cabarete')
  assert.equal(client.neighborhoodListingLink(null), null)
  assert.equal(client.neighborhoodListingLink('x'.repeat(81)), null)
  withdrawn = true
  assert.equal(await client.getNeighborhood(model.slug, 'es', signal), null)
})

test('neighborhood source URLs, explicit calendar dates and unique supported topics are required', async () => {
  const signal = new AbortController().signal
  const fact = { topic: 'transport', text: 'Synthetic checked route', checked_on: '2026-11-17', source: model.sources[0] }
  const detail = { ...model, listing_location: null, facts: [fact] }
  for (const next of [
    { ...detail, slug: 'different-area' },
    { ...detail, facts: [] },
    { ...detail, facts: [fact, fact] },
    { ...detail, facts: [{ ...fact, topic: 'private_note' }] },
    { ...detail, facts: [{ ...fact, checked_on: '2026-04-31' }] },
    { ...detail, facts: [{ ...fact, source: { label: 'Private', url: 'https://user:token@example.org/' } }] },
  ]) await assert.rejects(neighborhoodApi(async () => response(next)).getNeighborhood(model.slug, 'en', signal))
})
