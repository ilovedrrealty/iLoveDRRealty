// Bounded actual helper/React handlers with synthetic GET/clipboard/window seams.
// No app server, browser, database, external app or provider is opened.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm')
const ts = require('typescript'), React = require('react'), runtime = require('react/jsx-runtime')
const { renderToStaticMarkup } = require('react-dom/server')
const root = path.resolve(__dirname, '..'), src = path.join(root, 'apps/dashboard/src')
const ID = n => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const TARGET = ID(1), OTHER = ID(2), ACTOR = ID(3), PROPERTY = ID(4)
const clone = value => JSON.parse(JSON.stringify(value)), deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
const codes = new Map()
function code(file) {
  if (!codes.has(file)) codes.set(file, ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText)
  return codes.get(file)
}
function load(relative, overrides = {}, globals = {}) {
  const file = path.join(src, relative), module = { exports: {} }
  vm.runInNewContext(code(file), { module, exports: module.exports, URL, AbortController, ...globals, require(name) {
    if (Object.hasOwn(overrides, name)) return overrides[name]
    if (name === '../../../../packages/sharing/manual') {
      const m = { exports: {} }; vm.runInNewContext(code(path.join(root, 'packages/sharing/manual.ts')), { module: m, exports: m.exports, URL }); return m.exports
    }
    if (name === './contactShare') return load('lib/contactShare.ts')
    return require(name)
  } })
  return module.exports
}
const model = load('lib/leadFollowUp.ts')
const raw = (changes = {}) => ({ id: TARGET, type: 'buyer_interest', name: 'Synthetic customer', email: 'customer+one@example.com', phone: '+18095550101',
  property_id: PROPERTY, assigned_realtor_id: ACTOR, message: 'PRIVATE LEAD NOTE', tracking_summary: { campaign: 'PRIVATE TRACKING' }, from_user_id: 'PRIVATE ACCOUNT', ...changes })
const contact = (changes = {}) => ({ id: TARGET, type: 'buyer_interest', name: 'Synthetic customer', email: 'customer+one@example.com', phone: '+18095550101',
  propertyId: PROPERTY, actorId: ACTOR, actorRole: 'realtor', assigneeId: ACTOR, ...changes })
