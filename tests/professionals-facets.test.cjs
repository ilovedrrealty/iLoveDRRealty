const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const axios = require('axios')
const root = path.resolve(__dirname, '..')
const clone = value => JSON.parse(JSON.stringify(value))

function loader(overrides = {}, globals = {}) {
  const cache = new Map()
  function load(relative) {
    const file = path.resolve(root, relative)
    if (cache.has(file)) return cache.get(file)
    const module = { exports: {} }; cache.set(file, module.exports)
    const { outputText } = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
      target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
    } })
    vm.runInNewContext(outputText, { exports: module.exports, module, URL, URLSearchParams, ...globals, require: id => {
      if (Object.hasOwn(overrides, id)) return overrides[id]
      if (id.startsWith('.')) {
        const base = path.resolve(path.dirname(file), id)
        if (Object.hasOwn(overrides, base)) return overrides[base]
        const target = [base, base + '.ts', base + '.tsx', path.join(base, 'index.ts')].find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile())
        if (target && target.startsWith(root + path.sep)) return load(target)
      }
      if (['react', 'react/jsx-runtime', 'axios'].includes(id)) return require(id)
      throw new Error('Unexpected facet test import: ' + id)
    } })
    return module.exports
  }
  return load
}
const model = loader()('packages/professionals/src/index.ts')
const optionsFor = ids => ids.map(id => ({ id, label: { en: 'Declared ' + id, es: 'Declarado ' + id } }))
const options = {
  categories: [], areas: [], languages: [],
  provider_kinds: optionsFor(['professional_practice', 'contractor', 'supplier', 'laboratory', 'financial_institution', 'cooperative', 'management_company', 'utility_provider', 'insurance_provider', 'other_provider']),
  property_classes: optionsFor(['house_villa', 'apartment_condominium', 'multiunit_building', 'vacation_rental', 'hotel_hospitality', 'office', 'retail_restaurant', 'warehouse_industrial', 'farm_rural', 'vacant_land']),
  work_scopes: optionsFor(['design', 'installation', 'inspection', 'repair', 'recurring_maintenance', 'supply', 'advisory', 'financing', 'insurance', 'management', 'utility_service', 'other_work']),
}
function ui(locale) {
  const copy = require(`../apps/dashboard/src/locale/${locale}/professionals.json`)
  const t = (key, args = {}) => (key.split('.').reduce((value, name) => value?.[name], copy) ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(args[name] ?? ''))
  return { copy, load: loader({ 'react-i18next': { useTranslation: () => ({ t, i18n: { language: locale } }) } }) }
}

test('fresh declarations are empty and normalizing an older draft preserves omission or explicit clearing', () => {
  const fresh = model.emptyProfessionalDraft()
  for (const key of ['provider_kind_ids', 'property_class_ids', 'work_scope_ids']) assert.deepEqual(clone(fresh[key]), [])
  const historical = clone(fresh)
  for (const key of ['provider_kind_ids', 'property_class_ids', 'work_scope_ids']) delete historical[key]
  const normalized = model.normalizeProfessionalDraft(historical)
  assert.ok(!Object.hasOwn(normalized, 'property_class_ids'))
  const selected = { ...historical, provider_kind_ids: ['cooperative', 'financial_institution'], property_class_ids: ['hotel_hospitality'], work_scope_ids: ['financing', 'management'] }
  assert.deepEqual(clone(model.normalizeProfessionalDraft(selected).work_scope_ids), ['financing', 'management'])
  assert.deepEqual(clone(model.normalizeProfessionalDraft({ ...selected, property_class_ids: [] }).property_class_ids), [])
  assert.deepEqual(clone(model.normalizeProfessionalDraft({ ...selected, property_class_ids: [] }).provider_kind_ids), selected.provider_kind_ids)
})

