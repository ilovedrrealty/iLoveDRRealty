const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const i18next = require('i18next')
const { I18nextProvider } = require('react-i18next')

const root = path.resolve(__dirname, '..')
const apiPath = path.join(root, 'apps/dashboard/src/api/propertyManagement.ts')
const clone = value => JSON.parse(JSON.stringify(value))
const LISTING = '11111111-1111-4111-8111-111111111111'
const RECORD = '22222222-2222-4222-8222-222222222222'
const locale = language => JSON.parse(fs.readFileSync(path.join(root, `apps/dashboard/src/locale/${language}/management.json`), 'utf8'))

function loadApi(response) {
  const calls = []
  const client = Object.fromEntries(['get', 'post', 'put'].map(method => [method, async (...args) => { calls.push({ method, args }); return { data: typeof response === 'function' ? response(method, ...args) : response } }]))
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(apiPath, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText, {
    module, exports: module.exports, URL, Date, Intl,
    require: name => name === 'axios' ? { isAxiosError: error => error?.isAxiosError === true } : name === './axios' ? { __esModule: true, default: client } : (() => { throw new Error('Unexpected import ' + name) })(),
  })
  return { ...module.exports, calls }
}
const api = loadApi()
function validDraft(kind) {
  const draft = api.newManagementDraft(kind, '2020-01-31')
  draft.title = 'Synthetic operational record'
  if (kind === 'lease') { draft.tenant_name = 'Synthetic tenant'; draft.rent = '1000.25' }
  if (kind === 'ledger') draft.amount = '250.15'
  return draft
}
function record(kind = 'task') {
  const body = api.managementWrite(LISTING, validDraft(kind))
  return { ...body, id: RECORD, version: 3, due_date: '2020-01-31', currency: kind === 'inspection' || kind === 'task' ? null : 'USD', amount: kind === 'lease' ? '1000.25' : kind === 'ledger' ? '250.15' : kind === 'maintenance' ? '0.00' : null, approval_status: kind === 'maintenance' ? 'pending' : 'not_required', approval_limit: null, approved_at: null, created_at: '2020-01-31T14:00:00Z', updated_at: '2020-01-31T14:00:00Z' }
}

test('DR date boundaries, leap dates and statement windows are explicit', () => {
  assert.equal(api.todayInDR(new Date('2026-10-25T03:59:59Z')), '2026-10-24')
  assert.equal(api.todayInDR(new Date('2026-10-25T04:00:00Z')), '2026-10-25')
  for (const day of ['2024-02-29', '2020-01-31', '0001-01-01']) assert.equal(api.validCalendarDate(day), true)
  for (const day of ['2023-02-29', '2020-02-31', '0000-01-01', '2020-1-01', 'not-a-date']) assert.equal(api.validCalendarDate(day), false)
  assert.equal(api.validStatementPeriod('2024-01-01', '2025-01-01'), true)
  assert.equal(api.validStatementPeriod('2024-01-01', '2025-01-02'), false)
  assert.equal(api.validStatementPeriod('2024-02-02', '2024-02-01'), false)
})

test('all five forms produce only their bounded operational fields, never approval metadata', () => {
  const allowed = {
    lease: ['notes', 'tenant_name', 'tenant_email', 'tenant_phone', 'unit_reference', 'start_date', 'end_date', 'rent', 'deposit', 'currency', 'due_day', 'first_due_date', 'first_rent', 'document_url'],
    maintenance: ['notes', 'category', 'priority', 'due_date', 'vendor_name', 'vendor_phone', 'estimated_cost', 'actual_cost', 'currency', 'requires_approval', 'progress_notes'],
    inspection: ['notes', 'inspection_type', 'due_date', 'inspector', 'checks', 'item_notes', 'evidence_links'],
    ledger: ['notes', 'direction', 'category', 'amount', 'currency', 'transaction_date', 'reference', 'lease_id', 'rent_period'],
    task: ['notes', 'category', 'due_date', 'assigned_to', 'recurrence'],
  }
  for (const kind of api.MANAGEMENT_KINDS) {
    const draft = validDraft(kind)
    assert.deepEqual(clone(api.managementDraftIssues(draft)), [])
    const payload = api.managementWrite(LISTING, draft)
    assert.deepEqual(Object.keys(payload.data).sort(), allowed[kind].sort())
    assert.equal(payload.origin_record_id, null)
    assert.ok(!JSON.stringify(payload).includes('approval_status'))
    const old = record(kind); old.origin_record_id = '33333333-3333-4333-8333-333333333333'
    assert.equal(api.managementWrite(LISTING, draft, old).origin_record_id, old.origin_record_id)
    assert.equal(api.draftFromRecord(old).kind, kind)
    assert.throws(() => api.managementWrite('bad-reference', draft))
    assert.throws(() => api.managementWrite('44444444-4444-4444-8444-444444444444', draft, old))
  }
})

