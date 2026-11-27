// Actual API and component handlers with synthetic transport, bounded hooks and
// SSR. No application server, database, browser or provider execution.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm')
const ts = require('typescript'), React = require('react'), jsxRuntime = require('react/jsx-runtime')
const { renderToStaticMarkup } = require('react-dom/server')
const root = path.resolve(__dirname, '../apps/dashboard/src')
const ID = n => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const TARGET = ID(1), OTHER = ID(2), FIRST = ID(3), LATER = ID(4), EVENT = ID(5), TIME = '2026-11-26T12:00:00Z'
const clone = value => JSON.parse(JSON.stringify(value))
const notice = (changes = {}) => ({ kind: 'lead_assigned_agent', status: 'accepted', attempts: 1, created_at: TIME, attempted_at: TIME, accepted_at: TIME, outcome_uncertain: false, ...changes })
const event = (changes = {}) => ({ id: EVENT, action: 'assigned', created_at: TIME, notices: [notice()], ...changes })
const report = (items = [event()], changes = {}) => ({ total: items.length, limit: 10, offset: 0, tracked: items.length > 0, items, ...changes })
const currentRow = (changes = {}) => ({ id: TARGET, assigned_realtor_id: LATER, assigned_realtor_name: 'Current agent', status: 'closed', assigned_at: TIME, ...changes })
const code = new Map()
function compile(file) {
  if (!code.has(file)) code.set(file, ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText)
  return code.get(file)
}

function api({ get = async url => url.endsWith('assignment-history') ? report() : [currentRow()], put = async () => ({ status: 204 }) } = {}) {
  const calls = [], modules = new Map(); let next = 20
  const client = { get: async (...args) => { calls.push({ method: 'get', args }); return { data: await get(...args) } },
    put: async (...args) => { calls.push({ method: 'put', args }); return put(...args) }, post: () => assert.fail('Unexpected POST') }
  function load(file) {
    if (modules.has(file)) return modules.get(file)
    const module = { exports: {} }
    vm.runInNewContext(compile(file), { module, exports: module.exports, crypto: { randomUUID: () => ID(++next) }, require(name) {
      if (name === './axios') return { __esModule: true, default: client }
      assert.ok(['./admin', './leads'].includes(name), name); return load('api/' + name.slice(2) + '.ts')
    } })
    modules.set(file, module.exports); return module.exports
  }
  return { ...load('api/assignments.ts'), calls, legacyAdmin: load('api/admin.ts'), legacyLead: load('api/leads.ts') }
}

