const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const React = require('react')
const ts = require('typescript')
const { renderToStaticMarkup } = require('react-dom/server')

const root = path.resolve(__dirname, '../apps/landing/src')
const plain = value => JSON.parse(JSON.stringify(value))
const token = '00112233-4455-4677-8899-aabbccddeeff.' + 'a'.repeat(64)
const locales = Object.fromEntries(['en', 'es'].map(language => [language,
  JSON.parse(fs.readFileSync(path.join(root, 'locales', language, 'blog.json'), 'utf8'))]))

function load(file, imports = {}, globals = {}) {
  const filename = path.join(root, file)
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  }, fileName: filename, reportDiagnostics: true })
  assert.deepEqual(output.diagnostics, [])
  const module = { exports: {} }
  vm.runInNewContext(output.outputText, {
    module, exports: module.exports,
    process: { env: { NEXT_PUBLIC_API_URL: 'https://api.example.test/' } },
    require: name => {
      if (name === 'react/jsx-runtime') return require(name)
      assert.ok(Object.hasOwn(imports, name), 'unexpected import ' + name)
      return imports[name]
    },
    ...globals,
  }, { filename, timeout: 3000 })
  return module.exports
}

function fixedT(language) {
  return key => {
    const value = key.split('.').reduce((object, field) => object?.[field], locales[language])
    assert.equal(typeof value, 'string', language + ' missing ' + key)
    return value
  }
}

function treeNodes(node) {
  if (Array.isArray(node)) return node.flatMap(treeNodes)
  return React.isValidElement(node) ? [node, ...treeNodes(node.props.children)] : []
}

function interactive(file, api, browser = {}, language = 'en') {
  const state = []
  let index = 0
  let effect
  let cleanup
  const hooks = {
    useId: () => 'newsletter-test-' + index++,
    useState: initial => {
      const key = index++
      if (!(key in state)) state[key] = initial
      return [state[key], value => { state[key] = value }]
    },
    useRef: initial => {
      const key = index++
      if (!(key in state)) state[key] = { current: initial }
      return state[key]
    },
    useEffect: callback => { effect = callback },
  }
  const Component = load(file, {
    react: hooks,
    'react-i18next': { useTranslation: () => ({ t: fixedT(language), i18n: { language, changeLanguage: () => {} } }) },
    '../api/newsletter': api,
  }, { window: browser }).default
  return {
    render() { index = 0; return Component() },
    effect() { cleanup = effect() },
    cleanup() { cleanup?.(); cleanup = undefined },
  }
}

function actionBrowser(fragment) {
  const listeners = new Set()
  const browser = {
    location: { hash: fragment, search: '?source=mail', pathname: '/newsletter/' },
    history: { state: null, replaceState: (_state, _title, location) => {
      assert.equal(location, '/newsletter/')
      browser.location.hash = ''
      browser.location.search = ''
    } },
    addEventListener(name, listener) { assert.equal(name, 'hashchange'); listeners.add(listener) },
    removeEventListener(name, listener) { assert.equal(name, 'hashchange'); listeners.delete(listener) },
    navigate(fragment) {
      browser.location.hash = fragment
      for (const listener of listeners) listener()
    },
    listenerCount() { return listeners.size },
  }
  return browser
}

const flush = () => new Promise(resolve => setImmediate(resolve))

