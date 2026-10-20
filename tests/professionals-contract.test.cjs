const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
function loadTS(relative, globals = {}, imports = {}) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8')
  const result = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } })
  const exports = {}
  vm.runInNewContext(result.outputText, { exports, URL, URLSearchParams, Date, ...globals, require: id => {
    if (Object.hasOwn(imports, id)) return imports[id]
    throw new Error(`Unexpected import: ${id}`)
  } })
  return exports
}
const model = loadTS('packages/professionals/src/index.ts')
const complete = () => ({ ...model.emptyProfessionalDraft(), business_name: 'Synthetic services', category_ids: ['example'], service_area_ids: ['example'], descriptions: { en: 'Property services.', es: '' }, public_phone: '+18095550101', public_contact_consent: true })

test('submission accepts a contact person instead of a business name and one translated description', () => {
  const draft = complete()
  draft.business_name = ''; draft.contact_name = 'Synthetic Professional'
  draft.descriptions = { en: '', es: 'Servicios para propiedades.' }
  assert.equal(model.professionalSubmissionIssues(draft).length, 0)
  assert.equal(model.professionalLabel(draft.descriptions, 'en'), draft.descriptions.es)
})
test('publication requires explicit business contact and explicit consent', () => {
  const draft = complete()
  draft.public_phone = ''; draft.public_contact_consent = false
  const issues = model.professionalSubmissionIssues(draft)
  assert.ok(issues.includes('contact'))
  assert.ok(issues.includes('consent'))
  assert.equal(draft.public_email, '')
})
test('phone formatting normalizes to the backend E164 contract and invalid contacts cannot become links', () => {
  const draft = complete()
  draft.public_phone = '+1 (809) 555-0101'; draft.public_whatsapp = '+1 809 555 0102'
  const normalized = model.normalizeProfessionalDraft(draft)
  assert.equal(normalized.public_phone, '+18095550101')
  assert.equal(normalized.public_whatsapp, '+18095550102')
  assert.equal(model.professionalContactHref('phone', normalized.public_phone), 'tel:+18095550101')
  assert.equal(model.professionalContactHref('whatsapp', normalized.public_whatsapp), 'https://wa.me/18095550102')
  assert.equal(model.professionalContactHref('phone', '+18095550101?x=1'), undefined)
  assert.equal(model.professionalContactHref('email', 'test@example.com?bcc=hidden@example.com'), undefined)
  assert.equal(model.professionalContactHref('email', 'test%0A@example.com'), 'mailto:test%250A%40example.com')
  assert.equal(model.professionalContactHref('website', 'javascript:alert(1)'), undefined)
  assert.equal(model.professionalContactHref('website', 'https://user:password@example.com'), undefined)
})

function intentHarness(search = '', blockedStorage = false) {
  const values = new Map()
  const storage = {
    getItem: key => { if (blockedStorage) throw new Error('Storage blocked'); return values.get(key) ?? null },
    setItem: (key, value) => { if (blockedStorage) throw new Error('Storage blocked'); values.set(key, value) },
    removeItem: key => values.delete(key),
  }
  const window = { location: { search } }
  const api = loadTS('apps/landing/src/lib/professionalJoin.ts', { window, sessionStorage: storage })
  return { api, window, values }
}
test('professional intent chooses a fixed dashboard screen and ignores arbitrary redirect targets', () => {
  const { api } = intentHarness('?join=professional&redirect=https://untrusted.example')
  assert.equal(api.dashboardAfterAuth('https://app.ilovedrrealty.com'), 'https://app.ilovedrrealty.com/professional-profile')
  assert.equal(api.isProfessionalJoin('?join=admin'), false)
})
test('verification links in the same browser retain the join hint without carrying identity or secrets', () => {
  const { api, window, values } = intentHarness('?join=professional')
  assert.equal(api.rememberProfessionalJoin(), true)
  window.location.search = '?email=synthetic%40example.com&code=123456'
  assert.equal(api.dashboardAfterAuth('https://app.ilovedrrealty.com'), 'https://app.ilovedrrealty.com/professional-profile')
  assert.equal(values.size, 0)
  assert.equal(api.dashboardAfterAuth('https://app.ilovedrrealty.com'), 'https://app.ilovedrrealty.com')
})
test('expired join hints do not redirect a later unrelated sign-in', () => {
  const { api, values } = intentHarness()
  values.set('ildr.professional-join.v1', String(Date.now() - 2 * 60 * 60 * 1000))
  assert.equal(api.rememberProfessionalJoin(), false)
  assert.equal(api.dashboardAfterAuth('https://app.ilovedrrealty.com'), 'https://app.ilovedrrealty.com')
})
test('explicit professional navigation still works when browser storage is unavailable', () => {
  const { api } = intentHarness('?join=professional', true)
  assert.equal(api.dashboardAfterAuth('https://app.ilovedrrealty.com'), 'https://app.ilovedrrealty.com/professional-profile')
})

test('member directory intent survives signup and verification without accepting an arbitrary redirect', () => {
  const { api, window, values } = intentHarness('?directory=professionals&redirect=https://untrusted.example')
  assert.equal(api.rememberProfessionalJoin(), false)
  assert.equal(api.professionalAuthParams().directory, 'professionals')
  window.location.search = '?email=synthetic%40example.com&code=123456'
  assert.equal(api.dashboardAfterAuth('https://app.ilovedrrealty.com'), 'https://app.ilovedrrealty.com/professional-directory')
  assert.equal(values.size, 0)
  assert.equal(api.dashboardAfterAuth('https://app.ilovedrrealty.com'), 'https://app.ilovedrrealty.com')
})