function ui(component = 'AssignmentHistory', transport = {}, language = 'en', extra = {}) {
  const f = api(transport), modules = new Map(), frames = new Map(), wrappers = new Map(), effects = [], values = []
  const copy = ns => JSON.parse(fs.readFileSync(path.join(root, 'locale', language, ns + '.json'), 'utf8'))
  const copies = { communications: copy('communications'), admin: copy('admin') }
  function t(key, data = {}, ns = 'communications') { const text = key.split('.').reduce((value, item) => value?.[item], copies[ns]); assert.equal(typeof text, 'string', key); return text.replace(/\{\{(\w+)\}\}/g, (_, name) => String(data[name] ?? '')) }
  let activeFrame, seen, tree, html = '', dirty = false
  let props = { scope: 'lead', targetId: TARGET, revision: 0, onAccessLost: () => values.push('denied'),
    initial: { realtor_id: FIRST, realtor_name: 'Original agent' }, agents: [{ id: FIRST, display_name: 'Requested agent', email: 'choice@example.invalid', role: 'realtor' }, { id: LATER, display_name: 'Current agent', email: 'later@example.invalid', role: 'admin' }], onCurrent: value => values.push(clone(value)), ...extra }
  function slot(kind) { const i = activeFrame.cursor++; if (!activeFrame.slots[i]) activeFrame.slots[i] = { kind }; assert.equal(activeFrame.slots[i].kind, kind); return activeFrame.slots[i] }
  const hooks = { ...React,
    useState(initial) { const state = slot('state'); if (!Object.hasOwn(state, 'value')) state.value = typeof initial === 'function' ? initial() : initial; return [state.value, next => { state.value = typeof next === 'function' ? next(state.value) : next; dirty = true }] },
    useRef(initial) { const state = slot('ref'); return state.value ??= { current: initial } },
    useCallback(fn, deps) { const state = slot('callback'); if (!state.deps || deps.some((x, i) => x !== state.deps[i])) { state.deps = [...deps]; state.value = fn } return state.value },
    useEffect(callback, deps) { const state = slot('effect'); if (!state.deps || deps.some((x, i) => x !== state.deps[i])) { state.deps = [...deps]; effects.push({ state, callback }) } },
  }
  function wrap(type, key) {
    if (!wrappers.has(type)) wrappers.set(type, new Map())
    const group = wrappers.get(type), identity = key ?? 'root'
    if (!group.has(identity)) {
      const frame = { slots: [], cursor: 0, mounted: false, tree: null }; frames.set(frame, frame)
      const Wrapper = p => { if (!frame.mounted) frame.slots = []; frame.mounted = true; seen.add(frame); const prior = activeFrame; activeFrame = frame; frame.cursor = 0; try { frame.tree = type(p); return frame.tree } finally { activeFrame = prior } }
      Wrapper.frame = frame; group.set(identity, Wrapper)
    }
    return group.get(identity)
  }
  const jsx = (type, p, key) => jsxRuntime.jsx(typeof type === 'function' ? wrap(type, key) : type, p, key)
  const jsxs = (type, p, key) => jsxRuntime.jsxs(typeof type === 'function' ? wrap(type, key) : type, p, key)
  function load(file) {
    if (modules.has(file)) return modules.get(file)
    const module = { exports: {} }
    vm.runInNewContext(compile(file), { module, exports: module.exports, AbortController, Intl, require(name) {
      if (name === 'react') return hooks
      if (name === 'react/jsx-runtime') return { ...jsxRuntime, jsx, jsxs }
      if (name === 'react-i18next') return { useTranslation: ns => ({ t: (key, data) => t(key, data, ns), i18n: { language } }) }
      if (name === '../../api/assignments') return f
      if (name === '../../lib/agentChoices') return load('lib/agentChoices.ts')
      if (name === '../shared/ConfirmModal') return { ConfirmModal: p => jsx('button', { onClick: p.onConfirm, children: p.confirmLabel }) }
      assert.equal(name, './AssignmentHistory'); return load('components/admin/AssignmentHistory.tsx')
    } })
    modules.set(file, module.exports); return module.exports
  }
  const Component = load('components/admin/' + component + '.tsx')[component]
  function render() {
    dirty = false; seen = new Set(); tree = jsx(Component, props, props.scope + ':' + props.targetId); html = renderToStaticMarkup(tree)
    for (const frame of frames.values()) if (!seen.has(frame)) { for (const state of frame.slots) { state.cleanup?.(); state.cleanup = undefined } frame.mounted = false }
    return html
  }
  async function settle() { for (let n = 0; n < 16; n++) { render(); for (const item of effects.splice(0)) { item.state.cleanup?.(); item.state.cleanup = item.callback() } for (let i = 0; i < 16; i++) await Promise.resolve(); if (!dirty && !effects.length) return html } assert.fail('Assignment did not settle') }
  function text(value) { return Array.isArray(value) ? value.map(text).join('') : React.isValidElement(value) ? value.type.frame ? text(value.type.frame.tree) : text(value.props.children) : value == null ? '' : String(value) }
  function nodes() { const result = []; function visit(value) { if (Array.isArray(value)) return value.forEach(visit); if (!React.isValidElement(value)) return; if (value.type.frame) return visit(value.type.frame.tree); result.push(value); visit(value.props.children) } visit(tree); return result }
  function button(key, ns) { const found = nodes().filter(n => n.type === 'button' && text(n) === t(key, {}, ns)); assert.equal(found.length, 1, key); return found[0] }
  return { f, t, values, render, settle, nodes, text: () => text(tree), button, html: () => html,
    setProps(next) { props = { ...props, ...next } }, unmount() { for (const frame of frames.values()) for (const state of frame.slots) state.cleanup?.() } }
}