test('subscribe and explicit actions send only their exact private JSON contract', async () => {
  const calls = []
  const api = load('api/newsletter.ts', {}, { fetch: async (url, options) => {
    calls.push([url, options])
    const action = url.split('/').at(-1)
    return { status: action === 'subscribe' ? 202 : 200,
      json: async () => ({ status: { subscribe: 'accepted', confirm: 'subscribed', unsubscribe: 'unsubscribed' }[action] }) }
  } })
  await api.subscribeToNewsletter(' person@example.com ', 'es')
  await api.applyNewsletterAction('confirm', token)
  await api.applyNewsletterAction('unsubscribe', token)
  assert.equal(calls.length, 3)
  assert.deepEqual(calls.map(([url]) => url), [
    'https://api.example.test/newsletter/subscribe',
    'https://api.example.test/newsletter/confirm',
    'https://api.example.test/newsletter/unsubscribe',
  ])
  for (const [url, options] of calls) {
    assert.ok(!url.includes(token) && !url.includes('person'))
    const fields = plain(options)
    delete fields.body
    assert.deepEqual(fields, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error', cache: 'no-store' })
  }
  assert.deepEqual(calls.map(([, options]) => JSON.parse(options.body)), [
    { email: 'person@example.com', consent: true, language: 'es' }, { token }, { token },
  ])
})

test('responses are validated and failures cannot become subscription success', async () => {
  for (const [status, body, code] of [
    [400, null, 'invalid'], [422, null, 'invalid'], [429, null, 'rate_limited'],
    [503, null, 'unavailable'], [200, { status: 'accepted' }, 'unavailable'],
    [202, { status: 'subscribed' }, 'unavailable'],
    [202, { status: 'accepted', email: 'private@example.com' }, 'unavailable'],
  ]) {
    const api = load('api/newsletter.ts', {}, { fetch: async () => ({ status, json: async () => body }) })
    await assert.rejects(api.subscribeToNewsletter('person@example.com', 'en'), error => error.code === code)
  }
  const api = load('api/newsletter.ts', {}, { fetch: async () => { throw new Error('private transport error') } })
  await assert.rejects(api.applyNewsletterAction('confirm', token), error => error.code === 'unavailable')
})

test('only a bounded purpose-specific fragment can supply an action token', async () => {
  let calls = 0
  const api = load('api/newsletter.ts', {}, { fetch: async () => { calls++; throw new Error('unexpected fetch') } })
  assert.equal(token.length, 101)
  assert.deepEqual(plain(api.readNewsletterLink('#confirm=' + token)), { action: 'confirm', token })
  assert.deepEqual(plain(api.readNewsletterLink('#unsubscribe=' + token)), { action: 'unsubscribe', token })
  for (const link of ['', '#email=user@example.com', '?confirm=' + token, '#confirm=' + token + '&extra=1',
    '#confirm=short', '#confirm=' + 'a'.repeat(257), '#unsubscribe=' + token + '%20', '#confirm=' + token + '#other',
    '#confirm=' + token.toUpperCase(), '#confirm=synthetic_' + 'a'.repeat(34), '#confirm=' + token.replace('.', '_')]) {
    assert.equal(api.readNewsletterLink(link), null)
  }
  await assert.rejects(api.applyNewsletterAction('confirm', 'invalid'), error => error.code === 'invalid')
  assert.equal(calls, 0)
})

test('newsletter sign-up renders a required email and unchecked independent consent in each language', () => {
  for (const language of ['en', 'es']) {
    const Signup = load('components/NewsletterSignup.tsx', {
      react: React,
      'react-i18next': { useTranslation: () => ({ t: fixedT(language), i18n: { language } }) },
      '../api/newsletter': { NewsletterRequestError: class extends Error {}, subscribeToNewsletter: () => {} },
    }).default
    const html = renderToStaticMarkup(React.createElement(Signup))
    assert.match(html, /<form/)
    assert.match(html, /type="email"[^>]*required=""/)
    assert.match(html, /type="checkbox"[^>]*required=""/)
    assert.ok(!/<input[^>]*type="checkbox"[^>]*checked/.test(html))
    assert.match(html, /<button[^>]*type="submit"[^>]*disabled=""/)
    assert.ok(html.includes(locales[language].newsletter.consent))
    assert.match(html, /href="\/privacy-policy\/"/)
    assert.match(html, /href="\/terms-of-service\/"/)
  }
})

test('sign-up needs deliberate consent and one in-flight request', async () => {
  let release
  const calls = []
  const api = {
    NewsletterRequestError: class extends Error {},
    subscribeToNewsletter: (...args) => { calls.push(args); return new Promise(resolve => { release = resolve }) },
  }
  const signup = interactive('components/NewsletterSignup.tsx', api)
  let nodes = treeNodes(signup.render())
  await nodes.find(node => node.type === 'form').props.onSubmit({ preventDefault() {} })
  assert.equal(calls.length, 0)
  nodes.find(node => node.type === 'input' && node.props.type === 'email').props.onChange({ target: { value: 'office@example.com' } })
  nodes.find(node => node.type === 'input' && node.props.type === 'checkbox').props.onChange({ target: { checked: true } })
  nodes = treeNodes(signup.render())
  const first = nodes.find(node => node.type === 'form').props.onSubmit({ preventDefault() {} })
  await nodes.find(node => node.type === 'form').props.onSubmit({ preventDefault() {} })
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0], ['office@example.com', 'en'])
  assert.equal(treeNodes(signup.render()).find(node => node.type === 'button').props.disabled, true)
  release()
  await first
  assert.ok(treeNodes(signup.render()).some(node => node.props.role === 'status'))
})

