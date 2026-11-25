const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { PhoneInput } = require('react-international-phone')
const { isValidPhoneNumber } = require('libphonenumber-js')

const signupPath = path.join(__dirname, '../apps/landing/src/views/Signup.tsx')
const signup = fs.readFileSync(signupPath, 'utf8')
const tree = ts.createSourceFile(signupPath, signup, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const inputs = []
function visit(node) {
  if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(tree) === 'PhoneInput') inputs.push(node)
  ts.forEachChild(node, visit)
}
visit(tree)
assert.equal(inputs.length, 1, 'Exercise the actual Signup phone input option')
const overflow = inputs[0].attributes.properties.find(attribute => ts.isJsxAttribute(attribute) && attribute.name.text === 'allowMaskOverflow')
assert.ok(overflow && !overflow.initializer, 'Signup must permit digits beyond a country formatting mask')

function renderedDigits(value, country, allowMaskOverflow) {
  const html = renderToStaticMarkup(React.createElement(PhoneInput, { value, defaultCountry: country, allowMaskOverflow }))
  const input = html.match(/<input\b[^>]*>/g)
  assert.equal(input?.length, 1)
  const renderedValue = input[0].match(/\bvalue="([^"]*)"/)
  assert.ok(renderedValue, 'Read the actual library-rendered phone input')
  return renderedValue[1].replace(/\D/g, '')
}

test('Signup preserves the final Argentina mobile digit beyond the locked country mask', () => {
  const number = '+5491123456789'
  assert.equal(isValidPhoneNumber(number), true)
  assert.equal(renderedDigits(number, 'ar', true), number.slice(1))
  assert.equal(renderedDigits(number, 'ar', false), number.slice(1, -1), 'The unmodified mask reproduces the reported one-digit truncation')
})

test('Signup overflow keeps complete Dominican and US numbers intact', () => {
  for (const [country, number] of [['do', '+18095551234'], ['us', '+12125551234']]) {
    assert.equal(isValidPhoneNumber(number), true)
    assert.equal(renderedDigits(number, country, true), number.slice(1))
  }
})

test('Accepting mask overflow retains validation against incomplete or impossible numbers', () => {
  assert.match(signup, /isValidPhoneNumber\(v\)/)
  for (const number of ['+5491', '+1', '+999123456789']) assert.equal(isValidPhoneNumber(number), false)
})
