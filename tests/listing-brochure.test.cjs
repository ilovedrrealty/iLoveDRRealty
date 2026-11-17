const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { test } = require('node:test')
const { inflateSync } = require('node:zlib')
const ts = require('typescript')
const { PDFArray, PDFDict, PDFDocument, PDFName, PDFString } = require('pdf-lib')

const landing = path.join(__dirname, '..', 'apps', 'landing', 'src')
const fixtureId = '18e0b859-d0d9-4e38-bbe0-448d332735b2'
const canonical = 'https://ilovedrrealty.com/listing/' + fixtureId + '/'
const modules = new Map()

function loadLocal(file) {
  const resolved = path.resolve(landing, file)
  if (modules.has(resolved)) return modules.get(resolved).exports
  const module = { exports: {} }
  modules.set(resolved, module)
  const result = ts.transpileModule(fs.readFileSync(resolved, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  })
  // Run in the same realm as pdf-lib, which validates Array and Uint8Array
  // constructors.
  const evaluate = new Function('module', 'exports', 'require', result.outputText)
  evaluate(module, module.exports, name => name.startsWith('.')
    ? loadLocal(path.relative(landing, path.resolve(path.dirname(resolved), name + '.ts')))
    : require(name))
  return module.exports
}

const { listingBrochureFacts, createListingBrochure } = loadLocal('lib/listingBrochure.ts')

const row = changes => ({
  id: fixtureId, status: 'active', type: 'villa', transaction: 'both',
  title: 'Villa Mar Azul 🏡 y jardín', location: '  SOSU\u0301A ', location_precision: 'area',
  bedrooms: 3, bathrooms: '2.5', area_sqft: 2340, lot_size_sqft: 4050, year_built: 2021,
  currency: 'DOP', price: '16000000.25', price_per_month: '45890.50', price_per_day: '1450.00',
  latitude: 19.71, longitude: -70.51,
  description: 'PRIVATE_UNSCOPED_DESCRIPTION', submitted_by_name: 'PRIVATE_PERSON',
  submitted_by_email: 'private-contact@example.invalid', co_listing_agreement_url: 'https://private.example.invalid/',
  maps_url: 'https://maps.example.invalid/', images: ['https://photo.example.invalid/'],
  ...changes,
})
const project = (changes = {}, id = fixtureId) => listingBrochureFacts(id, row(changes))

function translate(locale) {
  const dictionary = JSON.parse(fs.readFileSync(path.join(landing, 'locales', locale, 'property_detail.json'), 'utf8')).brochure
  return key => {
    const value = key.split('.').reduce((record, field) => record?.[field], dictionary)
    assert.equal(typeof value, 'string', 'Missing ' + locale + ' brochure translation ' + key)
    return value
  }
}

test('the brochure requires the requested current active listing and recognized public type/purpose', () => {
  assert.equal(project({ status: 'archived' }), null)
  assert.equal(project({ status: 'draft' }), null)
  assert.equal(project({ type: 'unknown' }), null)
  assert.equal(project({ transaction: 'investment' }), null)
  assert.equal(project({ id: '18e0b859-d0d9-4e38-bbe0-448d332735b3' }), null)
  assert.equal(project({}, fixtureId + '\n'), null)
  assert.equal(project({ id: fixtureId.toUpperCase() }).url, canonical)
})

test('only named brochure fields are projected and location is a canonical public catalog area', () => {
  const fields = project()
  assert.deepEqual(Object.keys(fields).sort(), [
    'area', 'bathrooms', 'bedrooms', 'built', 'currency', 'id', 'livingSqft', 'lotSqft', 'rates',
    'title', 'transaction', 'type', 'url',
  ])
  assert.equal(fields.area, 'Sosúa')
  assert.equal(fields.title, 'Villa Mar Azul y jardín')
  assert.equal(project({ location: 'Sosúa, 19 Example Street' }).area, null)
  assert.equal(project({ title: 'Phone +1 (809) 555-0102' }).title, null)
  assert.equal(project({ title: 'Contact sales@example.invalid' }).title, null)
  assert.equal(project({ title: '<b>Villa</b>' }).title, null)
  for (const precision of ['hidden', undefined]) {
    const masked = project({ title: 'Villa at a hidden address', location_precision: precision })
    assert.equal(masked.title, null)
    assert.equal(masked.area, null)
  }
  assert.equal(project({ type: 'land' }).livingSqft, null)
  assert.equal(project({ area_sqft: -5, bathrooms: '0', lot_size_sqft: '60.3', year_built: -1 }).lotSqft, null)
})