test('history API uses bounded exact target GETs and validates every allowed notice state', async () => {
  const states = [notice({ status: 'pending', attempts: 0, attempted_at: null, accepted_at: null }), notice({ status: 'processing', accepted_at: null }), notice(), notice({ status: 'needs_review', accepted_at: null, outcome_uncertain: true }), notice({ status: 'failed', accepted_at: null }), notice({ status: 'skipped', attempts: 0, attempted_at: null, accepted_at: null })]
  for (const value of states) { const f = api({ get: async () => report([event({ notices: [value] })]) }), signal = new AbortController().signal; const row = await f.getAssignmentHistory('lead', TARGET.toUpperCase(), {}, signal); assert.deepEqual(clone(row.items[0].notices[0]), value); assert.equal(f.calls[0].args[0], `/admin/leads/${TARGET}/assignment-history`); assert.equal(f.calls[0].args[1].signal, signal); assert.deepEqual(clone(f.calls[0].args[1].params), { limit: 10, offset: 0 }) }
  const account = await api({ get: async () => report([event({ action: 'cleared', notices: [] })]) }).getAssignmentHistory('account', TARGET); assert.equal(account.items[0].notices.length, 0)
})

test('history API rejects malformed, private, duplicated or inconsistent metadata without projecting extras', async () => {
  const malformed = [report([event({ recipient: 'private' })]), report([event({ notices: [notice({ provider_id: 'private' })] })]), report([event({ notices: [notice({ status: 'accepted', attempts: 0, attempted_at: null })] })]), report([event({ notices: [notice({ status: 'pending' })] })]), report([event({ notices: [notice({ status: 'needs_review', accepted_at: null })] })]), report([event({ notices: [notice({ status: 'failed', outcome_uncertain: true, accepted_at: null })] })]), report([event({ notices: [notice({ attempts: 2 })] })]), report([event({ notices: [notice(), notice()] })]), report([event(), event({ id: EVENT.toUpperCase() })]), report([], { tracked: true }), report([], { email: 'private' }), report([event({ created_at: 'yesterday' })])]
  for (const value of malformed) await assert.rejects(api({ get: async () => value }).getAssignmentHistory('lead', TARGET))
  await assert.rejects(api().getAssignmentHistory('account', TARGET))
  for (const args of [['bad', TARGET], ['lead', TARGET + '?private'], ['lead', TARGET, { limit: 51 }], ['lead', TARGET, { offset: 10001 }], ['lead', TARGET, { limit: true }]]) { const f = api(); await assert.rejects(f.getAssignmentHistory(...args)); assert.equal(f.calls.length, 0) }
})

test('new intent replays exact frozen body while legacy clients still omit request UUID', async () => {
  const f = api(), intent = f.createAssignmentIntent('lead', TARGET, FIRST), signal = new AbortController().signal
  assert.equal(Object.isFrozen(intent), true); await f.submitAssignment(intent, signal); await f.submitAssignment(intent, signal)
  assert.deepEqual(clone(f.calls[0].args[1]), { realtor_id: FIRST, request_id: intent.requestId }); assert.deepEqual(clone(f.calls[0].args[1]), clone(f.calls[1].args[1])); assert.equal(f.calls[0].args[2].signal, signal)
  await f.legacyLead.assignLead(TARGET, FIRST); await f.legacyAdmin.assignRealtorToOwner(TARGET, null)
  assert.deepEqual(clone(f.calls[2].args[1]), { realtor_id: FIRST }); assert.deepEqual(clone(f.calls[3].args[1]), { realtor_id: null })
  for (const [status, expected] of [[409, 'refused'], [401, 'denied'], [403, 'denied'], [404, 'refused'], [500, 'unconfirmed']]) { const x = api({ put: async () => { throw { response: { status } } } }); await assert.rejects(x.submitAssignment(intent), error => error.kind === expected); assert.equal(x.calls.length, 1) }
  await assert.rejects(api({ put: async () => ({ status: 200 }) }).submitAssignment(intent), error => error.kind === 'unconfirmed')
})

