const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const ts = require('typescript')

const filename = path.resolve(__dirname, '../apps/dashboard/src/components/admin/DevelopmentInventoryFields.tsx')
const node = (type, props) => ({ type, props })
const dependencies = {
  'react/jsx-runtime': { jsx: node, jsxs: node },
  react: { useId: () => 'test-id', useState: initial => [initial, () => {}] },
  'react-i18next': { useTranslation: () => ({ t: key => key }) },
  '../../api/developments': { DEVELOPMENT_UNIT_STATUSES: ['available', 'reserved', 'sold', 'unconfirmed'] },
  '../../pages/admin/WebsiteEditorFields': { editorInput: '', editorButton: '', TextField: props => node('mock-text-field', props) },
}
const moduleUnderTest = { exports: {} }
const { outputText, diagnostics } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, reportDiagnostics: true, compilerOptions: {
  target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
} })
assert.deepEqual(diagnostics, [])
vm.runInNewContext(outputText, {
  URL, module: moduleUnderTest, exports: moduleUnderTest.exports,
  require: name => {
    assert.ok(Object.hasOwn(dependencies, name), name)
    return dependencies[name]
  },
})
const { DevelopmentInventoryFields } = moduleUnderTest.exports

function flatten(element) {
  if (Array.isArray(element)) return element.flatMap(flatten)
  if (!element || typeof element !== 'object') return []
  return [element, ...flatten(typeof element.type === 'function' ? element.type(element.props) : element.props.children)]
}

function blank() {
  return {
    project: { name_en: '', name_es: '', summary_en: '', summary_es: '', target_delivery: null, phases: [], payment_stages: [], updates: [] },
    evidence: { source_reference: '', verified_on: null, availability_valid_through: null, private_note: '' },
  }
}

function harness(initial = blank()) {
  let draft = initial
  const all = () => flatten(DevelopmentInventoryFields({ draft, onChange: next => { draft = next }, disabled: false }))
  const input = label => {
    const match = all().find(node => node.type.name === 'InputField' && node.props.label === label)
    assert.ok(match, label)
    return match.props
  }
  const control = (type, predicate) => {
    const match = all().find(node => node.type === type && predicate(node.props))
    assert.ok(match, type)
    return match.props
  }
  const button = label => control('button', props => props.children === label)
  return { all, input, button, control, get: () => draft }
}

test('phase and unit controls build only the nested wire data and preserve private evidence', () => {
  const view = harness()
  view.control('mock-text-field', props => props.label === 'source_reference').onChange('Dated synthetic developer statement')
  view.input('verified_on').onChange('2026-11-17')
  view.button('add_phase').onClick()
  view.input('phase_code').onChange('A')
  view.button('add_unit').onClick()
  view.input('unit_code').onChange('A-104')
  view.input('floor').onChange('Garden level')
  view.input('size').onChange('112.50')
  const unit = view.get().project.phases[0].units[0]
  assert.equal(unit.code, 'A-104')
  assert.equal(unit.floor, 'Garden level')
  assert.equal(unit.area_m2, '112.50')
  assert.equal(unit.status, 'unconfirmed')
  assert.equal(view.get().evidence.verified_on, '2026-11-17')
  assert.equal(view.get().evidence.source_reference, 'Dated synthetic developer statement')
  view.button('remove_unit').onClick()
  assert.equal(view.get().project.phases[0].units.length, 0)
})

test('replacing a floor plan clears approval and credential links cannot be approved', () => {
  const view = harness()
  view.button('add_phase').onClick()
  view.button('add_unit').onClick()
  const check = () => view.control('input', props => props.type === 'checkbox')
  assert.equal(check().disabled, true)
  view.input('floor_plan').onChange('https://developer.example.test/approved.pdf')
  assert.equal(check().disabled, false)
  check().onChange({ target: { checked: true } })
  assert.equal(view.get().project.phases[0].units[0].floor_plan_approved, true)
  view.input('floor_plan').onChange('https://developer.example.test/draft.pdf?x-amz-signature=synthetic')
  assert.equal(view.get().project.phases[0].units[0].floor_plan_approved, false)
  assert.equal(check().disabled, true)
})

test('payment percentage and amount controls stay mutually exclusive, including zero percent', () => {
  const view = harness()
  view.button('add_payment').onClick()
  view.input('payment_percent').onChange('0')
  assert.equal(view.input('payment_amount').disabled, true)
  assert.equal(view.get().project.payment_stages[0].percent, '0')
  view.input('payment_percent').onChange('')
  view.input('payment_amount').onChange('45000')
  const currency = view.control('select', props => props.children[1].props.value === 'USD')
  currency.onChange({ target: { value: 'DOP' } })
  assert.equal(view.input('payment_percent').disabled, true)
  assert.equal(view.get().project.payment_stages[0].currency, 'DOP')
  view.input('payment_amount').onChange('')
  assert.equal(view.get().project.payment_stages[0].currency, null)
  assert.equal(view.input('payment_percent').disabled, false)
})

test('the editor renders one bounded page of unit controls while retaining the complete draft', () => {
  const initial = blank()
  initial.project.phases.push({
    code: 'A', name_en: 'A', name_es: 'A', target_delivery: null,
    units: Array.from({ length: 50 }, (_, index) => ({
      code: String(index), floor: null, area_m2: null, price: null, currency: null,
      status: 'unconfirmed', floor_plan_url: null, floor_plan_approved: false,
    })),
  })
  const view = harness(initial)
  assert.equal(view.all().filter(node => node.type.name === 'InputField' && node.props.label === 'unit_code').length, 25)
  assert.equal(view.get().project.phases[0].units.length, 50)
})
