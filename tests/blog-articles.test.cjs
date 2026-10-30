const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { createRequire } = require('node:module')

// Run from the existing application repository; use only its installed packages.
// While staged beside final-candidates, load those four files. Once reviewed and
// copied into repository/tests, load the integrated application content instead.
const repo = path.resolve(process.env.REALTY_REPO_ROOT || process.cwd())
const app = path.join(repo, 'apps/landing/src')
const fromRepo = createRequire(path.join(repo, 'apps/landing/package.json'))
const ts = fromRepo('typescript')
const React = fromRepo('react')
const { renderToStaticMarkup } = fromRepo('react-dom/server')
const staged = path.resolve(__dirname, '..')
const dataRoot = process.env.REALTY_CONTENT_ROOT
  ? path.resolve(process.env.REALTY_CONTENT_ROOT)
  : fs.existsSync(path.join(staged, 'blogData.ts')) ? staged : path.join(app, 'data')
const localeRoot = fs.existsSync(path.join(dataRoot, 'locales'))
  ? path.join(dataRoot, 'locales') : path.join(app, 'locales')
const plain = value => JSON.parse(JSON.stringify(value))
const locales = Object.fromEntries(['en', 'es'].map(lang => [lang,
  JSON.parse(fs.readFileSync(path.join(localeRoot, lang, 'blog.json'), 'utf8')),
]))

// Same TypeScript/CommonJS/VM approach as the existing Node regression suite.
// Only explicit imports below are allowed; no recursive app loader or network.
function sourceModule(file, imports = {}) {
  const module = { exports: {} }
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX,
  } }).outputText
  vm.runInNewContext(output, {
    module, exports: module.exports,
    require: name => {
      if (Object.hasOwn(imports, name)) return imports[name]
      if (name === 'react/jsx-runtime') return fromRepo(name)
      throw new Error(`Unexpected application import: ${name}`)
    },
    fetch: () => { throw new Error('Network is forbidden in article regressions') },
    URL, console,
  }, { filename: file, timeout: 3000 })
  return module.exports
}
const design = sourceModule(path.join(app, 'design.ts'))
const enData = sourceModule(path.join(dataRoot, 'blogData.ts'), { '../design': design })
const esData = sourceModule(path.join(dataRoot, 'blogData.es.ts'))
const slugs = Object.keys(enData.ARTICLES)

function fixedT(lang) {
  return (key, options) => {
    const value = key.split('.').reduce((node, part) => node?.[part], locales[lang])
    if (options?.returnObjects) {
      assert.ok(value && typeof value === 'object', `Missing ${lang} object locale key: ${key}`)
      return value
    }
    assert.equal(typeof value, 'string', `Missing ${lang} blog locale key: ${key}`)
    return value
  }
}
function consumer(activeLanguage = 'en', data = { en: enData, es: esData }) {
  const nav = []
  const ArticleDetail = sourceModule(path.join(app, 'views/ArticleDetail.tsx'), {
    'react-i18next': { useTranslation: () => ({ i18n: {
      language: activeLanguage, getFixedT: fixedT,
    } }) },
    '../hooks/useNav': { useNav: () => (...args) => nav.push(args) },
    '../data/blogData': data.en,
    '../data/blogData.es': data.es,
  }).default
  return { ArticleDetail, nav }
}
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes)
  if (!React.isValidElement(node)) return []
  return [node, ...nodes(node.props.children)]
}
function visibleText(node) {
  if (Array.isArray(node)) return node.map(visibleText).join('')
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  return React.isValidElement(node) ? visibleText(node.props.children) : String(node)
}
const readable = value => value.replace(/\[\[([^\]|]+)\|[^\]]+\]\]/g, '$1')
const escapedText = value => renderToStaticMarkup(React.createElement('span', null, value)).replace(/^<span>|<\/span>$/g, '')
function assertArticleBody(tree, article, lang, slug) {
  const html = renderToStaticMarkup(tree)
  const hostArticle = nodes(tree).find(node => node.type === 'article')
  assert.ok(hostArticle, `${lang}/${slug}: actual article element rendered`)
  const text = visibleText(hostArticle)
  assert.match(html, new RegExp(`<div lang="${lang}"`))
  for (const value of [article.title, article.lede, ...article.faqs.flatMap(f => [f.q, f.a])]) {
    assert.ok(text.includes(value), `${lang}/${slug}: missing title/lede/FAQ: ${value}`)
  }
  for (const [kind, value] of article.body) {
    const strings = kind === 'table'
      ? [...value.headers, ...value.rows.flat()]
      : kind === 'cta' ? [value.label] : Array.isArray(value) ? value : [value]
    for (const item of strings) assert.ok(text.includes(readable(item)), `${lang}/${slug}: omitted ${kind}: ${item}`)
  }
  assert.ok(!text.includes('[['), `${lang}/${slug}: raw inline markup leaked`)
  return html
}