test('lease validation handles first due and prorated zero rent without accepting invalid money or dates', () => {
  const draft = validDraft('lease')
  draft.status = 'active'; draft.due_day = '31'; draft.first_rent = '0'; draft.first_due_date = draft.start_date
  assert.deepEqual(clone(api.managementDraftIssues(draft)), [])
  assert.equal(api.managementWrite(LISTING, draft).data.first_rent, '0')
  for (const value of ['0', '-1', '1.001', '1e3', 'Infinity', '10000000000']) { draft.rent = value; assert.ok(api.managementDraftIssues(draft).includes('money')) }
  draft.rent = '1.00'; draft.status = 'ended'; assert.ok(api.managementDraftIssues(draft).includes('lease_dates'))
  draft.end_date = '2020-02-29'; draft.first_due_date = '2020-03-01'; assert.ok(api.managementDraftIssues(draft).includes('first_due_date'))
  draft.first_due_date = ''; draft.due_day = '32'; assert.ok(api.managementDraftIssues(draft).includes('due_day'))
  draft.due_day = '15'; draft.document_url = 'https://user:secret@example.invalid/lease'; assert.ok(api.managementDraftIssues(draft).includes('url'))
})

test('inspection completion needs all eight checks and a note for every issue', () => {
  const draft = validDraft('inspection'); draft.status = 'completed'
  assert.ok(api.managementDraftIssues(draft).includes('inspection_complete'))
  for (const key of api.INSPECTION_ITEMS) draft.checks[key] = 'pass'
  draft.checks.plumbing = 'issue'
  assert.ok(api.managementDraftIssues(draft).includes('inspection_complete'))
  draft.item_notes.plumbing = 'Synthetic leak requires review'
  assert.deepEqual(clone(api.managementDraftIssues(draft)), [])
  draft.evidence_text = 'https://example.invalid/inspection\nhttps://example.invalid/meter'
  assert.equal(api.managementWrite(LISTING, draft).data.evidence_links.length, 2)
  draft.evidence_text = Array(13).fill('https://example.invalid/test').join('\n')
  assert.ok(api.managementDraftIssues(draft).includes('evidence_links'))
  for (const url of ['http://example.invalid', 'javascript:alert(1)', 'https://example.invalid/with space', 'https://example.invalid:bad']) assert.equal(api.safeManagementUrl(url), false)
})

test('manual ledger allocations and future planned entries stay distinct from recorded receipts', () => {
  const draft = validDraft('ledger'); draft.currency = 'DOP'; draft.status = 'recorded'; draft.transaction_date = '2099-01-01'
  assert.ok(api.managementDraftIssues(draft, '2026-10-25').includes('transaction_date'))
  draft.status = 'planned'; assert.ok(!api.managementDraftIssues(draft, '2026-10-25').includes('transaction_date'))
  draft.rent_period = '2026-10'; assert.ok(api.managementDraftIssues(draft).includes('rent_period'))
  draft.lease_id = RECORD
  const payload = api.managementWrite(LISTING, draft)
  assert.equal(payload.data.rent_period, '2026-10-01'); assert.equal(payload.data.currency, 'DOP')
  draft.ledger_category = 'deposit'; assert.ok(api.managementDraftIssues(draft).includes('rent_period'))
  draft.rent_period = ''; assert.deepEqual(clone(api.managementDraftIssues(draft)), [])
})

