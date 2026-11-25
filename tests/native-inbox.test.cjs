const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server')
const root = path.resolve(__dirname, '..'), prefix = 'apps/dashboard/src/'
const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0')
const plain = value => JSON.parse(JSON.stringify(value)), policy = { policy_version: 'native-inbox-v1', admin_oversight: true }
const member = (n, role = 'owner') => ({ id: id(n), user_code: n, display_name: 'Synthetic member ' + n, role })
const source = { kind: 'native', id: id(10), recipient_id: null }
const summary = changes => ({ id: source.id, participants: [member(1, 'buyer'), member(2, 'realtor')], brokerage_subject_id: id(1),
  created_at: '2026-01-01T00:00:00Z', last_entry_at: '2026-01-01T00:00:01Z', last_sequence: 2, last_entry_preview: null,
  unread_count: 1, is_observer: false, can_send: true, read_only_reason: null, ...policy, ...changes })
const entry = changes => ({ id: id(11), sequence: 2, kind: 'message', body: 'Synthetic message', author: member(2, 'realtor'),
  context_role: null, created_at: '2026-01-01T00:00:01Z', occurred_at: null, reported_direction: null, call_outcome: null, delivery_state: 'stored_in_app', ...changes })
const thread = changes => ({ source, conversation: summary(), items: [entry()], total: 2, cursor: null, next_cursor: 'opaque-resource-cursor',
  page_size: 30, read_only: false, read_only_reason: null, ...policy, review_id: null, review_expires_at: null, ...changes })
const response = data => ({ data, headers: { 'cache-control': 'no-store', pragma: 'no-cache' } })
const page = items => ({ items, total: items.length, page: 1, page_size: 30 })
const failure = status => ({ isAxiosError: true, response: { status } })

