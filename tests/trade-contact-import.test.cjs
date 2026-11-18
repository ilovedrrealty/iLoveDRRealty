const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { File } = require('node:buffer')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const source = fs.readFileSync(path.join(root, 'apps/dashboard/src/api/tradeContacts.ts'), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS,
} }).outputText

function load(data = {}) {
  const calls = []
  const client = Object.fromEntries(['get', 'post'].map(method => [method, async (...args) => {
    calls.push([method, ...args]); return { data }
  }]))
  const module = { exports: {} }
  vm.runInNewContext(compiled, { module, exports: module.exports, FormData, URL, require(name) {
    assert.equal(name, './axios'); return { __esModule: true, default: client }
  } })
  return { ...module.exports, calls }
}
const clone = value => JSON.parse(JSON.stringify(value))
const entry = { name: 'Synthetic trade', category: 'Plomería', source_authority: 'Synthetic owner source',
  source_url: 'https://example.com/private-reference', verified_on: '2026-11-18', verification_status: 'owner_source' }

test('existing JSON arrays and entries objects keep source evidence and phone text', () => {
  const api = load()
  for (const value of [[entry], { entries: [{ ...entry, phone: '+18095550123' }] }]) {
    const parsed = clone(api.readTradeContactFile('\ufeff' + JSON.stringify(value)))
    assert.equal(parsed.entries.length, 1)
    assert.equal(parsed.entries[0].source_url, entry.source_url)
    assert.equal(parsed.entries[0].verification_status, 'owner_source')
    if (!Array.isArray(value)) assert.equal(parsed.entries[0].phone, '+18095550123')
  }
  assert.equal(api.readTradeContactFile(JSON.stringify([{ ...entry, unknown_field: 'denied' }])).error, 'invalid_row')
  assert.equal(api.readTradeContactFile(JSON.stringify(Array(251).fill(entry))).error, 'too_many_rows')
})

test('structured filters are explicit read-only parameters with cancellation', async () => {
  const api = load({ items: [], total: 0 }), signal = new AbortController().signal
  const filters = { q: 'pool', category: 'Piscinas', province: 'Puerto Plata', locality: 'Cabarete',
    verification_status: 'owner_source', contact_channel: 'phone' }
  await api.listTradeContacts(filters, 50, signal)
  assert.equal(api.calls.length, 1)
  assert.equal(api.calls[0][0], 'get')
  assert.equal(api.calls[0][1], '/admin/trade-contacts')
  assert.deepEqual(clone(api.calls[0][2].params), { ...filters, limit: 50, offset: 50 })
  assert.equal(api.calls[0][2].signal, signal)
})

test('file analysis sends multipart data and a worksheet without importing anything', async () => {
  const api = load(), signal = new AbortController().signal
  const file = new File(['name,phone\nExample,+12025550123'], 'contacts.csv', { type: 'text/csv' })
  await api.analyzeTradeContactFile(file, 'Contactos', 'semicolon', signal)
  assert.equal(api.calls.length, 1)
  const [method, url, data, options] = api.calls[0]
  assert.equal(method, 'post')
  assert.equal(url, '/admin/trade-contacts/preview-file')
  assert.ok(data instanceof FormData)
  assert.equal(data.get('file').name, 'contacts.csv')
  assert.equal(data.get('sheet'), 'Contactos')
  assert.equal(data.get('delimiter'), 'semicolon')
  assert.equal(options.signal, signal)
  assert.equal(options.headers, undefined)
})

test('column review preserves mappings and shared evidence independently of final confirmation', async () => {
  const response = { entries: [entry], issues: [], issue_count: 0, result: { inserted: 1, updated: 0, unchanged: 0 } }
  const api = load(response), signal = new AbortController().signal
  const table = { columns: ['Nombre'], rows: [{ row_number: 2, values: [entry.name] }],
    file_sha256: 'a'.repeat(64), sheets: [], sheet: null, suggested_mapping: { name: 0 } }
  const mapping = { name: 0 }, defaults = { category: entry.category, source_url: entry.source_url }
  assert.equal(await api.previewTradeContactMapping(table, mapping, defaults, signal), response)
  assert.equal(api.calls.length, 1)
  assert.equal(api.calls[0][1], '/admin/trade-contacts/preview-mapping')
  assert.deepEqual(clone(api.calls[0][2]), { table, mapping, defaults })
  assert.equal(api.calls[0][3].signal, signal)
  await api.importTradeContacts([entry], false)
  assert.equal(api.calls[1][1], '/admin/trade-contacts/import')
  assert.deepEqual(clone(api.calls[1][2]), { dry_run: false, entries: [entry] })
})

test('both languages expose filters, mapping errors and explicit review/confirmation', () => {
  const locales = ['en', 'es'].map(language => JSON.parse(fs.readFileSync(
    path.join(root, `apps/dashboard/src/locale/${language}/admin.json`), 'utf8')).trade_contacts_page)
  for (const copy of locales) {
    for (const field of ['locality', 'verification_status', 'contact_channel']) assert.ok(copy.filters[field])
    for (const field of ['match_columns', 'shared_fields', 'source_help', 'issue_count', 'row_issue']) assert.ok(copy.file_mapping[field])
    for (const code of ['formula_cells', 'xlsx_expansion', 'unsupported_file', 'utf8_required']) assert.ok(copy.errors[code])
    assert.ok(copy.preview && copy.confirm_import && copy.review_note)
  }
  assert.deepEqual(Object.keys(locales[0].file_mapping).sort(), Object.keys(locales[1].file_mapping).sort())
  assert.deepEqual(Object.keys(locales[0].errors).sort(), Object.keys(locales[1].errors).sort())
})