test('private API actions send exact versions, read cancellation and no automatic mutation retries', async () => {
  const task = record('task'), loaded = loadApi((method, url) => {
    if (url.endsWith('/properties')) return { items: [{ id: LISTING, title: 'Synthetic property', location: 'Synthetic town', can_approve: false }], total: 1, page: 2, page_size: 50 }
    if (method === 'get' && url.endsWith('/records')) return { items: [task], total: 1, page: 3, page_size: 50 }
    if (url.endsWith('/approval')) return record('maintenance')
    if (url.endsWith('/schedule-next')) return { ...task, id: '33333333-3333-4333-8333-333333333333', origin_record_id: RECORD }
    return task
  }), signal = new AbortController().signal
  await loaded.getManagedProperties('Synthetic', 2, signal)
  await loaded.getManagementRecords(LISTING, 'task', 3, signal)
  assert.deepEqual(clone(loaded.calls[0].args[1].params), { q: 'Synthetic', page: 2 })
  assert.equal(loaded.calls[0].args[1].signal, signal)
  assert.deepEqual(clone(loaded.calls[1].args[1].params), { listing_id: LISTING, kind: 'task', page: 3 })
  await loaded.saveManagementRecord(loaded.managementWrite(LISTING, validDraft('task'), task), task)
  assert.equal(loaded.calls[2].method, 'put'); assert.equal(loaded.calls[2].args[1].expected_version, 3)
  await loaded.approveManagementRecord(record('maintenance'), 'approved', '250.00', 'Synthetic approval')
  assert.deepEqual(clone(loaded.calls[3].args[1]), { expected_version: 3, decision: 'approved', limit: '250.00', comment: 'Synthetic approval' })
  await loaded.scheduleNextManagementTask(task)
  assert.deepEqual(clone(loaded.calls[4].args[1]), { expected_version: 3 })
  assert.equal(loaded.calls[4].args[0], `/property-management/records/${RECORD}/schedule-next`)
  await loaded.saveManagementRecord(loaded.managementWrite(LISTING, validDraft('task')), null)
  assert.equal(loaded.calls.filter(call => call.method === 'post' && call.args[0] === '/property-management/records').length, 1)
  assert.ok(!('expected_version' in loaded.calls[5].args[1]))
})

test('error messages are fixed translations and uncertain saves require reload rather than blind retry', () => {
  const failure = (status, detail) => ({ isAxiosError: true, response: { status, data: { detail } } })
  assert.equal(api.managementErrorKey(failure(409, 'This record changed. Reload before saving')), 'error_conflict')
  assert.equal(api.managementErrorKey(failure(409, 'An active lease overlaps for this property/unit')), 'error_overlap')
  assert.equal(api.managementErrorKey(failure(503, 'Synthetic private SQL parameters')), 'error_unavailable')
  assert.equal(api.uncertainManagementSave(failure(503, 'Unavailable')), true)
  assert.equal(api.uncertainManagementSave({ isAxiosError: true }), true)
  assert.equal(api.uncertainManagementSave(failure(409, 'changed')), false)
})

test('missing or cross-property financial responses fail instead of turning missing values into zero', async () => {
  const empty = { property: { id: LISTING, title: 'Synthetic property', location: 'Synthetic town' }, period: { start: '2020-01-01', end: '2020-01-31', as_of: '2020-01-31', timezone: 'America/Santo_Domingo' }, counts: { lease: 0, maintenance: 0, inspection: 0, ledger: 0, task: 0 }, totals: {}, entries: [], rent_due: [], open_work_orders: [], due_items: [], renewals: [], can_approve: false, note: 'Synthetic operational statement' }
  assert.equal(api.isManagementStatement(empty, LISTING, '2020-01-01', '2020-01-31'), true)
  assert.deepEqual(clone(await loadApi(empty).getManagementStatement(LISTING, '2020-01-01', '2020-01-31')), empty)
  for (const mutate of [value => { delete value.counts.task }, value => { value.totals.USD = { income: '0' } }, value => { value.period.timezone = 'UTC' }, value => { value.property.id = RECORD }, value => { value.entries = [{ ...record('ledger'), listing_id: RECORD }] }, value => { value.counts.ledger = -1 }]) {
    const broken = clone(empty); mutate(broken)
    await assert.rejects(loadApi(broken).getManagementStatement(LISTING, '2020-01-01', '2020-01-31'), /Management response is unavailable/)
  }
  await assert.rejects(loadApi({ items: [{ ...record('task'), listing_id: RECORD }], total: 1, page: 1, page_size: 50 }).getManagementRecords(LISTING, 'task', 1), /Management response is unavailable/)
})

