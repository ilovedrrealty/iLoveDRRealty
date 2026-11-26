// Actual read-only API/component with synthetic transport and bounded hooks.
// No app server, session, provider, database or real message delivery.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const runtime = require('react/jsx-runtime')
const { renderToStaticMarkup } = require('react-dom/server')
const root = path.resolve(__dirname, '../apps/dashboard/src')
const USER = '10000000-0000-4000-8000-000000000001', OTHER = '20000000-0000-4000-8000-000000000002'
const JOB = '30000000-0000-4000-8000-000000000003', TIME = '2026-11-26T12:00:00Z'
const job = (changes = {}) => ({ id: JOB, event_kind: 'signup', channel: 'email', provider: 'resend', step: 'customer_email', status: 'accepted', attempts: 1, max_attempts: 4, created_at: TIME, first_attempt_at: TIME, last_attempt_at: TIME, next_attempt_at: TIME, accepted_at: TIME, error_code: null, outcome_uncertain: false, ...changes })
const report = (items = [job()], changes = {}) => ({ total: items.length, limit: 25, offset: 0, tracked: items.length > 0, items, ...changes })
const clone = x => JSON.parse(JSON.stringify(x))
const compiled = file => ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText

function api(response) {
  const calls = [], module = { exports: {} }
  const client = { get: async (...args) => { calls.push(args); return { data: await response(...args) } }, post: () => assert.fail('Read-only history attempted a mutation') }
  vm.runInNewContext(compiled('api/communications.ts'), { module, exports: module.exports, require(name) { assert.equal(name, './axios'); return { __esModule: true, default: client } } })
  return { ...module.exports, calls }
}

function ui(response, language = 'en') {
  const client = api(response), copy = JSON.parse(fs.readFileSync(path.join(root, 'locale', language, 'communications.json'), 'utf8'))
  const t = (key, values = {}) => { const value = key.split('.').reduce((part, item) => part?.[item], copy); assert.equal(typeof value, 'string', key); return value.replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? '')) }
  const frames = new Map(), wrappers = new Map(), effects = []
  let current, tree, html = '', dirty = false, userId = USER, seen
  function slot(kind) { const index = current.cursor++; if (!current.slots[index]) current.slots[index] = { kind }; assert.equal(current.slots[index].kind, kind); return current.slots[index] }
  const hooks = { ...React,
    useState(initial) { const state = slot('state'); if (!Object.hasOwn(state, 'value')) state.value = typeof initial === 'function' ? initial() : initial; return [state.value, next => { state.value = typeof next === 'function' ? next(state.value) : next; dirty = true }] },
    useEffect(callback, deps) { const state = slot('effect'); if (!state.deps || deps.some((value, n) => value !== state.deps[n])) { state.deps = [...deps]; effects.push({ state, callback }) } },
  }
  // This fixture contains one root and at most one keyed read child. Real
  // component type+key changes retire that child's hooks and pending read.
  function wrap(type, key) {
    if (!wrappers.has(type)) wrappers.set(type, new Map())
    const byKey = wrappers.get(type), identity = key ?? 'root'
    if (!byKey.has(identity)) {
      const frame = { slots: [], cursor: 0, tree: null, mounted: false }; frames.set(frame, frame)
      const Wrapper = props => { if (!frame.mounted) frame.slots = []; frame.mounted = true; seen.add(frame); const previous = current; current = frame; frame.cursor = 0; try { frame.tree = type(props); return frame.tree } finally { current = previous } }
      Wrapper.frame = frame; byKey.set(identity, Wrapper)
    }
    return byKey.get(identity)
  }
  const jsx = (type, props, key) => runtime.jsx(typeof type === 'function' ? wrap(type, key) : type, props, key)
  const jsxs = (type, props, key) => runtime.jsxs(typeof type === 'function' ? wrap(type, key) : type, props, key)
  const module = { exports: {} }
  vm.runInNewContext(compiled('components/admin/SignupCommunicationHistory.tsx'), { module, exports: module.exports, AbortController, Intl, require(name) {
    if (name === 'react') return hooks
    if (name === 'react/jsx-runtime') return { ...runtime, jsx, jsxs }
    if (name === 'react-i18next') return { useTranslation: () => ({ t, i18n: { language } }) }
    assert.equal(name, '../../api/communications'); return client
  } })
  function render() {
    dirty = false; seen = new Set(); tree = jsx(module.exports.SignupCommunicationHistory, { userId }); html = renderToStaticMarkup(tree)
    for (const frame of frames.values()) if (!seen.has(frame)) { for (const state of frame.slots) { state.cleanup?.(); state.cleanup = undefined } frame.mounted = false }
    return html
  }
  async function settle() { for (let n = 0; n < 12; n++) { render(); for (const item of effects.splice(0)) { item.state.cleanup?.(); item.state.cleanup = item.callback() } for (let n = 0; n < 8; n++) await Promise.resolve(); if (!dirty && !effects.length) return html } assert.fail('History did not settle') }
  function text(x) { return Array.isArray(x) ? x.map(text).join('') : React.isValidElement(x) ? x.type.frame ? text(x.type.frame.tree) : text(x.props.children) : x == null ? '' : String(x) }
  function nodes() { const found = []; function visit(x) { if (Array.isArray(x)) return x.forEach(visit); if (!React.isValidElement(x)) return; if (x.type.frame) return visit(x.type.frame.tree); found.push(x); visit(x.props.children) } visit(tree); return found }
  function button(key) { const matches = nodes().filter(x => x.type === 'button' && text(x) === t(key)); assert.equal(matches.length, 1, key); return matches[0] }
  return { client, t, render, settle, button, nodes, text: () => text(tree), get html() { return html }, setUser(value) { userId = value },
    unmount() { for (const frame of frames.values()) for (const state of frame.slots) state.cleanup?.() } }
}

