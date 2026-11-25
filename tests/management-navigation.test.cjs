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
    { module, exports: module.exports, require: name => Object.hasOwn(overrides, name) ? overrides[name] : require(name) })
  return module.exports
}
const policy = load('apps/dashboard/src/lib/managementNavigation.ts')
const component = load('apps/dashboard/src/components/shared/ManagementNavigation.tsx', {
  '../../lib/managementNavigation': policy,
  'react-i18next': { useTranslation: () => ({ t: key => JSON.parse(fs.readFileSync(path.join(root, 'apps/dashboard/src/locale/en/nav.json'), 'utf8'))[key] }) },
})
test('actual rendered link requires both the real Admin account and Admin workspace', () => {
  for (const accountRole of ['buyer', 'owner', 'realtor', 'admin', 'Admin', '']) {
    for (const workspace of ['Buyer', 'Owner', 'Realtor', 'Admin', 'admin', '']) {
      const html = renderToStaticMarkup(React.createElement(component.ManagementNavigation, { accountRole, workspace }))
      if (accountRole === 'admin' && workspace === 'Admin') {
        assert.ok(html.includes('href="https://management.kaobahotel.com/"'))
        assert.ok(html.includes('Separate sign-in may be required'))
        assert.ok(html.includes('accounts and data remain separate'))
        assert.ok(html.includes('noopener noreferrer'))
        assert.ok(!/token=|email=|workspace=/.test(html))
      } else assert.equal(html, '', `${accountRole}/${workspace}`)
    }
  }
})
test('both locales describe navigation accurately and actual layout supplies real role separately', () => {
  for (const language of ['en', 'es']) {
    const locale = JSON.parse(fs.readFileSync(path.join(root, `apps/dashboard/src/locale/${language}/nav.json`), 'utf8'))
    assert.ok(locale.management_portal.trim())
    assert.ok(locale.management_navigation_note.trim())
  }
  const layout = fs.readFileSync(path.join(root, 'apps/dashboard/src/layouts/DashLayout.tsx'), 'utf8')
  assert.match(layout, /ManagementNavigation accountRole=\{user\.role\} workspace=\{role\}/)
  assert.equal(policy.managementNavigation('admin', 'Admin'), 'https://management.kaobahotel.com/')
})

test('the one authorized Realtor shortcut follows actual identity and role without granting hotel access', () => {
  const accountId = '30e0a4b8-aab7-4af8-9b0b-ccbde1dd4e64'
  for (const workspace of ['Realtor', 'Buyer', 'Owner', 'Admin', '']) {
    const html = renderToStaticMarkup(React.createElement(component.ManagementNavigation, { accountRole: 'realtor', workspace, accountId }))
    assert.ok(html.includes('href="https://management.kaobahotel.com/"'))
    assert.ok(html.includes('Separate sign-in may be required'))
    assert.ok(!html.includes(accountId) && !/token=|email=|workspace=/.test(html))
  }
  for (const accountRole of ['buyer', 'owner', 'Realtor', '', 'admin'])
    assert.equal(policy.managementNavigation(accountRole, 'Realtor', accountId), null)
  for (const other of [undefined, '', '30e0a4b8-aab7-4af8-9b0b-ccbde1dd4e65', '17', 'arlyn@example.invalid'])
    assert.equal(policy.managementNavigation('realtor', 'Admin', other), null)
})

test('the account profile and sidebar supply real identity and render both-language navigation notes', () => {
  const settings = fs.readFileSync(path.join(root, 'apps/dashboard/src/pages/Settings.tsx'), 'utf8')
  const layout = fs.readFileSync(path.join(root, 'apps/dashboard/src/layouts/DashLayout.tsx'), 'utf8')
  assert.match(settings, /ManagementNavigation accountRole=\{user.role\} workspace=\{role\} accountId=\{user.id\} appearance="profile"/)
  assert.match(layout, /ManagementNavigation accountRole=\{user.role\} workspace=\{role\} accountId=\{user.id\}/)
  for (const language of ['en', 'es']) {
    const locale = JSON.parse(fs.readFileSync(path.join(root, `apps/dashboard/src/locale/${language}/nav.json`), 'utf8'))
    const { ManagementNavigation } = load('apps/dashboard/src/components/shared/ManagementNavigation.tsx', {
      '../../lib/managementNavigation': policy, 'react-i18next': { useTranslation: () => ({ t: key => locale[key] }) },
    })
    const html = renderToStaticMarkup(React.createElement(ManagementNavigation, { accountRole: 'realtor', accountId: '30e0a4b8-aab7-4af8-9b0b-ccbde1dd4e64', workspace: 'Realtor', appearance: 'profile' }))
    assert.ok(html.includes(locale.management_portal) && html.includes(locale.management_navigation_note))
    assert.ok(html.includes('text-ink2') && html.includes('noopener noreferrer'))
  }
})
