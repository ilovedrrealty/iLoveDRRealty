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

function loader(overrides = {}) {
  const cache = new Map()
  function load(relative) {
    const file = path.resolve(root, relative)
    if (cache.has(file)) return cache.get(file)
    const module = { exports: {} }; cache.set(file, module.exports)
    const { outputText } = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
      target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
    } })
    vm.runInNewContext(outputText, { exports: module.exports, module, URL, URLSearchParams, require: id => {
      if (Object.hasOwn(overrides, id)) return overrides[id]
      if (id.startsWith('.')) {
        const base = path.resolve(path.dirname(file), id)
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
