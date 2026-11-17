const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
function load(relative, client) {
  const module = { exports: {} }
  const source = fs.readFileSync(path.join(root, relative), 'utf8')
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText,
    { module, exports: module.exports, URL, Date, Intl, require: name => name === './axios' ? { __esModule: true, default: client } : require(name) })
  return module.exports
}
const id = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`
const row = (number = 1, changes = {}) => ({ id: id(number), type: 'property_inquiry', property_id: id(99), property_title: 'Synthetic property',
  name: 'Synthetic contact', email: null, phone: '+18095551234', message: null, status: 'new',
  created_at: '2026-10-25T12:00:00Z', assigned_at: null, contacted_at: null, closed_at: null,
  assigned_realtor_id: null, assigned_realtor_name: null, ...changes })
const page = changes => ({ items: [row()], total: 58, page: 1, page_size: 50, state: 'all',
  summary: { all_total: 58, open_total: 45, closed_total: 12, unknown_total: 1 }, ...changes })

test('Owner feed uses full server counters, actual scoped endpoint and a cancellable GET only', async () => {
  const calls = [], signal = new AbortController().signal
  const api = load('apps/dashboard/src/api/ownerLeads.ts', { get: async (...args) => { calls.push(args); return { data: page() } } })
  const result = await api.getOwnerLeads(1, 'all', signal)
  assert.equal(result.total, 58)
  assert.equal(result.items.length, 1)
  assert.equal(result.summary.open_total, 45)
  assert.equal(calls.length, 1)
  assert.equal(calls[0][0], '/owner/leads')
  assert.equal(calls[0][1].params.page, 1)
  assert.equal(calls[0][1].params.state, 'all')
  assert.equal(calls[0][1].signal, signal)
  assert.equal(calls[0][1].headers, undefined, 'No custom cache header may break the established CORS contract')
})

test('Invalid/private reports fail visibly rather than becoming zero inquiries', async () => {
  const api = load('apps/dashboard/src/api/ownerLeads.ts', { get: async () => { throw new Error('Synthetic read failure') } })
  await assert.rejects(api.getOwnerLeads(), /Synthetic read failure/)
  for (const invalid of [page({ total: 0 }), page({ summary: { all_total: 58, open_total: 99, closed_total: 12, unknown_total: 1 } }),
    page({ items: [row(1, { tracking: { private: true } })] }), page({ items: [row(), row()] }),
    page({ items: [row(1, { email: undefined })] }), page({ items: [row(1, { status: 'future_state' })] })]) {
    assert.equal(api.isOwnerLeadPage(invalid, 1, 'all'), false)
  }
  await assert.rejects(api.getOwnerLeads(0), /Invalid inquiry page/)
  await assert.rejects(api.getOwnerLeads(10001), /Invalid inquiry page/)
  const malformed = load('apps/dashboard/src/api/ownerLeads.ts', { get: async () => ({ data: {} }) })
  await assert.rejects(malformed.getOwnerLeads(), /Inquiries unavailable/)
})

test('Phone-only, email-only and both-contact records have safe user-initiated actions with phone first', () => {
  const { inquiryContacts } = load('apps/dashboard/src/utils/inquiryFeeds.ts')
  let value = inquiryContacts('+1 809-555-1234', null)
  assert.equal(value.phone, 'tel:+18095551234'); assert.equal(value.email, null)
  value = inquiryContacts(null, 'buyer@example.com')
  assert.equal(value.phone, null); assert.equal(value.email, 'mailto:buyer%40example.com')
  value = inquiryContacts('+18095551234', 'buyer@example.com')
  assert.ok(value.phone); assert.ok(value.email)
  value = inquiryContacts('+1', 'bad\r\n@example.com')
  assert.equal(value.phone, null); assert.equal(value.email, null)
  const source = fs.readFileSync(path.join(root, 'apps/dashboard/src/components/dashboard/InquiryHistory.tsx'), 'utf8')
  assert.ok(source.indexOf('href={actions.phone}') < source.indexOf('href={actions.email}'))
  assert.doesNotMatch(source, /mailto:\$\{(?:row|lead)\.email\}/)
})

test('Buyer home and inquiry page share the same canonical property-only selection without changing other callers', () => {
  const { currentBuyerInquiries, inquiryStatus } = load('apps/dashboard/src/utils/inquiryFeeds.ts')
  const input = [row(1, { created_at: '2026-10-24T10:00:00Z' }), row(2, { type: 'seller_interest' }),
    row(3, { type: 'booking' }), row(4, { created_at: '2026-10-25T11:00:00Z' })]
  const result = currentBuyerInquiries(input)
  assert.equal(result.length, 2)
  assert.equal(result[0].id, id(4))
  assert.equal(input.length, 4)
  assert.equal(inquiryStatus('schedule'), 'schedule')
  assert.equal(inquiryStatus('provider_error'), 'unknown')
  for (const file of ['components/dashboard/BuyerHome.tsx', 'pages/buyer/Inquiries.tsx']) {
    const source = fs.readFileSync(path.join(root, 'apps/dashboard/src', file), 'utf8')
    assert.match(source, /getMyLeads\(controller\.signal\)/)
    assert.match(source, /currentBuyerInquiries\(/)
    assert.doesNotMatch(source, /getMyInquiries\(/)
  }
})

test('Canonical owner pagination and separate legacy history remain read-only and explicitly labeled', () => {
  const owner = fs.readFileSync(path.join(root, 'apps/dashboard/src/pages/owner/Leads.tsx'), 'utf8')
  const home = fs.readFileSync(path.join(root, 'apps/dashboard/src/components/dashboard/OwnerHome.tsx'), 'utf8')
  assert.match(owner, /data\.summary\[key\]/)
  assert.match(home, /inquiryPage\.summary\.open_total/)
  assert.match(owner, /<InquiryHistory scope="owner"/)
  assert.match(fs.readFileSync(path.join(root, 'apps/dashboard/src/pages/buyer/Inquiries.tsx'), 'utf8'), /<InquiryHistory scope="buyer"/)
  assert.doesNotMatch(owner, /updateLeadStatus|assignLead|submitLead|\.post\(/)
  const history = fs.readFileSync(path.join(root, 'apps/dashboard/src/components/dashboard/InquiryHistory.tsx'), 'utf8')
  assert.match(history, /history_explanation/)
  assert.match(history, /key=\{`legacy:\$\{row\.id\}`\}/)
  assert.match(history, /return \(\) => controller\.abort\(\)/)
})

test('Feed labels have matching English/Spanish keys, honest history and all real statuses', () => {
  const en = JSON.parse(fs.readFileSync(path.join(root, 'apps/dashboard/src/locale/en/inquiry_feeds.json'), 'utf8'))
  const es = JSON.parse(fs.readFileSync(path.join(root, 'apps/dashboard/src/locale/es/inquiry_feeds.json'), 'utf8'))
  const keys = (value, prefix = '') => Object.entries(value).flatMap(([key, child]) => typeof child === 'object' ? keys(child, prefix + key + '.') : [prefix + key]).sort()
  assert.deepEqual(keys(en), keys(es))
  for (const lang of [en, es]) {
    for (const state of ['new', 'assigned', 'schedule', 'contacted', 'closed', 'unknown']) assert.ok(lang.statuses[state])
    for (const field of ['history_explanation', 'current_error', 'open_definition', 'call_preferred']) assert.ok(lang[field])
  }
})
