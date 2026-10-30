import { useEffect, useState, type ReactNode } from 'react'
import { CalendarDays, ClipboardList, Home, RefreshCw, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ANALYTICS_BUCKET_KEYS, getAdminAnalytics, type AdminAnalytics, type AnalyticsDays } from '../../api/analytics'

const { roles: ROLES, listingStatuses: LISTINGS, purposes: PURPOSES, propertyTypes: PROPERTY_TYPES,
  leadStatuses: LEAD_STATUSES, leadTypes: LEAD_TYPES, bookingStatuses: BOOKINGS } = ANALYTICS_BUCKET_KEYS
const SERIES = ['accounts_created', 'inquiries_received', 'booking_records_created'] as const
const COLORS = ['#0b63ab', '#c41230', '#15803d']

function Panel({ title, children, description }: { title: string; children: ReactNode; description?: string }) {
  return <section className="rounded-2xl border border-line bg-paper p-4 sm:p-5">
    <h2 className="font-sans text-base font-bold text-ink">{title}</h2>
    {description ? <p className="mt-1 text-xs leading-relaxed text-ink2">{description}</p> : null}
    <div className="mt-4">{children}</div>
  </section>
}

function CountList({ counts, keys, label, format, color = '#0b63ab' }: {
  counts: Record<string, number>; keys: readonly string[]; label: (key: string) => string
  format: (value: number) => string; color?: string
}) {
  const total = keys.reduce((sum, key) => sum + counts[key], 0)
  return <dl className="space-y-3">{keys.map(key => {
    const count = counts[key]
    return <div key={key}>
      <div className="flex items-baseline justify-between gap-3 text-sm"><dt className="text-ink2">{label(key)}</dt><dd className="font-semibold tabular-nums text-ink">{format(count)}</dd></div>
      <div aria-hidden="true" className="mt-1 h-1.5 overflow-hidden rounded-full bg-line-soft"><div className="h-full rounded-full" style={{ width: `${total ? count / total * 100 : 0}%`, background: color }} /></div>
    </div>
  })}</dl>
}