test('authoritative current read uses exact source ID and preserves a later assignment/status', async () => {
  const f = api({ get: async () => [currentRow({ id: OTHER }), currentRow()] }), signal = new AbortController().signal
  assert.deepEqual(clone(await f.getCurrentAssignment('lead', TARGET, signal)), { realtor_id: LATER, realtor_name: 'Current agent', status: 'closed', assigned_at: TIME }); assert.equal(f.calls[0].args[1].signal, signal)
  assert.deepEqual(clone(await f.getCurrentAssignment('account', TARGET, signal)), { realtor_id: LATER, realtor_name: 'Current agent' }); assert.equal(f.calls[1].args[0], '/admin/users')
  for (const rows of [[], [currentRow(), currentRow()], [currentRow({ assigned_realtor_id: 'private-invalid' })]]) await assert.rejects(api({ get: async () => rows }).getCurrentAssignment('lead', TARGET))
})

test('actual EN/ES history is lazy, metadata-only and honest about acceptance, uncertainty and no email', async () => {
  for (const language of ['en', 'es']) {
    const h = ui('AssignmentHistory', { get: async () => report([event({ notices: [notice(), notice({ kind: 'owner_upgrade_customer', status: 'pending', attempts: 0, attempted_at: null, accepted_at: null }), notice({ kind: 'owner_assigned_agent', status: 'processing', accepted_at: null })] }), event({ id: OTHER, notices: [] }), event({ id: FIRST, notices: [notice({ status: 'needs_review', accepted_at: null, outcome_uncertain: true })] })]) }, language)
    await h.settle(); assert.equal(h.f.calls.length, 0); h.button('assignment.open_history').props.onClick(); await h.settle()
    for (const key of ['assignment.accepted_note', 'assignment.no_email', 'assignment.email_uncertain', 'assignment.statuses.accepted', 'assignment.kinds.lead_assigned_agent', 'assignment.kinds.owner_upgrade_customer', 'assignment.kinds.owner_assigned_agent']) assert.ok(h.text().includes(h.t(key)))
    for (const privateValue of [TARGET, EVENT, OTHER, FIRST, 'lead_assigned_agent', 'needs_review', '@']) assert.ok(!h.text().includes(privateValue))
    assert.ok(!h.nodes().some(n => n.type === 'button' && /resend|reenviar|retry|reintentar/i.test(String(n.props.children))))
    h.button('assignment.hide_history').props.onClick(); await h.settle(); assert.equal(h.f.calls[0].args[1].signal.aborted, true)
  }
})

test('actual history handles10/1 pages, account no-email and read error with explicit refresh only', async () => {
  let broken = false
  const events = Array.from({ length: 11 }, (_, i) => event({ id: ID(100 + i), notices: [] }))
  const h = ui('AssignmentHistory', { get: async (_, options) => { if (broken) throw Error('private detail'); return report(events.slice(options.params.offset, options.params.offset + 10), { offset: options.params.offset, total: 11, tracked: true }) } }, 'en', { scope: 'account' })
  await h.settle(); h.button('assignment.open_history').props.onClick(); await h.settle(); assert.equal(h.nodes().filter(n => n.type === 'li').length, 10)
  h.button('next').props.onClick(); await h.settle(); assert.equal(h.f.calls[1].args[1].params.offset, 10); assert.equal(h.nodes().filter(n => n.type === 'li').length, 1); assert.equal(h.button('next').props.disabled, true)
  broken = true; h.button('refresh').props.onClick(); h.render(); assert.equal(h.nodes().filter(n => n.type === 'li').length, 0); await h.settle(); assert.ok(h.text().includes(h.t('assignment.load_error'))); assert.ok(!h.text().includes('private detail'))
  broken = false; h.button('refresh').props.onClick(); await h.settle(); assert.equal(h.f.calls.length, 4); assert.equal(h.nodes().filter(n => n.type === 'li').length, 1)
})

test('changing target or closing history aborts and ignores a late private result', async () => {
  let old
  const h = ui('AssignmentHistory', { get: url => url.includes(TARGET) ? new Promise(resolve => { old = resolve }) : Promise.resolve(report([])) })
  await h.settle(); h.button('assignment.open_history').props.onClick(); await h.settle(); h.setProps({ targetId: OTHER }); await h.settle()
  assert.equal(h.f.calls[0].args[1].signal.aborted, true); assert.equal(h.f.calls.length, 1)
  h.button('assignment.open_history').props.onClick(); await h.settle(); old(report()); await h.settle()
  assert.ok(h.text().includes(h.t('assignment.untracked'))); assert.equal(h.nodes().filter(n => n.type === 'li').length, 0)
  h.button('assignment.hide_history').props.onClick(); await h.settle(); assert.equal(h.f.calls[1].args[1].signal.aborted, true)
})

