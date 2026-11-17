/** Pure synthetic regressions. No browser, network, clipboard or WhatsApp is opened. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
const clone = value => JSON.parse(JSON.stringify(value))
const locale = language => JSON.parse(fs.readFileSync(path.join(root, `apps/landing/src/locales/${language}/calculator.json`), 'utf8'))

function loadTs(relative, overrides = {}) {
  const module = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
  // Execute trusted repository code in the host realm. pdf-lib validates its
  // inputs with constructor/instanceof checks; a VM Array/Uint8Array otherwise
  // differs from the host library's constructors unlike a real browser bundle.
  const evaluate = new Function('module', 'exports', 'require', 'btoa', 'atob', code)
  evaluate(module, module.exports, name => Object.hasOwn(overrides, name) ? overrides[name] : require(name),
    value => Buffer.from(value, 'binary').toString('base64'), value => Buffer.from(value, 'base64').toString('binary'))
  return module.exports
}
const roi = loadTs('apps/landing/src/lib/roiCalculator.ts')
function translate(language) {
  const data = locale(language)
  return (key, options = {}) => {
    const value = key.split('.').reduce((item, name) => item?.[name], data)
    assert.equal(typeof value, 'string', `Missing ${language} translation ${key}`)
    return value.replace(/\{\{(\w+)\}\}/g, (_, name) => String(options[name] ?? ''))
  }
}
function state(changes = {}) {
  return { ...clone(roi.ROI_DEFAULTS), price: 100000, downPct: 25, closingPct: 5, reno: 10000, rate: 0, term: 5,
    rent: 1000, occupancy: 100, rentGrowth: 0, propTaxPct: 0, mgmtPct: 0, maintPct: 0, insPct: 0,
    confoturYrs: 0, appRate: 0, flipHoldingMonths: 12, flipResalePct: 20, flipSellingPct: 5, ...changes }
}
function close(actual, expected, tolerance = 0.0000001) { assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`) }

// Inspect actual React SSR output, rather than accepting a label-shaped source
// string. All names/help references must resolve to unique rendered elements.
function renderedControls(html) {
  const decode = value => value.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  const text = value => decode(value.replace(/<[^>]*>/g, '')).trim()
  const elements = [...html.matchAll(/<([a-z][a-z0-9]*)\b([^>]*)>/g)].map(match => ({
    tag: match[1], end: match.index + match[0].length,
    attributes: Object.fromEntries([...match[2].matchAll(/([\w:-]+)(?:="([^"]*)")?/g)].map(attribute => [attribute[1], decode(attribute[2] ?? '')])),
  }))
  const ids = elements.filter(element => element.attributes.id).map(element => element.attributes.id)
  assert.equal(new Set(ids).size, ids.length, 'No two controls, labels or hints may share an id, including separate calculator instances')
  const byId = new Map(elements.filter(element => element.attributes.id).map(element => [element.attributes.id, element]))
  function referenceText(references) {
    return references.trim().split(/\s+/).map(id => {
      const target = byId.get(id)
      assert.ok(target, `Accessibility reference ${id} must target an existing unique element`)
      assert.notEqual(target.attributes['aria-hidden'], 'true', 'A name/help target must be available to assistive technology')
      const closing = html.indexOf(`</${target.tag}>`, target.end)
      assert.ok(closing >= target.end, `Name/help target ${id} must have rendered text`)
      const content = text(html.slice(target.end, closing))
      assert.ok(content, `Name/help target ${id} must not be empty`)
      return content
    }).join(' ')
  }
  return elements.filter(element => element.tag === 'select' || element.tag === 'input' && ['number', 'range'].includes(element.attributes.type)).map(element => {
    const attributes = element.attributes
    assert.ok(attributes.id, 'Every native calculator control needs its own unique id')
    const name = attributes['aria-labelledby'] ? referenceText(attributes['aria-labelledby']) : attributes['aria-label']?.trim()
    assert.ok(name, `Every ${attributes.type || element.tag} control needs a nonempty accessible name`)
    if (element.tag === 'select' || attributes.type === 'number') assert.ok(attributes['aria-labelledby'], 'Visible Field labels must name number/select controls')
    return { name, description: attributes['aria-describedby'] ? referenceText(attributes['aria-describedby']) : undefined, type: attributes.type || element.tag }
  })
}

for (const language of ['en', 'es']) {
  test(`calculator native controls have unique accessible EN/ES labels and help targets (${language})`, async () => {
    const React = require('react'), { renderToStaticMarkup } = require('react-dom/server')
    const { I18nextProvider } = require('react-i18next'), i18n = require('i18next').createInstance()
    const data = locale(language)
    await i18n.init({ lng: language, fallbackLng: false, ns: ['calculator'], defaultNS: 'calculator', resources: { [language]: { calculator: data } }, interpolation: { escapeValue: false } })
    for (const scenario of ['rent', 'vacation', 'flip']) for (const financing of ['mortgage', 'cash']) {
      // SSR has no user events/effects. Override only the two initial mode
      // values; real React hooks, context, useId and the full page still render.
      const fixtureReact = { ...React, useState: initial => React.useState(initial === 'rent' ? scenario : initial === 'mortgage' ? financing : initial) }
      const Calculator = loadTs('apps/landing/src/views/Calculator.tsx', {
        react: fixtureReact, '../hooks/useNav': { useNav: () => () => {} }, '../lib/roiCalculator': roi,
      }).default
      const html = renderToStaticMarkup(React.createElement(I18nextProvider, { i18n }, React.createElement(React.Fragment, null, React.createElement(Calculator), React.createElement(Calculator))))
      const expected = [
        [data.property.purchase_price, data.property.usd], [data.property.price_slider, data.property.usd],
        [data.property.down_payment, financing === 'cash' ? data.property.cash_full : undefined],
        [data.property.closing_costs], [scenario === 'flip' ? data.property.reno_flip : data.property.reno_rent, data.property.optional],
        [data.financing.interest_rate], [data.financing.loan_term], [data.financing.type_label],
        ...(scenario === 'flip' ? [[data.flip.holding_months], [data.flip.resale_change], [data.flip.selling_cost]] : [[data.income.monthly_rent], [data.income.rent_slider], [data.income.occupancy], [data.income.rent_growth]]),
        [data.expenses.prop_tax], [data.expenses.mgmt], [data.expenses.maint], [data.expenses.insurance],
        [data.expenses.confotur_label, data.expenses.confotur_hint], [data.expenses.appreciation],
      ]
      const controls = renderedControls(html)
      assert.deepEqual(controls.map(({ name, description }) => [name, description]), [...expected, ...expected].map(([name, description]) => [name, description]), `${language}/${scenario}/${financing}: each current control must have its own exact translated name and applicable hint`)
      assert.equal(controls.filter(control => control.type === 'range').length, scenario === 'flip' ? 2 : 4, 'Both the price and visible rent sliders need explicit localized names')
      assert.equal(controls.filter(control => control.type === 'select').length, 2)
    }
  })
}

test('simple payback has a consistent30-year scale and distinguishes results beyond its range', () => {
  const selected = state({ financing: 'cash', price: 120000, closingPct: 0, reno: 0, rent: 500 })
  const result = roi.calculateRoi(selected)
  close(result.breakeven, 20)
  const marker = roi.roiSimplePaybackScale(result.breakeven)
  assert.equal(marker.kind, 'within'); close(marker.positionPct, 200 / 3)
  assert.deepEqual([...roi.ROI_PAYBACK_TICKS], [0, 5, 10, 15, 20, 25, 30])
  close(roi.roiSimplePaybackScale(30).positionPct, 100)
  const later = roi.roiSimplePaybackScale(roi.calculateRoi({ ...selected, rent: 200 }).breakeven)
  assert.equal(later.kind, 'beyond'); assert.equal(later.years, 50); assert.equal(later.positionPct, null)
  close(roi.calculateRoi({ ...selected, rentGrowth: 15, appRate: 20 }).breakeven, 20)
})

test('undefined payback and an exact zero net are not rendered as a positive result', () => {
  const selected = state({ financing: 'cash', price: 100000, closingPct: 0, reno: 0, rent: 1000, maintPct: 12 })
  const result = roi.calculateRoi(selected)
  close(result.annualCashFlow, 0); assert.equal(result.breakeven, null)
  assert.equal(roi.roiSimplePaybackScale(result.breakeven).kind, 'undefined')
  const bar = roi.roiNetBar(result.years[0].net, result.maxBar)
  assert.equal(bar.kind, 'zero'); assert.equal(bar.heightPx, 0)
  const loss = roi.calculateRoi({ ...selected, mgmtPct: 1 })
  assert.equal(roi.roiNetBar(loss.years[0].net, loss.maxBar).kind, 'loss')
  assert.ok(roi.roiNetBar(loss.years[0].net, loss.maxBar).heightPx > 0)
  for (const value of [0, -1, Infinity, NaN, null]) assert.equal(roi.roiSimplePaybackScale(value).kind, 'undefined')
  assert.throws(() => roi.roiNetBar(1, 0), /Invalid cash flow/)
})

test('screen and reports define simple payback without implying growth-aware break-even', () => {
  const selected = state({ financing: 'cash', price: 120000, closingPct: 0, reno: 0, rent: 500 })
  for (const language of ['en', 'es']) {
    const data = locale(language), report = roi.buildRoiReport({ ...selected, locale: language }, translate(language))
    const payback = report.summary.find(row => row.key === 'breakeven')
    close(payback.raw, 20); assert.equal(payback.label, data.kpis.be_label)
    assert.ok(data.breakeven.beyond.includes('30'))
    assert.ok(report.notes.includes(data.report.rental_definition))
    assert.ok(data.chart.zero_net); assert.ok(data.chart.net_magnitude_note)
  }
  const screen = fs.readFileSync(path.join(root, 'apps/landing/src/views/Calculator.tsx'), 'utf8')
  assert.match(screen, /roiSimplePaybackScale\(model\?\.breakeven/)
  assert.match(screen, /year \/ ROI_PAYBACK_SCALE_YEARS \* 100/)
  assert.match(screen, /netBar\.kind === 'zero'/)
  assert.doesNotMatch(screen, /breakeven \/ 20/)
})

test('cash purchases invest the complete price plus closing/works; financing keeps the actual down payment', () => {
  const cash = roi.calculateRoi(state({ financing: 'cash' }))
  close(cash.initialCash, 115000); close(cash.loan, 0); close(cash.monthlyMortgage, 0)
  close(cash.annualCashFlow, 12000); close(cash.cashOnCash, 12000 / 115000 * 100)
  close(cash.grossYield, 12); close(cash.capRate, 12)
  const financed = roi.calculateRoi(state())
  close(financed.initialCash, 40000); close(financed.loan, 75000); close(financed.monthlyMortgage, 1250)
  close(financed.annualCashFlow, -3000); close(financed.cashOnCash, -7.5)
  close(financed.grossYield, 12)
  assert.notEqual(financed.cashOnCash, financed.grossYield)
  close(roi.calculateRoi(state({ financing: 'cash', downPct: 0 })).initialCash, 115000)
  close(roi.calculateRoi(state({ financing: 'cash', downPct: 100 })).initialCash, 115000)
})

test('flip profit deducts closing costs and expenses interest once, never principal twice', () => {
  for (const financing of ['cash', 'mortgage', 'seller']) {
    const chosen = state({ scenario: 'flip', financing })
    const result = roi.calculateRoi(chosen)
    close(result.resale, 120000); close(result.sellingCost, 6000); close(result.closingCost, 5000)
    close(result.flipProfit, -1000)
    close(result.flipProfit, result.saleCashAfterPayoff - result.initialCash - result.holdingCash)
    if (financing !== 'cash') {
      close(result.principalPaid, 15000); close(result.remainingLoan, 60000)
      close(result.holdingInterest, 0); close(result.holdingCash, 15000)
    }
  }
  const withoutClosing = roi.calculateRoi(state({ scenario: 'flip', closingPct: 0 }))
  close(withoutClosing.flipProfit, 4000)
  close(withoutClosing.flipProfit - roi.calculateRoi(state({ scenario: 'flip' })).flipProfit, 5000)
})

test('amortization uses annual-rate fractions/months, handles zero rate and stops at term', () => {
  const zero = roi.roiAmortization(1200, 0, 1, 3)
  close(zero.payment, 100); close(zero.principalPaid, 300); close(zero.remaining, 900); close(zero.interestPaid, 0)
  const afterTerm = roi.roiAmortization(1200, 0, 1, 15)
  close(afterTerm.monthsPaid, 12); close(afterTerm.payments, 1200); close(afterTerm.remaining, 0)
  const firstMonth = roi.roiAmortization(1200, 0.12, 1, 1)
  close(firstMonth.interestPaid, 12); close(firstMonth.principalPaid, firstMonth.payment - 12)
  close(firstMonth.remaining, 1200 - firstMonth.principalPaid)
  const longHold = roi.calculateRoi(state({ scenario: 'flip', flipHoldingMonths: 72 }))
  close(longHold.remainingLoan, 0); close(longHold.principalPaid, 75000); close(longHold.holdingCash, 75000)
  close(longHold.flipProfit, -1000)
  close(longHold.flipProfit, longHold.saleCashAfterPayoff - longHold.initialCash - longHold.holdingCash)
  const hard = roi.calculateRoi(state({ scenario: 'flip', financing: 'hard', rate: 2, flipHoldingMonths: 1 }))
  close(hard.effectiveRate, 0.06); close(hard.holdingInterest, 375)
  close(hard.flipProfit, hard.saleCashAfterPayoff - hard.initialCash - hard.holdingCash)
  for (const args of [[1000, Infinity, 5, 1], [-1, 0.1, 5, 1], [1000, 0.1, 0, 1], [1000, 0.1, 5, -1]]) assert.throws(() => roi.roiAmortization(...args))
})

test('projected percentage expenses follow rent, debt ends at term, undefined returns are not gross yield', () => {
  const growing = roi.calculateRoi(state({ financing: 'cash', mgmtPct: 10, rentGrowth: 10 }))
  close(growing.years[0].rent, 12000); close(growing.years[0].exp, 1200)
  close(growing.years[1].rent, 13200); close(growing.years[1].exp, 1320)
  close(roi.calculateRoi(state()).tenYearCashAndValue, 45000)
  const noEquity = roi.calculateRoi(state({ downPct: 0, closingPct: 0, reno: 0 }))
  assert.equal(noEquity.cashOnCash, null); assert.equal(noEquity.breakeven, null); close(noEquity.grossYield, 12)
  const taxed = roi.calculateRoi(state({ financing: 'cash', propTaxPct: 1 }))
  const exempt = roi.calculateRoi(state({ financing: 'cash', propTaxPct: 1, confoturYrs: 10 }))
  close(taxed.annualOperatingExpense - exempt.annualOperatingExpense, 1000)
  close(roi.calculateRoi(state({ scenario: 'flip', financing: 'cash', propTaxPct: 1, flipHoldingMonths: 6 })).holdingTax, 500)
})

test('no exemption is assumed; confirmed remaining years expire instead of restarting at purchase', () => {
  assert.equal(roi.ROI_DEFAULTS.confoturYrs, 0)
  const defaults = roi.calculateRoi(clone(roi.ROI_DEFAULTS))
  assert.ok(defaults.annualOperatingExpense >= roi.ROI_DEFAULTS.price * roi.ROI_DEFAULTS.propTaxPct / 100)
  const partial = roi.calculateRoi(state({ financing: 'cash', propTaxPct: 1, confoturYrs: 2 }))
  close(partial.years[0].exp, 0); close(partial.years[1].exp, 0); close(partial.years[2].exp, 1000)
  close(roi.calculateRoi(state({ scenario: 'flip', financing: 'cash', propTaxPct: 1, confoturYrs: 2, flipHoldingMonths: 30 })).holdingTax, 500)
  for (const remaining of [-1, 16, 1.5, '10']) assert.equal(roi.isRoiState(state({ confoturYrs: remaining })), false)
  assert.equal(roi.isRoiState(state({ confoturYrs: 15 })), true)
})

test('every chosen input and locale survives a bounded canonical URL reload without scenario presets', () => {
  for (const language of ['en', 'es']) for (const scenario of ['rent', 'vacation', 'flip']) {
    const chosen = state({ scenario, locale: language, rent: 4567.89, reno: 12345.67, flipHoldingMonths: 17, flipResalePct: -12.5, financing: 'seller' })
    const url = new URL(roi.roiShareUrl(chosen))
    assert.equal(url.origin, 'https://ilovedrrealty.com'); assert.equal(url.pathname, '/calculator/'); assert.equal(url.search, '')
    assert.ok(url.hash.length < roi.ROI_MAX_TOKEN_LENGTH + 6)
    const restored = roi.readRoiFragment(url.hash)
    assert.equal(restored.invalid, false); assert.deepEqual(clone(restored.state), chosen)
    assert.deepEqual(clone(roi.calculateRoi(restored.state)), clone(roi.calculateRoi(chosen)))
    assert.equal(restored.state.rent, 4567.89); assert.equal(restored.state.reno, 12345.67)
  }
})

test('tampered versions, currencies, contacts, URLs and non-finite/out-of-range numeric states are rejected', () => {
  const mutations = [value => { value.v = 2 }, value => { value.currency = 'DOP' }, value => { value.locale = 'fr' }, value => { value.scenario = 'unknown' }, value => { value.price = Infinity }, value => { value.rent = NaN }, value => { value.price = '100000' }, value => { value.price = 0 }, value => { value.occupancy = 101 }, value => { value.term = 5.5 }, value => { value.flipHoldingMonths = 0 }, value => { value.rate = 1.001 }, value => { value.email = 'synthetic@example.invalid' }, value => { value.redirect = 'https://example.invalid/' }, value => { delete value.rent }]
  for (const mutate of mutations) {
    const chosen = state(); mutate(chosen)
    assert.equal(roi.isRoiState(chosen), false)
    assert.throws(() => roi.encodeRoiState(chosen))
    assert.equal(roi.decodeRoiState(Buffer.from(JSON.stringify(chosen)).toString('base64url')), null)
  }
  for (const token of ['', 'x'.repeat(1601), 'invalid!', '=padding', 'eyJ2IjoxfQ', roi.encodeRoiState(state()) + '&email=test']) assert.equal(roi.decodeRoiState(token), null)
  assert.equal(roi.readRoiFragment('#roi=invalid').invalid, true)
  assert.equal(roi.readRoiFragment('').invalid, false)
})

test('reports use exact recalculated raw values and translate the same scenario in EN/ES', () => {
  for (const language of ['en', 'es']) for (const scenario of ['rent', 'vacation', 'flip']) {
    const chosen = state({ locale: language, scenario, price: 876543.21, downPct: 35.5, financing: 'seller', rate: 4.75, rent: 4321.23 })
    const before = JSON.stringify(chosen), report = roi.buildRoiReport(chosen, translate(language)), result = roi.calculateRoi(chosen)
    assert.equal(JSON.stringify(chosen), before)
    assert.deepEqual(clone(report.state), chosen); assert.equal(report.currency, 'USD'); assert.equal(report.language, language)
    for (const row of report.summary) assert.equal(row.raw, result[row.key])
    for (const row of report.assumptions) assert.equal(row.raw, chosen[row.key])
    assert.deepEqual(clone(report.years), clone(result.years))
    assert.ok(report.notes.every(note => typeof note === 'string' && note.length > 20))
    assert.ok(report.notes.some(note => note.includes(language === 'en' ? 'not guaranteed' : 'no son retornos garantizados')))
    assert.equal(report.references.length, 2)
    assert.ok(report.references.every(source => new URL(source.url).hostname === 'dgii.gov.do'))
    const restored = roi.readRoiFragment(new URL(report.url).hash).state
    assert.deepEqual(clone(roi.buildRoiReport(restored, translate(language))), clone(report))
  }
})

test('clipboard success/failure is truthful and WhatsApp creates only a recipient-picker draft', async () => {
  const chosen = state({ locale: 'es', scenario: 'flip' }), calls = []
  const copied = await roi.copyRoiLink(chosen, async value => { calls.push(value) })
  assert.equal(copied.copied, true); assert.deepEqual(calls, [roi.roiShareUrl(chosen)])
  assert.equal((await roi.copyRoiLink(chosen, async () => { throw new Error('Synthetic clipboard denial') })).copied, false)
  assert.equal((await roi.copyRoiLink(chosen)).copied, false)
  const report = roi.buildRoiReport(chosen, translate('es')), url = new URL(roi.roiWhatsAppUrl(chosen, translate('es')))
  assert.equal(url.origin, 'https://wa.me'); assert.equal(url.pathname, '/'); assert.deepEqual([...url.searchParams.keys()], ['text'])
  const draft = url.searchParams.get('text')
  assert.ok(draft.includes(report.url)); assert.ok(draft.includes(report.summary[0].value)); assert.ok(draft.includes(report.notes[0]))
  assert.ok(!url.searchParams.has('phone'))
})

test('real EN/ES PDF bytes contain the selected report fields and cents, without sample replacement', async () => {
  const library = require('pdf-lib')
  const pdf = loadTs('apps/landing/src/lib/roiPdf.ts', { './roiCalculator': roi })
  for (const language of ['en', 'es']) for (const scenario of ['rent', 'flip']) {
    const chosen = state({ locale: language, scenario, price: 876543.21, rate: 4.75, financing: 'seller' })
    const report = roi.buildRoiReport(chosen, translate(language))
    const bytes = await pdf.createRoiPdf(chosen, translate(language))
    assert.equal(Buffer.from(bytes).subarray(0, 5).toString(), '%PDF-')
    const document = await library.PDFDocument.load(bytes)
    assert.equal(document.getTitle(), report.title)
    assert.ok(document.getPageCount() >= 2 && document.getPageCount() <= 10)
    const text = []
    for (const page of document.getPages()) {
      const contents = document.context.lookup(page.node.Contents())
      const streams = contents instanceof library.PDFArray ? contents.asArray().map(ref => document.context.lookup(ref)) : [contents]
      for (const stream of streams) {
        const raw = stream.getContents(), filter = String(stream.dict.get(library.PDFName.of('Filter')) || '')
        const operators = (filter.includes('FlateDecode') ? zlib.inflateSync(raw) : Buffer.from(raw)).toString('latin1')
        for (const match of operators.matchAll(/<([0-9a-f]+)>\s*Tj/gi)) text.push(Buffer.from(match[1], 'hex').toString('latin1'))
      }
    }
    for (const row of [...report.assumptions, ...report.summary]) assert.ok(text.includes(pdf.roiPdfText(row.value)), `PDF lost selected field ${row.key} (${language}/${scenario})`)
    assert.ok(text.includes('iLoveDR Realty'))
    assert.ok(text.includes(pdf.roiPdfText(translate(language)('report.page', { page: 1, count: document.getPageCount() }))))
  }
})

test('PDF long text wraps within measured width and dependency failures never produce fake bytes', async () => {
  const pdf = loadTs('apps/landing/src/lib/roiPdf.ts', { './roiCalculator': roi })
  for (const text of ['Long report line '.repeat(20), roi.roiShareUrl(state()), 'áéíóú ñ — USD']) {
    const lines = pdf.wrapRoiPdfText(text, 80, value => value.length * 4)
    assert.ok(lines.length); assert.ok(lines.every(line => line.length * 4 <= 80))
  }
  assert.throws(() => pdf.wrapRoiPdfText('Synthetic', 0, value => value.length))
  const failing = loadTs('apps/landing/src/lib/roiPdf.ts', { './roiCalculator': roi, 'pdf-lib': { PDFDocument: { create: async () => { throw new Error('Synthetic PDF failure') } } } })
  await assert.rejects(failing.createRoiPdf(state(), translate('en')), /Synthetic PDF failure/)
  await assert.rejects(pdf.createRoiPdf({ ...state(), currency: 'DOP' }, translate('en')), /Invalid calculator assumptions/)
})

test('export locale trees match and the screen imports the same pure engine without eager PDF code', () => {
  function keys(value, prefix = '') { return Object.entries(value).flatMap(([key, item]) => item && typeof item === 'object' ? keys(item, prefix + key + '.') : [prefix + key]).sort() }
  assert.deepEqual(keys(locale('en')), keys(locale('es')))
  const source = fs.readFileSync(path.join(root, 'apps/landing/src/views/Calculator.tsx'), 'utf8')
  assert.ok(source.includes('calculateRoi(assumptions)'))
  assert.ok(source.includes("await import('../lib/roiPdf')"))
  assert.ok(!source.includes("from 'pdf-lib'")); assert.ok(!source.includes('mortgagePmt('))
  assert.ok(source.includes('setRent(value.rent)')); assert.ok(source.includes('setReno(value.reno)'))
  assert.ok(!source.includes('window.open('))
})
