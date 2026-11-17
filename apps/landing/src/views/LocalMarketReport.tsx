'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { editorialLink, type EditorialLocale } from '../api/editorial'
import {
  formatMarketMoney, getMarketReport, marketReportLink, marketReportLocation, marketReportSearchLink,
  REPORT_CURRENCIES, REPORT_TIME_ZONE, type MarketCohort, type MarketReport,
} from '../api/marketReports'
import { groupLocations } from '../data/searchLocations'

const action = 'inline-flex min-h-11 max-w-full items-center rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink hover:bg-paper2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sea'
const primary = 'inline-flex min-h-11 items-center rounded-lg bg-sea px-4 py-2 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sea'
const surface = 'min-w-0 rounded-2xl border border-line bg-white p-4 sm:p-5'
const locations = groupLocations([])

function ReportScope({ location, locale, onApply }: {
  location: string | null; locale: EditorialLocale; onApply: (location: string | null) => void
}) {
  const { t } = useTranslation('blog', { keyPrefix: 'market_report' })
  const { t: search } = useTranslation('search')
  const [choice, setChoice] = useState(location ?? '')
  return <form className={`${surface} flex flex-wrap items-end gap-3`} onSubmit={event => {
    event.preventDefault()
    onApply(marketReportLocation(choice))
  }}>
    <div className="min-w-0 flex-1 basis-56 space-y-1">
      <label htmlFor="market-report-location" className="block text-sm font-bold text-ink">{t('location', { lng: locale })}</label>
      <select id="market-report-location" value={choice} onChange={event => setChoice(event.target.value)}
        className="min-h-11 min-w-0 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-sea">
        <option value="">{t('all_locations', { lng: locale })}</option>
        {locations.map(group => <optgroup key={group.key} label={search(`locations.areas.${group.key}`, { lng: locale })}>
          {group.options.map(option => <option value={option.value} key={option.value}>{option.value}</option>)}
        </optgroup>)}
      </select>
    </div>
    <button type="submit" className={primary}>{t('apply', { lng: locale })}</button>
  </form>
}

function CohortReport({ group, locale }: { group: MarketCohort; locale: EditorialLocale }) {
  const { t } = useTranslation('blog', { keyPrefix: 'market_report' })
  const { t: search } = useTranslation('search')
  const copy = (name: string) => t(name, { lng: locale })
  const count = (value: number) => new Intl.NumberFormat(locale === 'es' ? 'es-DO' : 'en-US').format(value)
  const amounts = [['minimum', group.price_min], ['median', group.price_median], ['maximum', group.price_max]] as const
  const areaLabel = group.area_basis ? copy(`basis.${group.area_basis}`) : null
  return <article className={`${surface} space-y-4`}>
    <h4 className="text-lg font-bold text-ink">{search(`sidebar.type_${group.property_type}`, { lng: locale })}</h4>
    <dl className="grid min-w-0 gap-2 text-sm sm:grid-cols-3">
      {([['listings', group.listing_count], ['priced_listings', group.price_count], ['sized_listings', group.size_count]] as const)
        .map(([label, value]) => <div key={label} className="min-w-0 rounded-lg bg-paper px-3 py-2">
          <dt className="text-ink2">{copy(label)}</dt>
          <dd className="font-bold tabular-nums text-ink">{count(value)}</dd>
        </div>)}
    </dl>
    {group.price_count > 0 ? <dl className="grid min-w-0 gap-3 text-sm sm:grid-cols-3">
      {amounts.map(([label, value]) => value !== null ? <div key={label} className="min-w-0">
        <dt className="text-ink2">{copy(label)}</dt>
        <dd className="font-semibold tabular-nums text-ink [overflow-wrap:anywhere]">{formatMarketMoney(value, group.currency, locale)}</dd>
      </div> : null)}
    </dl> : <p className="text-sm text-dim">{copy('no_prices')}</p>}
    <dl className="border-t border-line pt-3">
      <dt className="text-sm text-ink2">{copy('per_sqm')}{areaLabel ? ` · ${areaLabel}` : ''}</dt>
      <dd className="mt-1 break-words text-sm text-ink">
        {group.median_price_per_sqm !== null ? formatMarketMoney(group.median_price_per_sqm, group.currency, locale)
          : copy(group.area_basis ? 'unavailable' : 'basis_unavailable')}
      </dd>
    </dl>
  </article>
}