test('all twelve actual consumers render the selected EN/ES body and FAQ, without English fallback', () => {
  assert.equal(slugs.length, 12)
  assert.deepEqual(Object.keys(esData.ARTICLES_ES).sort(), [...slugs].sort())
  assert.deepEqual(Object.keys(esData.CARDS_ES).sort(), [...slugs].sort())
  assert.deepEqual(plain(enData.GUIDES.map(x => x.slug)), [
    'can-americans-buy', 'closing-costs-dr', 'punta-cana-airbnb-roi',
  ])
  assert.equal(enData.HIDDEN_GUIDES.length, 9)
  assert.deepEqual(plain([...enData.GUIDES, ...enData.HIDDEN_GUIDES].map(x => x.slug)).sort(), [...slugs].sort())
  for (const slug of slugs) {
    const en = enData.ARTICLES[slug], es = esData.ARTICLES_ES[slug]
    assert.notEqual(es.title, en.title, slug)
    assert.equal(esData.CARDS_ES[slug].title, es.title, `${slug}: stale Spanish card title`)
    assert.equal(esData.CARDS_ES[slug].desc, es.lede, `${slug}: stale Spanish card description`)
    const english = consumer('en')
    assertArticleBody(english.ArticleDetail({ slug }), en, 'en', slug)
    const spanish = consumer('es')
    assertArticleBody(spanish.ArticleDetail({ slug }), es, 'es', slug)
    // Explicit route language must win over a stale English client preference.
    const explicit = consumer('en')
    const tree = explicit.ArticleDetail({ slug, lang: 'es' })
    assertArticleBody(tree, es, 'es', slug)
    const article = nodes(tree).find(n => n.type === 'article')
    assert.ok(!visibleText(article).includes(en.lede), `${slug}: English lede fallback`)
    for (const button of nodes(tree).filter(n => n.type === 'button' && n.props.onClick)) button.props.onClick()
    const articleCalls = explicit.nav.filter(([page]) => page === 'article' || page === 'es/article')
    assert.ok(articleCalls.length > 0, `${slug}: no article navigation was exercised`)
    for (const [page, target] of articleCalls) {
      assert.equal(page, 'es/article', `${slug}: Spanish navigation escaped its language`)
      assert.ok(esData.ARTICLES_ES[target], `${slug}: unknown Spanish target ${target}`)
    }
    for (const [page] of explicit.nav) assert.ok(!/^https?:/i.test(page), 'External source was sent to internal navigation')
  }
})

