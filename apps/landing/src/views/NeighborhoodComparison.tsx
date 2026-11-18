'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NEIGHBORHOOD_PAGE_SIZE, NEIGHBORHOOD_TOPICS } from '../../../../packages/editorial-neighborhoods'
import { editorialLink, type EditorialLocale } from '../api/editorial'
import {
  getNeighborhood, listNeighborhoods, neighborhoodCompareLink, neighborhoodListingLink,
  type NeighborhoodSummary, type PublishedNeighborhood,
} from '../api/neighborhoods'

const action = 'inline-flex min-h-11 items-center rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink hover:bg-paper2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sea disabled:opacity-50'
const primary = 'inline-flex min-h-11 items-center rounded-lg bg-sea px-4 py-2 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sea disabled:opacity-50'
const cell = 'min-w-0 rounded-xl border border-line bg-white p-4'
const maximum = 3
type RequestState<T> = { key: string; data: T | null }
type Catalog = Awaited<ReturnType<typeof listNeighborhoods>>

function formatDate(value: string, locale: EditorialLocale): string {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-DO' : 'en-US', { dateStyle: 'medium', timeZone: 'UTC' })
    .format(new Date(value + 'T12:00:00Z'))
}

function ComparisonResults({ profiles, locale }: { profiles: PublishedNeighborhood[]; locale: EditorialLocale }) {
  const { t } = useTranslation('blog', { keyPrefix: 'comparison' })
  const copy = (name: string, values?: Record<string, string>) => t(name, { lng: locale, ...values })
  const columns = profiles.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
  const grid = `grid min-w-0 gap-3 ${columns}`
  return <>
    <ul className={grid}>
      {profiles.map(profile => {
        const listings = neighborhoodListingLink(profile.listing_location)
        return <li key={profile.slug} className={`${cell} space-y-2`}>
          <h3 className="font-bold text-ink [overflow-wrap:anywhere]">{profile.title}</h3>
          <p className="text-sm text-ink2 [overflow-wrap:anywhere]">{profile.summary}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href={editorialLink(locale, profile.slug)} className="text-sm font-semibold text-sea underline">
              {copy('read_profile', { area: profile.title })}
            </Link>
            {listings && profile.listing_location ? <Link href={listings} className="text-sm font-semibold text-sea underline [overflow-wrap:anywhere]">
              {copy('property_search', { location: profile.listing_location })}
            </Link> : null}
          </div>
        </li>
      })}
    </ul>
    {NEIGHBORHOOD_TOPICS.map(topic => <section key={topic} aria-labelledby={`comparison-topic-${topic}`} className="space-y-2">
      <h3 id={`comparison-topic-${topic}`} className="text-lg font-bold text-ink">{copy(`topics.${topic}`)}</h3>
      <ul className={grid}>
        {profiles.map(profile => {
          const fact = profile.facts.find(entry => entry.topic === topic)
          return <li key={profile.slug} className={`${cell} space-y-2`}>
            <h4 className="font-bold text-ink [overflow-wrap:anywhere]">{profile.title}</h4>
            {fact ? <>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink2 [overflow-wrap:anywhere]">{fact.text}</p>
              <p className="text-xs text-dim">
                {copy('checked_on')} <time dateTime={fact.checked_on}>{formatDate(fact.checked_on, locale)}</time>
              </p>
              <a href={fact.source.url} target="_blank" rel="noopener noreferrer"
                className="text-sm font-semibold text-sea underline [overflow-wrap:anywhere]">{fact.source.label}</a>
            </> : <p className="text-sm text-dim">{copy('unknown')}</p>}
          </li>
        })}
      </ul>
    </section>)}
  </>
}

