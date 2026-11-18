const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const dashboard = 'apps/dashboard/src'
const plain = value => JSON.parse(JSON.stringify(value))

function load(name, imports = {}) {
  const filename = path.join(root, name)
  const out = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename, reportDiagnostics: true, compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    },
  })
  assert.deepEqual(out.diagnostics, [])
  const module = { exports: {} }
  vm.runInNewContext(out.outputText, { module, exports: module.exports, Intl, URL, require: dependency => {
    assert.ok(Object.hasOwn(imports, dependency), dependency)
    return imports[dependency]
  } })
  return module.exports
}

const costs = load(`${dashboard}/data/purchaseCosts.ts`)
const normalized = { category: 'inspection', currency: 'USD', basis: 'quote', amount_minor: 0, label: 'Inspection quote' }
const id = 'b95cce91-71cc-43a0-892f-28b31007f9d5'
const summary = { id, title: 'Synthetic due diligence review', version: 4, updated_at: '2026-11-17T08:15:00Z' }

function harness() {
  const queue = []
  const calls = []
  const client = Object.fromEntries(['get', 'post', 'put'].map(method => [method, async (url, ...args) => {
    calls.push([method, url, ...args])
    return { data: queue.shift() }
  }]))
  const api = load(`${dashboard}/api/researchWorkspaces.ts`, {
    './axios': client, '../data/purchaseCosts': costs,
  })
  return { api, calls, queue }
}

test('amounts use exact cents, distinguish blank and zero, and reject invalid or out-of-limit values', () => {
  const amount = value => plain(costs.purchaseCostAmount(value))
  assert.deepEqual(amount('  '), { state: 'blank' })
  assert.deepEqual(amount('0.00'), { state: 'valid', minor: 0 })
  assert.deepEqual(amount('0,01'), { state: 'valid', minor: 1 })
  assert.deepEqual(amount('.5'), { state: 'valid', minor: 50 })
  assert.deepEqual(amount('99999999999.99'), { state: 'valid', minor: 9_999_999_999_999 })
  for (const value of ['-1', '1.005', '1,234.56', '1e3', 'NaN', '100000000000.00', '6.']) {
    assert.deepEqual(amount(value), { state: 'invalid' }, value)
  }
  assert.equal(costs.purchaseCostRows([normalized])[0].amount, '0.00')
})

test('prepared worksheets omit blank rows and keep two independent exact totals', () => {
  const blank = costs.blankPurchaseCostRow()
  const rows = [blank, { ...blank, amount: '0.00', category: 'inspection', basis: 'quote', label: ' Inspection quote ' },
    { ...blank, amount: '19,05', currency: 'DOP' }, { ...blank, amount: '0.01', currency: 'DOP' }]
  const prepared = costs.preparePurchaseCosts(rows)
  assert.equal(prepared.length, 3)
  assert.deepEqual(plain(prepared[0]), normalized)
  assert.deepEqual(plain(costs.purchaseCostTotals(prepared)), { USD: 0, DOP: 1906 })
  assert.deepEqual(plain(costs.purchaseCostTotals([])), { USD: null, DOP: null })
  assert.equal(costs.preparePurchaseCosts([...rows, { ...blank, amount: 'bad' }]), null)
  assert.equal(costs.preparePurchaseCosts(Array.from({ length: 21 }, () => blank)), null)
  assert.equal(costs.preparePurchaseCosts([{ ...blank, amount: '1', label: 'x'.repeat(81) }]), null)
  const limit = Array.from({ length: 20 }, () => ({ ...normalized, amount_minor: costs.PURCHASE_COST_AMOUNT_MINOR_LIMIT }))
  assert.equal(costs.purchaseCostTotals(limit).USD, 199_999_999_999_980)
  assert.match(costs.purchaseCostMoney(costs.purchaseCostTotals(limit).USD, 'USD', false), /1,999,999,999,999\.80$/)
})

test('existing review writes retain their version contract; explicit zero and clearing require a verified receipt', async () => {
  const { api, queue, calls } = harness()
  const base = { ...api.emptyResearchData(), title: summary.title }
  const saved = { ...summary, data: base }
  queue.push(saved, { ...saved, data: { ...base, purchase_costs: [normalized] } },
    { ...saved, data: { ...base, purchase_costs: [] } }, saved)
  assert.equal(Object.hasOwn((await api.getResearchWorkspace(id)).data, 'purchase_costs'), false)
  await api.saveResearchWorkspace({ ...base, purchase_costs: [normalized] }, null)
  await api.saveResearchWorkspace({ ...base, purchase_costs: [] }, summary)
  await assert.rejects(api.saveResearchWorkspace({ ...base, purchase_costs: [normalized] }, summary),
    problem => problem instanceof api.PurchaseCostsUnconfirmed && problem.workspace.id === id)
  assert.equal(calls[1][1], '/research-workspaces')
  assert.equal(calls[1][2].purchase_costs[0].amount_minor, 0)
  assert.deepEqual(plain(calls[2][2]), { ...plain(base), purchase_costs: [], expected_version: 4 })
  queue.push({ ...saved, data: { ...base, purchase_costs: [{ ...normalized, currency: 'EUR' }] } })
  await assert.rejects(api.getResearchWorkspace(id), /Invalid saved purchase costs/)
  queue.push(saved)
  await api.saveResearchWorkspace(base, summary)
  assert.equal(Object.hasOwn(calls.at(-1)[2], 'purchase_costs'), false)
})

test('the private worksheet renders its saved/print amounts and fixed public resource in both languages', () => {
  const resources = load('packages/website-settings/src/drResources.ts')
  for (const language of ['en', 'es']) {
    const dictionary = JSON.parse(fs.readFileSync(path.join(root, dashboard, 'locale', language, 'research_tools.json'))).purchase_costs
    const icons = Object.fromEntries(['ExternalLink', 'Plus', 'Trash2'].map(name => [name, () => null]))
    const { PurchaseCostWorksheet } = load(`${dashboard}/pages/shared/PurchaseCostWorksheet.tsx`, {
      react: React, 'react/jsx-runtime': require('react/jsx-runtime'), 'lucide-react': icons,
      '../../../../../packages/website-settings/src/drResources': resources, '../../data/purchaseCosts': costs,
      'react-i18next': { useTranslation: () => ({ i18n: { language }, t(key, parameters = {}) {
        const value = key.split('.').reduce((row, part) => row?.[part], dictionary)
        assert.equal(typeof value, 'string', key)
        return value.replace(/\{\{(\w+)\}\}/g, (_, field) => String(parameters[field]))
      } }) },
    })
    const markup = renderToStaticMarkup(React.createElement(PurchaseCostWorksheet, {
      rows: costs.purchaseCostRows([normalized]), costs: [normalized], disabled: false, onChange() {},
    }))
    assert.match(markup, /USD\s0\.00/)
    assert.match(markup, /No amounts|Sin montos/)
    assert.match(markup, /print:block/)
    assert.match(markup, /Inspection quote/)
    assert.match(markup, /href="https:\/\/www\.dgii\.gov\.do\/app\/WebApps\/Calculadoras\/transferenciaInmobiliaria\/CalculoTransferencia\.aspx" target="_blank" rel="noopener noreferrer"/)
    assert.doesNotMatch(markup, /<form/)
  }
})
