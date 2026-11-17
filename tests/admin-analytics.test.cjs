const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const source = fs.readFileSync(path.resolve(__dirname, '../apps/dashboard/src/api/analytics.ts'), 'utf8')
const clone = value => JSON.parse(JSON.stringify(value))

function load(data) {
  const calls = []
  const api = { get: async (...args) => { calls.push(args); return { data } } }
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText,
    { module, exports: module.exports, require: name => { assert.equal(name, './axios'); return { __esModule: true, default: api } } })
  return { ...module.exports, calls }
}

function fixture() {
  return {
    generated_at: '2026-10-25T15:00:00Z',
    window: { days: 7, start_at: '2026-10-19T00:00:00Z', end_at: '2026-10-25T15:00:00Z', timezone: 'UTC' },
    snapshot: {
      accounts: 3, active_accounts: 2, accounts_by_role: { buyer: 1, owner: 1, realtor: 0, admin: 1, other: 0 },
      listing_records: 2, active_listings: 1,
      listings_by_status: { active: 1, pending_approval: 1, draft: 0, rejected: 0, archived: 0, other: 0 },
      active_listings_by_purpose: { sale: 1, rent: 0, both: 0, other: 0 },
      active_listings_by_type: { villa: 1, apartment: 0, condo: 0, land: 0, commercial: 0, other: 0 },
    },
    period: {
      accounts_created: 1, listings_created: 1,
      inquiries: {
        received: 2, excluded_internal_tests: 1, unknown_tracking: 1, contact_recorded: 1, crm_linked: 1, crm_errors: 0,
        by_type: { buyer_interest: 1, seller_interest: 0, rental_interest: 1, property_inquiry: 0, booking: 0, other: 0 },
        current_status: { new: 1, assigned: 0, contacted: 0, closed: 1, other: 0 },
      },
      booking_records_created: 1, booking_current_status: { pending: 0, confirmed: 1, cancelled: 0, other: 0 },
    },
    daily: Array.from({ length: 7 }, (_, index) => ({
      date: `2026-10-${19 + index}`, accounts_created: index === 0 ? 1 : 0,
      inquiries_received: index === 2 ? 2 : 0, booking_records_created: index === 6 ? 1 : 0,
    })),
    financial_values_reported: false, definitions_version: 1,
  }
}

test('Admin report requests only the bounded aggregate endpoint and keeps cancellation', async () => {
  const data = fixture()
  const loaded = load(data)
  const signal = new AbortController().signal
  assert.equal(await loaded.getAdminAnalytics(7, signal), data)
  assert.equal(loaded.calls.length, 1)
  assert.equal(loaded.calls[0][0], '/admin/analytics')
  assert.deepEqual(clone(loaded.calls[0][1].params), { days: 7 })
  assert.equal(loaded.calls[0][1].signal, signal)
})

test('genuine empty reports are accepted without treating missing metrics as zero', () => {
  const data = fixture()
  function zeroNumbers(value) {
    for (const [key, item] of Object.entries(value)) {
      if (typeof item === 'number' && !['days', 'definitions_version'].includes(key)) value[key] = 0
      else if (item && typeof item === 'object') zeroNumbers(item)
    }
  }
  zeroNumbers(data)
  assert.equal(load().isAdminAnalytics(data, 7), true)
  delete data.snapshot.accounts
  assert.equal(load().isAdminAnalytics(data, 7), false)
})

test('missing, negative, mismatched or financial payloads are unavailable, not substitute metrics', async () => {
  const mutations = [
    data => { delete data.period.inquiries.current_status.closed },
    data => { data.snapshot.active_listings = -1 },
    data => { data.snapshot.accounts = '3' },
    data => { data.period.inquiries.received = 3 },
    data => { data.period.inquiries.crm_errors = 3 },
    data => { data.daily[0].accounts_created = 9 },
    data => { data.daily.pop() },
    data => { data.daily[1].date = data.daily[0].date },
    data => { data.window.timezone = 'local' },
    data => { data.window.start_at = '2026-10-19T00:00:00' },
    data => { data.window.start_at = '2026-10-19T01:00:00Z' },
    data => { data.window.end_at = '2026-10-26T00:00:00Z'; data.generated_at = data.window.end_at },
    data => { data.generated_at = 'invalid' },
    data => { data.financial_values_reported = true },
    data => { data.definitions_version = 2 },
  ]
  for (const mutate of mutations) {
    const data = fixture(); mutate(data)
    await assert.rejects(load(data).getAdminAnalytics(7), /Analytics response is unavailable/)
  }
  await assert.rejects(load({ detail: 'synthetic private failure' }).getAdminAnalytics(7), /Analytics response is unavailable/)
  await assert.rejects(load(fixture()).getAdminAnalytics(30), /Analytics response is unavailable/)
})

test('Admin analytics has matching English and Spanish definitions and no stale month header', () => {
  const locale = language => JSON.parse(fs.readFileSync(path.resolve(__dirname, `../apps/dashboard/src/locale/${language}/admin.json`), 'utf8'))
  function leafKeys(value, prefix = '') {
    return Object.entries(value).flatMap(([key, item]) => typeof item === 'object' ? leafKeys(item, prefix + key + '.') : [prefix + key]).sort()
  }
  const en = locale('en'), es = locale('es')
  assert.deepEqual(leafKeys(en.analytics_page), leafKeys(es.analytics_page))
  assert.ok(en.analytics_page.report_scope.includes('does not report revenue'))
  assert.ok(es.analytics_page.report_scope.includes('No informa ingresos'))
  assert.ok(!en.pages.analytics.sub.includes('2026'))
  assert.ok(!es.pages.analytics.sub.includes('2026'))
})
