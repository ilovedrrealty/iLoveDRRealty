// Synthetic helper and actual-generator regressions; no live API requests.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const root = path.resolve(__dirname, '..')
const ts = require('typescript')
const source = fs.readFileSync(path.join(root, 'apps/landing/src/lib/listingExport.ts'), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS,
} }).outputText
const clone = value => JSON.parse(JSON.stringify(value))
const row = n => ({ id: `10000000-0000-0000-0000-${String(n).padStart(12, '0')}`, created_at: '2026-10-25T12:00:00Z' })
const rows = (start, size) => Array.from({ length: size }, (_, i) => row(start + i))
const page = (number, total, items) => ({ page: number, page_size: 60, total, items })
function setup(responses, context = {}) {
  const module = { exports: {} }, calls = []
  vm.runInNewContext(compiled, { module, exports: module.exports, URL, Set, AbortSignal, Date, ...context })
  const fetcher = async (url, options) => {
    calls.push({ url, options })
    const next = responses.shift()
    if (next instanceof Error) throw next
    assert.ok(next, 'Unexpected extra API request')
    return { ok: true, status: 200, json: async () => next, ...next.response }
  }
  return { collect: value => module.exports.listingsForStaticExport(value, fetcher), calls }
}

test('complete60+1 pagination returns exactly61real IDs for both intended consumers', async () => {
  const fixture = [...rows(1, 60), row(61)]
  const run = setup([page(1, 61, fixture.slice(0, 60)), page(2, 61, fixture.slice(60))])
  const actual = await run.collect('https://api.example.com/')
  assert.deepEqual(clone(actual), fixture)
  assert.equal(run.calls.length, 2)
  assert.match(run.calls[1].url, /page=2&page_size=60&include_aggregates=false$/)
  assert.ok(run.calls.every(call => call.options.credentials === 'omit' && call.options.signal instanceof AbortSignal))
  const params = actual.map(item => ({ id: item.id }))
  const sitemap = actual.map(item => `https://ilovedrrealty.com/listing/${item.id}/`)
  assert.deepEqual(params.map(item => item.id), sitemap.map(url => url.split('/')[4]))
})

test('exact multiple of60 does not request an invented empty tail', async () => {
  const run = setup([page(1, 120, rows(1, 60)), page(2, 120, rows(61, 60))])
  assert.equal((await run.collect('https://api.example.com')).length, 120)
  assert.equal(run.calls.length, 2)
})

test('HTTP failure after a full first page rejects rather than publishing its partial IDs', async () => {
  const last = page(2, 61, [row(61)])
  last.response = { ok: false, status: 503 }
  const run = setup([page(1, 61, rows(1, 60)), last])
  await assert.rejects(run.collect('https://api.example.com'), /HTTP 503/)
  assert.equal(run.calls.length, 2)
})

test('network and malformedJSON failures propagate without a partial fallback', async () => {
  for (const last of [new Error('Synthetic transport failure'), {
    ...page(2, 61, [row(61)]), response: { json: async () => { throw new SyntaxError('Synthetic bad JSON') } },
  }]) {
    const run = setup([page(1, 61, rows(1, 60)), last])
    await assert.rejects(run.collect('https://api.example.com'), /Synthetic/)
  }
})

test('short nonfinal, empty premature, oversized and wrongfinal pages are refused', async () => {
  for (const data of [page(1, 61, rows(1, 59)), page(1, 61, []), page(1, 60, rows(1, 61)), page(1, 2, [row(1)])]) {
    await assert.rejects(setup([data]).collect('https://api.example.com'), /premature final-page items/)
  }
})

test('duplicate IDs within or across pages including case variants reject the build input', async () => {
  await assert.rejects(setup([page(1, 2, [row(1), row(1)])]).collect('https://api.example.com'), /duplicate/)
  const lower = { ...row(1), id: 'a0000000-0000-0000-0000-000000000001' }
  const duplicate = { ...lower, id: lower.id.toUpperCase() }
  assert.notEqual(lower.id, duplicate.id)
  await assert.rejects(setup([page(1, 61, [lower, ...rows(2, 59)]), page(2, 61, [duplicate])]).collect('https://api.example.com'), /duplicate/)
})

test('missing fields, strings, negative/noninteger totals and wrong page metadata reject', async () => {
  for (const mutation of [
    data => { delete data.total }, data => { data.total = '1' }, data => { data.total = -1 },
    data => { data.total = 1.5 }, data => { data.total = Number.MAX_SAFE_INTEGER + 1 },
    data => { data.items = null }, data => { data.page = 2 }, data => { data.page_size = 24 },
  ]) {
    const data = page(1, 1, [row(1)]); mutation(data)
    await assert.rejects(setup([data]).collect('https://api.example.com'), /pagination contract/)
  }
})

test('changed totals are refused even when secondpage would otherwise fit', async () => {
  for (const total of [60, 62]) {
    await assert.rejects(setup([page(1, 61, rows(1, 60)), page(2, total, [row(61)])]).collect('https://api.example.com'), /total changed/)
  }
})