test('action GET scrubs the token without submitting; only the human control posts once', async () => {
  for (const action of ['confirm', 'unsubscribe']) {
    const calls = []
    const api = load('api/newsletter.ts', {}, { fetch: () => { throw new Error('network forbidden') } })
    api.applyNewsletterAction = async (...args) => { calls.push(args) }
    const browser = actionBrowser('#' + action + '=' + token)
    const view = interactive('views/NewsletterPreferences.tsx', api, browser)
    view.render()
    view.effect()
    assert.equal(calls.length, 0)
    assert.equal(browser.location.hash, '')
    assert.equal(browser.location.search, '')
    let nodes = treeNodes(view.render())
    const label = locales.en.newsletter.manage[action + '_button']
    const button = nodes.find(node => node.type === 'button' && node.props.children === label)
    assert.ok(button)
    const pending = button.props.onClick()
    await pending
    await new Promise(resolve => setImmediate(resolve))
    assert.deepEqual(calls, [[action, token]])
    nodes = treeNodes(view.render())
    assert.ok(nodes.some(node => node.props.role === 'status'))
    assert.ok(!JSON.stringify(nodes).includes(token))
    view.cleanup()
  }
})

test('a second same-document link replaces settled or invalid state and is scrubbed before a human action', async () => {
  const nextToken = token.replace(/a/g, 'b')
  const calls = []
  const api = load('api/newsletter.ts', {}, { fetch: () => { throw new Error('network forbidden') } })
  api.applyNewsletterAction = async (...args) => { calls.push(args) }
  const browser = actionBrowser('#confirm=' + token)
  const view = interactive('views/NewsletterPreferences.tsx', api, browser)
  const actionButton = action => treeNodes(view.render()).find(node =>
    node.type === 'button' && node.props.children === locales.en.newsletter.manage[action + '_button'])
  view.render(); view.effect()
  actionButton('confirm').props.onClick()
  await flush()
  assert.ok(treeNodes(view.render()).some(node => node.props.role === 'status'))
  browser.navigate('#unsubscribe=' + nextToken)
  assert.equal(browser.location.hash, '')
  assert.equal(calls.length, 1)
  assert.ok(!treeNodes(view.render()).some(node => node.props.role === 'status'))
  assert.equal(actionButton('unsubscribe').props.disabled, false)
  actionButton('unsubscribe').props.onClick()
  await flush()
  assert.deepEqual(calls, [['confirm', token], ['unsubscribe', nextToken]])
  browser.navigate('#confirm=invalid')
  assert.equal(browser.location.hash, '')
  assert.equal(actionButton('confirm'), undefined)
  browser.navigate('#confirm=' + token)
  assert.equal(browser.location.hash, '')
  assert.ok(actionButton('confirm'))
  assert.equal(calls.length, 2)
  assert.ok(!JSON.stringify(treeNodes(view.render())).includes(token))
  view.cleanup()
})

