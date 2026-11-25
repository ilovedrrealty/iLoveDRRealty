const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const root = path.resolve(__dirname, '..'), source = 'apps/dashboard/src/'
const plain = value => JSON.parse(JSON.stringify(value))
function load(file, imports = {}, globals = {}) {
  let input = fs.readFileSync(path.join(root, file), 'utf8')
  if (file === source + 'pages/realtor/SaleProperties.tsx') {
    // Model this one unset Vite setting for the bounded CJS adapter; real URL fallback executes.
    const setting = 'import.meta.env.VITE_LANDING_URL'
    assert.equal(input.split(setting).length, 2)
    input = input.replace(setting, 'undefined')
  }
  const module = { exports: {} }
  const output = ts.transpileModule(input, { fileName: file, compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText
  vm.runInNewContext(output, { module, exports: module.exports, URL, URLSearchParams, AbortController, Intl, ...globals,
    require: name => { assert.ok(Object.hasOwn(imports, name), `Unapproved import: ${name}`); return imports[name] } }, { filename: file })
  return module.exports
}
const helpers = load(source + 'lib/saleCatalog.ts'), defaults = helpers.saleDefaults
const id = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`
const raw = changes => ({ id: id(1), status: 'active', transaction: 'sale', title: 'Synthetic sale', location: 'Sosúa', type: 'villa',
  price: '125000.50', currency: 'USD', bedrooms: 3, bathrooms: 2.5, area_sqft: 1500, images: ['https://images.example.invalid/sale.webp'],
  owner_id: 'PRIVATE_OWNER', owner_email: 'PRIVATE_EMAIL', notes: 'PRIVATE_NOTES', co_listing_agreement: 'PRIVATE_AGREEMENT', ...changes })
const response = (items = [raw()], changes = {}) => ({ data: { items, total: items.length, page: 1, page_size: 24, ...changes }, headers: { 'cache-control': 'no-store' } })
function apiHarness(reply) {
  const calls = [], client = { get: async (...args) => { calls.push(args); return typeof reply === 'function' ? reply(...args) : reply } }
  return { calls, api: load(source + 'api/saleCatalog.ts', { './axios': { __esModule: true, default: client }, '../lib/saleCatalog': helpers }) }
}

function assertOwnProfileSaleRole(input) {
  const fileName = 'profile-role-guard.tsx'
  const file = ts.createSourceFile(fileName, input, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX)
  assert.equal(file.parseDiagnostics.length, 0)
  function imported(name, from) {
    const matches = file.statements.filter(ts.isImportDeclaration).flatMap(node => {
      const bindings = node.importClause?.namedBindings
      return bindings && ts.isNamedImports(bindings) ? bindings.elements
        .filter(binding => binding.name.text === name).map(binding => ({ node, binding })) : []
    })
    assert.equal(matches.length, 1, `Expected the actual ${name} import`)
    assert.equal(matches[0].node.moduleSpecifier.text, from)
    assert.ok(!matches[0].node.importClause.isTypeOnly && !matches[0].binding.propertyName && !matches[0].binding.isTypeOnly)
  }
  imported('MemberProfile', '../../components/network/MemberCommunity')
  imported('canBrowseSales', '../../lib/saleCatalog')
  const functions = file.statements.filter(node => ts.isFunctionDeclaration(node) && node.name?.text === 'PropertyNetwork')
  assert.equal(functions.length, 1)
  const component = functions[0]
  assert.equal(component.parameters.length, 1)
  assert.ok(ts.isObjectBindingPattern(component.parameters[0].name))
  const users = component.parameters[0].name.elements.filter(node => node.name.getText(file) === 'user' && !node.propertyName && !node.dotDotDotToken)
  assert.equal(users.length, 1)
  const ownProfiles = []
  function bindingNames(name) {
    return ts.isIdentifier(name) ? [name.text] : ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)
      ? name.elements.filter(ts.isBindingElement).flatMap(element => bindingNames(element.name)) : []
  }
  function visit(node) {
    if ((ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isFunctionDeclaration(node)
      || ts.isFunctionExpression(node) || ts.isClassDeclaration(node) || ts.isClassExpression(node)) && node.name)
      assert.ok(!bindingNames(node.name).some(name => ['MemberProfile', 'canBrowseSales', 'user'].includes(name)), 'Account-role bindings must not be shadowed')
    if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && ts.isIdentifier(node.tagName)
      && node.tagName.text === 'MemberProfile') {
      const attributes = [...node.attributes.properties]
      assert.ok(attributes.every(ts.isJsxAttribute), 'MemberProfile props must be explicit')
      const names = attributes.map(attribute => attribute.name.getText(file))
      assert.equal(new Set(names).size, names.length, 'MemberProfile props must not be duplicated')
      if (names.includes('own')) ownProfiles.push(attributes)
    }
    ts.forEachChild(node, visit)
  }
  visit(component.body)
  assert.equal(ownProfiles.length, 1)
  const attributes = ownProfiles[0]
  const own = attributes.find(attribute => attribute.name.text === 'own').initializer
  assert.ok(!own || (ts.isJsxExpression(own) && own.expression?.kind === ts.SyntaxKind.TrueKeyword))
  const value = attributes.find(attribute => attribute.name.text === 'browseSales')?.initializer
  assert.ok(value && ts.isJsxExpression(value) && value.expression && ts.isCallExpression(value.expression))
  const call = value.expression
  assert.ok(!call.questionDotToken && ts.isIdentifier(call.expression) && call.expression.text === 'canBrowseSales')
  assert.equal(call.arguments.length, 1)
  const role = call.arguments[0]
  assert.ok(ts.isPropertyAccessExpression(role) && !role.questionDotToken && role.name.text === 'role'
    && ts.isIdentifier(role.expression) && role.expression.text === 'user')
}

test('sale browsing capability uses the real account role and fixed Realtor workspace', () => {
  for (const role of ['buyer', 'owner', 'realtor', 'admin', 'Realtor', '', 'unknown'])
    assert.equal(helpers.canBrowseSales(role), role === 'realtor' || role === 'admin')
  assert.equal(helpers.SALE_CATALOG_PATH, '/sale-properties?workspace=realtor')
  const dashboard = fs.readFileSync(path.join(root, source, 'pages/Dashboard.tsx'), 'utf8')
  assert.match(dashboard, /case 'sale-properties': return canBrowseSales\(user.role\) \? <RealtorSaleProperties \/>/)
  const network = fs.readFileSync(path.join(root, source, 'pages/shared/PropertyNetwork.tsx'), 'utf8')
  assertOwnProfileSaleRole(network)
  assertOwnProfileSaleRole(network.replace('own categories={options.categories}', 'categories={options.categories} own'))
  assertOwnProfileSaleRole(network.replace('own categories=', 'own={true} categories='))
  for (const replacement of ['browseSales={true}', "browseSales={canBrowseSales('admin')}",
    'browseSales={canBrowseSales(user.accountRole)}', 'browseSales={canBrowseSales?.(user.role)}',
    'browseSales={canBrowseSales(user.role)} browseSales={true}']) {
    assert.throws(() => assertOwnProfileSaleRole(network.replace('browseSales={canBrowseSales(user.role)}', replacement)))
  }
  for (const replacement of ['own={false}', 'own={"true"}', 'own {...{ browseSales: true }}'])
    assert.throws(() => assertOwnProfileSaleRole(network.replace('own categories=', `${replacement} categories=`)))
  assert.throws(() => assertOwnProfileSaleRole(network.replace("  const { t } =", "  const canBrowseSales = () => true\n  const { t } =")))
})

test('typed filters round trip through pagination without rental or management scope', () => {
  const filters = { ...defaults, region: 'Sosúa', type: 'villa', beds: '3', min_price: '0', max_price: '200000.50', sort: 'low', usd_to_dop: '60' }
  const query = helpers.saleQuery(filters, 2)
  assert.deepEqual(plain(helpers.readSaleQuery(query)), { filters, page: 2 })
  assert.equal(query.get('workspace'), 'realtor')
  assert.equal(query.has('purpose'), false)
  assert.equal(query.has('owner_id'), false)
  assert.equal(helpers.readSaleQuery(new URLSearchParams('purpose=rent&status=draft&owner_id=PRIVATE')).filters.sort, 'new')
  for (const input of ['page=0', 'page=-1', 'page=1000000', 'page=2&page=3', 'beds=3&beds=4', 'min_price=-1', 'min_price=20&max_price=10',
    'min_price=NaN', 'sort=private', 'usd_to_dop=0', 'usd_to_dop=1001', 'type=%00villa', 'region=' + 'A'.repeat(81)])
    assert.equal(helpers.readSaleQuery(new URLSearchParams(input)), null, input)
  assert.equal(helpers.saleQuery({ ...defaults, beds: '21' }), null)
  assert.equal(helpers.saleQuery(defaults, 0), null)
})

test('catalog request is always the active public sale contract with 24 server rows and explicit comparison units', async () => {
  const h = apiHarness(response([raw({ transaction: 'both' })], { page: 2, total: 25 })), signal = new AbortController().signal
  const filters = { ...defaults, region: 'Sosúa', type: 'villa', beds: '0', min_price: '0', max_price: '200000', sort: 'high', usd_to_dop: '60' }
  const page = await h.api.getSaleCatalog(filters, 2, signal)
  assert.equal(h.calls.length, 1)
  assert.equal(h.calls[0][0], '/listings')
  assert.equal(h.calls[0][1].signal, signal)
  assert.deepEqual(plain(h.calls[0][1].params), { purpose: 'sale', page: 2, page_size: 24, region: 'Sosúa', type: 'villa', beds: 0,
    min_price: 0, max_price: 200000, sort: 'high', price_currency: 'USD', usd_to_dop: 60, include_aggregates: false })
  assert.equal(page.total, 25)
  assert.equal(page.items[0].transaction, 'both')
  assert.equal(page.items[0].price, 125000.5)
  assert.deepEqual(Object.keys(page.items[0]).sort(), ['id', 'title', 'location', 'type', 'transaction', 'price', 'currency', 'bedrooms', 'bathrooms', 'area_sqft', 'image'].sort())
  assert.ok(!JSON.stringify(page).includes('PRIVATE'))
})

test('catalog rejects unsafe or inconsistent responses instead of widening scope or falling back to private listings', async () => {
  const malformed = [response([raw({ status: 'draft' })]), response([raw({ transaction: 'rent' })]), response([raw({ id: '../listings/mine' })]),
    response([raw({ price: '-1' })]), response([raw({ currency: '' })]), response([raw(), raw()]), response(Array.from({ length: 25 }, (_, n) => raw({ id: id(n + 1) }))),
    response([raw()], { page: 2 }), response([raw()], { page_size: 60 }), response([raw()], { total: -1 }), { ...response(), headers: { 'cache-control': 'public' } }]
  for (const result of malformed) await assert.rejects(apiHarness(result).api.getSaleCatalog(defaults, 1, new AbortController().signal))
  const h = apiHarness(response())
  await assert.rejects(h.api.getSaleCatalog({ ...defaults, sort: 'owner' }, 1, new AbortController().signal))
  assert.equal(h.calls.length, 0)
  const safe = await apiHarness(response([raw({ images: ['javascript:alert(1)'] })])).api.getSaleCatalog(defaults, 1, new AbortController().signal)
  assert.equal(safe.items[0].image, null)
})

test('filter facets preserve abort signals and deduplicate existing public labels', async () => {
  const signal = new AbortController().signal, h = apiHarness({ data: { locations: [{ value: 'Sosúa', count: 2 }, { value: 'Sosúa', count: 1 }], types: [{ value: 'villa', count: 3 }] } })
  assert.deepEqual(plain(await h.api.getSaleOptions(signal)), { locations: ['Sosúa'], types: ['villa'] })
  assert.equal(h.calls[0][0], '/listings/filter-options')
  assert.equal(h.calls[0][1].signal, signal)
  await assert.rejects(apiHarness({ data: { locations: [{ value: 'private', count: -1 }], types: [] } }).api.getSaleOptions(signal))
})

function translations(language, namespace) {
  const data = JSON.parse(fs.readFileSync(path.join(root, source, `locale/${language}/${namespace}.json`), 'utf8'))
  return (key, values = {}) => {
    const value = key.split('.').reduce((v, part) => v?.[part], data) ?? values.defaultValue
    assert.equal(typeof value, 'string', `Missing ${language}/${namespace}:${key}`)
    return value.replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? ''))
  }
}
function pageModule(language, react = React, router = {}, api = {}) {
  return load(source + 'pages/realtor/SaleProperties.tsx', {
    react, 'react/jsx-runtime': require('react/jsx-runtime'), 'react-router-dom': router,
    'react-i18next': { useTranslation: (namespace, { keyPrefix = '' } = {}) => ({ t: (key, values) => translations(language, namespace)((keyPrefix ? keyPrefix + '.' : '') + key, values), i18n: { language } }) },
    '../../api/saleCatalog': api, '../../lib/saleCatalog': helpers, '../../lib/siteUrls': load(source + 'lib/siteUrls.ts'),
  })
}

test('profile and account catalog shortcut renders only for authorized real roles with bilingual labels', () => {
  for (const language of ['en', 'es']) {
    const { SaleCatalogLink } = load(source + 'components/shared/SaleCatalogLink.tsx', {
      'react/jsx-runtime': require('react/jsx-runtime'), '../../lib/saleCatalog': helpers,
      'react-i18next': { useTranslation: namespace => ({ t: translations(language, namespace) }) },
    })
    for (const role of ['buyer', 'owner', 'realtor', 'admin']) {
      const html = renderToStaticMarkup(React.createElement(SaleCatalogLink, { accountRole: role }))
      if (!helpers.canBrowseSales(role)) assert.equal(html, '')
      else { assert.ok(html.includes('href="/sale-properties?workspace=realtor"')); assert.ok(html.includes(translations(language, 'nav')('sale-properties'))) }
    }
  }
})

test('real cards show original currency and canonical public detail contact/share links in both languages', async () => {
  const page = await apiHarness(response([raw({ currency: 'DOP', price: 7500000 })])).api.getSaleCatalog(defaults, 1, new AbortController().signal)
  for (const language of ['en', 'es']) {
    const { SalePropertyCard } = pageModule(language), entry = page.items[0]
    const detailsUrl = new URL(helpers.saleListingPath(entry.id), 'https://ilovedrrealty.com').href
    const html = renderToStaticMarkup(React.createElement(SalePropertyCard, { entry, detailsUrl }))
    assert.ok(html.includes('Synthetic sale') && html.includes('Sosúa'))
    assert.ok(html.includes(`href="https://ilovedrrealty.com/listing/${id(1)}/"`))
    assert.ok(html.includes(translations(language, 'realtor')('sale_catalog.view').replaceAll('&', '&amp;')))
    assert.ok(!html.includes('PRIVATE') && !html.includes('payout') && !html.includes('Edit listing'))
    assert.ok(/RD\$|DOP/.test(html), 'Card retains its original Dominican-peso currency')
  }
  for (const bad of ['../../private', 'name', id(1) + '?owner_id=PRIVATE']) assert.equal(helpers.saleListingPath(bad), null)
})

// Bounded hook/React SSR adapter: exercises actual component events/effect cleanups,
// not browser geometry or real HTTP. Only explicit synthetic API responses can run.
function pageHarness(language = 'en', initial = '') {
  const slots = [], effects = [], calls = []; let cursor = 0, dirty = true, tree, html, query = new URLSearchParams(initial)
  const react = { ...React,
    useState(initialValue) { const index = cursor++; if (!slots[index]) slots[index] = { value: typeof initialValue === 'function' ? initialValue() : initialValue }
      return [slots[index].value, value => { const next = typeof value === 'function' ? value(slots[index].value) : value; if (!Object.is(next, slots[index].value)) { slots[index].value = next; dirty = true } }] },
    useEffect(effect, deps) { const index = cursor++, old = slots[index]; if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) {
      slots[index] = { deps, cleanup: old?.cleanup }; effects.push(() => { slots[index].cleanup?.(); slots[index].cleanup = effect() }) } },
  }
  const api = { getSaleCatalog(filters, page, signal) { return new Promise((resolve, reject) => calls.push({ filters, page, signal, resolve, reject })) }, getSaleOptions: async () => ({ locations: ['Sosúa'], types: ['villa'] }) }
  const router = { useSearchParams: () => [query, next => { query = new URLSearchParams(next); dirty = true }] }
  const { RealtorSaleProperties } = pageModule(language, react, router, api)
  function nodes(value = tree) { if (!React.isValidElement(value)) return []; return [value, ...React.Children.toArray(value.props.children).flatMap(nodes)] }
  const h = { calls, get html() { return html }, get query() { return query }, nodes,
    async settle() { for (let n = 0; n < 15; n++) { if (dirty) { dirty = false; cursor = 0; tree = RealtorSaleProperties(); html = renderToStaticMarkup(tree); for (const effect of effects.splice(0)) effect() } for (let tick = 0; tick < 3; tick++) await Promise.resolve(); if (!dirty && !effects.length) return } assert.fail('Unbounded render loop') },
    navigate(value) { query = new URLSearchParams(value); dirty = true },
    dispose() { for (const slot of slots) slot?.cleanup?.() },
  }
  return h
}

test('actual page aborts stale pages, preserves pagination filters and recovers from errors and empty results', async () => {
  const h = pageHarness('en', 'region=Sos%C3%BAa')
  try {
    await h.settle(); assert.equal(h.calls.length, 1)
    h.navigate('region=Cabarete&page=2'); await h.settle()
    assert.equal(h.calls[0].signal.aborted, true)
    assert.equal(h.calls[1].page, 2); assert.equal(h.calls[1].filters.region, 'Cabarete')
    h.calls[1].resolve({ items: [], total: 25, page: 2, page_size: 24 }); await h.settle()
    h.calls[0].resolve({ items: [{ id: id(1), title: 'STALE_PRIVATE_RESULT' }], total: 1, page: 1, page_size: 24 }); await h.settle()
    assert.ok(!h.html.includes('STALE_PRIVATE_RESULT'))
    const previous = h.nodes().find(n => n.type === 'button' && n.props.children === 'Previous')
    previous.props.onClick(); await h.settle()
    assert.equal(h.query.get('region'), 'Cabarete'); assert.equal(h.query.has('page'), false)
    h.calls[2].reject(new Error('Synthetic unavailable')); await h.settle()
    assert.ok(h.html.includes('Properties could not be loaded'))
    h.nodes().find(n => n.type === 'button' && n.props.children === 'Try again').props.onClick(); await h.settle()
    h.calls[3].resolve({ items: [], total: 0, page: 1, page_size: 24 }); await h.settle()
    assert.ok(h.html.includes('No active sale properties'))
    assert.ok(h.calls.every(call => call.signal instanceof AbortSignal))
  } finally { h.dispose() }
  assert.equal(h.calls.at(-1).signal.aborted, true)
})

test('actual filter form clears unsaved edits even on the default URL and invalid URLs make no catalog request', async () => {
  for (const language of ['en', 'es']) {
    const h = pageHarness(language), t = translations(language, 'realtor')
    try {
      await h.settle()
      h.nodes().find(n => n.type === 'input' && n.props.type === 'search').props.onChange({ target: { value: 'Unsaved place' } }); await h.settle()
      h.nodes().find(n => n.type === 'button' && n.props.children === t('sale_catalog.clear')).props.onClick(); await h.settle()
      assert.equal(h.nodes().find(n => n.type === 'input' && n.props.type === 'search').props.value, '')
      h.navigate('min_price=50&max_price=10'); await h.settle()
      assert.equal(h.calls.length, 1)
      assert.ok(h.html.includes(t('sale_catalog.invalid_filters')))
      h.nodes().find(n => n.type === 'button' && n.props.children === t('sale_catalog.clear')).props.onClick(); await h.settle()
      assert.equal(h.calls.length, 2)
      assert.equal(h.calls[1].filters.usd_to_dop, '59.5')
      assert.ok(h.html.includes(t('sale_catalog.price_note')))
    } finally { h.dispose() }
  }
})