function api(read = async url => url.endsWith('/auth/me') ? { id: ACTOR, role: 'admin' } : [raw()]) {
  const calls = []
  return { calls, ...load('api/leadFollowUp.ts', { './axios': { __esModule: true, default: { getUri: ({ url }) => 'https://owned.example' + url } }, '../lib/leadFollowUp': model }, {
    fetch: async (url, options) => { calls.push({ url, options }); const value = await read(url, options); return value && Object.hasOwn(value, 'ok') ? value : { ok: true, status: 200, json: async () => value } }
  }) }
}
const AccessLost = api().FollowUpAccessLost
function ui(options = {}) {
  const frames = new Map(), wrappers = new Map(), effects = [], calls = [], copied = [], opened = [], events = new Map()
  const locale = options.locale ?? 'en', copy = JSON.parse(fs.readFileSync(path.join(src, 'locale', locale, 'admin.json')))
  const t = key => { const value = key.split('.').reduce((v, k) => v?.[k], copy); assert.equal(typeof value, 'string', key); return value }
  let active, seen, tree, html, dirty = false, props = { targetId: TARGET }, current = contact()
  const read = async (id, signal) => { calls.push({ kind: 'lead', id, signal }); return options.read ? options.read(id, signal) : clone(current) }
  function slot(kind) { const i = active.cursor++; if (!active.slots[i]) active.slots[i] = { kind }; assert.equal(active.slots[i].kind, kind); return active.slots[i] }
  const hooks = { ...React,
    useState(initial) { const s = slot('state'); if (!Object.hasOwn(s, 'value')) s.value = typeof initial === 'function' ? initial() : initial; return [s.value, value => { s.value = typeof value === 'function' ? value(s.value) : value; dirty = true }] },
    useRef(initial) { const s = slot('ref'); return s.value ??= { current: initial } },
    useEffect(callback, deps) { const s = slot('effect'); if (!s.deps || deps.some((v, i) => v !== s.deps[i])) { s.deps = [...deps]; effects.push({ s, callback }) } }
  }
  function wrap(type, key) {
    if (!wrappers.has(type)) wrappers.set(type, new Map())
    const group = wrappers.get(type), identity = key ?? 'root'
    if (!group.has(identity)) {
      const f = { cursor: 0, slots: [], mounted: false, tree: null }; frames.set(f, f)
      const W = p => { if (!f.mounted) f.slots = []; f.mounted = true; seen.add(f); const old = active; active = f; f.cursor = 0; try { f.tree = type(p); return f.tree } finally { active = old } }
      W.frame = f; group.set(identity, W)
    }
    return group.get(identity)
  }
  const jsx = (type, p, key) => runtime.jsx(typeof type === 'function' ? wrap(type, key) : type, p, key)
  const jsxs = (type, p, key) => runtime.jsxs(typeof type === 'function' ? wrap(type, key) : type, p, key)
  const window = { addEventListener: (key, value) => events.set(key, value), removeEventListener: key => events.delete(key), open: (...args) => { opened.push(args); return null } }
  const document = { visibilityState: 'visible', addEventListener: (key, value) => events.set(key, value), removeEventListener: key => events.delete(key) }
  const module = load('components/admin/LeadFollowUp.tsx', {
    react: hooks, 'react/jsx-runtime': { ...runtime, jsx, jsxs }, 'react-i18next': { useTranslation: () => ({ t, i18n: { language: locale } }) },
    '../../lib/leadFollowUp': model, '../../api/leadFollowUp': { FollowUpAccessLost: AccessLost, getFollowUpLead: read,
      getPublicFollowUpLink: async (id, signal) => { calls.push({ kind: 'property', id, signal }); return options.property ? options.property(id, signal) : model.propertyDraftUrl(id) } }
  }, { window, document, navigator: { clipboard: { writeText: async value => { if (options.copyFails) throw new Error('owned failure'); copied.push(value) } } } })
  function render() {
    dirty = false; seen = new Set(); tree = jsx(module.LeadFollowUp, props, props.targetId); html = renderToStaticMarkup(tree)
    for (const f of frames.values()) if (!seen.has(f)) { for (const s of f.slots) { s.cleanup?.(); s.cleanup = undefined } f.mounted = false }
    return html
  }
  async function settle() { for (let i = 0; i < 20; i++) { render(); for (const e of effects.splice(0)) { e.s.cleanup?.(); e.s.cleanup = e.callback() } for (let j = 0; j < 24; j++) await Promise.resolve(); if (!dirty && !effects.length) return html } assert.fail('UI did not settle') }
  function text(v) { return Array.isArray(v) ? v.map(text).join('') : React.isValidElement(v) ? v.type.frame ? text(v.type.frame.tree) : text(v.props.children) : v == null ? '' : String(v) }
  function nodes() { const result = []; function visit(v) { if (Array.isArray(v)) return v.forEach(visit); if (!React.isValidElement(v)) return; if (v.type.frame) return visit(v.type.frame.tree); result.push(v); visit(v.props.children) } visit(tree); return result }
  function button(key) { const found = nodes().filter(n => n.type === 'button' && text(n) === t('manual_follow_up.' + key)); assert.equal(found.length, 1, key); return found[0] }
  function input(tag, number = 0) { return nodes().filter(n => n.type === tag)[number] }
  return { calls, copied, opened, t, nodes, button, input, settle, html: () => html, text: () => text(tree),
    setCurrent(value) { current = value }, setTarget(id) { props = { targetId: id } }, event(key, hidden = false) { document.visibilityState = hidden ? 'hidden' : 'visible'; events.get(key)?.() },
    async click(key) { const b = button(key); assert.ok(!b.props.disabled); await b.props.onClick(); return settle() } }
}