// Actual page/editor handlers; only presentation, transport and browser-event
// seams are synthetic. No application, database, clipboard or provider runs.
const later = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const denial = status => ({ isAxiosError: true, response: { status } })
function privateProfile() {
  const draft = { ...model.emptyProfessionalDraft(), business_name: 'PRIVATE draft business', category_ids: ['plumbing'],
    service_area_ids: ['sosua'], descriptions: { en: 'PRIVATE experience', es: '' }, public_phone: '+18095550101', public_contact_consent: true }
  return { id: 'owned-profile', version: 1, draft, management_type: 'admin_managed', owner: null, review_status: 'pending', listing_status: 'published',
    published_profile: { ...draft, id: 'owned-profile' }, review_note: 'PRIVATE review note', history: [{ version: 1, action: 'save', created_at: '2026-11-01T00:00:00Z', note: 'PRIVATE history' }] }
}
function privacyUI(target, api = {}, props = {}) {
  const frames = new Map(), wrappers = new Map(), effects = [], copy = require('../apps/dashboard/src/locale/en/professionals.json')
  const t = (key, values = {}) => (key.split('.').reduce((v, k) => v?.[k], copy) ?? key).replace(/\{\{(\w+)\}\}/g, (_, key) => String(values[key] ?? ''))
  let active, seen, tree, html, dirty = false, id = 0
  function slot(kind) { const n = active.cursor++; if (!active.slots[n]) active.slots[n] = { kind }; assert.equal(active.slots[n].kind, kind); return active.slots[n] }
  const hooks = { ...React,
    useState(initial) { const s = slot('state'); if (!Object.hasOwn(s, 'value')) s.value = typeof initial === 'function' ? initial() : initial; return [s.value, value => { s.value = typeof value === 'function' ? value(s.value) : value; dirty = true }] },
    useRef(initial) { const s = slot('ref'); return s.value ??= { current: initial } },
    useId() { return slot('id').value ??= 'owned-' + ++id },
    useCallback(fn, deps) { const s = slot('callback'); if (!s.deps || deps.some((v, i) => v !== s.deps[i])) { s.deps = [...deps]; s.value = fn } return s.value },
    useEffect(fn, deps) { const s = slot('effect'); if (!s.deps || deps.some((v, i) => v !== s.deps[i])) { s.deps = [...deps]; effects.push({ s, fn }) } },
  }
  function wrap(type, key) {
    if (!wrappers.has(type)) wrappers.set(type, new Map())
    const all = wrappers.get(type), identity = key ?? 'root'
    if (!all.has(identity)) {
      const frame = { slots: [], cursor: 0, mounted: false, tree: null }; frames.set(frame, frame)
      all.set(identity, p => { if (!frame.mounted) frame.slots = []; frame.mounted = true; seen.add(frame); const previous = active; active = frame; frame.cursor = 0; try { frame.tree = type(p); return frame.tree } finally { active = previous } })
      all.get(identity).frame = frame
    }
    return all.get(identity)
  }
  const runtime = require('react/jsx-runtime'), jsx = (type, p, key) => runtime.jsx(typeof type === 'function' ? wrap(type, key) : type, p, key)
  const jsxs = (type, p, key) => runtime.jsxs(typeof type === 'function' ? wrap(type, key) : type, p, key)
  const fake = {
    getAdminProfessionals: async () => ({ items: [{ ...privateProfile().draft, id: 'owned-profile', management_type: 'admin_managed', review_status: 'pending', listing_status: 'published', owner: { display_name: 'PRIVATE owner', email: 'private@example.com' } }], total: 1, limit: 20, offset: 0 }),
    getProfessionalOptions: async () => options, getAdminProfessional: async () => privateProfile(), getMyProfessionalProfile: async () => privateProfile(),
    saveProfessionalDraft: async () => privateProfile(), submitProfessionalProfile: async () => privateProfile(), withdrawProfessionalProfile: async () => privateProfile(),
    createAdminProfessional: async () => privateProfile(), saveAdminProfessional: async () => privateProfile(), submitAdminProfessional: async () => privateProfile(), moderateProfessional: async () => privateProfile(),
    uploadProfessionalPhoto: async () => '', uploadAdminProfessionalPhoto: async () => '', ...api,
  }
  const shared = path.join(root, 'apps/dashboard/src/components/shared'), admin = path.join(root, 'apps/dashboard/src/components/admin')
  const overrides = { react: hooks, 'react/jsx-runtime': { ...runtime, jsx, jsxs }, 'react-i18next': { useTranslation: () => ({ t, i18n: { language: 'en' } }) },
    axios: { isAxiosError: value => value?.isAxiosError === true }, [path.join(root, 'apps/dashboard/src/api/professionals')]: fake,
    [path.join(shared, 'ProfessionalDialog')]: { ProfessionalDialog: p => jsx('section', { 'data-owned-dialog': true, children: p.children }) },
    [path.join(shared, 'ProfessionalConfirmation')]: { ProfessionalConfirmation: p => jsx('button', { onClick: p.onConfirm, children: p.confirmLabel }) },
    [path.join(shared, 'ProfessionalDraftFields')]: { ProfessionalDraftFields: p => jsx('input', { value: p.draft.business_name, onChange: e => p.onChange('business_name', e.target.value), onInput: p.onUpload, 'data-owned-upload': true }) },
    [path.join(shared, 'ProfessionalPreview')]: { ProfessionalPreview: p => jsx('pre', { children: JSON.stringify(p.profile) }) },
    [path.join(shared, 'ProfileShareActions')]: { ProfileShareActions: () => null },
  }
  let childProps
  if (target === 'admin') overrides[path.join(admin, 'ManagedProfessionalEditor')] = { ManagedProfessionalEditor: p => { childProps = p; return jsx('pre', { children: JSON.stringify(p.initial?.draft) }) } }
  const load = loader(overrides, { AbortController, window: { addEventListener() {}, removeEventListener() {}, confirm: () => true } }), module = target === 'admin' ? load('apps/dashboard/src/pages/admin/Professionals.tsx') : target === 'own' ? load('apps/dashboard/src/pages/shared/ProfessionalProfile.tsx') : load('apps/dashboard/src/components/admin/ManagedProfessionalEditor.tsx')
  const Component = module.AdminProfessionals ?? module.ProfessionalProfile ?? module.ManagedProfessionalEditor
  function render() { dirty = false; seen = new Set(); tree = jsx(Component, props); html = renderToStaticMarkup(tree); for (const frame of frames.values()) if (!seen.has(frame)) { for (const s of frame.slots) { s.cleanup?.(); s.cleanup = undefined } frame.mounted = false } }
  async function settle() { for (let i = 0; i < 25; i++) { render(); for (const e of effects.splice(0)) { e.s.cleanup?.(); e.s.cleanup = e.fn() } for (let n = 0; n < 20; n++) await Promise.resolve(); if (!dirty && !effects.length) return html } assert.fail('Privacy handlers did not settle') }
  function text(v) { return Array.isArray(v) ? v.map(text).join('') : React.isValidElement(v) ? v.type.frame ? text(v.type.frame.tree) : text(v.props.children) : v == null ? '' : String(v) }
  function nodes() { const all = []; function visit(v) { if (Array.isArray(v)) return v.forEach(visit); if (!React.isValidElement(v)) return; if (v.type.frame) return visit(v.type.frame.tree); all.push(v); visit(v.props.children) } visit(tree); return all }
  function button(key) { const found = nodes().filter(n => n.type === 'button' && text(n) === t(key)); assert.equal(found.length, 1, key); return found[0] }
  return { settle, nodes, button, text: () => text(tree), html: () => html, child: () => childProps,
    async click(key) { const n = button(key); assert.ok(!n.props.disabled); n.props.onClick(); return settle() },
    cleanup() { for (const f of frames.values()) for (const s of f.slots) s.cleanup?.() },
  }
}