test('actual Blog SSR uses the selected locale for statistics, process, FAQs, cards and promotional copy', () => {
  for (const lang of ['en', 'es']) {
    const Blog = sourceModule(path.join(app, 'views/Blog.tsx'), {
      react: React,
      'react-i18next': { useTranslation: () => ({ t: fixedT(lang), i18n: { language: lang } }) },
      '../hooks/useNav': { useNav: () => () => {} },
      '../data/blogData': enData,
      '../data/blogData.es': esData,
      '../components/WebsiteResources': { __esModule: true, default: () => null },
      '../components/ProfessionalResourceCard': { __esModule: true, default: () => null },
      '../components/WebsiteSettingsProvider': { useWebsiteImage: (_key, fallback) => fallback },
    }).default
    const html = renderToStaticMarkup(React.createElement(Blog))
    const locale = locales[lang]
    const expected = [locale.hero.sub, ...locale.stats,
      ...locale.process.steps.flatMap(item => [item.title, item.desc]),
      ...locale.faq.items.map(item => item.q),
      locale.newsletter.heading, locale.newsletter.sub, locale.newsletter.disclaimer,
      ...enData.GUIDES.map(card => lang === 'es' ? esData.CARDS_ES[card.slug].title : card.title),
    ]
    for (const value of expected) assert.ok(html.includes(escapedText(value)), `${lang}: rendered Blog omitted locale/card copy: ${value}`)
    assert.ok(!html.includes('first 20yr') && !html.includes('primeros 20 años'), 'Old tax-holiday label leaked')
    if (lang === 'es') assert.ok(!html.includes(escapedText(locales.en.hero.sub)), 'Blog used English fallback')
  }
})

function routes(lang) {
  const { ArticleDetail } = consumer('en')
  const prefix = lang === 'es' ? '../../../../' : '../../../'
  return sourceModule(path.join(app, lang === 'es' ? 'app/es/article/[slug]/page.tsx' : 'app/article/[slug]/page.tsx'), {
    [prefix + 'views/ArticleDetail']: { __esModule: true, default: ArticleDetail },
    [prefix + 'data/blogData']: enData,
    [prefix + 'data/blogData.es']: esData,
    [prefix + 'components/EsLangSync']: { __esModule: true, default: () => null },
  })
}
test('actual route functions agree on static paths, localized metadata, canonicals and Article/FAQ JSON-LD', async () => {
  for (const lang of ['en', 'es']) {
    const route = routes(lang)
    assert.deepEqual(plain(route.generateStaticParams()).map(p => p.slug).sort(), [...slugs].sort())
    for (const slug of slugs) {
      const a = lang === 'es' ? esData.ARTICLES_ES[slug] : enData.ARTICLES[slug]
      const params = Promise.resolve({ slug })
      const metadata = plain(await route.generateMetadata({ params }))
      assert.equal(metadata.title, a.metaTitle || a.title)
      assert.equal(metadata.description, a.metaDescription || a.lede)
      assert.deepEqual(metadata.keywords, plain(a.keywords))
      assert.equal(metadata.alternates.canonical, `${lang === 'es' ? '/es' : ''}/article/${slug}/`)
      assert.deepEqual(metadata.alternates.languages, {
        en: `/article/${slug}/`, es: `/es/article/${slug}/`, 'x-default': `/article/${slug}/`,
      })
      assert.equal(metadata.openGraph.type, 'article')
      assert.equal(metadata.openGraph.title, metadata.title)
      assert.equal(metadata.openGraph.description, metadata.description)
      assert.deepEqual(metadata.openGraph.images, [a.img])
      if (lang === 'es') assert.equal(metadata.openGraph.locale, 'es_DO')
      assert.equal(metadata.twitter.card, 'summary_large_image')
      assert.equal(metadata.twitter.title, metadata.title)
      assert.equal(metadata.twitter.description, metadata.description)
      const page = await route.default({ params: Promise.resolve({ slug }) })
      const schemas = nodes(page).filter(n => n.type === 'script' && n.props.type === 'application/ld+json')
        .map(n => JSON.parse(n.props.dangerouslySetInnerHTML.__html))
      const article = schemas.find(s => s['@type'] === 'Article')
      const faq = schemas.find(s => s['@type'] === 'FAQPage')
      assert.equal(article.headline, a.title)
      assert.equal(article.description, metadata.description)
      assert.equal(article.inLanguage, lang)
      assert.equal(article.image, a.img)
      assert.deepEqual(faq.mainEntity, plain(a.faqs.map(f => ({
        '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a },
      }))))
      if (lang === 'es') assert.equal(faq.inLanguage, 'es')
      const html = renderToStaticMarkup(page)
      assert.ok(html.includes('application/ld+json'))
      // For English routes, English active preference; Spanish routes pass lang=es.
      assert.ok(html.includes(escapedText(a.title)))
    }
  }
})