test('all EN/ES templates ask relevant next steps using only the deliberate name and type', () => {
  const safe = model.projectFollowUpLead(raw(), { id: ACTOR, role: 'admin' })
  assert.deepEqual(Object.keys(safe).sort(), ['actorId','actorRole','assigneeId','email','id','name','phone','propertyId','type'])
  assert.equal(model.projectFollowUpLead(raw({ assigned_realtor_id: OTHER }), { id: ACTOR, role: 'realtor' }), null)
  for (const language of ['en','es']) for (const kind of model.draftKinds) {
    const value = model.welcomeDraft(language, kind, 'Edited recipient'), text = value.subject + value.body
    assert.ok(text.includes('Edited recipient') && model.validFollowUpDraft({ ...value, publicUrl: null }))
    for (const secret of ['PRIVATE LEAD NOTE','PRIVATE TRACKING','PRIVATE ACCOUNT',TARGET,ACTOR]) assert.ok(!text.includes(secret))
  }
  assert.match(model.welcomeDraft('en','buyer','A').body, /budget.*When.*viewing/s)
  assert.match(model.welcomeDraft('es','renter','A').body, /fechas.*presupuesto.*ocupantes/)
  assert.match(model.welcomeDraft('en','seller','A').body, /features.*valuation/s)
  assert.equal(model.recipientName('A\r\nBcc: hidden'), '')
})
test('recipient destinations reject header injection and national/default-country phone assumptions', () => {
  const value = { subject: 'Café & home?', body: 'Hola & hello\nSecond line', publicUrl: null }
  const email = new URL(model.followUpDestination('email', contact(), value))
  assert.equal(decodeURIComponent(email.pathname), contact().email); assert.equal(email.searchParams.get('subject'), value.subject); assert.equal(email.searchParams.get('body'), value.body)
  assert.deepEqual([...email.searchParams.keys()], ['subject','body'])
  const whatsapp = new URL(model.followUpDestination('whatsapp', contact(), value)); assert.equal(whatsapp.pathname, '/18095550101'); assert.equal(whatsapp.searchParams.get('text'), value.body)
  assert.equal(model.followUpDestination('call', contact(), value), 'tel:+18095550101')
  for (const phone of ['8095550101','(809)555-0101','020 7946 0101','+1','+18095550101 ext 2','+18095550101 click here','+18095550101\nPRIVATE']) assert.equal(model.internationalDestination(phone), null, phone)
  for (const address of ['a@b.co?bcc=private@b.co','a@b.co\r\nBcc: private@b.co','a@b.co,b@b.co']) assert.equal(model.followUpDestination('email', contact({ email: address }), value), null)
  assert.equal(model.followUpDestination('email', contact(), { ...value, subject: 'Hi\r\nBcc: x@y.co' }), null)
  assert.equal(model.validFollowUpDraft({ ...value, body: 'x'.repeat(3999), publicUrl: model.propertyDraftUrl(PROPERTY) }), false)
  for (const part of ['subject','body']) assert.equal(model.followUpDestination('email',contact(),{...value,[part]:'\ud800'}),null)
  assert.equal(model.followUpDestination('email',contact({email:'\ud800@example.com'}),value),null)
})
test('fresh existing staff GETs authorize Admin/current-assignee and deliberately omit private lead fields', async () => {
  for (const role of ['admin','realtor']) {
    const f = api(async url => url.endsWith('/auth/me') ? { id: ACTOR, role } : [raw()]), signal = new AbortController().signal
    const result = await f.getFollowUpLead(TARGET, signal)
    assert.equal(result.actorRole, role); assert.equal(f.calls[1].url, 'https://owned.example/' + (role==='admin'?'admin':'realtor') + '/leads')
    assert.ok(f.calls.every(call => call.options.signal === signal && call.options.cache === 'no-store' && call.options.credentials === 'include' && call.options.redirect === 'error'))
    assert.ok(!JSON.stringify(result).includes('PRIVATE'))
  }
  for (const role of ['buyer','owner']) { const f = api(async () => ({ id: ACTOR, role })); await assert.rejects(f.getFollowUpLead(TARGET, new AbortController().signal)); assert.equal(f.calls.length, 1) }
  const reassigned = api(async url => url.endsWith('/auth/me') ? { id: ACTOR, role: 'realtor' } : [raw({ assigned_realtor_id: OTHER })]); await assert.rejects(reassigned.getFollowUpLead(TARGET, new AbortController().signal))
  const duplicate = api(async url => url.endsWith('/auth/me') ? { id: ACTOR, role: 'admin' } : [raw(),raw()]); await assert.rejects(duplicate.getFollowUpLead(TARGET,new AbortController().signal))
})
test('public listing links require anonymous no-store active exact-id reads without photos or grants', async () => {
  const response = row => ({ ok: true, status: 200, headers: new Map([['cache-control','no-store']]), json: async () => row })
  const f = api(async () => response({ id: PROPERTY, status: 'active', description: 'PRIVATE', latitude: 19, images: ['private'] }))
  assert.equal(await f.getPublicFollowUpLink(PROPERTY,new AbortController().signal),model.propertyDraftUrl(PROPERTY))
  assert.equal(f.calls[0].options.credentials,'omit'); assert.equal(f.calls[0].options.cache,'no-store'); assert.deepEqual(Object.keys(f.calls[0].options.headers),['Accept'])
  for (const row of [{id:OTHER,status:'active'},{id:PROPERTY,status:'inactive'}]) assert.equal(await api(async()=>response(row)).getPublicFollowUpLink(PROPERTY,new AbortController().signal),null)
  assert.equal(await api(async()=>({ok:false,status:404})).getPublicFollowUpLink(PROPERTY,new AbortController().signal),null)
  assert.equal(await api(async()=>({...response({id:PROPERTY,status:'active'}),headers:new Map()})).getPublicFollowUpLink(PROPERTY,new AbortController().signal),null)
})
test('actual lazy editor supports explicit message language/name/template/body and truthful clipboard feedback', async () => {
  const f=ui(); await f.settle(); assert.equal(f.calls.length,0); await f.click('open'); assert.match(f.html(),/approximate budget/)
  f.input('input').props.onChange({target:{value:'María'}}); await f.settle()
  f.input('select',0).props.onChange({target:{value:'es'}}); await f.settle(); assert.match(f.html(),/Hola María/)
  f.input('select',1).props.onChange({target:{value:'renter'}}); await f.settle(); assert.match(f.html(),/ocupantes/)
  f.input('textarea').props.onChange({target:{value:'Edited exact body & question?'}}); await f.settle(); await f.click('copy')
  assert.deepEqual(f.copied,['Edited exact body & question?']); assert.equal(f.calls.length,2); assert.equal(f.opened.length,0)
  assert.ok(f.text().includes(f.t('manual_follow_up.copied')))
})
test('actual email WhatsApp and call handlers only request validated recipient handoffs after fresh reads', async () => {
  const f=ui(); await f.settle(); await f.click('open'); for(const key of ['email','whatsapp','call'])await f.click(key)
  assert.equal(f.calls.length,4); assert.equal(f.opened.length,3)
  assert.ok(f.opened[0][0].startsWith('mailto:customer%2Bone%40example.com?'))
  assert.ok(f.opened[1][0].startsWith('https://wa.me/18095550101?text=')); assert.equal(f.opened[2][0],'tel:+18095550101')
  assert.ok(f.opened.every(args=>args[1]==='_blank'&&args[2]==='noopener,noreferrer')); assert.ok(f.text().includes(f.t('manual_follow_up.requested')))
})
test('changed authoritative contact blocks an old draft action and resets the actual editor', async () => {
  const f=ui(); await f.settle(); await f.click('open'); f.input('textarea').props.onChange({target:{value:'OLD PRIVATE DRAFT'}}); await f.settle()
  f.setCurrent(contact({name:'Changed customer',email:'changed@example.com'})); await f.click('email')
  assert.equal(f.opened.length,0); assert.ok(!f.html().includes('OLD PRIVATE DRAFT')); assert.ok(f.html().includes('Changed customer')); assert.ok(f.text().includes(f.t('manual_follow_up.changed')))
})
test('current access loss and transient read error clear all drafts and only allow a fresh retry', async () => {
  for(const error of [new AccessLost(),new Error('owned unavailable')]) {
    let fail=false; const f=ui({read:async()=>{if(fail)throw error;return contact()}}); await f.settle(); await f.click('open')
    f.input('textarea').props.onChange({target:{value:'OLD PRIVATE DRAFT'}});await f.settle();fail=true;await f.click('copy')
    assert.equal(f.copied.length,0);assert.ok(!f.html().includes('OLD PRIVATE DRAFT')&&!f.html().includes(contact().email))
    assert.ok(f.text().includes(f.t('manual_follow_up.'+(error instanceof AccessLost?'denied':'error'))))
    fail=false;await f.click('refresh');assert.ok(!f.html().includes('OLD PRIVATE DRAFT'));assert.match(f.html(),/approximate budget/)
  }
})
test('closing and target replacement abort stale reads before they can project contact or draft text', async () => {
  const wait=deferred();let first=true;const f=ui({read:async id=>{if(first){first=false;return wait.promise}return contact({id,name:'Second customer'})}})
  await f.settle(); f.button('open').props.onClick();await f.settle();const signal=f.calls[0].signal;await f.click('close');assert.equal(signal.aborted,true)
  f.setTarget(OTHER);await f.settle();await f.click('open');wait.resolve(contact());await f.settle()
  assert.ok(f.html().includes('Second customer')&&!f.html().includes('Synthetic customer'));assert.equal(f.copied.length,0)
})
test('actual public-link choice is opt-in and withdrawal blocks the message rather than sharing a stale link', async () => {
  let available=true;const f=ui({property:async()=>available?model.propertyDraftUrl(PROPERTY):null});await f.settle();await f.click('open');await f.click('check_link')
  assert.equal(f.input('input',2).props.type,'checkbox');assert.equal(f.input('input',2).props.checked,false)
  f.input('input',2).props.onChange({target:{checked:true}});await f.settle();available=false;await f.click('copy')
  assert.equal(f.copied.length,0);assert.equal(f.opened.length,0);assert.ok(!f.html().includes(model.propertyDraftUrl(PROPERTY)));assert.ok(f.text().includes(f.t('manual_follow_up.link_unavailable')))
  const changed=ui();await changed.settle();await changed.click('open');await changed.click('check_link')
  changed.input('input',2).props.onChange({target:{checked:true}});await changed.settle()
  changed.setCurrent(contact({propertyId:OTHER}));await changed.click('email')
  assert.equal(changed.opened.length,0);assert.ok(!changed.html().includes(model.propertyDraftUrl(PROPERTY)));assert.ok(changed.text().includes(changed.t('manual_follow_up.changed')))
})
test('focus refresh and hidden-page retirement clear draft state; clipboard errors never claim copying', async () => {
  const f=ui({copyFails:true});await f.settle();await f.click('open');await f.click('copy');assert.ok(f.text().includes(f.t('manual_follow_up.copy_failed')));assert.equal(f.copied.length,0)
  assert.ok(f.input('textarea')&&!f.input('textarea').props.disabled);assert.match(f.input('textarea').props.value,/approximate budget/)
  f.input('textarea').props.onChange({target:{value:'UNSAVED BODY'}});await f.settle();f.event('visibilitychange',true);await f.settle();assert.ok(!f.html().includes('UNSAVED BODY')&&!f.html().includes(contact().email))
  f.event('visibilitychange',false);await f.settle();assert.match(f.html(),/approximate budget/)
})
test('both UI languages keep editable controls and qualified manual-only feedback with identical copy keys', async () => {
  const en=JSON.parse(fs.readFileSync(path.join(src,'locale/en/admin.json'))).manual_follow_up,es=JSON.parse(fs.readFileSync(path.join(src,'locale/es/admin.json'))).manual_follow_up
  assert.deepEqual(Object.keys(en).sort(),Object.keys(es).sort());assert.deepEqual(Object.keys(en.kinds).sort(),Object.keys(es.kinds).sort())
  for(const locale of ['en','es']){const f=ui({locale});await f.settle();await f.click('open');assert.equal(f.nodes().filter(n=>n.type==='select').length,2);assert.equal(f.input('textarea').props.maxLength,4000);assert.ok(f.text().includes(f.t('manual_follow_up.no_delivery')));assert.equal(f.opened.length,0)}
})
test('real lead integration defaults off, scopes the three staff callers and preserves separate sharing and Inbox', () => {
  const read=file=>fs.readFileSync(path.join(src,file),'utf8'),panel=read('components/admin/LeadDetailPanel.tsx')
  assert.match(panel,/allowManualFollowUp = false/);assert.match(panel,/allowManualFollowUp \? <LeadFollowUp key=\{`manual-follow-up:\$\{lead.id\}:\$\{lead.assigned_realtor_id/)
  assert.match(read('pages/admin/Leads.tsx'),/<LeadDetailPanel\s+allowContactShare\s+allowManualFollowUp/)
  for(const file of ['pages/realtor/Leads.tsx','pages/realtor/Pipeline.tsx'])assert.match(read(file),/allowManualFollowUp=\{!!user && selectedLead\?\.assigned_realtor_id === user.id\}/)
  const component=read('components/admin/LeadFollowUp.tsx')
  assert.doesNotMatch(component,/updateLeadStatus|assignLead\(|localStorage|sessionStorage|client\.(post|put|patch)|sendBeacon|navigator.share/)
  assert.match(panel,/<ShareContactButton key=\{lead.id\}/)
})