test('actual uncertain assignment locks choices and resolves only the same UUID/body, then shows later current state', async () => {
  let puts = 0
  const h = ui('AssignmentPanel', { put: async () => { if (++puts === 1) throw Error('lost response'); return { status: 204 } } })
  await h.settle(); h.button('assignment.save').props.onClick(); await h.settle()
  assert.ok(h.text().includes(h.t('assignment.change_uncertain'))); assert.equal(h.nodes().find(n => n.type === 'select').props.disabled, true); assert.equal(h.button('assignment.save').props.disabled, true)
  h.button('assignment.resolve').props.onClick(); await h.settle()
  const mutations = h.f.calls.filter(c => c.method === 'put'); assert.equal(mutations.length, 2); assert.deepEqual(clone(mutations[0].args[1]), clone(mutations[1].args[1])); assert.equal(mutations[0].args[1].realtor_id, FIRST)
  assert.equal(h.nodes().find(n => n.type === 'select').props.value, LATER); assert.ok(h.text().includes(h.t('assignment.saved'))); assert.equal(h.values[0].realtor_id, LATER); assert.equal(h.values[0].status, 'closed')
})

test('a confirmed mutation with failed current read stays locked and refresh performs GET only', async () => {
  let reads = 0
  const h = ui('AssignmentPanel', { get: async () => { if (++reads === 1) throw Error('lost current read'); return [currentRow()] } })
  await h.settle(); h.button('assignment.save').props.onClick(); await h.settle(); assert.ok(h.text().includes(h.t('assignment.saved_read_error'))); assert.equal(h.button('assignment.save').props.disabled, true)
  h.button('assignment.refresh_current').props.onClick(); await h.settle(); assert.equal(h.f.calls.filter(c => c.method === 'put').length, 1); assert.equal(reads, 2); assert.equal(h.values[0].realtor_id, LATER)
})

test('known conflict refreshes current assignment without silently replacing intent or resubmitting', async () => {
  const h = ui('AssignmentPanel', { put: async () => { throw { response: { status: 409 } } } })
  await h.settle(); h.button('assignment.save').props.onClick(); await h.settle(); assert.ok(h.text().includes(h.t('assignment.refused'))); assert.equal(h.f.calls.filter(c => c.method === 'put').length, 1); assert.equal(h.values[0].realtor_id, LATER); assert.equal(h.button('assignment.save').props.disabled, false)
})

test('current mutation401/403 clears current assignment, cached history and mutation controls', async () => {
  for (const status of [401, 403]) {
    const h = ui('AssignmentPanel', { put: async () => { throw { response: { status } } } })
    await h.settle(); h.button('assignment.open_history').props.onClick(); await h.settle(); assert.ok(h.nodes().some(n => n.type === 'li'))
    h.button('assignment.save').props.onClick(); await h.settle(); assert.ok(h.text().includes(h.t('assignment.access_lost'))); assert.equal(h.nodes().filter(n => n.type === 'li' || n.type === 'select').length, 0); assert.ok(!h.text().includes('Original agent')); assert.equal(h.values.length, 0)
  }
})

test('current history401/403/404 clears the enclosing assignment projection before a later read', async () => {
  for (const status of [401, 403, 404]) {
    let deny = false
    const h = ui('AssignmentPanel', { get: async () => { if (deny) throw { response: { status } }; return report() } })
    await h.settle(); h.button('assignment.open_history').props.onClick(); await h.settle(); deny = true
    h.button('refresh').props.onClick(); h.render(); assert.equal(h.nodes().filter(n => n.type === 'li').length, 0)
    await h.settle(); assert.equal(h.nodes().filter(n => n.type === 'select').length, 0); assert.ok(h.text().includes(h.t('assignment.access_lost')))
  }
})

