'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  EDITORIAL_PAGE_SIZE, editorialLink, editorialSlug, getPublishedEditorial, listPublishedEditorial,
  type EditorialLocale, type PublishedEditorial,
} from '../api/editorial'
import { neighborhoodCompareLink } from '../api/neighborhoods'
import { marketReportLink } from '../api/marketReports'

const action = 'inline-flex min-h-11 items-center rounded-lg border border-line px-3 py-2 font-semibold text-ink hover:bg-paper2'
type Directory = Awaited<ReturnType<typeof listPublishedEditorial>>
type Result =
  | { key: string; state: 'directory'; data: Directory }
  | { key: string; state: 'reader'; data: PublishedEditorial }
  | { key: string; state: 'missing' | 'error' }

export default function Editorial({ reader = false }: { reader?: boolean }) {
  const params = useSearchParams()
  const { t, i18n } = useTranslation('blog')
  const langs = params.getAll('lang')
  const locale: EditorialLocale = langs.length === 1 && (langs[0] === 'es' || langs[0] === 'en')
    ? langs[0] : i18n.language.startsWith('es') ? 'es' : 'en'
  const slugs = params.getAll('slug')
  const slug = reader && slugs.length === 1 ? editorialSlug(slugs[0]) : null
  const pages = params.getAll('page')
  const requestedPage = pages.length === 1 ? pages[0] : ''
  const page = !reader && requestedPage && /^(?:[1-9]\d{0,2}|1000)$/.test(requestedPage) ? Number(requestedPage) : 1
  const [refresh, setRefresh] = useState(0)
  const key = `${reader ? 'reader' : 'directory'}:${locale}:${reader ? slug : page}:${refresh}`
  const [result, setResult] = useState<Result | null>(null)
  const current = result?.key === key ? result : null
  const missing = reader && !slug || current?.state === 'missing'
  const copy = (name: string) => t(`editorial.${name}`, { lng: locale })

  useEffect(() => {
    if (reader && !slug) return
    const controller = new AbortController()
    const task = slug
      ? getPublishedEditorial(slug, locale, controller.signal).then<Result>(data => data
        ? { key, state: 'reader', data } : { key, state: 'missing' })
      : listPublishedEditorial(locale, page, controller.signal).then<Result>(data => ({ key, state: 'directory', data }))
    task.then(value => { if (!controller.signal.aborted) setResult(value) })
      .catch(() => { if (!controller.signal.aborted) setResult({ key, state: 'error' }) })
    return () => controller.abort()
  }, [key, locale, page, reader, slug])

  useEffect(() => {
    function refreshOnReturn() { setRefresh(value => value + 1) }
    window.addEventListener('focus', refreshOnReturn)
    window.addEventListener('pageshow', refreshOnReturn)
    return () => {
      window.removeEventListener('focus', refreshOnReturn)
      window.removeEventListener('pageshow', refreshOnReturn)
    }
  }, [])

  const linkFor = (language: EditorialLocale) => editorialLink(language, slug ?? undefined, page)
  return <main lang={locale} className="min-w-0 bg-paper px-4 py-10 sm:px-7 sm:py-16">
    <div className="mx-auto max-w-270 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={reader ? editorialLink(locale) : '/blog/'} className={action}>{copy(reader ? 'directory' : 'back_resources')}</Link>
        <nav aria-label={copy('language')} className="flex flex-wrap gap-2">
          {(['en', 'es'] as const).map(language => <Link key={language} href={linkFor(language)}
            hrefLang={language} lang={language} aria-current={language === locale ? 'page' : undefined} className={action}>
            {language === 'es' ? 'Español' : 'English'}
          </Link>)}
        </nav>
      </div>
      {!reader && <header className="space-y-2">
        <h1 className="font-sans text-3xl font-bold tracking-tight text-ink sm:text-5xl">{copy('directory')}</h1>
        <p className="text-dim">{copy('description')}</p>
        <div className="flex flex-wrap gap-2">
          <Link href={neighborhoodCompareLink(locale)} className={action}>{copy('compare_neighborhoods')}</Link>
          <Link href={marketReportLink(locale)} className={action}>{t('market_report.title', { lng: locale })}</Link>
        </div>
      </header>}
      {missing ? <p role="status" className="text-ink">{copy('unavailable')}</p>
        : !current ? <p role="status" className="text-dim">{copy('loading')}</p>
        : current.state === 'error' ? <div className="space-y-2">
          <p role="alert" className="text-ink">{copy('error')}</p>
          <button type="button" className={action} onClick={() => setRefresh(value => value + 1)}>{copy('retry')}</button>
        </div> : current.state === 'directory' ? <>
          {current.data.items.length ? <ul className="grid min-w-0 gap-4 sm:grid-cols-2">
            {current.data.items.map(item => <li key={item.slug} className="min-w-0 rounded-2xl border border-line p-5">
              <p className="mb-1 text-sm text-dim">{copy(item.kind)}</p>
              <h2 className="break-words text-lg font-bold text-ink"><Link href={editorialLink(locale, item.slug)}
                className="underline-offset-4 hover:underline">{item.title}</Link></h2>
              <p className="mt-2 break-words leading-relaxed text-ink2">{item.summary}</p>
            </li>)}
          </ul> : <p className="text-dim">{copy('empty')}</p>}
          {(page > 1 || page * EDITORIAL_PAGE_SIZE < current.data.total) && <nav aria-label={copy('pagination')} className="flex flex-wrap gap-2">
            {page > 1 && <Link href={editorialLink(locale, undefined, page - 1)} className={action}>{copy('previous')}</Link>}
            {page < 1000 && page * EDITORIAL_PAGE_SIZE < current.data.total &&
              <Link href={editorialLink(locale, undefined, page + 1)} className={action}>{copy('next')}</Link>}
          </nav>}
        </> : current.state === 'reader' && <article className="mx-auto min-w-0 max-w-190 space-y-6 py-3">
          <header className="space-y-3">
            <p className="text-sm text-dim">{copy(current.data.kind)}</p>
            <h1 className="break-words font-sans text-3xl font-bold tracking-tight text-ink sm:text-5xl">{current.data.title}</h1>
            <p className="break-words text-lg leading-relaxed text-ink2">{current.data.summary}</p>
          </header>
          <div className="space-y-4 text-ink">
            {current.data.body.split(/\r?\n\s*\r?\n/).map((paragraph, index) => <p
              key={index} className="whitespace-pre-wrap leading-relaxed [overflow-wrap:anywhere]">{paragraph}</p>)}
          </div>
          {current.data.sources.length > 0 && <section className="border-t border-line pt-4">
            <h2 className="font-bold text-ink">{copy('sources')}</h2>
            <ul className="mt-2 space-y-2">
              {current.data.sources.map((source, index) => <li key={index}><a href={source.url}
                target="_blank" rel="noreferrer noopener" className="font-semibold text-sea underline [overflow-wrap:anywhere]">{source.label}</a></li>)}
            </ul>
          </section>}
        </article>}
    </div>
  </main>
}
