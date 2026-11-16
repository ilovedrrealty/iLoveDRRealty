const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const root = path.resolve(__dirname, '..')
function load(relative, overrides = {}) {
  const module = { exports: {} }
  const source = fs.readFileSync(path.join(root, relative), 'utf8')
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText,
    { module, exports: module.exports, URL, require: name => Object.hasOwn(overrides, name) ? overrides[name] : require(name) })
  return module.exports
}
const model = load('apps/dashboard/src/lib/contactShare.ts')
const labels = { name: 'Nombre', email: 'Correo', phone: 'Teléfono' }
const contact = { name: 'Synthetic & Asociación', email: 'synthetic+villa@example.com', phone: '+18095550101',
  message: 'PRIVATE MESSAGE', notes: 'PRIVATE NOTES', tracking: { campaign: 'PRIVATE CAMPAIGN' },
  ghl_contact_url: 'PRIVATE CRM', property_address: 'PRIVATE ADDRESS', id: 'PRIVATE ID' }

test('minimum selection shares only the explicitly projected name, never the complete lead', () => {
  const preview = model.contactPreview(contact, model.minimalContactSelection(), labels)
  assert.equal(preview, 'Nombre: Synthetic & Asociación')
  for (const value of [contact.email, contact.phone, contact.message, contact.notes, contact.ghl_contact_url, contact.property_address, contact.id]) assert.ok(!preview.includes(value))
  assert.deepEqual(Object.keys(model.shareableContact(contact)).sort(), ['email', 'name', 'phone'])
  assert.notEqual(model.minimalContactSelection(), model.minimalContactSelection(), 'Selection must be fresh for each contact')
})

test('only checked valid contacts enter the exact preview; unsafe header data and invalid phones are excluded', () => {
  const selected = { name: false, email: true, phone: true }
  assert.equal(model.contactPreview(contact, selected, labels), 'Correo: synthetic+villa@example.com\nTeléfono: +18095550101')
  for (const email of ['x@example.com\r\nBcc: secret@example.com', '<img>@example.com', 'x@example.com?bcc=secret@example.com', 'x@example.com\u0000', 'invalid']) {
    assert.equal(model.shareableContact({ name: 'A', email }).email, '')
  }
  for (const phone of ['+1', 'not a phone', '123456', '1234567890123456', '(809 555-0101', '8095550101 x42', '8095550101'.padEnd(51),
    '+18095550101\nBcc: a@b.co', '8095550101\r\nBcc: a@b.co']) assert.equal(model.shareableContact({ name: 'A', phone }).phone, '')
  assert.equal(model.shareableContact({ name: 'A\nPhone: private' }).name, '')
})

test('national phone numbers keep their entered format in draft bodies only', () => {
  const selected = { name: false, email: false, phone: true }
  for (const phone of ['8095550101', '(809) 555-0101', '020 7946 0101', '809.555.0101']) {
    const preview = model.contactPreview({ name: 'A', phone }, selected, labels)
    assert.equal(preview, `Teléfono: ${phone}`)
    const draft = model.contactComposeLinks(preview, 'Contacto')
    const email = new URL(draft.email), whatsapp = new URL(draft.whatsapp)
    assert.equal(email.pathname, '')
    assert.equal(whatsapp.pathname, '/')
    assert.equal(email.searchParams.get('body'), preview)
    assert.equal(whatsapp.searchParams.get('text'), preview)
  }
  assert.equal(model.shareableContact({ name: 'A', phone: '+1 (809) 555-0101' }).phone, '+18095550101')
})

test('email and WhatsApp links round-trip exactly, without recipient or header injection', () => {
  const preview = model.contactPreview(contact, { name: true, email: true, phone: false }, labels)
  const links = model.contactComposeLinks(preview, 'Contacto: café & villa?')
  const email = new URL(links.email), whatsapp = new URL(links.whatsapp)
  assert.equal(email.pathname, '')
  assert.equal(email.searchParams.get('subject'), 'Contacto: café & villa?')
  assert.equal(email.searchParams.get('body'), preview)
  assert.deepEqual([...email.searchParams.keys()], ['subject', 'body'])
  assert.equal(whatsapp.origin, 'https://wa.me')
  assert.equal(whatsapp.searchParams.get('text'), preview)
  assert.deepEqual([...whatsapp.searchParams.keys()], ['text'])
  assert.equal(model.contactComposeLinks('', 'Contact'), null)
  assert.equal(model.contactComposeLinks('Contact', 'Contact\r\nBcc: private@example.com'), null)
})

test('actual React preview escapes hostile text and retains readable exact plain-text content', () => {
  const component = load('apps/dashboard/src/components/shared/ShareContactDialog.tsx', {
    '../../lib/contactShare': model,
    'react-i18next': { useTranslation: () => ({ t: key => key }) },
  })
  const text = '<img src=x onerror=alert(1)> & "quoted"\nCorreo: synthetic@example.com'
  const html = renderToStaticMarkup(React.createElement(component.ContactSharePreview, { text, empty: 'Empty' }))
  assert.ok(html.includes('&lt;img'))
  assert.ok(!html.includes('<img'))
  assert.ok(html.includes('&amp;'))
  assert.ok(html.includes('Correo: synthetic@example.com'))
  assert.ok(html.includes('whitespace-pre-wrap'))
})

test('only the Admin leads panel enables the private share control', () => {
  const read = relative => fs.readFileSync(path.join(root, 'apps/dashboard/src', relative), 'utf8')
  const panel = read('components/admin/LeadDetailPanel.tsx')
  assert.match(panel, /allowContactShare = false/)
  assert.match(panel, /allowContactShare \? \(/)
  assert.match(panel, /contact=\{\{ name: lead\.name, email: lead\.email, phone: lead\.phone \}\}/)
  assert.match(read('pages/admin/Leads.tsx'), /<LeadDetailPanel\s+allowContactShare\b/)
  for (const relative of ['pages/realtor/Leads.tsx', 'pages/realtor/Pipeline.tsx', 'pages/owner/Leads.tsx', 'pages/buyer/Inquiries.tsx']) {
    assert.doesNotMatch(read(relative), /allowContactShare|ShareContactButton/)
  }
  const dialog = read('components/shared/ShareContactDialog.tsx')
  assert.match(dialog, /\[permission, setPermission\] = useState\(false\)/)
  assert.match(dialog, /const links = permission \? contactComposeLinks/)
  assert.match(dialog, /if \(!links\) return/)
  assert.doesNotMatch(dialog, /privateContact|dangerouslySetInnerHTML|fetch\(|client\.(post|put)|localStorage|listingUrl/)
})

test('permission, composer and clipboard feedback copy is present in both languages', () => {
  const locale = lang => JSON.parse(fs.readFileSync(path.join(root, 'apps/dashboard/src/locale', lang, 'contact_share.json'), 'utf8'))
  const english = locale('en'), spanish = locale('es')
  assert.deepEqual(Object.keys(english).sort(), Object.keys(spanish).sort())
  for (const language of [english, spanish]) {
    for (const key of ['permission', 'permission_needed', 'compose_email', 'compose_whatsapp', 'copied']) {
      assert.ok(language[key].trim())
    }
  }
})