function loader(client, react = React, language = 'en', globals = {}) {
  const cache = new Map()
  function load(file) {
    const absolute = path.resolve(root, file)
    assert.ok(absolute.startsWith(root + path.sep))
    if (cache.has(absolute)) return cache.get(absolute).exports
    if (absolute.endsWith('.json')) return JSON.parse(fs.readFileSync(absolute, 'utf8'))
    const module = { exports: {} }; cache.set(absolute, module)
    const code = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { fileName: absolute, compilerOptions: {
      target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText
    vm.runInNewContext(code, { module, exports: module.exports, URL, URLSearchParams, Date, Intl, AbortController, Blob, Event, ...globals,
      require(name) {
        if (name === 'react') return react
        if (name === 'react/jsx-runtime') return require(name)
        if (name === 'axios') return { isAxiosError: value => value?.isAxiosError === true }
        if (name === 'react-router-dom') return { useSearchParams: () => assert.fail('No router in this bounded leaf') }
        if (name === 'react-i18next') return { useTranslation: (namespace, { keyPrefix = '' } = {}) => ({ i18n: { language }, t: (key, values = {}) => {
          const data = JSON.parse(fs.readFileSync(path.join(root, prefix, 'locale', language, namespace + '.json'), 'utf8'))
          const value = (keyPrefix ? keyPrefix + '.' + key : key).split('.').reduce((old, part) => old?.[part], data) ?? values.defaultValue
          assert.equal(typeof value, 'string', 'Missing ' + language + '/' + namespace + ':' + key)
          return value.replace(/\{\{(\w+)\}\}/g, (_, key) => String(values[key] ?? ''))
        } }) }
        if (name === './axios' && absolute.includes(path.sep + 'api' + path.sep)) return { __esModule: true, default: client }
        assert.ok(name.startsWith('.'), 'Unapproved module: ' + name)
        const base = path.resolve(path.dirname(absolute), name), target = ['', '.ts', '.tsx', '.json', '/index.ts'].map(s => base + s).find(f => fs.existsSync(f) && fs.statSync(f).isFile())
        assert.ok(target, 'Missing source import ' + name); return load(path.relative(root, target))
      },
    }, { filename: absolute })
    return module.exports
  }
  return load
}
function harness(reply) {
  const calls = [], client = Object.fromEntries(['get', 'post', 'put'].map(method => [method, async (...args) => {
    calls.push({ method, args }); return typeof reply === 'function' ? reply(method, ...args) : response(reply)
  }]))
  const load = loader(client)
  return { calls, load, api: load(prefix + 'api/inbox.ts') }
}

test('Inbox policy permits only website messages and manual records with explicit oversight', async () => {
  const channels = Object.fromEntries(['in_app', 'manual_whatsapp', 'manual_call', 'email', 'gmail', 'whatsapp_sync', 'sms', 'telephone_sync'].map((key, n) => [key, n < 3]))
  assert.deepEqual(plain(await harness({ ...policy, channels }).api.getInboxPolicy()), policy)
  for (const value of [{ ...policy, channels: { ...channels, gmail: true } }, { ...policy, admin_oversight: false, channels },
    { ...policy, policy_version: 'other', channels }, { ...policy, channels: { ...channels, phone: 'PRIVATE' } }])
    await assert.rejects(harness(value).api.getInboxPolicy())
  await assert.rejects(harness(() => ({ data: { ...policy, channels }, headers: {} })).api.getInboxPolicy())
})

test('recipient and list adapters keep only approved identities and never accept contact metadata', async () => {
  const h = harness(page([{ ...member(2, 'realtor'), relationship: 'assigned_agent' }])), signal = new AbortController().signal
  const result = await h.api.getInboxRecipients('Synthetic', 1, signal)
  assert.deepEqual(Object.keys(result.items[0]).sort(), ['id', 'user_code', 'display_name', 'role', 'relationship'].sort())
  assert.equal(h.calls[0].args[0], '/messaging/recipients')
  assert.equal(h.calls[0].args[1].signal, signal)
  assert.deepEqual(plain(h.calls[0].args[1].params), { q: 'Synthetic', page: 1 })
  await assert.rejects(harness(page([{ ...member(2), relationship: 'member', email: 'PRIVATE' }])).api.getInboxRecipients(''))
  await assert.rejects(h.api.getInboxRecipients('bad\nsearch'))
  await assert.rejects(h.api.getInboxRecipients('', 1001))
  const oversight = harness(page([summary({ is_observer: true, read_only_reason: 'review_required', can_send: false, last_entry_preview: 'PRIVATE' })]))
  await assert.rejects(oversight.api.getInboxConversations('oversight'))
})

test('history passes opaque cursors unchanged without a page ceiling and validates resource and review binding', async () => {
  const cursor = 'opaque-history-30001', next = 'next-resource-cursor', signal = new AbortController().signal
  const h = harness(thread({ cursor, next_cursor: next })), result = await h.api.getInboxThread(source, cursor, null, signal)
  assert.equal(result.cursor, cursor); assert.equal(result.next_cursor, next)
  assert.deepEqual(plain(h.calls[0].args[1].params), { cursor })
  assert.equal(h.calls[0].args[1].signal, signal)
  assert.equal(h.calls[0].args[0], '/messaging/conversations/' + source.id + '/entries')
  for (const changes of [{ source: { ...source, id: id(99) } }, { cursor: 'shifted' }, { next_cursor: cursor }, { review_id: id(99) }, { read_only: true },
    { review_expires_at: '2026-01-01T00:10:00Z' }, { conversation: summary({ last_sequence: 1 }) },
    { items: [entry(), entry()] }, { items: [entry({ sequence: 1 }), entry({ id: id(12), sequence: 2 })] }])
    await assert.rejects(harness(thread({ cursor, ...changes })).api.getInboxThread(source, cursor))
  await assert.rejects(h.api.getInboxThread(source, 'x'.repeat(513)))
  const legacy = { kind: 'service_negotiation', id: id(20), recipient_id: id(21) }, review = id(22)
  const legacyPage = thread({ source: legacy, conversation: null, items: [entry({ sequence: null, delivery_state: 'legacy_recorded', context_role: 'provider' })],
    read_only: true, read_only_reason: 'legacy_read_only', review_id: review, review_expires_at: '2026-01-01T00:10:00Z' })
  const reviewed = harness(legacyPage)
  assert.equal((await reviewed.api.getInboxThread(legacy, null, review)).items[0].delivery_state, 'legacy_recorded')
  assert.equal(reviewed.calls[0].args[0], '/messaging/admin/reviews/' + review + '/entries')
  await assert.rejects(harness({ ...legacyPage, read_only: false }).api.getInboxThread(legacy, null, review))
})

test('plain text normalization counts Unicode code points and rejects unsafe controls and malformed Unicode before transport', () => {
  const { api, calls } = harness(null), base = { action: 'entry_created', conversation_id: source.id, submission_id: id(30), kind: 'message' }
  const good = api.prepareInboxCommand({ ...base, body: '  ' + '😀'.repeat(2000) + '\r\n\t ' })
  assert.equal([...good.body.body].length, 2000)
  assert.equal(good.body.body, '😀'.repeat(2000))
  assert.equal(api.prepareInboxCommand({ ...base, body: ' First\nsecond\tthird\rline ' }).body.body, 'First\nsecond\tthird\rline')
  for (const body of ['😀'.repeat(2001), 'x\x00', 'x\x91', 'x\ud800', 'x\udfff', ' \t\r\n '])
    assert.throws(() => api.prepareInboxCommand({ ...base, body }), api.InboxInputError)
  assert.equal(calls.length, 0)
})

test('manual records require aware bounded time and reported context, while message bodies cannot claim external delivery', () => {
  const { api } = harness(null), now = Date.parse('2026-01-01T12:00:00Z')
  const base = { action: 'entry_created', conversation_id: source.id, submission_id: id(31), kind: 'manual_call', body: 'Manual report',
    occurred_at: '2026-01-01T11:00:00-01:00', reported_direction: 'incoming', call_outcome: 'no_answer' }
  const prepared = api.prepareInboxCommand(base, now)
  assert.equal(prepared.body.kind, 'manual_call'); assert.equal(prepared.body.reported_direction, 'incoming')
  assert.equal(Object.hasOwn(prepared.body, 'delivery_state'), false)
  for (const change of [{ occurred_at: null }, { occurred_at: '2026-01-01T12:00:00' }, { occurred_at: '1969-12-31T00:00:00Z' },
    { occurred_at: '2026-01-01T12:06:00Z' }, { reported_direction: null }, { call_outcome: null }, { kind: 'manual_whatsapp' }, { kind: 'message' }])
    assert.throws(() => api.prepareInboxCommand({ ...base, ...change }, now), api.InboxInputError)
})

test('each prepared command uses a fixed endpoint and deep frozen normalized body without actor impersonation', async () => {
  const { api } = harness(null)
  const cases = [
    [{ action: 'conversation_opened', recipient_id: id(2) }, '/conversations', 'post', null],
    [{ action: 'read_marked', conversation_id: source.id, last_read_sequence: 1 }, '/conversations/' + source.id + '/read', 'put', source.id],
    [{ action: 'visibility_saved', actor_id: id(1), expected_version: 0, visibility: 'private' }, '/preferences', 'put', id(1)],
    [{ action: 'block_saved', user_id: id(2), blocked: true }, '/blocks/' + id(2), 'put', id(2)],
    [{ action: 'review_opened', source, reason: 'support' }, '/admin/reviews', 'post', null],
  ]
  for (const [fields, endpoint, method, target] of cases) {
    const result = api.prepareInboxCommand({ submission_id: id(32), ...fields })
    assert.equal(result.path, endpoint); assert.equal(result.method, method); assert.equal(result.target, target)
    assert.ok(Object.isFrozen(result) && Object.isFrozen(result.body))
    assert.ok(!Object.hasOwn(result.body, 'actor_id') && !Object.hasOwn(result.body, 'author_id'))
    if (result.body.source) assert.ok(Object.isFrozen(result.body.source))
  }
  assert.throws(() => api.prepareInboxCommand({ action: 'review_opened', submission_id: id(32), source: { ...source, recipient_id: id(2) }, reason: 'support' }))
  const h = harness(response(null))
  await assert.rejects(h.api.executeInboxCommand({ path: '/../admin/users', method: 'put', body: {} }))
  assert.equal(h.calls.length, 0)
})

test('mutation and resolution receipts bind actor attempt, action and known target and preserve the identical body on retry', async () => {
  let prepared
  const h = harness((method, endpoint) => response({ submission_id: id(33), action: 'visibility_saved', target_id: id(1) }))
  prepared = h.api.prepareInboxCommand({ action: 'visibility_saved', submission_id: id(33), actor_id: id(1), expected_version: 0, visibility: 'members' })
  const signal = new AbortController().signal
  await h.api.executeInboxCommand(prepared, signal); await h.api.executeInboxCommand(prepared, signal); await h.api.resolveInboxCommand(prepared, signal)
  assert.equal(h.calls[0].args[1], h.calls[1].args[1])
  assert.equal(h.calls[0].args[2].signal, signal)
  assert.equal(h.calls[2].args[0], '/messaging/commands/' + id(33))
  for (const bad of [{ submission_id: id(34), action: 'visibility_saved', target_id: id(1) }, { submission_id: id(33), action: 'block_saved', target_id: id(1) },
    { submission_id: id(33), action: 'visibility_saved', target_id: id(2) }, { submission_id: id(33), action: 'visibility_saved', target_id: id(1), private: 'PRIVATE' }]) {
    const invalid = harness(bad), action = invalid.api.prepareInboxCommand({ action: 'visibility_saved', submission_id: id(33), actor_id: id(1), expected_version: 0, visibility: 'members' })
    await assert.rejects(invalid.api.executeInboxCommand(action))
  }
})

test('real EN/ES entry render escapes plain text and labels manual reports and Admin authors without delivery claims', () => {
  for (const language of ['en', 'es']) {
    const load = loader({ get() { assert.fail('No HTTP during SSR') } }, React, language), { InboxEntry } = load(prefix + 'components/inbox/InboxThread.tsx')
    const value = entry({ author: member(3, 'admin'), body: '<script>PRIVATE_MARKER</script>', kind: 'manual_call', delivery_state: 'manual_record',
      occurred_at: '2026-01-01T00:00:00Z', reported_direction: 'outgoing', call_outcome: 'voicemail' })
    const html = renderToStaticMarkup(React.createElement(InboxEntry, { entry: value }))
    const copy = JSON.parse(fs.readFileSync(path.join(root, prefix, 'locale', language, 'inbox.json')))
    assert.ok(html.includes('&lt;script&gt;PRIVATE_MARKER&lt;/script&gt;') && !html.includes('<script>'))
    assert.ok(html.includes(copy.manual_record_notice.replaceAll("'", '&#x27;')))
    assert.ok(html.includes(copy.roles.admin) && html.includes(copy.outcomes.voicemail))
    assert.ok(!html.includes('mailto:') && !html.includes('wa.me'))
    const old = JSON.parse(fs.readFileSync(path.join(root, prefix, 'locale', language, 'property_network.json')))
    for (const key of ['privacy', 'negotiation_privacy']) assert.match(old.conversation[key], language === 'en' ? /Admin.*audited.*read-only/ : /administradores.*auditada.*solo lectura/)
  }
})

test('private conversation links accept one opaque UUID and both locale trees cover the same interface', () => {
  const { load } = harness(null), { inboxConversationTarget } = load(prefix + 'pages/shared/Inbox.tsx')
  assert.deepEqual(plain(inboxConversationTarget(new URLSearchParams('conversation=' + source.id))), { id: source.id, invalid: false })
  for (const value of ['conversation=name@example.invalid', 'conversation=../users', 'conversation=' + source.id + '&conversation=' + source.id])
    assert.deepEqual(plain(inboxConversationTarget(new URLSearchParams(value))), { id: null, invalid: true })
  const keys = (value, base = '') => Object.entries(value).flatMap(([key, item]) => typeof item === 'string' ? [base + key] : keys(item, base + key + '.')).sort()
  const en = JSON.parse(fs.readFileSync(path.join(root, prefix, 'locale/en/inbox.json'))), es = JSON.parse(fs.readFileSync(path.join(root, prefix, 'locale/es/inbox.json')))
  assert.deepEqual(keys(en), keys(es))
})

// Real hooks and their actual effect cleanups, with an explicit bounded state
// adapter and synthetic promises. This is not DOM, real HTTP or browser proof.
function hookHarness(client) {
  const slots = [], effects = [], timers = new Map(), listeners = new Map()
  let cursor = 0, dirty = true, disposed = false, rootHook, current, nextTimer = 0, nextCommand = 100
  const slot = kind => { const index = cursor++; if (!slots[index]) slots[index] = { kind }; assert.equal(slots[index].kind, kind); return slots[index] }
  const hooks = { ...React,
    useState(initial) { const state = slot('state'); if (!Object.hasOwn(state, 'value')) state.value = typeof initial === 'function' ? initial() : initial
      return [state.value, update => { const value = typeof update === 'function' ? update(state.value) : update; if (!Object.is(value, state.value)) { state.value = value; if (!disposed) dirty = true } }] },
    useRef(initial) { const state = slot('ref'); return state.value ??= { current: initial } },
    useEffect(effect, deps) { const state = slot('effect'); if (!state.deps || deps.some((v, i) => !Object.is(v, state.deps[i]))) {
      state.deps = [...deps]; effects.push(() => { state.cleanup?.(); state.cleanup = effect() }) } },
  }
  const add = (type, fn) => { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn) }
  const remove = (type, fn) => { listeners.get(type)?.delete(fn); if (!listeners.get(type)?.size) listeners.delete(type) }
  const window = { addEventListener: add, removeEventListener: remove, dispatchEvent: event => { for (const fn of [...listeners.get(event.type) ?? []]) fn(event); return !event.defaultPrevented },
    setTimeout(fn, delay) { const id = ++nextTimer; timers.set(id, { fn, delay }); return id }, clearTimeout(id) { timers.delete(id) } }
  const document = { visibilityState: 'visible', addEventListener: add, removeEventListener: remove }
  const load = loader(client, hooks, 'en', { window, document, navigator: { onLine: true }, crypto: { randomUUID: () => id(nextCommand++) } })
  const h = { load, window, get value() { return current }, get timers() { return timers.size }, get listeners() { return listeners.size },
    get stateValues() { return slots.filter(state => state.kind === 'state').map(state => state.value) },
    setHook(fn) { rootHook = fn; dirty = true }, render() { dirty = true },
    async flush() { for (let n = 0; n < 25; n++) { if (dirty) { cursor = 0; dirty = false; current = rootHook(); for (const effect of effects.splice(0)) effect() }
      for (let tick = 0; tick < 24; tick++) await Promise.resolve(); if (!dirty && !effects.length) return } assert.fail('Unbounded hook render loop') },
    dispose() { disposed = true; for (const state of slots) state.cleanup?.() },
  }
  return h
}
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }

