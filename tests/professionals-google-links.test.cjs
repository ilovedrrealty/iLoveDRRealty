const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const PROFILE = 'https://www.google.com/maps/place/Synthetic+business/'
const EMBED = 'https://www.google.com/maps/embed?pb=!1m2!1sSynthetic!2sBusiness'
const clone = value => JSON.parse(JSON.stringify(value))
function load(relative, imports = {}) {
  const compiled = ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), {
    fileName: relative, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  })
  assert.equal(compiled.diagnostics?.filter(item => item.category === ts.DiagnosticCategory.Error).length ?? 0, 0)
  const exports = {}
  vm.runInNewContext(compiled.outputText, { exports, URL, URLSearchParams, require(name) {
    assert.ok(Object.hasOwn(imports, name), 'Unexpected Google profile dependency')
    return imports[name]
  } })
  return exports
}
const model = load('packages/professionals/src/index.ts')
const copy = JSON.parse(fs.readFileSync(path.join(root, 'apps/dashboard/src/locale/en/professionals.json'), 'utf8'))
const t = (key, options) => {
  const text = key.split('.').reduce((value, part) => value?.[part], copy) ?? key
  return options ? text.replace('{{name}}', options.name ?? '') : text
}
function elements(node) {
  if (!node || typeof node !== 'object') return []
  if (Array.isArray(node)) return node.flatMap(elements)
  return [node, ...elements(node.props?.children)]
}
const jsx = (type, props, key) => ({ type, props, key })
const facetFields = load('apps/dashboard/src/components/shared/ProfessionalFields.tsx', {
  react: { useId: () => 'synthetic-facet-field' },
  'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
  'react-i18next': { useTranslation: () => ({ t, i18n: { language: 'en' } }) },
  '../../../../../packages/professionals/src': model,
})
const facets = load('apps/dashboard/src/components/shared/ProfessionalFacets.tsx', {
  'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
  'react-i18next': { useTranslation: () => ({ t, i18n: { language: 'en' } }) },
  '../../../../../packages/professionals/src': model,
  './ProfessionalFields': facetFields,
})

test('Google links accept genuine place search CID and official share forms without rewriting the destination', () => {
  for (const value of [PROFILE, "https://www.google.com/maps/place/John's+Repairs",
    'https://www.google.com/maps/search/?api=1&query=Synthetic+business&query_place_id=SyntheticID',
    'https://www.google.com/maps/search/Synthetic+business', 'https://maps.google.com/?cid=123456',
    'https://maps.app.goo.gl/Abcde12345?g_st=ic', 'https://g.page/synthetic-business', 'https://g.page/r/Synthetic_123']) {
    assert.equal(model.professionalGoogleProfileHref(' ' + value + ' '), value)
  }
})

test('foreign hosts credentials keys fragments and misleading Google redirects cannot become profile links', () => {
  for (const value of ['http://www.google.com/maps/place/A', 'https://www.google.com.evil.example/maps/place/A',
    'https://google.com@evil.example/maps/place/A', 'https://user:secret@www.google.com/maps/place/A',
    'https://www.google.com:443/maps/place/A', PROFILE + '#token=private', PROFILE + '?%6bey=do-not-store',
    'https://www.google.com/url?url=https://evil.example', 'https://www.google.com/maps/place/../url',
    'https://www.google.com/maps/place/%2e%2e/url', 'https://www.google.com\\@evil.example/maps/place/A',
    'https://www.google.com/maps/search/?api=1&api=0&query=Business', PROFILE + '%0A', PROFILE + 'x'.repeat(2048),
    'https://maps.app.goo.gl/Abcde12345?link=https://evil.example']) {
    assert.equal(model.professionalGoogleProfileHref(value), undefined, value)
  }
})

test('manual map URL remains opaque while API keyed HTML duplicate and foreign embeds are refused', () => {
  assert.equal(model.professionalGoogleEmbedHref(EMBED), EMBED)
  assert.equal(model.professionalGoogleEmbedHref(EMBED + '&hl=es-419'), EMBED + '&hl=es-419')
  for (const value of ['<iframe src="' + EMBED + '"></iframe>', 'https://evil.example/maps/embed?pb=!1m2',
    'https://www.google.com/maps/embed/v1/place?key=do-not-store&q=Business', EMBED + '&key=do-not-store',
    EMBED + '&pb=!other', EMBED + '&url=https://evil.example', EMBED + '#token=private',
    'https://www.google.com/maps/embed?pb=', 'https://www.google.com/maps/embed?pb=not-google-payload',
    EMBED + '&hl=es&hl=en', EMBED + '&hl=%0A', EMBED + 'x'.repeat(4096)]) {
    assert.equal(model.professionalGoogleEmbedHref(value), undefined, value)
  }
})