test('an explicit directory or profile choice replaces the previous professional destination', () => {
  const { api, window } = intentHarness('?join=professional')
  api.rememberProfessionalJoin()
  window.location.search = '?directory=professionals'
  assert.equal(api.dashboardAfterAuth('https://app.ilovedrrealty.com'), 'https://app.ilovedrrealty.com/professional-directory')
  window.location.search = '?join=professional'
  assert.equal(api.dashboardAfterAuth('https://app.ilovedrrealty.com'), 'https://app.ilovedrrealty.com/professional-profile')
  const blocked = intentHarness('?directory=professionals', true)
  assert.equal(blocked.api.dashboardAfterAuth('https://app.ilovedrrealty.com'), 'https://app.ilovedrrealty.com/professional-directory')
})

test('real estate profiles identify their own company without changing the normal profile contract', () => {
  const draft = complete()
  draft.category_ids = ['real_estate_agent']; draft.business_name = ''; draft.contact_name = 'Synthetic agent'
  assert.ok(model.professionalSubmissionIssues(draft).includes('company'))
  draft.business_name = 'Synthetic other company'
  assert.equal(model.professionalSubmissionIssues(draft).length, 0)
  assert.equal(Object.hasOwn(draft, 'role'), false)
})

test('directory requests use the authenticated dashboard client and preserve bounded filters', async () => {
  const requests = []
  const client = { get: async (...args) => { requests.push(args); return { data: { items: [], total: 0 } } } }
  const api = loadTS('apps/dashboard/src/api/professionals.ts', {}, { './axios': client })
  const params = { category: ['real_estate_agent'], area: ['cabarete'], q: 'Synthetic', limit: 24, offset: 0 }
  await api.getProfessionals(params)
  await api.getProfessional('synthetic/id')
  assert.equal(requests[0][0], '/professionals')
  assert.equal(requests[0][1].params, params)
  assert.equal(Object.hasOwn(requests[0][1], 'withCredentials'), false)
  assert.equal(requests[1][0], '/professionals/synthetic%2Fid')
})

test('directory multiselect uses repeated FastAPI query keys with actual Axios serialization', async () => {
  const axios = require('axios')
  let config
  const client = { get: async (url, options) => { config = { url, ...options }; return { data: { items: [], total: 0 } } } }
  const api = loadTS('apps/dashboard/src/api/professionals.ts', {}, { './axios': client })
  await api.getProfessionals({ category: ['real_estate_agent', 'property_management'], area: ['cabarete', 'sosua'], q: '', limit: 24, offset: 0 })
  const serialized = new URL(axios.getUri(config), 'https://api.example.com')
  assert.deepEqual(serialized.searchParams.getAll('category'), ['real_estate_agent', 'property_management'])
  assert.deepEqual(serialized.searchParams.getAll('area'), ['cabarete', 'sosua'])
  assert.equal(serialized.searchParams.has('category[]'), false)
  assert.equal(serialized.searchParams.has('area[]'), false)
})
test('moderation sends private feedback as note and includes the reviewed expected version', async () => {
  const requests = []
  const client = { post: async (...args) => { requests.push(args); return { data: { version: 7 } } } }
  const api = loadTS('apps/dashboard/src/api/professionals.ts', {}, { './axios': client })
  await api.moderateProfessional('synthetic-id', 'reject', 6, 'Please add the service area.')
  const [url, body] = requests[0]
  assert.equal(url, '/admin/professionals/synthetic-id/reject')
  assert.equal(body.expected_version, 6)
  assert.equal(body.note, 'Please add the service area.')
  assert.equal(Object.hasOwn(body, 'reason'), false)
})
test('all new public and dashboard strings have matching EN/ES keys', () => {
  function keys(value, prefix = '') { return Object.entries(value).flatMap(([key, item]) => typeof item === 'string' ? [`${prefix}${key}`] : keys(item, `${prefix}${key}.`)) }
  for (const folder of ['apps/landing/src/locales', 'apps/dashboard/src/locale']) {
    const en = JSON.parse(fs.readFileSync(path.join(root, folder, 'en/professionals.json'), 'utf8'))
    const es = JSON.parse(fs.readFileSync(path.join(root, folder, 'es/professionals.json'), 'utf8'))
    assert.deepEqual(keys(en).sort(), keys(es).sort())
  }
})
test('the directory uses singular and plural result labels in both languages', async () => {
  const i18n = require('i18next').createInstance()
  const en = JSON.parse(fs.readFileSync(path.join(root, 'apps/landing/src/locales/en/professionals.json'), 'utf8'))
  const es = JSON.parse(fs.readFileSync(path.join(root, 'apps/landing/src/locales/es/professionals.json'), 'utf8'))
  await i18n.init({ resources: { en: { translation: en }, es: { translation: es } }, lng: 'en', fallbackLng: 'en' })
  assert.equal(i18n.t('results', { count: 1 }), '1 professional')
  assert.equal(i18n.t('results', { count: 2 }), '2 professionals')
  await i18n.changeLanguage('es')
  assert.equal(i18n.t('results', { count: 1 }), '1 profesional')
  assert.equal(i18n.t('results', { count: 2 }), '2 profesionales')
})
