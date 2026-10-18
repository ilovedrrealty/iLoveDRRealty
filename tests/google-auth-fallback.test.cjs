const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const googleSDK = require('@react-oauth/google')

const root = path.resolve(__dirname, '..')
function load(relative, imports = {}, globals = {}) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } })
  const exports = {}
  vm.runInNewContext(outputText, { exports, ...globals, require: id => {
    if (Object.hasOwn(imports, id)) return imports[id]
    if (id === 'react' || id === 'react/jsx-runtime' || id === 'yup' || id === 'react-international-phone' || id === 'libphonenumber-js') return require(id)
    throw new Error(`Unexpected import: ${id}`)
  } })
  return exports
}

function harness(clientId, language = 'en') {
  const auth = require(`../apps/landing/src/locales/${language}/auth.json`)
  let hookCalls = 0
  let providerCalls = 0
  let authCalls = 0
  const config = load('apps/landing/src/lib/googleAuth.ts', {}, { process: { env: { NEXT_PUBLIC_GOOGLE_CLIENT_ID: clientId } } })
  const sdk = { ...googleSDK,
    GoogleOAuthProvider: props => { providerCalls++; return React.createElement(googleSDK.GoogleOAuthProvider, props) },
    useGoogleLogin: props => { hookCalls++; return googleSDK.useGoogleLogin(props) },
  }
  const translate = { useTranslation: () => ({ t: key => key.split('.').reduce((value, part) => value?.[part], auth) ?? key }) }
  const authAPI = { googleAuth: async () => { authCalls++ }, register: async () => { authCalls++ } }
  const section = load('apps/landing/src/components/GoogleAuthSection.tsx', {
    '@react-oauth/google': sdk, 'react-i18next': translate,
    'react-hot-toast': { default: { success() {}, error() {} } },
    '../api/auth': authAPI, '../lib/googleAuth': config,
    '../lib/professionalJoin': { dashboardAfterAuth: () => 'https://app.ilovedrrealty.com/professional-profile' },
  }, { process: { env: {} } }).default
  const provider = load('apps/landing/src/components/GoogleAuthProvider.tsx', {
    '@react-oauth/google': sdk, '../lib/googleAuth': config,
  }).default
  return { config, section, provider, translate, authAPI, counts: () => ({ hookCalls, providerCalls, authCalls }) }
}

for (const language of ['en', 'es']) {
  test(`missing Google ID renders the localized email fallback without mounting OAuth (${language})`, () => {
    const fixture = harness(undefined, language)
    for (const mode of ['login', 'signup']) {
      const html = renderToStaticMarkup(React.createElement(fixture.provider, null,
        React.createElement(fixture.section, { mode })))
      assert.match(html, language === 'en' ? /Continue with email/ : /Continúa con tu correo/)
      assert.doesNotMatch(html, /<button|<script/)
    }
    assert.deepEqual(fixture.counts(), { hookCalls: 0, providerCalls: 0, authCalls: 0 })
  })
}

test('whitespace Google ID is treated as absent', () => {
  const fixture = harness('  \n ')
  assert.equal(fixture.config.GOOGLE_CLIENT_ID, '')
  renderToStaticMarkup(React.createElement(fixture.section, { mode: 'signup' }))
  assert.equal(fixture.counts().hookCalls, 0)
})

test('configured Google auth retains the provider, sign-in button and SDK hook', () => {
  // Synthetic public identifier for server rendering only; no SDK script or auth request runs here.
  const fixture = harness('synthetic-client-id-for-unit-test')
  for (const mode of ['login', 'signup']) {
    const html = renderToStaticMarkup(React.createElement(fixture.provider, null,
      React.createElement(fixture.section, { mode })))
    assert.match(html, /Continue with Google/)
    assert.match(html, /<button/)
    assert.doesNotMatch(html, /Continue with email/)
  }
  assert.deepEqual(fixture.counts(), { hookCalls: 2, providerCalls: 2, authCalls: 0 })
})

test('the email signup form renders with no Google provider or client identifier', () => {
  const fixture = harness(undefined)
  const Signup = load('apps/landing/src/views/Signup.tsx', {
    '../hooks/useNav': { useNav: () => () => {} },
    'next/navigation': { useRouter: () => ({ push() {} }) },
    'react-international-phone/style.css': {},
    'react-hot-toast': { default: { success() {}, error() {} } },
    '../api/auth': fixture.authAPI,
    '../components/GoogleAuthSection': { __esModule: true, default: fixture.section },
    'react-i18next': fixture.translate,
    '../hooks/usePlatformStats': { usePlatformStats: () => null },
    '../lib/professionalJoin': { professionalAuthParams: () => ({ join: 'professional' }), rememberProfessionalJoin: () => true },
  }).default
  const html = renderToStaticMarkup(React.createElement(Signup))
  assert.match(html, /type="email"/)
  assert.match(html, /type="password"/)
  assert.match(html, /Create account/)
  assert.match(html, /Continue with email/)
  assert.deepEqual(fixture.counts(), { hookCalls: 0, providerCalls: 0, authCalls: 0 })
})