test('actual Inbox reader suppresses late prior-resource results, clears expired reviews and supports explicit authorized refresh', async () => {
  const h = hookHarness({ get() { assert.fail('Only explicit synthetic read promises') } }), { useInboxRead } = h.load(prefix + 'hooks/useInboxRead.ts')
  const requests = []; let key = 'resource-A'
  h.setHook(() => useInboxRead(key, signal => { const task = deferred(); requests.push({ ...task, signal, key }); return task.promise }))
  try {
    await h.flush(); requests[0].resolve({ body: 'AUTHORIZED_A' }); await h.flush()
    assert.equal(h.value.data.body, 'AUTHORIZED_A')
    h.window.dispatchEvent(new Event('focus')); await h.flush()
    const old = requests[1]; key = 'resource-B'; h.render(); await h.flush()
    assert.equal(old.signal.aborted, true); assert.equal(h.value.data, null)
    requests[2].resolve({ body: 'AUTHORIZED_B' }); await h.flush()
    old.resolve({ body: 'NEVER_RENDER_PRIOR_A' }); await h.flush()
    assert.equal(h.value.data.body, 'AUTHORIZED_B')
    h.window.dispatchEvent(new Event('focus')); await h.flush()
    requests[3].reject(failure(410)); await h.flush()
    assert.equal(h.value.data, null)
    assert.equal(h.value.error.response.status, 410)
    h.value.refresh(); await h.flush()
    requests[4].resolve({ body: 'AUTHORIZED_B_FRESH' }); await h.flush()
    assert.equal(h.value.data.body, 'AUTHORIZED_B_FRESH')
  } finally { h.dispose() }
  assert.equal(h.timers, 0); assert.equal(h.listeners, 0)
})