test('target retirement aborts a pending mutation and ignores its later204 without a new read or write', async () => {
  let finish
  const h = ui('AssignmentPanel', { put: () => new Promise(resolve => { finish = resolve }) })
  await h.settle(); h.button('assignment.save').props.onClick(); await h.settle(); h.setProps({ targetId: OTHER, initial: { realtor_id: LATER, realtor_name: 'Next person agent' } }); await h.settle()
  assert.equal(h.f.calls[0].args[2].signal.aborted, true); finish({ status: 204 }); await h.settle(); assert.equal(h.f.calls.length, 1); assert.equal(h.values.length, 0); assert.ok(h.text().includes('Next person agent'))
})

test('read-only targets expose lazy history only and owner-access assignment requires confirmation', async () => {
  const read = ui('AssignmentPanel', {}, 'en', { readOnly: true }); await read.settle(); assert.equal(read.f.calls.length, 0); assert.equal(read.nodes().filter(n => n.type === 'select').length, 0); read.button('assignment.open_history').props.onClick(); await read.settle(); assert.equal(read.f.calls.length, 1)
  const h = ui('AssignmentPanel', {}, 'en', { ownerAccess: true }); await h.settle(); h.button('assignment.save').props.onClick(); await h.settle(); assert.equal(h.f.calls.length, 0); h.button('lead_panel.grant_access_confirm', 'admin').props.onClick(); await h.settle(); assert.equal(h.f.calls.filter(c => c.method === 'put').length, 1)
})

test('lead agent search keeps existing role-aware filtering and quick choice stays bound while uncertain', async () => {
  const h = ui('AssignmentPanel', { put: async () => { throw Error('lost response') } }, 'es', { propertyAgent: { id: LATER, name: 'Current agent' } })
  await h.settle(); h.nodes().find(n => n.type === 'input' && n.props.type === 'search').props.onChange({ target: { value: h.t('agent_choices.role_admin', {}, 'admin') } }); await h.settle()
  const options = h.nodes().filter(n => n.type === 'option'); assert.equal(options.length, 3); assert.ok(h.text().includes('Current agent'))
  const quick = h.nodes().filter(n => n.type === 'button' && String(n.props.children).startsWith(h.t('lead_panel.quick_assign', {}, 'admin'))); assert.equal(quick.length, 1)
  quick[0].props.onClick(); await h.settle(); assert.equal(h.f.calls[0].args[1].realtor_id, LATER); assert.equal(h.nodes().find(n => n.type === 'select').props.value, LATER)
  assert.equal(h.nodes().find(n => n.type === 'input').props.disabled, true); h.button('assignment.resolve').props.onClick(); await h.settle(); assert.deepEqual(clone(h.f.calls[0].args[1]), clone(h.f.calls[1].args[1]))
})

test('selected agent404 refusal refreshes a valid target and retains its current assignment and history', async () => {
  const h = ui('AssignmentPanel', { put: async () => { throw { response: { status: 404 } } } })
  await h.settle(); h.button('assignment.open_history').props.onClick(); await h.settle()
  h.button('assignment.save').props.onClick(); await h.settle()
  assert.ok(h.text().includes(h.t('assignment.refused'))); assert.ok(!h.text().includes(h.t('assignment.access_lost')))
  assert.equal(h.nodes().find(n => n.type === 'select').props.value, LATER); assert.equal(h.values[0].realtor_id, LATER)
  assert.ok(h.nodes().some(n => n.type === 'li')); assert.equal(h.f.calls.filter(c => c.method === 'put').length, 1)
  assert.equal(h.f.calls.filter(c => c.args[0] === '/admin/leads').length, 1)
  const deleted = ui('AssignmentPanel', { put: async () => { throw { response: { status: 404 } } }, get: async () => [] })
  await deleted.settle(); deleted.button('assignment.save').props.onClick(); await deleted.settle()
  assert.ok(deleted.text().includes(deleted.t('assignment.current_unavailable'))); assert.ok(deleted.text().includes(deleted.t('assignment.refused_read_error')))
  assert.ok(!deleted.text().includes('Original agent')); assert.ok(!deleted.text().includes(deleted.t('assignment.access_lost')))
  assert.equal(deleted.button('assignment.save').props.disabled, true); assert.equal(deleted.f.calls.filter(c => c.method === 'put').length, 1)
})
