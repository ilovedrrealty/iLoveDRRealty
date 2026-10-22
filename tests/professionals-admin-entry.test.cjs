const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

const root = path.resolve(__dirname, '..')
function loader(overrides = {}) {
  const cache = new Map()
  return function load(relative) {
    const absolute = path.resolve(root, relative)
    if (cache.has(absolute)) return cache.get(absolute)
    const module = { exports: {} }
    cache.set(absolute, module.exports)
    const { outputText } = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: {
      target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
    } })
    vm.runInNewContext(outputText, { exports: module.exports, module, URL, FormData, require: id => {
      if (Object.hasOwn(overrides, id)) return overrides[id]
      if (id.startsWith('.')) {
        const candidate = path.resolve(path.dirname(absolute), id)
        if (Object.hasOwn(overrides, candidate)) return overrides[candidate]
        const target = [candidate, candidate + '.ts', candidate + '.tsx', path.join(candidate, 'index.ts')].find(file => fs.existsSync(file) && fs.statSync(file).isFile())
        if (target && target.startsWith(root + path.sep)) return load(target)
      }
      if (['react', 'react/jsx-runtime', 'axios', 'lucide-react'].includes(id)) return require(id)
      throw new Error(`Unexpected test import: ${id}`)
    } })
    return module.exports
  }
}
const model = loader()('packages/professionals/src/index.ts')
const clone = value => JSON.parse(JSON.stringify(value))
function complete() {
  return { ...model.emptyProfessionalDraft(), business_name: 'Synthetic services', category_ids: ['electrical', 'other_services'], custom_services: ['Smart home controls'], service_area_ids: ['nationwide'], descriptions: { en: 'Property services', es: '' }, public_phone: '+18095550101', public_contact_consent: true }
}

test('Other specialties preserve multiple standard services and normalize spacing, accents and duplicates', () => {
  const draft = complete()
  draft.category_ids = ['electrical', 'plumbing', 'other_services']
  draft.custom_services = ['  Pérgolas  ', 'Pergolas', 'Smart   controls', 'Smart controls', '']
  const normalized = model.normalizeProfessionalDraft(draft)
  assert.deepEqual(clone(normalized.category_ids), ['electrical', 'plumbing', 'other_services'])
  assert.deepEqual(clone(normalized.custom_services), ['Pérgolas', 'Smart controls'])
  assert.equal(model.professionalCustomServicesInvalid(normalized), false)
})

test('Other may be an incomplete private draft, but submission requires a bounded specialty', () => {
  const draft = complete()
  draft.custom_services = []
  assert.equal(model.professionalCustomServicesInvalid(draft), false)
  assert.ok(model.professionalSubmissionIssues(draft).includes('custom_services'))
  for (const values of [['X'], ['x'.repeat(81)], ['Bad\u0000label'], Array.from({ length: 9 }, (_, i) => `Specialty ${i}`)]) {
    draft.custom_services = values
    assert.equal(model.professionalCustomServicesInvalid(draft), true)
  }
  draft.custom_services = ['A valid specialty']; draft.category_ids = ['electrical']
  assert.equal(model.professionalCustomServicesInvalid(draft), true)
})

test('historical public profiles default to no custom labels and only selected Other adds specialties', () => {
  const options = [{ id: 'electrical', label: { en: 'Electricians', es: 'Electricistas' } }]
  assert.deepEqual(clone(model.professionalServiceLabels({ category_ids: ['electrical'] }, options, 'es')), ['Electricistas'])
  assert.deepEqual(clone(model.professionalServiceLabels({ category_ids: ['electrical'], custom_services: ['Hidden stray value'] }, options, 'en')), ['Electricians'])
  assert.ok(model.professionalServiceLabels(complete(), options, 'en').includes('Smart home controls'))
})

test('Admin-managed and account-owned publication eligibility fail closed on mismatched source or account status', () => {
  const pending = { management_type: 'admin_managed', owner: null, review_status: 'pending', listing_status: 'hidden' }
  assert.equal(model.canApproveProfessional(pending), true)
  assert.equal(model.canApproveProfessional({ ...pending, review_status: 'draft' }), false)
  assert.equal(model.canApproveProfessional({ ...pending, listing_status: 'suspended' }), false)
  assert.equal(model.canApproveProfessional({ ...pending, management_type: 'account_owned' }), false)
  const owner = { email_verified: true, status: 'active' }
  assert.equal(model.canApproveProfessional({ ...pending, owner }), false)
  assert.equal(model.canApproveProfessional({ ...pending, management_type: 'account_owned', owner }), true)
  assert.equal(model.canApproveProfessional({ ...pending, management_type: 'account_owned', owner: { ...owner, email_verified: false } }), false)
  assert.equal(model.canApproveProfessional({ ...pending, management_type: 'account_owned', owner: { ...owner, status: 'deactivated' } }), false)
})

test('Admin entry API writes only explicit drafts and CAS versions, without signup, invitation or automatic approval', async () => {
  const requests = []
  const client = { post: async (...args) => { requests.push(['POST', ...args]); return { data: { version: 1 } } }, put: async (...args) => { requests.push(['PUT', ...args]); return { data: { version: 2 } } } }
  const api = loader({ './axios': { __esModule: true, default: client } })('apps/dashboard/src/api/professionals.ts')
  const draft = clone(model.emptyProfessionalDraft())
  await api.createAdminProfessional(draft)
  await api.saveAdminProfessional('profile/id', 7, draft)
  await api.submitAdminProfessional('profile/id', 8)
  assert.deepEqual(clone(requests), [
    ['POST', '/admin/professionals', { draft }],
    ['PUT', '/admin/professionals/profile%2Fid', { expected_version: 7, draft }],
    ['POST', '/admin/professionals/profile%2Fid/submit', { expected_version: 8 }],
  ])
  assert.equal(requests[0][2].draft.public_contact_consent, false)
  assert.equal(requests.some(request => /auth|invite|approve/.test(request[1])), false)
})