test('detected Admin list/detail/moderation denial clears private projections and only an explicit refresh reloads', async () => {
  for (const mode of ['list', 'options', 'detail', 'moderation']) for (const status of [401, 403]) {
    let refuse = false
    const f = privacyUI('admin', {
      getAdminProfessionals: async () => { if (mode === 'list' && refuse) throw denial(status); return { items: [{ ...privateProfile().draft, id: 'owned-profile', owner: { display_name: 'PRIVATE owner', email: 'private@example.com' }, review_status: 'pending', listing_status: 'published' }], total: 1 } },
      getProfessionalOptions: async () => { if (mode === 'options' && refuse) throw denial(status); return options },
      getAdminProfessional: async () => { if (mode === 'detail' && refuse) throw denial(status); return privateProfile() },
      moderateProfessional: async () => { throw denial(status) },
    })
    try {
      await f.settle(); if (mode !== 'detail') await f.click('review_profile'); refuse = true
      if (mode === 'list' || mode === 'options') await f.click('admin_private_drafts')
      else if (mode === 'detail') await f.click('review_profile')
      else { await f.click('approve'); await f.click('confirm') }
      assert.doesNotMatch(f.html(), /PRIVATE|private@example.com|data-owned-dialog|<form/)
      assert.ok(f.text().includes(require('../apps/dashboard/src/locale/en/professionals.json').admin_access_lost))
      refuse = false; await f.click('retry'); assert.match(f.html(), /PRIVATE draft business/)
    } finally { f.cleanup() }
  }
})