test('signup API uses only the immutable-account GET and rejects private or malformed records', async () => {
  const f = api(async () => report()), signal = new AbortController().signal
  const result = await f.getSignupCommunications(USER.toUpperCase(), {}, signal)
  assert.deepEqual(clone(f.calls[0][1].params), { limit: 25, offset: 0 })
  assert.equal(f.calls[0][0], '/admin/users/' + USER + '/communications'); assert.equal(f.calls[0][1].signal, signal)
  assert.equal(result.items[0].status, 'accepted'); assert.equal('can_retry' in result.items[0], false)
  for (const bad of ['not-a-uuid', USER + '?email=private']) { const x = api(async () => report()); await assert.rejects(x.getSignupCommunications(bad)); assert.equal(x.calls.length, 0) }
  for (const filters of [{ limit: 101 }, { offset: 10001 }, { offset: -1 }, { limit: 0.5 }]) { const x = api(async () => report()); await assert.rejects(x.getSignupCommunications(USER, filters)); assert.equal(x.calls.length, 0) }
  for (const data of [report([job({ provider_id: 'private' })]), report([job({ body: 'private' })]), report([job({ can_retry: true })]), report([job({ event_kind: 'lead' })]), report([job({ status: 'delivered' })]), report([job(), job()]), report([], { user_id: USER }), report([], { tracked: true }), report([job()], { total: 0, tracked: false })]) {
    await assert.rejects(api(async () => data).getSignupCommunications(USER))
  }
})