export function Analytics() {
  const { t, i18n } = useTranslation('admin')
  const [days, setDays] = useState<AnalyticsDays>(30)
  const [refresh, setRefresh] = useState(0)
  const [data, setData] = useState<AdminAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const locale = i18n.language.startsWith('es') ? 'es-DO' : 'en-US'
  const format = (value: number) => value.toLocaleString(locale)
  const label = (group: string, key: string) => t(`analytics_page.${group}.${key}`)
  const shortDate = (value: string) => new Intl.DateTimeFormat(locale, { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(new Date(value.length === 10 ? `${value}T00:00:00Z` : value))
  const dateTime = (value: string) => new Intl.DateTimeFormat(locale, { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setLoading(true)
    setFailed(false)
    setData(null)
    getAdminAnalytics(days, controller.signal)
      .then(report => { if (active && !controller.signal.aborted) setData(report) })
      .catch(() => { if (active && !controller.signal.aborted) setFailed(true) })
      .finally(() => { if (active && !controller.signal.aborted) setLoading(false) })
    return () => { active = false; controller.abort() }
  }, [days, refresh])

  const dailyMax = data ? Math.max(1, ...data.daily.flatMap(day => SERIES.map(key => day[key]))) : 1
  const noDailyActivity = data?.daily.every(day => SERIES.every(key => day[key] === 0))

  return <div className="space-y-5" aria-busy={loading}>
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><label htmlFor="analytics-days" className="mb-1 block text-xs font-semibold text-ink2">{t('analytics_page.period_label')}</label>
        <select id="analytics-days" value={days} onChange={event => {
          const next = Number(event.target.value)
          if (next === 7 || next === 30 || next === 90) setDays(next)
        }} className="min-h-10 rounded-lg border border-line bg-paper px-3 text-sm text-ink">
          {[7, 30, 90].map(value => <option key={value} value={value}>{t('analytics_page.last_days', { count: value })}</option>)}
        </select>
      </div>
      <button type="button" disabled={loading} onClick={() => setRefresh(value => value + 1)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line bg-paper px-3 text-sm font-semibold text-ink disabled:cursor-wait disabled:opacity-60"><RefreshCw size={15} aria-hidden="true" />{t('analytics_page.refresh')}</button>
    </div>
    {loading ? <div role="status" className="rounded-xl border border-line bg-paper p-6 text-sm text-ink2">{t('analytics_page.loading')}</div> : null}
    {failed ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-900"><p>{t('analytics_page.error')}</p><button type="button" onClick={() => setRefresh(value => value + 1)} className="mt-3 min-h-9 rounded-lg border border-red-300 bg-white px-3 font-semibold">{t('analytics_page.retry')}</button></div> : null}
    {data ? <>
      <p className="text-xs leading-relaxed text-ink2">{t('analytics_page.window', { start: shortDate(data.window.start_at), end: shortDate(data.window.end_at) })}{' · '}{t('analytics_page.updated', { date: dateTime(data.generated_at) })}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { Icon: Users, title: t('analytics_page.accounts'), value: data.snapshot.accounts, note: t('analytics_page.active_status', { count: data.snapshot.active_accounts }) },
          { Icon: Home, title: t('analytics_page.active_listings'), value: data.snapshot.active_listings, note: t('analytics_page.current_snapshot') },
          { Icon: ClipboardList, title: t('analytics_page.inquiries'), value: data.period.inquiries.received, note: t('analytics_page.period_count') },
          { Icon: CalendarDays, title: t('analytics_page.bookings'), value: data.period.booking_records_created, note: t('analytics_page.booking_count_note') },
        ].map(({ Icon, title, value, note }) => <section key={title} className="rounded-xl border border-line bg-paper p-4"><Icon size={18} className="mb-2 text-coral" aria-hidden="true" /><div className="text-2xl font-bold tabular-nums text-ink">{format(value)}</div><h2 className="mt-1 text-sm font-semibold text-ink">{title}</h2><p className="mt-1 text-xs text-ink2">{note}</p></section>)}
      </div>
      <Panel title={t('analytics_page.activity_title')} description={t('analytics_page.activity_note')}>
        <ul className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink2">{SERIES.map((key, i) => <li key={key} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[i] }} aria-hidden="true" />{label('daily', key)}</li>)}</ul>
        {noDailyActivity ? <p className="mb-4 rounded-lg bg-line-soft p-3 text-sm text-ink2">{t('analytics_page.empty_activity')}</p> : null}
        <div className="overflow-x-auto" aria-hidden="true"><div className="flex h-32 items-end gap-1 border-b border-line" style={{ minWidth: data.daily.length * 12 }}>{data.daily.map(day => <div key={day.date} className="flex h-full flex-1 items-end justify-center gap-px">{SERIES.map((key, i) => <div key={key} className="min-w-px max-w-3 flex-1 rounded-t-sm" style={{ height: `${day[key] / dailyMax * 100}%`, background: COLORS[i] }} />)}</div>)}</div></div>
        <div aria-hidden="true" className="mt-1 flex justify-between text-[11px] text-ink2"><span>{shortDate(data.daily[0].date)}</span><span>{shortDate(data.daily[data.daily.length - 1].date)}</span></div>
        <details className="mt-4 text-sm"><summary className="cursor-pointer font-semibold text-ink">{t('analytics_page.show_daily_values')}</summary><div className="mt-3 max-h-80 overflow-auto"><table className="w-full text-left text-xs"><caption className="sr-only">{t('analytics_page.daily_table_caption')}</caption><thead><tr className="border-b border-line text-ink2"><th scope="col" className="p-2">{t('analytics_page.date')}</th>{SERIES.map(key => <th key={key} scope="col" className="p-2 text-right">{label('daily', key)}</th>)}</tr></thead><tbody>{data.daily.map(day => <tr key={day.date} className="border-b border-line"><th scope="row" className="whitespace-nowrap p-2 font-normal text-ink2">{shortDate(day.date)}</th>{SERIES.map(key => <td key={key} className="p-2 text-right tabular-nums text-ink">{format(day[key])}</td>)}</tr>)}</tbody></table></div></details>
      </Panel>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title={t('analytics_page.inquiry_status_title')} description={t('analytics_page.cohort_note')}><CountList counts={data.period.inquiries.current_status} keys={LEAD_STATUSES} label={key => label('lead_status', key)} format={format} color="#c41230" /></Panel>
        <Panel title={t('analytics_page.inquiry_type_title')} description={t('analytics_page.inquiry_scope')}><CountList counts={data.period.inquiries.by_type} keys={LEAD_TYPES} label={key => label('lead_type', key)} format={format} color="#c41230" /></Panel>
      </div>
      <Panel title={t('analytics_page.followup_title')} description={t('analytics_page.followup_note')}>
        <dl className="grid gap-4 sm:grid-cols-3">{[
          { title: t('analytics_page.contact_recorded'), value: data.period.inquiries.contact_recorded },
          { title: t('analytics_page.crm_linked'), value: data.period.inquiries.crm_linked },
          { title: t('analytics_page.crm_errors'), value: data.period.inquiries.crm_errors },
        ].map(({ title, value }) => <div key={title}><dt className="text-xs text-ink2">{title}</dt><dd className="mt-1 text-xl font-bold tabular-nums text-ink">{format(value)}</dd></div>)}</dl>
        <p className="mt-4 text-xs leading-relaxed text-ink2">{t('analytics_page.tracking_note', { tests: format(data.period.inquiries.excluded_internal_tests), unknown: format(data.period.inquiries.unknown_tracking) })}</p>
        <a href="/leads?workspace=admin" className="mt-3 inline-block text-sm font-semibold text-coral underline underline-offset-2">{t('analytics_page.open_leads')}</a>
      </Panel>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title={t('analytics_page.listing_status_title')} description={t('analytics_page.snapshot_listing_note', { total: format(data.snapshot.listing_records), created: format(data.period.listings_created) })}><CountList counts={data.snapshot.listings_by_status} keys={LISTINGS} label={key => label('listing_status', key)} format={format} /></Panel>
        <Panel title={t('analytics_page.account_roles_title')} description={t('analytics_page.snapshot_accounts_note', { created: format(data.period.accounts_created) })}><CountList counts={data.snapshot.accounts_by_role} keys={ROLES} label={key => label('account_role', key)} format={format} /></Panel>
        <Panel title={t('analytics_page.active_purpose_title')} description={t('analytics_page.current_snapshot')}><CountList counts={data.snapshot.active_listings_by_purpose} keys={PURPOSES} label={key => label('purpose', key)} format={format} color="#15803d" /></Panel>
        <Panel title={t('analytics_page.active_type_title')} description={t('analytics_page.current_snapshot')}><CountList counts={data.snapshot.active_listings_by_type} keys={PROPERTY_TYPES} label={key => label('property_type', key)} format={format} color="#15803d" /></Panel>
        <Panel title={t('analytics_page.booking_status_title')} description={t('analytics_page.booking_scope')}><CountList counts={data.period.booking_current_status} keys={BOOKINGS} label={key => label('booking_status', key)} format={format} /></Panel>
      </div>
      <p className="rounded-xl border border-line bg-line-soft p-4 text-xs leading-relaxed text-ink2">{t('analytics_page.report_scope')}</p>
    </> : null}
  </div>
}