export function MarketReportSnapshot({ report, locale }: { report: MarketReport; locale: EditorialLocale }) {
  const { t } = useTranslation('blog', { keyPrefix: 'market_report' })
  const copy = (name: string, values?: Record<string, string | number>) => t(name, { lng: locale, ...values })
  const region = locale === 'es' ? 'es-DO' : 'en-US'
  const count = new Intl.NumberFormat(region)
  const checked = new Intl.DateTimeFormat(region, { dateStyle: 'medium', timeStyle: 'short', timeZone: REPORT_TIME_ZONE })
    .format(new Date(report.as_of))
  return <section aria-labelledby="market-snapshot" className="space-y-5">
    <header className="space-y-3">
      <h2 id="market-snapshot" className="text-xl font-bold text-ink sm:text-2xl">{report.location ?? copy('all_locations')}</h2>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1 text-sm">
          <p className="font-semibold text-ink">{copy('total', { total: count.format(report.total_listings) })}</p>
          <p className="text-ink2">{copy('as_of')} <time dateTime={report.as_of}>{checked}</time> · {copy('time_zone')}</p>
        </div>
        <Link href={marketReportSearchLink(report.location)} className={action}>
          {report.location ? copy('search_location', { location: report.location }) : copy('search_all')}
        </Link>
      </div>
      {report.unclassified_currency_count > 0 ? <p className="text-sm text-ink2">
        {copy('currency_omitted', {
          count: report.unclassified_currency_count, countLabel: count.format(report.unclassified_currency_count),
        })}
      </p> : null}
    </header>
    {report.total_listings === 0 ? <p role="status" className="text-sm text-dim">{copy('empty')}</p>
      : report.groups.length === 0 ? <p role="status" className="text-sm text-dim">{copy('no_currency_groups')}</p>
        : REPORT_CURRENCIES.map(currency => {
          const groups = report.groups.filter(group => group.currency === currency)
          return groups.length ? <section key={currency} aria-labelledby={`market-currency-${currency}`} className="space-y-3">
            <h3 id={`market-currency-${currency}`} className="text-lg font-bold text-ink">{currency}</h3>
            <div className="grid min-w-0 gap-3 lg:grid-cols-2">
              {groups.map(group => <CohortReport key={group.property_type} group={group} locale={locale} />)}
            </div>
          </section> : null
        })}
  </section>
}

export default function LocalMarketReport() {
  const { t, i18n } = useTranslation('blog', { keyPrefix: 'market_report' })
  const params = useSearchParams()
  const router = useRouter()
  const languages = params.getAll('lang')
  const selectedLocale = languages.length === 1 ? languages[0] : ''
  const locale: EditorialLocale = selectedLocale === 'en' || selectedLocale === 'es' ? selectedLocale
    : i18n.language.startsWith('es') ? 'es' : 'en'
  const requested = params.getAll('location')
  const location = requested.length === 1 ? marketReportLocation(requested[0]) : null
  const invalidScope = requested.length > 0 && !location
  const [revision, setRevision] = useState(0)
  const [snapshot, setSnapshot] = useState<{ key: string; report: MarketReport | null } | null>(null)
  const key = `${location ?? ''}:${revision}`
  const current = !invalidScope && snapshot?.key === key ? snapshot : null
  const copy = (name: string) => t(name, { lng: locale })
  const refresh = () => setRevision(value => value + 1)

  useEffect(() => {
    if (invalidScope) return
    const controller = new AbortController()
    void getMarketReport(location, controller.signal).then(report => {
      if (!controller.signal.aborted) setSnapshot({ key, report })
    }).catch(() => {
      if (!controller.signal.aborted) setSnapshot({ key, report: null })
    })
    return () => controller.abort()
  }, [invalidScope, key, location])

  useEffect(() => {
    function refreshOnReturn() { setRevision(value => value + 1) }
    window.addEventListener('focus', refreshOnReturn)
    window.addEventListener('pageshow', refreshOnReturn)
    return () => {
      window.removeEventListener('focus', refreshOnReturn)
      window.removeEventListener('pageshow', refreshOnReturn)
    }
  }, [])

  return <main lang={locale} className="min-w-0 bg-paper px-4 py-10 sm:px-7 sm:py-16">
    <div className="mx-auto max-w-270 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={editorialLink(locale)} className={action}>{copy('back')}</Link>
        <nav aria-label={copy('language')} className="flex flex-wrap gap-2">
          {(['en', 'es'] as const).map(language => <Link key={language} href={marketReportLink(language, location)}
            hrefLang={language} lang={language} aria-current={language === locale ? 'page' : undefined} className={action}>
            {language === 'es' ? 'Español' : 'English'}
          </Link>)}
        </nav>
      </div>
      <header className="space-y-2">
        <h1 className="font-sans text-3xl font-bold tracking-tight text-ink sm:text-5xl">{copy('title')}</h1>
        <p className="text-ink2">{copy('intro')}</p>
      </header>
      <ReportScope key={invalidScope ? 'invalid' : location ?? 'all'} location={location} locale={locale} onApply={next => {
        if (next === location && !invalidScope) refresh()
        else router.push(marketReportLink(locale, next), { scroll: false })
      }} />
      {invalidScope ? <p role="alert" className="text-sm text-ink">{copy('invalid_location')}</p>
        : !current ? <p role="status" className="text-sm text-dim">{copy('loading')}</p>
          : !current.report ? <div className="space-y-2">
            <p role="alert" className="text-sm text-ink">{copy('error')}</p>
            <button type="button" className={action} onClick={refresh}>{copy('retry')}</button>
          </div> : <MarketReportSnapshot report={current.report} locale={locale} />}
      <section aria-labelledby="market-method" className={`${surface} space-y-2 text-sm leading-relaxed text-ink2`}>
        <h2 id="market-method" className="text-lg font-bold text-ink">{copy('method')}</h2>
        <p>{copy('method_asking')}</p>
        <p>{copy('method_area')}</p>
      </section>
    </div>
  </main>
}