test('own and managed actual editor save/upload denial discards drafts and prevents further mutation actions', async () => {
  for (const target of ['own', 'managed']) for (const operation of ['save', 'upload']) for (const status of [401, 403]) {
    let attempts = 0, lost = 0
    const refused = async () => { attempts++; throw denial(status) }
    const f = privacyUI(target, target === 'own' ? { saveProfessionalDraft: refused, uploadProfessionalPhoto: refused } : { saveAdminProfessional: refused, uploadAdminProfessionalPhoto: refused },
      target === 'managed' ? { initial: privateProfile(), options, onSaved() { assert.fail('Denied editor cannot publish data') }, onClose() {}, onAccessLost() { lost++ } } : {})
    try {
      await f.settle(); const input = f.nodes().find(n => n.type === 'input' && n.props['data-owned-upload'])
      input.props.onChange({ target: { value: 'PRIVATE unsaved edit' } }); await f.settle(); await f.click('draft_preview')
      if (operation === 'save') await f.click('save')
      else { input.props.onInput({ type: 'image/png', size: 64 }); await f.settle() }
      assert.equal(attempts, 1); assert.doesNotMatch(f.html(), /PRIVATE|data-owned-dialog|<form|<input|<pre/)
      assert.equal(lost, target === 'managed' ? 1 : 0)
    } finally { f.cleanup() }
  }
})

test('late Admin detail/editor callbacks cannot restore private data after a detected list denial', async () => {
  const held = later(); let second = false, refuse = false, detailSignal
  const f = privacyUI('admin', {
    getAdminProfessionals: async () => { if (refuse) throw denial(403); return { items: [{ ...privateProfile().draft, id: 'owned-profile', owner: null, review_status: 'pending', listing_status: 'published' }], total: 1 } },
    getAdminProfessional: async (_id, signal) => { detailSignal = signal; return second ? held.promise : privateProfile() },
  })
  try {
    await f.settle(); await f.click('review_profile'); await f.click('managed_edit'); const retired = f.child()
    retired.onAccessLost(); await f.settle(); retired.onSaved(privateProfile()); await f.settle(); assert.doesNotMatch(f.html(), /PRIVATE|data-owned-dialog/)
    await f.click('retry'); second = true; f.button('review_profile').props.onClick(); await f.settle(); refuse = true
    await f.click('admin_private_drafts'); assert.equal(detailSignal.aborted, true)
    held.resolve(privateProfile()); await f.settle(); assert.doesNotMatch(f.html(), /PRIVATE|data-owned-dialog/)
  } finally { f.cleanup() }
  const oldRead = later(), own = privacyUI('own', { getMyProfessionalProfile: () => oldRead.promise, getProfessionalOptions: async () => { throw denial(401) } })
  try { await own.settle(); oldRead.resolve(privateProfile()); await own.settle(); assert.doesNotMatch(own.html(), /PRIVATE|<input|<pre/); assert.ok(own.text().includes(require('../apps/dashboard/src/locale/en/professionals.json').profile_access_lost)) }
  finally { own.cleanup() }
})