test('base sale and declared day/month rent remain native and ambiguous prices are omitted', () => {
  const both = project()
  assert.equal(both.currency, 'DOP')
  assert.deepEqual(both.rates, [
    { basis: 'sale_price', amount: 16000000.25 },
    { basis: 'per_month', amount: 45890.5 },
    { basis: 'per_day', amount: 1450 },
  ])
  const rent = project({ currency: 'USD', transaction: 'rent', price_per_month: null, price_per_day: '25' })
  assert.deepEqual(rent.rates, [{ basis: 'per_day', amount: 25 }])
  assert.deepEqual(project({ transaction: 'rent', price_per_day: 'NaN', price_per_month: null }).rates, [])
  assert.deepEqual(project({ currency: 'EUR' }).rates, [])
  assert.deepEqual(project({ currency: undefined }).rates, [])
  assert.deepEqual(project({ transaction: 'sale', construction_status: 'Under Construction' }).rates, [])
  assert.deepEqual(project({ transaction: 'sale', construction_status: 'Pre-Construction' }).rates, [])
  assert.deepEqual(project({ price: '100\n', price_per_day: false, price_per_month: '-500' }).rates, [])
})

function textOnPage(pdf) {
  const refs = pdf.getPage(0).node.Contents().asArray()
  const commands = refs.map(ref => inflateSync(pdf.context.lookup(ref).getContents()).toString('ascii')).join('\n')
  return [...commands.matchAll(/<([A-F0-9]+)> Tj/g)].map(match => Buffer.from(match[1], 'hex').toString('latin1')).join('\n')
}

test('both languages produce a real one-page printable PDF with one HTTPS listing link', async () => {
  for (const locale of ['en', 'es']) {
    const pdf = await PDFDocument.load(await createListingBrochure(project(), locale, translate(locale)))
    assert.equal(pdf.getPageCount(), 1)
    assert.deepEqual(pdf.getPage(0).getSize(), { width: 612, height: 792 })
    assert.equal(pdf.getAuthor(), 'I Love DR Realty')
    assert.equal(pdf.catalog.lookup(PDFName.of('Lang'), PDFString).decodeText(), locale)
    const references = pdf.getPage(0).node.lookup(PDFName.of('Annots'), PDFArray)
    assert.equal(references.size(), 1)
    const action = references.lookup(0, PDFDict).lookup(PDFName.of('A'), PDFDict)
    assert.equal(action.lookup(PDFName.of('S'), PDFName).asString(), '/URI')
    assert.equal(action.lookup(PDFName.of('URI'), PDFString).decodeText(), canonical)
    const text = textOnPage(pdf)
    assert.ok(text.includes('Villa Mar Azul y jardín') && text.includes('Sosúa'))
    assert.ok(text.includes(translate(locale)('per_month')) && text.includes(translate(locale)('per_day')))
    assert.ok(text.includes('DOP '))
    for (const omitted of ['PRIVATE_', 'private-contact', 'https://maps', 'https://photo', '19.71', '-70.51', 'USD ']) {
      assert.ok(!text.includes(omitted))
    }
  }
})

test('a hidden-location rent-only brochure preserves only a declared rate and cannot expose title or area', async () => {
  const fields = project({
    transaction: 'rent', location_precision: 'hidden', title: 'SENSITIVE_FIXTURE_ADDRESS',
    currency: 'USD', price: '15000', price_per_month: '700', price_per_day: null,
  })
  const pdf = await PDFDocument.load(await createListingBrochure(fields, 'en', translate('en')))
  const text = textOnPage(pdf)
  assert.ok(text.includes('USD 700') && text.includes('Rent per month'))
  assert.ok(!text.includes('Rent per day') && !text.includes('15,000') && !text.includes('SENSITIVE_FIXTURE_ADDRESS') && !text.includes('Sosúa'))
  assert.equal(pdf.getTitle(), 'Villa | I Love DR Realty')
})
