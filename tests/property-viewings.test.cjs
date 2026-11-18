const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { test } = require('node:test')
const vm = require('node:vm')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const listingId = '00000000-0000-4000-8000-000000000001'
const nextListingId = '00000000-0000-4000-8000-000000000002'
const viewingId = '00000000-0000-4000-8000-000000000003'
const itineraryId = '00000000-0000-4000-8000-000000000004'
const requestId = '00000000-0000-4000-8000-000000000005'
const listing = { id: listingId, title: 'Synthetic villa', location: 'Cabarete' }
const now = Date.parse('2026-11-20T12:00:00Z')
const starts_at = '2026-11-21T09:00:00-04:00'
const contact = { listing, agent_name: 'Synthetic agent', scheduling_url: 'https://calendly.com/synthetic/viewing' }
const viewing = { ...contact, id: viewingId, version: 1, status: 'requested', mode: 'in_person', starts_at,
  timezone: 'America/Santo_Domingo', attendee_name: 'Synthetic buyer', note: '', meeting_details: null, meeting_url: null }
const itinerary = { id: itineraryId, title: 'House visits', items: [viewing] }
const plain = value => JSON.parse(JSON.stringify(value))

function load(file, dependencies = {}) {
  const module = { exports: {} }
  const output = ts.transpileModule(read(file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  })
  vm.runInNewContext(output.outputText, { URL, module, exports: module.exports, require: id => {
    assert.ok(Object.hasOwn(dependencies, id), `Unexpected dependency ${id}`)
    return dependencies[id]
  } })
  return module.exports
}

function harness() {
  const calls = []
  let response
  const axios = Object.fromEntries(['get', 'post'].map(method => [method, async (...args) => {
    calls.push([method, ...args])
    return response
  }]))
  const date = load('apps/dashboard/src/api/serviceWork.ts', {
    './axios': axios, './propertyManagement': { validCalendarDate: value => new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value },
    './serviceWorkflow': {},
  })
  const api = load('apps/dashboard/src/api/viewings.ts', { './axios': axios, './serviceWork': date })
  return { api, calls, reply: (data, cache = 'no-store') => { response = { data, headers: { 'cache-control': cache } } } }
}

test('the exact active property navigates to the configured dashboard, and malformed IDs produce no CTA', () => {
  const { viewingRequestUrl } = load('apps/landing/src/lib/viewingLink.ts')
  assert.equal(viewingRequestUrl('https://app.example.invalid/ignored', listingId), `https://app.example.invalid/viewings?listing=${listingId}`)
  assert.equal(viewingRequestUrl('http://127.0.0.1:4175', listingId), `http://127.0.0.1:4175/viewings?listing=${listingId}`)
  assert.equal(viewingRequestUrl('https://user:pass@example.invalid', listingId), `https://app.ilovedrrealty.com/viewings?listing=${listingId}`)
  assert.equal(viewingRequestUrl('shortlisting=other', '../viewings?listing=bad'), null)
})

test('itinerary requests use distinct property IDs and normalize requested times to Republic local time', () => {
  const { api } = harness()
  const first = { listing_id: listingId, mode: 'in_person', local_start: '2026-11-21T09:00', note: ' Walkthrough ' }
  const second = { listing_id: nextListingId, mode: 'virtual', local_start: '2026-11-21T10:00', note: '' }
  assert.deepEqual(plain(api.prepareViewingStops([first, second], now)), [
    { listing_id: listingId, mode: 'in_person', starts_at, note: 'Walkthrough' },
    { listing_id: nextListingId, mode: 'virtual', starts_at: '2026-11-21T10:00:00-04:00', note: '' },
  ])
  assert.equal(api.prepareViewingStops([first, first], now), null)
  assert.equal(api.prepareViewingStops([], now), null)
  assert.equal(api.prepareViewingStops([{ ...first, local_start: '2026-11-19T09:00' }], now), null)
  assert.equal(api.viewingTime('2026-11-21T09:00+08:00', now), null)
})