test('actual Inbox attempt never automatically retries and requires a fresh authorized read after its receipt before completing', async () => {
  const posts = [], resolves = [], reads = [], applied = []
  const client = { post(endpoint, body, config) { const task = deferred(); posts.push({ ...task, endpoint, body, config }); return task.promise },
    get(endpoint, config) { const task = deferred(); resolves.push({ ...task, endpoint, config }); return task.promise } }
  const h = hookHarness(client), { useInboxCommand } = h.load(prefix + 'hooks/useInboxCommand.ts')
  h.setHook(() => useInboxCommand({ load(receipt, attempt, signal) { const task = deferred(); reads.push({ ...task, receipt, attempt, signal }); return task.promise },
    authorize: async () => ({ writable: true }), canRetry: (_, state) => state.writable, applied: (state, receipt) => applied.push({ state, receipt }) }))
  const input = { action: 'entry_created', submission_id: id(40), conversation_id: source.id, kind: 'message', body: 'Exact original draft' }
  try {
    await h.flush(); h.value.send(input); h.value.send({ ...input, submission_id: id(49), body: 'Immediate duplicate tap' }); await h.flush()
    assert.equal(posts.length, 1)
    const frozen = h.value.pending; input.body = 'Changed after submit'
    posts[0].reject(failure(503)); await h.flush()
    assert.equal(h.value.pending, frozen); assert.equal(posts.length, 1); assert.equal(applied.length, 0)
    h.value.check(); await h.flush(); resolves[0].reject(failure(404)); await h.flush()
    assert.equal(h.value.checked, true); assert.equal(h.value.pending, frozen); assert.equal(posts.length, 1)
    h.value.retry(); await h.flush()
    assert.equal(posts.length, 2); assert.equal(posts[1].body, posts[0].body)
    assert.equal(posts[1].body.body, 'Exact original draft')
    posts[1].resolve(response({ submission_id: id(40), action: 'entry_created', target_id: id(41) })); await h.flush()
    assert.equal(reads.length, 1); assert.equal(h.value.pending, frozen); assert.equal(applied.length, 0)
    reads[0].resolve({ writable: true, authoritative: true }); await h.flush()
    assert.equal(h.value.pending, null); assert.equal(applied.length, 1); assert.equal(applied[0].state.authoritative, true)
  } finally { h.dispose() }
})