export default function NeighborhoodComparison() {
  const params = useSearchParams()
  const { t, i18n } = useTranslation('blog', { keyPrefix: 'comparison' })
  const langs = params.getAll('lang')
  const locale: EditorialLocale = langs.length === 1 && (langs[0] === 'en' || langs[0] === 'es')
    ? langs[0] : i18n.language.startsWith('es') ? 'es' : 'en'
  const copy = (name: string, values?: Record<string, string | number>) => t(name, { lng: locale, ...values })
  const [page, setPage] = useState(1)
  const [refresh, setRefresh] = useState(0)
  const [selected, setSelected] = useState<NeighborhoodSummary[]>([])
  const [requested, setRequested] = useState<string[]>([])
  const [catalog, setCatalog] = useState<RequestState<Catalog> | null>(null)
  const [comparison, setComparison] = useState<RequestState<(PublishedNeighborhood | null)[]> | null>(null)
  const comparisonHeading = useRef<HTMLHeadingElement>(null)
  const catalogKey = `${locale}:${page}:${refresh}`
  const comparisonKey = `${locale}:${requested.join(',')}:${refresh}`
  const currentCatalog = catalog?.key === catalogKey ? catalog : null
  const currentComparison = comparison?.key === comparisonKey ? comparison : null

  useEffect(() => {
    const controller = new AbortController()
    void listNeighborhoods(locale, page, controller.signal).then(data => {
      if (!controller.signal.aborted) setCatalog({ key: catalogKey, data })
    }).catch(() => {
      if (!controller.signal.aborted) setCatalog({ key: catalogKey, data: null })
    })
    return () => controller.abort()
  }, [catalogKey, locale, page])

  useEffect(() => {
    if (requested.length < 2) return
    const controller = new AbortController()
    void Promise.all(requested.map(slug => getNeighborhood(slug, locale, controller.signal))).then(data => {
      if (!controller.signal.aborted) setComparison({ key: comparisonKey, data })
    }).catch(() => {
      if (!controller.signal.aborted) setComparison({ key: comparisonKey, data: null })
    })
    return () => controller.abort()
  }, [comparisonKey, locale, requested])

  useEffect(() => {
    function refreshOnReturn() { setRefresh(value => value + 1) }
    window.addEventListener('focus', refreshOnReturn)
    window.addEventListener('pageshow', refreshOnReturn)
    return () => {
      window.removeEventListener('focus', refreshOnReturn)
      window.removeEventListener('pageshow', refreshOnReturn)
    }
  }, [])

  useEffect(() => {
    if (requested.length >= 2) comparisonHeading.current?.focus()
  }, [requested])

  function select(item: NeighborhoodSummary, checked: boolean) {
    setRequested([])
    setComparison(null)
    setSelected(current => {
      if (!checked) return current.filter(entry => entry.slug !== item.slug)
      if (current.length >= maximum || current.some(entry => entry.slug === item.slug)) return current
      return [...current, item]
    })
  }
  const retry = () => setRefresh(value => value + 1)
  const comparisonProfiles = currentComparison?.data
    ?.filter((profile): profile is PublishedNeighborhood => profile !== null)
  const hasMissing = Boolean(currentComparison?.data?.includes(null))

  return <main lang={locale} className="min-w-0 bg-paper px-4 py-10 sm:px-7 sm:py-16">
    <div className="mx-auto max-w-270 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={editorialLink(locale)} className={action}>{copy('directory')}</Link>
        <nav aria-label={copy('language')} className="flex flex-wrap gap-2">
          {(['en', 'es'] as const).map(language => <Link key={language} href={neighborhoodCompareLink(language)} hrefLang={language}
            lang={language} aria-current={language === locale ? 'page' : undefined} className={action}>
            {language === 'es' ? 'Español' : 'English'}
          </Link>)}
        </nav>
      </div>
      <header className="space-y-2">
        <h1 className="font-sans text-3xl font-bold tracking-tight text-ink sm:text-5xl">{copy('title')}</h1>
        <p className="text-sm text-ink2 sm:text-base">{copy('intro')}</p>
      </header>
      <section aria-labelledby="neighborhood-choices" className="space-y-4">
        <h2 id="neighborhood-choices" className="text-lg font-bold text-ink">{copy('choose')}</h2>
        {!currentCatalog ? <p role="status" className="text-sm text-dim">{copy('loading_areas')}</p>
          : !currentCatalog.data ? <div className="space-y-2">
            <p role="alert" className="text-sm text-ink">{copy('error')}</p>
            <button type="button" className={action} onClick={retry}>{copy('retry')}</button>
          </div> : <>
            {!currentCatalog.data.items.length ? <p className="text-sm text-dim">{copy('empty')}</p> : null}
            <ul className="grid min-w-0 gap-3 sm:grid-cols-2">
              {currentCatalog.data.items.map(item => {
                const checked = selected.some(entry => entry.slug === item.slug)
                return <li key={item.slug} className={cell}>
                  <label className="flex min-h-11 min-w-0 cursor-pointer items-start gap-3">
                    <input type="checkbox" className="mt-1 size-4 shrink-0 accent-sea" checked={checked}
                      disabled={!checked && selected.length >= maximum} onChange={event => select(item, event.target.checked)}
                      aria-label={item.title} />
                    <span className="min-w-0">
                      <span className="block font-bold text-ink [overflow-wrap:anywhere]">{item.title}</span>
                      <span className="mt-1 block text-sm text-ink2 [overflow-wrap:anywhere]">{item.summary}</span>
                    </span>
                  </label>
                </li>
              })}
            </ul>
            {(page > 1 || page * NEIGHBORHOOD_PAGE_SIZE < currentCatalog.data.total) && <nav aria-label={copy('pages')} className="flex flex-wrap gap-2">
              <button type="button" className={action} disabled={page === 1} onClick={() => setPage(page - 1)}>{copy('previous')}</button>
              <button type="button" className={action} disabled={page >= 1000 || page * NEIGHBORHOOD_PAGE_SIZE >= currentCatalog.data.total}
                onClick={() => setPage(page + 1)}>{copy('next')}</button>
            </nav>}
          </>}
        <p role="status" className="text-sm text-ink2">{copy('selected', { count: selected.length })}</p>
        {selected.length ? <ul aria-label={copy('selection')} className="flex min-w-0 flex-wrap gap-2">
          {selected.map(item => <li key={item.slug} className="min-w-0">
            <button type="button" className={`${action} max-w-full text-left [overflow-wrap:anywhere]`} onClick={() => select(item, false)}>
              {copy('remove', { area: currentCatalog?.data?.items.find(entry => entry.slug === item.slug)?.title ?? item.title })}
            </button>
          </li>)}
        </ul> : null}
        <button type="button" className={primary} disabled={selected.length < 2} onClick={() => {
          setComparison(null)
          setRequested(selected.map(item => item.slug))
        }}>{copy('compare')}</button>
      </section>
      {requested.length >= 2 ? <section aria-labelledby="neighborhood-results" className="min-w-0 space-y-5 border-t border-line pt-5">
        <h2 id="neighborhood-results" ref={comparisonHeading} tabIndex={-1} className="text-2xl font-bold text-ink">{copy('results')}</h2>
        {!currentComparison ? <p role="status" className="text-sm text-dim">{copy('loading_comparison')}</p>
          : !currentComparison.data ? <div className="space-y-2">
            <p role="alert" className="text-sm text-ink">{copy('error')}</p>
            <button type="button" className={action} onClick={retry}>{copy('retry')}</button>
          </div> : <>
            {hasMissing ? <p role="status" className="text-sm text-ink2">{copy('withdrawn')}</p> : null}
            {comparisonProfiles && comparisonProfiles.length >= 2 ? <ComparisonResults profiles={comparisonProfiles} locale={locale} /> : null}
          </>}
      </section> : null}
    </div>
  </main>
}