test('only supported scheduling and video meeting URLs create links', () => {
  const { api } = harness()
  for (const safe of ['https://meet.google.com/abc-defg-hij', 'https://us02web.zoom.us/j/123456', 'https://teams.live.com/meet/synthetic']) {
    assert.equal(api.viewingMeetingUrl(safe), safe)
  }
  for (const other of ['https://meet.google.com.example.invalid/abc-defg-hij', 'https://zoom.us@elsewhere.invalid/j/123', 'https://meet.google.com/abc-defg-hij#x', 'https://meeting.example.invalid/', 'javascript:alert(1)']) {
    assert.equal(api.viewingMeetingUrl(other), null)
  }
  assert.equal(api.viewingSchedulingUrl('https://calendar.google.com/calendar/u/0/appointments/schedules/synthetic'), 'https://calendar.google.com/calendar/u/0/appointments/schedules/synthetic')
  assert.equal(api.viewingSchedulingUrl('https://calendly.com/synthetic/viewing'), 'https://calendly.com/synthetic/viewing')
  assert.equal(api.viewingSchedulingUrl('https://calendar.google.com/calendar/event?id=1'), null)
})

test('buyer and assigned agents see status-appropriate actions', () => {
  const { api } = harness()
  assert.deepEqual(plain(api.viewingActions('requested', false)), ['cancel'])
  assert.deepEqual(plain(api.viewingActions('requested', true)), ['confirm', 'propose', 'decline', 'cancel'])
  assert.deepEqual(plain(api.viewingActions('proposed', false)), ['accept', 'decline', 'cancel'])
  assert.deepEqual(plain(api.viewingActions('proposed', true)), ['propose', 'decline', 'cancel'])
  for (const terminal of ['declined', 'cancelled', 'unavailable']) assert.deepEqual(plain(api.viewingActions(terminal, false)), [])
})

test('contact and itinerary reads use scoped routes and reject cached or mismatched property responses', async () => {
  const h = harness()
  const signal = new AbortController().signal
  h.reply(contact)
  assert.deepEqual(plain(await h.api.getViewingContact(listingId, signal)), contact)
  await assert.rejects(h.api.getViewingContact(nextListingId, signal), /Unexpected viewing property/)
  h.reply({ items: [itinerary] })
  assert.deepEqual(plain(await h.api.getMyViewings(2, signal)), [itinerary])
  h.reply({ items: [viewing] })
  assert.deepEqual(plain(await h.api.getAssignedViewings(1, signal)), [viewing])
  assert.equal(h.calls[2][2].signal, signal)
  assert.deepEqual(plain(h.calls[2][2].params), { page: 2, page_size: 30 })
  h.reply({ items: [] }, 'private')
  await assert.rejects(h.api.getAssignedViewings(1, signal), /Invalid private viewing response/)
})

test('request and action send explicit context and return the expected record only', async () => {
  const h = harness()
  const body = { request_id: requestId, title: itinerary.title, stops: [{ listing_id: listingId, mode: 'in_person', starts_at, note: '' }] }
  h.reply(itinerary)
  assert.deepEqual(plain(await h.api.submitViewing(body)), itinerary)
  assert.deepEqual(plain(h.calls[0]), ['post', '/viewings', body])
  const action = { action: 'confirm', expected_version: 1, availability_checked: true, meeting_details: 'Front entrance' }
  h.reply({ ...viewing, version: 2, status: 'confirmed', meeting_details: action.meeting_details })
  const updated = await h.api.updateViewing(viewingId, action)
  assert.equal(updated.status, 'confirmed')
  assert.deepEqual(plain(h.calls[1]), ['post', `/viewings/${viewingId}/action`, action])
  h.reply({ ...viewing, id: nextListingId })
  await assert.rejects(h.api.updateViewing(viewingId, action), /Invalid viewing response/)
})

test('both dashboard languages cover every control and have public viewing links', () => {
  const common = language => JSON.parse(read(`apps/dashboard/src/locale/${language}/common.json`)).viewings
  assert.deepEqual(Object.keys(common('en')).sort(), Object.keys(common('es')).sort())
  assert.deepEqual(Object.keys(common('en').actions).sort(), Object.keys(common('es').actions).sort())
  for (const language of ['en', 'es']) {
    const listingCopy = JSON.parse(read(`apps/landing/src/locales/${language}/property_detail.json`))
    assert.ok(listingCopy.sidebar.request_viewing)
    assert.ok(listingCopy.sidebar.message_agent)
  }
})