test('malformed identifiers or creation dates cannot become routes or sitemap entries', async () => {
  for (const changes of [{ id: '' }, { id: '../fake-path' }, { id: null }, { created_at: undefined }, { created_at: 'not-a-date' }]) {
    await assert.rejects(setup([page(1, 1, [{ ...row(1), ...changes }])]).collect('https://api.example.com'), /invalid listing/)
  }
  const actual = await setup([page(1, 1, [{ ...row(1), created_at: null }])]).collect('https://api.example.com')
  assert.equal(actual[0].created_at, null)
})

test('zero and overcapacity inputs fail clearly instead of producing fake routes or truncation', async () => {
  await assert.rejects(setup([page(1, 0, [])]).collect('https://api.example.com'), /zero listings/)
  await assert.rejects(setup([page(1, 50001, rows(1, 60))]).collect('https://api.example.com'), /reviewed build capacity/)
})

test('missing or unsafe config makes no request, while exact loopback rehearsal remains supported', async () => {
  for (const base of [undefined, '', 'http://external.example.com', 'https://user:secret@example.com', 'https://api.example.com?key=value', 'https://api.example.com#fragment']) {
    const run = setup([])
    await assert.rejects(run.collect(base))
    assert.equal(run.calls.length, 0)
  }
  const run = setup([page(1, 1, [row(1)])])
  assert.equal((await run.collect('http://127.0.0.1:8900')).length, 1)
})

test('elapsed global budget prevents another page rather than an unbounded scan', async () => {
  let calls = 0
  class Clock extends Date { static now() { return calls++ === 0 ? 0 : 120001 } }
  const run = setup([], { Date: Clock })
  await assert.rejects(run.collect('https://api.example.com'), /deadline/)
  assert.equal(run.calls.length, 0)
})

test('a final page cannot succeed after parsing or validation exhausts the global budget', async () => {
  for (const expiresOnRead of [3, 4]) {
    let reads = 0
    class Clock extends Date { static now() { return ++reads >= expiresOnRead ? 120001 : 0 } }
    const run = setup([page(1, 1, [row(1)])], { Date: Clock })
    await assert.rejects(run.collect('https://api.example.com'), /deadline/)
    assert.equal(run.calls.length, 1)
  }
})

// Load only the two actual generator modules. Detail rendering and article
// inventory are unrelated to this contract; any accidental live fetch fails.
function actualGenerators(collect) {
  const calls = []
  const helper = { listingsForStaticExport: async base => {
    calls.push(base)
    return collect(base)
  } }
  function load(relative, imports) {
    const file = path.join(root, relative), module = { exports: {} }
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
      target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
    } }).outputText
    vm.runInNewContext(code, {
      module, exports: module.exports, URL, Set, Date,
      process: { env: { NEXT_PUBLIC_API_URL: 'https://api.example.com' } },
      fetch: () => { throw new Error('Live fetch is forbidden in generator regressions') },
      require: name => {
        if (Object.hasOwn(imports, name)) return imports[name]
        if (name === 'react/jsx-runtime') return require(name)
        throw new Error(`Unexpected generator import: ${name}`)
      },
    }, { filename: file, timeout: 3000 })
    return module.exports
  }
  const listing = load('apps/landing/src/app/listing/[id]/page.tsx', {
    '../../../lib/listingExport': helper,
    '../../../views/PropertyDetail': { __esModule: true, default: () => { throw new Error('Detail rendering is outside this generator test') } },
  })
  const sitemap = load('apps/landing/src/app/sitemap.ts', {
    '../lib/listingExport': helper,
    '../data/blogData': {
      ARTICLES: { 'reviewed-guide': { date: '2026-10-30' } },
      FEATURED: { slug: 'reviewed-guide' }, EDITOR_PICKS: [], GUIDES: [],
    },
    '../data/blogData.es': { ARTICLES_ES: { 'reviewed-guide': {} } },
  })
  return { params: listing.generateStaticParams, sitemap: sitemap.default, calls }
}

test('both actual generators propagate the shared-loader failure without a partial or empty fallback', async () => {
  const failure = new Error('Synthetic enumeration refusal')
  const actual = actualGenerators(async () => { throw failure })
  await assert.rejects(actual.params(), error => error === failure)
  await assert.rejects(actual.sitemap(), error => error === failure)
  assert.deepEqual(actual.calls, ['https://api.example.com', 'https://api.example.com'])
})

test('both actual generators preserve the same validated IDs and existing sitemap mapping', async () => {
  const fixture = rows(1, 2)
  const actual = actualGenerators(async () => fixture)
  assert.deepEqual(clone(await actual.params()), fixture.map(({ id }) => ({ id })))
  const sitemap = await actual.sitemap()
  const entries = clone(sitemap.filter(item => item.url.includes('/listing/')))
  assert.deepEqual(entries, fixture.map(item => ({
    url: `https://ilovedrrealty.com/listing/${item.id}/`,
    lastModified: new Date(item.created_at).toISOString(), changeFrequency: 'weekly', priority: 0.8,
  })))
  assert.deepEqual(actual.calls, ['https://api.example.com', 'https://api.example.com'])
})