test('CSV keeps USD and DOP separate, preserves cents and neutralizes spreadsheet formulas', () => {
  const entry = record('ledger'); entry.title = '=HYPERLINK("https://example.invalid")'; entry.data.reference = '\t=1+1'
  const labels = locale('en').csv
  const statement = { property: { title: '+Synthetic property', location: '@Synthetic location' }, period: { start: '2020-01-01', end: '2020-01-31' }, totals: { USD: { income: '100.15', expenses: '25.10', net: '75.05', deposit_cash: '50.00', deposit_balance: '100.00' }, DOP: { income: '1000.00', expenses: '100.00', net: '900.00', deposit_cash: '0.00', deposit_balance: '0.00' } }, entries: [entry] }
  const csv = api.statementCsv(statement, labels)
  assert.ok(csv.startsWith('\uFEFF'))
  assert.ok(csv.includes('"USD","100.15","25.10","75.05"'))
  assert.ok(csv.includes('"DOP","1000.00","100.00","900.00"'))
  assert.ok(!csv.includes('1100.15'))
  for (const value of ['=1+1', '+cmd', '-1+1', '@SUM(A1)', '  =1', '\ttext', '\rtext', '\ntext', '\uFEFF=1']) assert.ok(api.safeCsvCell(value).startsWith('"\''))
  assert.ok(csv.includes("'=HYPERLINK")); assert.ok(csv.includes("'\t=1+1"))
  assert.ok(!csv.includes('tenant_email')); assert.ok(!csv.includes('vendor_phone'))
})

function leafKeys(value, prefix = '') { return Object.entries(value).flatMap(([key, item]) => typeof item === 'object' ? leafKeys(item, prefix + key + '.') : [prefix + key]).sort() }
test('all EN/ES management labels, statuses, checklists and validation messages are present', () => {
  const en = locale('en'), es = locale('es')
  assert.deepEqual(leafKeys(en), leafKeys(es))
  for (const kind of api.MANAGEMENT_KINDS) for (const status of api.MANAGEMENT_STATUSES[kind]) assert.ok(en.statuses[status] && es.statuses[status])
  for (const key of api.INSPECTION_ITEMS) assert.ok(en.checks[key] && es.checks[key])
  assert.ok(en.manual_note.includes('does not collect payments')); assert.ok(es.manual_note.includes('no cobra pagos'))
  assert.ok(en.native_currency_note.includes('never combined'))
  assert.ok(en.fields.work_scope && en.fields.progress_notes)
})

test('each structured form renders labeled real fields in English and Spanish, with all inspection items', async () => {
  const file = path.join(root, 'apps/dashboard/src/components/management/ManagementRecordFields.tsx')
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, { module, exports: module.exports, require: name => name.endsWith('/api/propertyManagement') ? api : require(name) })
  const Component = module.exports.ManagementRecordFields
  for (const language of ['en', 'es']) {
    const i18n = i18next.createInstance(); await i18n.init({ lng: language, fallbackLng: language, ns: ['management'], defaultNS: 'management', resources: { [language]: { management: locale(language) } }, interpolation: { escapeValue: false } })
    for (const kind of api.MANAGEMENT_KINDS) {
      const html = renderToStaticMarkup(React.createElement(I18nextProvider, { i18n }, React.createElement(Component, { draft: validDraft(kind), change: () => {}, current: null, canApprove: false, leases: [], moreLeases: false, loadingLeases: false, loadMoreLeases: () => {} })))
      assert.ok(html.includes('<label')); assert.ok(html.includes(locale(language).fields.title))
      assert.ok(!html.includes('fields.') && !html.includes('statuses.') && !html.includes('undefined'))
      if (kind === 'inspection') for (const key of api.INSPECTION_ITEMS) assert.ok(html.includes(locale(language).checks[key].replace(/&/g, '&amp;')))
      if (kind === 'maintenance') { assert.ok(html.includes(locale(language).fields.work_scope)); assert.ok(html.includes(locale(language).fields.progress_notes)); assert.ok(html.includes('disabled=""')) }
    }
  }
})