test('old drafts keep blank optional links and Google fields do not grant consent or create review claims', () => {
  const draft = model.emptyProfessionalDraft()
  assert.equal(draft.google_profile_url, ''); assert.equal(draft.google_maps_embed_url, '')
  draft.google_maps_embed_url = EMBED
  assert.deepEqual(clone(model.professionalGoogleIssues(draft)), ['google_maps_embed_url'])
  draft.google_profile_url = PROFILE
  assert.deepEqual(clone(model.professionalGoogleIssues(draft)), [])
  assert.equal(draft.public_contact_consent, false)
  assert.ok(model.professionalSubmissionIssues(draft).includes('consent'))
  const legacy = { ...draft }; delete legacy.google_profile_url; delete legacy.google_maps_embed_url
  const normalized = model.normalizeProfessionalDraft(legacy)
  assert.equal(normalized.google_profile_url, ''); assert.equal(normalized.google_maps_embed_url, '')
  for (const key of ['rating', 'reviews', 'review_count', 'google_verified', 'user_id', 'role']) assert.equal(Object.hasOwn(normalized, key), false)
})

test('owner and Admin API callers preserve explicit CAS drafts without submitting approving or creating accounts', async () => {
  const calls = []
  const client = { put: async (...args) => { calls.push(args); return { data: {} } } }
  const api = load('apps/dashboard/src/api/professionals.ts', { './axios': { __esModule: true, default: client } })
  const draft = clone({ ...model.emptyProfessionalDraft(), google_profile_url: PROFILE, google_maps_embed_url: EMBED })
  await api.saveProfessionalDraft(7, draft)
  await api.saveAdminProfessional('profile/id', 8, draft)
  assert.deepEqual(clone(calls), [['/professional-profile', { expected_version: 7, draft }],
    ['/admin/professionals/profile%2Fid', { expected_version: 8, draft }]])
  assert.equal(calls.some(([route]) => /auth|invite|submit|approve/.test(route)), false)
  assert.equal(draft.public_contact_consent, false)
})

function mapHarness() {
  const values = [], state = { cursor: 0 }
  const react = { useState(initial) {
    const index = state.cursor++
    if (!(index in values)) values[index] = initial
    return [values[index], value => { values[index] = value }]
  } }
  const component = load('apps/dashboard/src/components/shared/ProfessionalGoogleLinks.tsx', {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    'react-i18next': { useTranslation: () => ({ t }) }, '../../../../../packages/professionals/src': model,
    './ProfessionalFields': { professionalButton: 'button' },
  })
  return props => { state.cursor = 0; return elements(component.ProfessionalGoogleLinks(props)) }
}

test('actual Google component has no initial frame and loads only on click with a permanent safe profile fallback', () => {
  const render = mapHarness(), props = { name: 'Synthetic business', profileUrl: PROFILE, embedUrl: EMBED }
  let tree = render(props)
  assert.equal(tree.filter(node => node.type === 'iframe').length, 0)
  const anchor = tree.find(node => node.type === 'a')
  assert.equal(anchor.props.href, PROFILE); assert.equal(anchor.props.target, '_blank'); assert.equal(anchor.props.rel, 'noopener noreferrer')
  tree.find(node => node.type === 'button' && node.props.children === copy.google.load_map).props.onClick()
  tree = render(props)
  const frame = tree.find(node => node.type === 'iframe')
  assert.equal(frame.props.src, EMBED); assert.equal(frame.props.loading, 'lazy')
  assert.equal(frame.props.referrerPolicy, 'strict-origin-when-cross-origin')
  assert.equal(frame.props.sandbox, 'allow-scripts allow-same-origin')
  assert.ok(frame.props.title.includes(props.name))
  tree.find(node => node.type === 'button' && node.props.children === copy.google.hide_map).props.onClick()
  assert.equal(render(props).some(node => node.type === 'iframe'), false)
})