for (const locale of ['en', 'es']) {
  test(`actual declaration editor accepts all known choices and each clear changes only its selected field (${locale})`, () => {
    const { load, copy } = ui(locale)
    const { ProfessionalFacetChoices } = load('apps/dashboard/src/components/shared/ProfessionalFacets.tsx')
    const changes = [], draft = { ...model.emptyProfessionalDraft(), provider_kind_ids: options.provider_kinds.map(item => item.id), property_class_ids: options.property_classes.map(item => item.id), work_scope_ids: options.work_scopes.map(item => item.id) }
    const element = ProfessionalFacetChoices({ draft, options, onChange: (key, value) => changes.push([key, value]) })
    const choices = React.Children.toArray(element.props.children).filter(child => child?.props?.onChange)
    assert.deepEqual(choices.map(child => child.props.max), [10, 10, 12])
    choices.forEach(child => child.props.onChange(child.props.options.map(item => item.id)))
    assert.deepEqual(clone(changes), [['provider_kind_ids', draft.provider_kind_ids], ['property_class_ids', draft.property_class_ids], ['work_scope_ids', draft.work_scope_ids]])
    choices[1].props.onChange([])
    assert.deepEqual(clone(changes.at(-1)), ['property_class_ids', []])
    const html = renderToStaticMarkup(React.createElement(ProfessionalFacetChoices, { draft, options, onChange() {} }))
    assert.equal((html.match(/checked=""/g) ?? []).length, 32)
    assert.doesNotMatch(html, /disabled=""/)
    assert.ok(html.includes(copy.facets.declared_help))
  })
  test(`actual facet preview labels unknown historical declarations plainly and escapes supplied labels (${locale})`, () => {
    const { load, copy } = ui(locale)
    const { ProfessionalFacetSummary } = load('apps/dashboard/src/components/shared/ProfessionalFacets.tsx')
    const empty = renderToStaticMarkup(React.createElement(ProfessionalFacetSummary, { profile: {}, options }))
    assert.equal(empty.split(copy.facets.not_specified).length - 1, 3)
    const selected = renderToStaticMarkup(React.createElement(ProfessionalFacetSummary, {
      profile: { provider_kind_ids: ['supplier'], property_class_ids: ['hotel_hospitality'], work_scope_ids: ['supply'] },
      options: { ...options, provider_kinds: [{ id: 'supplier', label: { en: '<script>Supplier</script>', es: '<script>Proveedor</script>' } }] },
    }))
    assert.ok(selected.includes(copy.facets.declared_note))
    assert.match(selected, /&lt;script&gt;/)
    assert.doesNotMatch(selected, /<script>/)
  })
}

test('member list, aggregate map and Admin review use the same repeated facet query keys with cancellation', async () => {
  const requests = [], controller = new AbortController()
  const map = { total: 0, mapped_total: 0, unmapped_total: 0, complete: true, areas: [], catalog: { id: 'owned', reference_country_code: 'DO', source_reference: 'existing', purpose: 'approximate_area_references' } }
  const client = { get: async (url, config) => { requests.push([url, config]); return { data: url.endsWith('/map') ? map : { items: [], total: 0, limit: 24, offset: 0 } } } }
  const load = loader({ './axios': { __esModule: true, default: client } })
  const api = load('apps/dashboard/src/api/professionals.ts'), maps = load('apps/dashboard/src/api/directoryMaps.ts')
  const filters = { category: ['banking'], area: ['province_azua'], language: 'es', q: 'Owned', provider_kind: ['cooperative', 'financial_institution'], property_class: ['hotel_hospitality', 'farm_rural'], work_scope: ['financing', 'management'] }
  await api.getProfessionals({ ...filters, limit: 24, offset: 0 }, controller.signal)
  await maps.getProfessionalMap(filters, controller.signal)
  await api.getAdminProfessionals({ provider_kind: filters.provider_kind, property_class: filters.property_class, work_scope: filters.work_scope, limit: 20, offset: 0 }, controller.signal)
  assert.deepEqual(requests.map(([url]) => url), ['/professionals', '/professionals/map', '/admin/professionals'])
  for (const [url, config] of requests) {
    assert.equal(config.signal, controller.signal)
    const uri = new URL(axios.getUri({ url: 'https://owned.example' + url, ...config }))
    for (const key of ['provider_kind', 'property_class', 'work_scope']) assert.deepEqual(uri.searchParams.getAll(key), filters[key])
    assert.ok(!uri.search.includes('%5B%5D'))
  }
})