test('an older in-flight success or error cannot clear a newly opened action link', async () => {
  for (const outcome of ['success', 'invalid']) {
    const nextToken = token.replace(/a/g, 'b')
    const calls = []
    let settle
    class RequestError extends Error { constructor(code) { super(code); this.code = code } }
    const api = load('api/newsletter.ts', {}, { fetch: () => { throw new Error('network forbidden') } })
    api.NewsletterRequestError = RequestError
    api.applyNewsletterAction = (...args) => {
      calls.push(args)
      if (calls.length > 1) return Promise.resolve()
      return new Promise((resolve, reject) => {
        settle = () => outcome === 'success' ? resolve() : reject(new RequestError('invalid'))
      })
    }
    const browser = actionBrowser('#confirm=' + token)
    const view = interactive('views/NewsletterPreferences.tsx', api, browser)
    view.render(); view.effect()
    treeNodes(view.render()).find(node => node.type === 'button'
      && node.props.children === locales.en.newsletter.manage.confirm_button).props.onClick()
    browser.navigate('#unsubscribe=' + nextToken)
    assert.equal(browser.location.hash, '')
    const waiting = treeNodes(view.render()).find(node => node.type === 'button'
      && node.props.children === locales.en.newsletter.manage.working)
    assert.equal(waiting.props.disabled, true)
    waiting.props.onClick()
    assert.equal(calls.length, 1)
    settle()
    await flush()
    const next = treeNodes(view.render()).find(node => node.type === 'button'
      && node.props.children === locales.en.newsletter.manage.unsubscribe_button)
    assert.ok(next)
    assert.equal(next.props.disabled, false)
    assert.ok(!treeNodes(view.render()).some(node => node.props.role === 'status' || node.props.role === 'alert'))
    next.props.onClick()
    await flush()
    assert.deepEqual(calls, [['confirm', token], ['unsubscribe', nextToken]])
    assert.ok(treeNodes(view.render()).some(node => node.props.role === 'status'))
    view.cleanup()
  }
})

test('StrictMode effect cleanup and re-setup preserves the initial link and reinstalls exactly one listener', () => {
  const api = load('api/newsletter.ts', {}, { fetch: () => { throw new Error('network forbidden') } })
  const browser = actionBrowser('#confirm=' + token)
  const view = interactive('views/NewsletterPreferences.tsx', api, browser)
  view.render(); view.effect()
  assert.equal(browser.listenerCount(), 1)
  view.cleanup()
  assert.equal(browser.listenerCount(), 0)
  view.render(); view.effect()
  assert.equal(browser.listenerCount(), 1)
  assert.ok(treeNodes(view.render()).some(node => node.type === 'button'
    && node.props.children === locales.en.newsletter.manage.confirm_button))
  browser.navigate('#unsubscribe=' + token)
  assert.equal(browser.location.hash, '')
  assert.ok(treeNodes(view.render()).some(node => node.type === 'button'
    && node.props.children === locales.en.newsletter.manage.unsubscribe_button))
  view.cleanup()
  assert.equal(browser.listenerCount(), 0)
})

test('action links stay outside third-party features and outside the sitemap', () => {
  const Provider = ({ children }) => children
  for (const pathname of ['/newsletter', '/newsletter/', null]) {
    const forbidden = () => { throw new Error('Private link mounted public site integrations') }
    const shell = load('components/LandingRouteShell.tsx', {
      react: { Suspense: Provider },
      'next/navigation': { usePathname: () => pathname },
      'next/script': { __esModule: true, default: forbidden },
      'react-hot-toast': { Toaster: forbidden },
      './Navbar': { __esModule: true, default: forbidden },
      './Footer': { __esModule: true, default: forbidden },
      './GoogleAuthProvider': { __esModule: true, default: forbidden },
      './LeadCaptureProvider': { __esModule: true, default: forbidden },
      './I18nProvider': { __esModule: true, default: Provider },
      './WebsiteSettingsProvider': { __esModule: true, default: forbidden },
      './TrackingCapture': { __esModule: true, default: forbidden },
      './MeasurementPreferences': { __esModule: true, default: forbidden },
    }).default
    assert.equal(renderToStaticMarkup(React.createElement(shell, null, React.createElement('main', null, 'Preferences'))), '<main>Preferences</main>')
  }
  const page = load('app/newsletter/page.tsx', { '../../views/NewsletterPreferences': { __esModule: true, default: () => null } })
  assert.deepEqual(plain(page.metadata.robots), { index: false, follow: false })
  assert.equal(page.metadata.referrer, 'no-referrer')
  assert.ok(!fs.readFileSync(path.join(root, 'app/sitemap.ts'), 'utf8').includes('/newsletter/'))
})