test('actual Inbox attempt ignores late completion after access loss', async () => {
  const post = deferred(), callbacks = [], client = { post: () => post.promise, get() { assert.fail('No automatic command resolver') } }
  const h = hookHarness(client), { useInboxCommand } = h.load(prefix + 'hooks/useInboxCommand.ts'); let blocked = false
  h.setHook(() => useInboxCommand({ load: async () => ({ current: true }), authorize: async () => ({ current: true }),
    canRetry: () => true, applied: value => callbacks.push(value) }, blocked))
  try {
    await h.flush()
    h.value.send({ action: 'entry_created', submission_id: id(42), conversation_id: source.id, kind: 'message', body: 'Local private draft' }); await h.flush()
    const signal = h.value.pending; blocked = true; h.render(); await h.flush()
    post.resolve(response({ submission_id: id(42), action: 'entry_created', target_id: id(43) })); await h.flush()
    assert.equal(h.value.denied, true); assert.equal(callbacks.length, 0); assert.equal(h.value.pending, signal)
  } finally { h.dispose() }
})

test('actual Inbox input failure stays editable while a malformed transport acknowledgement keeps the frozen attempt', async () => {
  const calls = []
  const h = hookHarness({ post(endpoint, body) { calls.push({ endpoint, body }); return Promise.resolve(response({ submission_id: body.submission_id, action: 'entry_created' })) },
    get() { assert.fail('No automatic resolver') } })
  const { useInboxCommand } = h.load(prefix + 'hooks/useInboxCommand.ts')
  h.setHook(() => useInboxCommand({ load() { assert.fail('Malformed receipt cannot authorize completion') }, authorize: async () => true,
    canRetry: () => true, applied() { assert.fail('Malformed receipt cannot complete') } }))
  const base = { action: 'entry_created', submission_id: id(44), conversation_id: source.id, kind: 'message' }
  try {
    await h.flush(); h.value.send({ ...base, body: 'Unsafe\x00body' }); await h.flush()
    assert.equal(h.value.invalid, true); assert.equal(h.value.pending, null); assert.equal(calls.length, 0)
    h.value.send({ ...base, body: 'Corrected local draft' }); await h.flush()
    assert.equal(h.value.invalid, false); assert.equal(h.value.pending.body.body, 'Corrected local draft')
    assert.equal(h.value.saved, false); assert.equal(h.value.busy, false); assert.equal(calls.length, 1)
    h.value.send({ ...base, submission_id: id(45), body: 'Must remain locked' }); await h.flush()
    assert.equal(calls.length, 1)
  } finally { h.dispose() }
})