test('map source changes invalid profiles and real frame error signals remove the frame without losing the fallback', () => {
  const render = mapHarness(), props = { name: 'Synthetic business', profileUrl: PROFILE, embedUrl: EMBED }
  let tree = render(props)
  tree.find(node => node.type === 'button').props.onClick(); tree = render(props)
  tree.find(node => node.type === 'iframe').props.onError()
  tree = render(props)
  assert.equal(tree.some(node => node.type === 'iframe'), false)
  assert.ok(tree.some(node => node.type === 'a' && node.props.href === PROFILE))
  tree.find(node => node.type === 'button').props.onClick()
  assert.equal(render({ ...props, embedUrl: EMBED + '&hl=es' }).some(node => node.type === 'iframe'), false)
  assert.equal(render({ ...props, embedUrl: 'https://evil.example/frame' }).some(node => node.type === 'iframe'), false)
  assert.equal(render({ ...props, profileUrl: 'https://evil.example' }).length, 0)
})

test('Preview remounts Google state for another profile approval or source and never manufactures rating markup', () => {
  const Google = () => null
  const component = load('apps/dashboard/src/components/shared/ProfessionalPreview.tsx', {
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    'react-i18next': { useTranslation: () => ({ t, i18n: { language: 'en' } }) },
    '../../../../../packages/professionals/src': model, './ProfessionalGoogleLinks': { ProfessionalGoogleLinks: Google },
    './ProfessionalFacets': facets,
  })
  const draft = { ...model.emptyProfessionalDraft(), business_name: 'Synthetic business', id: 'one', approved_at: '2026-11-18T00:00:00Z', google_profile_url: PROFILE, google_maps_embed_url: EMBED }
  const widget = profile => elements(component.ProfessionalPreview({ profile, options: model.emptyProfessionalOptions() })).find(node => node.type === Google)
  const first = widget(draft)
  assert.notEqual(widget({ ...draft, id: 'two' }).key, first.key)
  assert.notEqual(widget({ ...draft, approved_at: '2026-11-18T01:00:00Z' }).key, first.key)
  assert.notEqual(widget({ ...draft, google_maps_embed_url: EMBED + '&hl=es' }).key, first.key)
  assert.equal(Object.hasOwn(first.props, 'rating'), false)
})

test('Admin and owner share bounded optional fields and matching EN ES guidance', () => {
  const Field = () => null, Choices = () => null, Services = () => null, changes = []
  const component = load('apps/dashboard/src/components/shared/ProfessionalDraftFields.tsx', {
    react: { useId: () => 'synthetic', useRef: () => ({ current: null }) },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' }, 'react-i18next': { useTranslation: () => ({ t }) },
    '../../../../../packages/professionals/src': model,
    './ProfessionalFields': { ProfessionalField: Field, ProfessionalChoices: Choices, professionalButton: '', professionalInput: '' },
    './ProfessionalServices': { ProfessionalServices: Services },
    './ProfessionalFacets': facets,
  })
  for (const adminManaged of [false, true]) {
    const tree = elements(component.ProfessionalDraftFields({ draft: model.emptyProfessionalDraft(), options: model.emptyProfessionalOptions(),
      adminManaged, onChange: (...args) => changes.push(args), onUpload: () => {}, uploading: false }))
    const profile = tree.find(node => node.type === Field && node.props.label === copy.google.profile_url)
    const embed = tree.find(node => node.type === Field && node.props.label === copy.google.embed_url)
    assert.equal(profile.props.value, ''); assert.equal(profile.props.type, 'url'); assert.equal(profile.props.maxLength, 2048)
    assert.equal(embed.props.value, ''); assert.equal(embed.props.maxLength, 4096)
    profile.props.onChange(PROFILE); embed.props.onChange(EMBED)
    assert.equal(tree.find(node => node.type === 'input' && node.props.type === 'checkbox').props.checked, false)
  }
  assert.deepEqual(changes.slice(0, 2), [['google_profile_url', PROFILE], ['google_maps_embed_url', EMBED]])
  const es = JSON.parse(fs.readFileSync(path.join(root, 'apps/dashboard/src/locale/es/professionals.json'), 'utf8'))
  assert.deepEqual(Object.keys(copy.google).sort(), Object.keys(es.google).sort())
  assert.ok(copy.google.member_help.includes('Google')); assert.ok(es.google.member_help.includes('Google'))
})