function ui(language = 'en') {
  const translations = require(`../apps/dashboard/src/locale/${language}/professionals.json`)
  const translate = (key, values = {}) => (key.split('.').reduce((value, part) => value?.[part], translations) ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? ''))
  const load = loader({
    'react-i18next': { useTranslation: () => ({ t: translate, i18n: { language } }) },
    [path.join(root, 'apps/dashboard/src/api/professionals')]: {},
  })
  const options = { categories: [{ id: 'electrical', label: { en: 'Electricians', es: 'Electricistas' } }, { id: 'other_services', label: { en: 'Other property services', es: 'Otros servicios inmobiliarios' } }], areas: [], languages: [] }
  return { load, options }
}

for (const language of ['en', 'es']) {
  test(`Admin entry form has explicit publication permission, no login account and no direct Publish button (${language})`, () => {
    const { load, options } = ui(language)
    const { ManagedProfessionalEditor } = load('apps/dashboard/src/components/admin/ManagedProfessionalEditor.tsx')
    const html = renderToStaticMarkup(React.createElement(ManagedProfessionalEditor, { initial: null, options, onSaved() {}, onClose() {} }))
    assert.match(html, language === 'en' ? /have this professional&#x27;s permission/ : /Tengo el permiso de este profesional/)
    assert.match(html, language === 'en' ? /without creating a login account/ : /sin crear una cuenta/)
    assert.match(html, language === 'en' ? /Save the private draft first/ : /Guarda primero el borrador privado/)
    assert.doesNotMatch(html, /checked=""|type="password"/)
    assert.doesNotMatch(html, /<button[^>]*>Approve and publish<\/button>/)
  })

  test(`Admin directory initially includes drafts and review requests with read-only quick filters (${language})`, () => {
    const { load } = ui(language)
    const { AdminProfessionals } = load('apps/dashboard/src/pages/admin/Professionals.tsx')
    const html = renderToStaticMarkup(React.createElement(AdminProfessionals))
    const translations = require(`../apps/dashboard/src/locale/${language}/professionals.json`)
    assert.match(html, new RegExp(`aria-pressed="true"[^>]*>${translations.admin_all_profiles}<`))
    assert.ok(html.includes(translations.admin_private_drafts))
    assert.ok(html.includes(translations.admin_awaiting_review))
    assert.equal((html.match(/<option value="" selected="">/g) ?? []).length, 2)
    assert.doesNotMatch(html, /<option value="pending" selected="">/)
    assert.equal((html.match(/<form /g) ?? []).length, 1)
    assert.doesNotMatch(html, /Approve and publish|Aprobar y publicar/)
    const labels = [...html.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/g)].map(match => match[1])
    assert.ok(labels.includes(translations.status), 'Review status needs its own exact accessible label')
    assert.ok(labels.includes(translations.visibility), 'Visibility needs its own exact accessible label')
    assert.ok(labels.every(label => !label.includes('<select')), 'A filter label must not include its option text')
  })

  test(`Professional editor text controls have unique native label targets (${language})`, () => {
    const { load, options } = ui(language)
    const { ProfessionalDraftFields } = load('apps/dashboard/src/components/shared/ProfessionalDraftFields.tsx')
    const html = renderToStaticMarkup(React.createElement(ProfessionalDraftFields, {
      draft: complete(), options, onChange() {}, onUpload() {}, uploading: false, adminManaged: true,
    }))
    const controls = [...html.matchAll(/<(input|textarea)\b([^>]*)>/g)].filter(([, , attributes]) => !attributes.includes('type="file"'))
    const ids = controls.map(([, , attributes]) => attributes.match(/\bid="([^"]+)"/)?.[1])
    assert.ok(ids.every(Boolean), 'Every text, checkbox and description control needs an id')
    assert.equal(new Set(ids).size, ids.length, 'Different controls must not share a label target')
    for (const id of ids) assert.ok(html.includes(`for="${id}"`), 'A native label must target each control')
  })
}

test('Other controls are conditional and public preview renders custom names as escaped text', () => {
  const { load, options } = ui()
  const { ProfessionalServices } = load('apps/dashboard/src/components/shared/ProfessionalServices.tsx')
  const draft = complete()
  const shown = renderToStaticMarkup(React.createElement(ProfessionalServices, { draft, options, onChange() {} }))
  assert.match(shown, /Smart home controls/)
  const hidden = renderToStaticMarkup(React.createElement(ProfessionalServices, { draft: { ...draft, category_ids: ['electrical'], custom_services: [] }, options, onChange() {} }))
  assert.doesNotMatch(hidden, /Add a specialty/)
  const { ProfessionalPreview } = load('apps/dashboard/src/components/shared/ProfessionalPreview.tsx')
  const preview = renderToStaticMarkup(React.createElement(ProfessionalPreview, { profile: { ...draft, custom_services: ['<script>example</script>'] }, options }))
  assert.match(preview, /&lt;script&gt;example&lt;\/script&gt;/)
  assert.doesNotMatch(preview, /<script>/)
})