test('actual private components immediately hide cached projections after write denial and retain a non-retryable frozen attempt', async () => {
  const copy = JSON.parse(fs.readFileSync(path.join(root, prefix, 'locale/en/inbox.json')))
  function nodes(element) {
    if (!React.isValidElement(element)) return []
    return [element, ...React.Children.toArray(element.props.children).flatMap(nodes)]
  }
  const find = (h, type, predicate = () => true) => {
    const value = nodes(h.value).find(node => node.type === type && predicate(node.props))
    assert.ok(value, 'Expected actual control ' + type); return value.props
  }
  const button = (h, label) => find(h, 'button', props => props.children === label)
  const html = h => renderToStaticMarkup(h.value)
  for (const status of [401, 403, 404]) {
    for (const view of ['thread', 'recipients', 'preferences', 'blocks', 'audit']) {
      const calls = []; let writes = 0, readsBeforeDenial = 0
      const h = hookHarness({
        get(endpoint) {
          calls.push({ method: 'get', endpoint })
          if (endpoint === '/messaging/preferences') return Promise.resolve(response({ visibility: 'private', version: 1, ...policy }))
          if (endpoint === '/messaging/recipients') return Promise.resolve(response(page([{ ...member(2, 'realtor'), relationship: 'assigned_agent' }])))
          if (endpoint === '/messaging/blocks') return Promise.resolve(response(page([member(2, 'realtor')])))
          assert.equal(endpoint, view === 'audit' ? '/messaging/admin/reviews/' + id(55) + '/entries' : '/messaging/conversations/' + source.id + '/entries')
          return Promise.resolve(response(thread({ items: [entry({ body: 'CACHED_PRIVATE_BODY' })],
            ...(view === 'audit' ? { conversation: summary({ is_observer: true }), review_id: id(55), review_expires_at: new Date(Date.now() + 600000).toISOString() } : {}) })))
        },
        post(endpoint, body) {
          calls.push({ method: 'post', endpoint, body }); writes++
          if (view === 'audit' && writes === 1) return Promise.resolve(response({ submission_id: body.submission_id, action: 'review_opened', target_id: id(55) }))
          return Promise.reject(failure(status))
        },
        put(endpoint, body) { calls.push({ method: 'put', endpoint, body }); return Promise.reject(failure(status)) },
      })
      const directory = h.load(prefix + 'components/inbox/InboxDirectory.tsx'), threads = h.load(prefix + 'components/inbox/InboxThread.tsx')
      const props = { actor: id(1), freshPolicy: true }
      h.setHook(() => view === 'thread' ? threads.InboxThread({ source, user: member(1, 'buyer'), freshPolicy: true })
        : view === 'recipients' ? directory.InboxRecipients({ ...props, onOpen() { assert.fail('Denied write cannot open a conversation') } })
        : view === 'preferences' ? directory.InboxPreferences(props)
        : view === 'blocks' ? directory.InboxBlocks(props)
        : threads.InboxAuditWorkspace({ source, user: member(3, 'admin'), freshPolicy: true }))
      try {
        await h.flush()
        if (view === 'thread') {
          assert.ok(html(h).includes('CACHED_PRIVATE_BODY'))
          find(h, 'textarea').onChange({ target: { value: 'LOCAL_SECRET_DRAFT' } }); await h.flush()
          assert.ok(html(h).includes('LOCAL_SECRET_DRAFT'))
          readsBeforeDenial = calls.filter(call => call.method === 'get').length
          find(h, 'form').onSubmit({ preventDefault() {} })
        } else if (view === 'recipients') {
          assert.ok(html(h).includes(member(2).display_name))
          find(h, 'input').onChange({ target: { value: 'LOCAL_DIRECTORY_DRAFT' } }); await h.flush()
          button(h, copy.select_member).onClick(); await h.flush()
          readsBeforeDenial = calls.filter(call => call.method === 'get').length
          button(h, copy.start_conversation).onClick()
        } else if (view === 'preferences') {
          find(h, 'input', props => props.type === 'checkbox').onChange({ target: { checked: true } }); await h.flush()
          readsBeforeDenial = calls.filter(call => call.method === 'get').length
          find(h, 'form').onSubmit({ preventDefault() {} })
        } else if (view === 'blocks') {
          assert.ok(html(h).includes(member(2).display_name))
          readsBeforeDenial = calls.filter(call => call.method === 'get').length
          button(h, copy.unblock).onClick()
        } else {
          button(h, copy.open_review).onClick(); await h.flush()
          assert.ok(nodes(h.value).some(node => node.type === threads.InboxThread))
          readsBeforeDenial = calls.filter(call => call.method === 'get').length
          button(h, copy.renew_review).onClick()
        }
        await h.flush()
        const frozen = h.stateValues.find(value => value?.body && value?.submission_id)
        assert.ok(frozen && Object.isFrozen(frozen) && Object.isFrozen(frozen.body))
        assert.equal(calls.filter(call => call.method === 'get').length, readsBeforeDenial, 'Private projection hidden before any polling or authorization read')
        if (view === 'audit') assert.equal(nodes(h.value).some(node => node.type === threads.InboxThread), false)
        else {
          const output = html(h)
          assert.ok(!output.includes('CACHED_PRIVATE_BODY') && !output.includes('LOCAL_SECRET_DRAFT') && !output.includes(member(2).display_name))
          if (view !== 'recipients') assert.equal(nodes(h.value).some(node => node.type === 'form'), false)
          else assert.ok(!nodes(h.value).some(node => node.type === 'button' && [copy.select_member, copy.start_conversation].includes(node.props.children)))
        }
        if (view === 'thread') assert.equal(h.stateValues.includes('LOCAL_SECRET_DRAFT'), false, 'Local composer cleared without editing frozen request')
        if (view === 'recipients') assert.equal(h.stateValues.includes('LOCAL_DIRECTORY_DRAFT'), false)
        const count = calls.filter(call => call.method !== 'get').length
        await h.flush()
        assert.equal(calls.filter(call => call.method !== 'get').length, count)
        assert.ok(!calls.some(call => call.endpoint.startsWith('/messaging/commands/')), 'No automatic resolver or retry after denial')
      } finally { h.dispose() }
      assert.equal(h.timers, 0); assert.equal(h.listeners, 0)
    }
  }
})
