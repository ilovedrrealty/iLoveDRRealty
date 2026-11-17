const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const source = fs.readFileSync(path.resolve(__dirname, '../apps/dashboard/src/api/leadDelivery.ts'), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText
const clone = value => JSON.parse(JSON.stringify(value))
const leadId = '10000000-0000-0000-0000-000000000001'
const jobId = '20000000-0000-0000-0000-000000000001'
const timestamp = '2026-10-25T16:00:00Z'

function load(data, error) {
  const calls = []
  const api = Object.fromEntries(['get', 'post'].map(method => [method, async (...args) => {
    calls.push([method, ...args])
    if (error) throw error
    return { data }
  }]))
  const module = { exports: {} }
  vm.runInNewContext(compiled, { module, exports: module.exports, require: name => {
    assert.equal(name, './axios'); return { __esModule: true, default: api }
  } })
  return { ...module.exports, calls }
}

function job(changes = {}) {
  return {
    id: jobId, lead_id: leadId, step: 'email_1', provider: 'resend', status: 'pending',
    attempts: 0, max_attempts: 4, created_at: timestamp, first_attempt_at: null,
    last_attempt_at: null, next_attempt_at: timestamp, accepted_at: null,
    error_code: null, blocked_by: null, outcome_uncertain: false, can_retry: false, ...changes,
  }
}
function summary() {
  return {
    generated_at: timestamp, enabled: true, total_jobs: 1, tracked_leads: 1,
    status_counts: { pending: 1, processing: 0, retry_wait: 0, accepted: 0, failed: 0, needs_review: 0, skipped: 0 },
    by_step: [{ step: 'email_1', status: 'pending', count: 1 }],
    worker: { last_poll_at: timestamp, last_completed_at: timestamp, last_batch_count: 0, error_code: null },
    note: 'Provider acknowledgement is not inbox delivery.',
  }
}
function queue(items = [job()], changes = {}) {
  return { total: items.length, limit: 25, offset: 0, items, ...changes }
}

test('summary is a read-only request with cancellation and reconciled recorded counters', async () => {
  const data = summary(), loaded = load(data), signal = new AbortController().signal
  assert.equal(await loaded.getDeliverySummary(signal), data)
  assert.equal(loaded.calls.length, 1)
  assert.equal(loaded.calls[0][0], 'get')
  assert.equal(loaded.calls[0][1], '/admin/leads/delivery-summary')
  assert.equal(loaded.calls[0][2].signal, signal)
})

test('genuine empty tracking is accepted, while missing or inconsistent reports are unavailable', async () => {
  const empty = summary()
  empty.total_jobs = 0; empty.tracked_leads = 0; empty.status_counts.pending = 0; empty.by_step = []
  empty.worker = { last_poll_at: null, last_completed_at: null, last_batch_count: 0, error_code: null }
  assert.equal(load().isDeliverySummary(empty), true)
  const mutations = [
    data => { delete data.status_counts.failed },
    data => { data.status_counts.pending = -1 },
    data => { data.status_counts.pending = '1' },
    data => { data.total_jobs = 2 },
    data => { data.tracked_leads = 2 },
    data => { data.by_step[0].count = 2 },
    data => { data.by_step[0].status = 'accepted' },
    data => { data.by_step.push(clone(data.by_step[0])) },
    data => { data.by_step[0].step = 'unknown' },
    data => { data.worker.error_code = 'synthetic@example.com' },
    data => { data.worker.last_poll_at = '2026-10-25T16:00:00' },
    data => { data.worker.last_batch_count = 11 },
    data => { data.generated_at = 'invalid' },
  ]
  for (const mutate of mutations) {
    const data = summary(); mutate(data)
    await assert.rejects(load(data).getDeliverySummary(), /summary unavailable/)
  }
  await assert.rejects(load({}).getDeliverySummary(), /summary unavailable/)
})

test('bounded queue request preserves status, lead ID and cancellation', async () => {
  const data = queue([job({ status: 'failed', can_retry: true })], { limit: 2, offset: 25, total: 40 })
  const loaded = load(data), signal = new AbortController().signal
  assert.equal(await loaded.getDeliveryQueue({ status: 'failed', lead_id: leadId.toUpperCase(), limit: 2, offset: 25 }, signal), data)
  assert.equal(loaded.calls.length, 1)
  assert.equal(loaded.calls[0][0], 'get')
  assert.equal(loaded.calls[0][1], '/admin/lead-deliveries')
  assert.deepEqual(clone(loaded.calls[0][2].params), { status: 'failed', lead_id: leadId, limit: 2, offset: 25 })
  assert.equal(loaded.calls[0][2].signal, signal)
  const defaults = load(queue([]))
  await defaults.getDeliveryQueue({})
  assert.deepEqual(clone(defaults.calls[0][2].params), { limit: 25, offset: 0 })
})

test('invalid queue filters never make an HTTP request', async () => {
  for (const filters of [{ limit: 0 }, { limit: 101 }, { limit: 1.5 }, { offset: -1 }, { offset: 10001 }, { status: 'delivered' }, { lead_id: 'synthetic-private-input' }]) {
    const loaded = load()
    await assert.rejects(loaded.getDeliveryQueue(filters), /Invalid delivery filters/)
    assert.equal(loaded.calls.length, 0)
  }
})

test('queue rejects wrong filters, duplicate jobs, customer payloads and unsafe retry flags', async () => {
  const variants = [
    queue([job({ status: 'accepted', accepted_at: timestamp, attempts: 1 })]),
    queue([job({ lead_id: '10000000-0000-0000-0000-000000000002', status: 'failed' })]),
    queue([job({ status: 'failed' }), job({ status: 'failed' })]),
    queue([job({ status: 'failed', payload: { body: 'synthetic private payload' } })]),
    queue([job({ status: 'failed', recipient: 'synthetic@example.com' })]),
    queue([job({ status: 'failed', error_code: 'unsafe raw provider response!' })]),
    queue([job({ status: 'failed', can_retry: true, outcome_uncertain: true })]),
    queue([job({ status: 'failed', can_retry: true, attempts: 4 })]),
    queue([job({ status: 'needs_review', can_retry: true })]),
    queue([job({ status: 'failed', blocked_by: 'crm_contact' })]),
    queue([job({ status: 'failed', provider: 'ghl' })]),
  ]
  for (const data of variants) await assert.rejects(load(data).getDeliveryQueue({ status: 'failed', lead_id: leadId }), /queue unavailable/)
})

test('accepted steps need provider acknowledgement metadata and cannot be retried', () => {
  const loaded = load()
  assert.equal(loaded.isDeliveryJob(job({ status: 'accepted', attempts: 1, accepted_at: timestamp })), true)
  for (const changes of [
    { status: 'accepted' },
    { status: 'accepted', attempts: 1, accepted_at: timestamp, can_retry: true },
    { status: 'accepted', attempts: 1, accepted_at: timestamp, outcome_uncertain: true },
    { attempts: 5 },
  ]) assert.equal(loaded.isDeliveryJob(job(changes)), false)
  assert.equal(loaded.isDeliveryJob(job({ status: 'needs_review', attempts: 1, outcome_uncertain: true })), true)
})

test('live queue tolerates legitimate total changes without creating substitute rows', async () => {
  const data = queue([], { total: 30, offset: 25 })
  assert.equal(await load(data).getDeliveryQueue({ offset: 25 }), data)
})

test('per-lead details use GET only and explicitly accept historical leads with no jobs', async () => {
  const signal = new AbortController().signal
  const data = { lead_id: leadId, tracked: true, enabled: true, jobs: [job()], note: null }
  const loaded = load(data)
  assert.equal(await loaded.getLeadDelivery(leadId.toUpperCase(), signal), data)
  assert.equal(loaded.calls[0][0], 'get')
  assert.equal(loaded.calls[0][1], `/admin/leads/${leadId}/delivery`)
  assert.equal(loaded.calls[0][2].signal, signal)
  const history = { ...data, tracked: false, jobs: [], note: 'Historical inquiries are not replayed.' }
  assert.equal(await load(history).getLeadDelivery(leadId), history)
  for (const bad of [{ ...data, tracked: false }, { ...data, lead_id: jobId }, { ...history, tracked: true }]) {
    await assert.rejects(load(bad).getLeadDelivery(leadId), /Lead delivery unavailable/)
  }
  const invalid = load()
  await assert.rejects(invalid.getLeadDelivery('invalid'), /Invalid lead identifier/)
  assert.equal(invalid.calls.length, 0)
})

test('one manual retry queues pending work with explicit JSON only to the private retry endpoint', async () => {
  const loaded = load({ id: jobId, status: 'pending', enabled: true })
  await loaded.retryDelivery(jobId.toUpperCase())
  assert.deepEqual(clone(loaded.calls), [['post', `/admin/lead-deliveries/${jobId}/retry`, {}]])
  const invalid = load()
  await assert.rejects(invalid.retryDelivery('invalid'), error => error.code === 'unavailable')
  assert.equal(invalid.calls.length, 0)
})

test('changed and uncertain requeue outcomes are controlled without automatic retries or raw errors', async () => {
  const changed = load(null, { response: { status: 409, data: { detail: 'synthetic private text' } } })
  await assert.rejects(changed.retryDelivery(jobId), error => error.code === 'not_retryable' && !error.message.includes('private'))
  assert.equal(changed.calls.length, 1)
  const unavailable = load(null, new Error('synthetic private error'))
  await assert.rejects(unavailable.retryDelivery(jobId), error => error.code === 'unavailable' && !error.message.includes('private'))
  assert.equal(unavailable.calls.length, 1)
  for (const data of [{ id: jobId, status: 'accepted', enabled: true }, { id: jobId, status: 'retry_wait', enabled: true }, { id: leadId, status: 'pending', enabled: true }, {}]) {
    const loaded = load(data)
    await assert.rejects(loaded.retryDelivery(jobId), error => error.code === 'unavailable')
    assert.equal(loaded.calls.length, 1)
  }
})

test('held legacy retries may offer one safe manual action, never an uncertain or exhausted resend', async () => {
  const legacy = job({ status: 'retry_wait', attempts: 1, first_attempt_at: timestamp, last_attempt_at: timestamp, can_retry: true })
  const data = queue([legacy])
  assert.equal(await load(data).getDeliveryQueue({ status: 'retry_wait' }), data)
  for (const changes of [
    { outcome_uncertain: true }, { attempts: 4 }, { status: 'pending' },
    { status: 'processing' }, { status: 'needs_review' }, { status: 'accepted', accepted_at: timestamp },
  ]) assert.equal(load().isDeliveryJob({ ...legacy, ...changes }), false)
})

test('English and Spanish explain worker status, provider acceptance and historical non-replay equally', () => {
  const locale = language => JSON.parse(fs.readFileSync(path.resolve(__dirname, `../apps/dashboard/src/locale/${language}/lead_delivery.json`), 'utf8'))
  function leafKeys(value, prefix = '') {
    return Object.entries(value).flatMap(([key, item]) => typeof item === 'object' ? leafKeys(item, prefix + key + '.') : [prefix + key]).sort()
  }
  const en = locale('en'), es = locale('es')
  assert.deepEqual(leafKeys(en), leafKeys(es))
  for (const status of load().DELIVERY_STATUSES) assert.ok(en.statuses[status] && es.statuses[status])
  for (const state of ['paused', 'awaiting', 'error', 'stale', 'polling']) assert.ok(en.worker[state] && en.worker[`${state}_help`] && es.worker[state] && es.worker[`${state}_help`])
  assert.ok(en.accepted_note.includes('does not prove'))
  assert.ok(es.accepted_note.includes('No demuestra'))
  assert.ok(en.legacy_note.includes('not queued or resent'))
  assert.ok(es.legacy_note.includes('no se ponen en cola'))
  assert.ok(en.detail.review_note.includes('No automatic resend'))
  assert.ok(es.detail.review_note.includes('No se permite el reenvío automático'))
  assert.ok(!JSON.stringify(en).includes('@'))
  assert.ok(!JSON.stringify(es).includes('@'))
})

test('Admin delivery renders a truthful loading state without invented counts or available retries', () => {
  const view = fs.readFileSync(path.resolve(__dirname, '../apps/dashboard/src/pages/admin/LeadDelivery.tsx'), 'utf8')
  const React = require('react')
  const { renderToStaticMarkup } = require('react-dom/server')
  for (const language of ['en', 'es']) {
    const messages = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../apps/dashboard/src/locale/${language}/lead_delivery.json`), 'utf8'))
    const i18n = require('i18next').createInstance()
    i18n.init({ lng: language, resources: { [language]: { lead_delivery: messages } }, initImmediate: false })
    const api = load(), module = { exports: {} }
    vm.runInNewContext(ts.transpileModule(view, { compilerOptions: {
      target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
    } }).outputText, { module, exports: module.exports, require: name => {
      if (name === '../../api/leadDelivery') return api
      if (name === 'react-i18next') return { useTranslation: () => ({ t: i18n.getFixedT(language, 'lead_delivery'), i18n }) }
      return require(name)
    } })
    const html = renderToStaticMarkup(React.createElement(module.exports.LeadDelivery))
    assert.ok(html.includes(messages.loading))
    assert.ok(html.includes(messages.accepted_note))
    assert.ok(html.includes('aria-busy="true"'))
    assert.ok(!html.includes(messages.counts.tracked_leads))
    assert.ok(!html.includes(messages.retry))
    assert.ok(!html.includes('NaN'))
    assert.equal(api.calls.length, 0)
  }
})