test('actual EN/ES history is on-demand and read-only, with accepted-versus-inbox and honest untracked copy', async () => {
  const copies = ['en', 'es'].map(language => JSON.parse(fs.readFileSync(path.join(root, 'locale', language, 'communications.json'))).account)
  assert.deepEqual(Object.keys(copies[0]).sort(), Object.keys(copies[1]).sort())
  for (const language of ['en', 'es']) {
    const h = ui(async () => report(), language)
    await h.settle(); assert.equal(h.client.calls.length, 0)
    h.button('account.open').props.onClick(); await h.settle()
    assert.equal(h.client.calls.length, 1); assert.ok(h.text().includes(h.t('accepted_note')))
    assert.ok(h.text().includes(h.t('statuses.accepted'))); assert.ok(!h.text().includes('@'))
    assert.ok(!h.nodes().some(x => x.type === 'a' || x.type === 'form'))
    assert.ok(!h.nodes().some(x => x.type === 'button' && /retry|reenvi|reintent/i.test(String(x.props.children))))
    h.button('account.hide').props.onClick(); await h.settle(); assert.equal(h.client.calls[0][1].signal.aborted, true)
    const empty = ui(async () => report([]), language); await empty.settle(); empty.button('account.open').props.onClick(); await empty.settle()
    assert.ok(empty.text().includes(empty.t('account.untracked'))); assert.ok(!empty.text().includes(empty.t('statuses.failed')))
  }
})

test('changing account retires the keyed read and ignores its late private result', async () => {
  let resolveOld
  const h = ui(url => url.includes(USER) ? new Promise(resolve => { resolveOld = resolve }) : Promise.resolve(report([])))
  await h.settle(); h.button('account.open').props.onClick(); await h.settle()
  h.setUser(OTHER); await h.settle(); assert.equal(h.client.calls[0][1].signal.aborted, true)
  assert.ok(h.text().includes(h.t('account.untracked')))
  resolveOld(report()); await h.settle()
  assert.ok(!h.text().includes(h.t('reference', { id: JOB }))); assert.ok(h.text().includes(h.t('account.untracked')))
  h.unmount(); assert.equal(h.client.calls[1][1].signal.aborted, true)
})

test('actual current 401/403/404 hides cached jobs before any later response', async () => {
  for (const status of [401, 403, 404]) {
    let denied = false
    const h = ui(async () => { if (denied) throw { response: { status } }; return report() })
    await h.settle(); h.button('account.open').props.onClick(); await h.settle()
    assert.ok(h.text().includes(h.t('reference', { id: JOB })))
    denied = true; h.button('refresh').props.onClick(); h.render()
    assert.ok(!h.text().includes(h.t('reference', { id: JOB })))
    await h.settle(); assert.ok(h.text().includes(h.t('account.access_lost')))
    assert.ok(!h.text().includes(h.t('account.untracked')))
  }
})

test('actual paging is bounded and a current read error recovers only through explicit refresh', async () => {
  let broken = false
  const h = ui(async (_, options) => { if (broken) throw Error('private transport detail'); return report([], { total: 26, tracked: true, offset: options.params.offset }) })
  await h.settle(); h.button('account.open').props.onClick(); await h.settle()
  h.button('next').props.onClick(); await h.settle()
  assert.equal(h.client.calls[1][1].params.offset, 25); assert.equal(h.button('next').props.disabled, true)
  assert.equal(h.client.calls[0][1].signal.aborted, true)
  broken = true; h.button('refresh').props.onClick(); await h.settle()
  assert.ok(h.text().includes(h.t('load_error'))); assert.ok(!h.text().includes('private transport detail'))
  broken = false; h.button('refresh').props.onClick(); await h.settle()
  assert.ok(h.text().includes(h.t('account.empty_page'))); assert.equal(h.client.calls.length, 4)
})

test('closing and reopening history starts a fresh read and ignores the closed read response', async () => {
  let resolveClosed, count = 0
  const freshID = '40000000-0000-4000-8000-000000000004'
  const h = ui(() => ++count === 1 ? new Promise(resolve => { resolveClosed = resolve }) : Promise.resolve(report([job({ id: freshID })])))
  await h.settle(); h.button('account.open').props.onClick(); await h.settle()
  h.button('account.hide').props.onClick(); await h.settle()
  assert.equal(h.client.calls[0][1].signal.aborted, true)
  h.button('account.open').props.onClick(); await h.settle()
  assert.ok(h.text().includes(h.t('reference', { id: freshID })))
  resolveClosed(report()); await h.settle()
  assert.ok(h.text().includes(h.t('reference', { id: freshID })))
  assert.ok(!h.text().includes(h.t('reference', { id: JOB }))); assert.equal(h.client.calls.length, 2)
})
