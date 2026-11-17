import { useTranslation } from 'react-i18next'
import type { ListingPerformance } from '../../api/listingPerformance'
import { NetworkDate } from '../network/NetworkShared'

const panel = 'min-w-0 space-y-3 rounded-xl border border-line bg-white p-4'

export function ListingPerformanceReport({ report }: { report: ListingPerformance }) {
  const { t, i18n } = useTranslation('listing_performance')
  const format = new Intl.NumberFormat(i18n.language.startsWith('es') ? 'es-DO' : 'en-US')
  const amount = (value: number | null) => value === null ? t('unavailable') : format.format(value)
  const values = [
    { label: t('views.lifetime'), value: report.views.lifetime, help: t('views.lifetime_help') },
    { label: t('views.tracked'), value: report.views.range_total, help: t(`views.coverage.${report.views.coverage}`) },
    { label: t('inquiries.title'), value: report.totals.property_inquiries, help: t('inquiries.help') },
    { label: t('confirmed.title'), value: report.totals.confirmed_viewings, help: t('confirmed.help') },
    { label: t('completed.title'), value: report.totals.recorded_completed_showings, help: t('completed.help') },
  ]
  const notes = report.entries.filter(entry => entry.kind !== 'completed_showing')
  const completed = report.entries.filter(entry => entry.kind === 'completed_showing')
  return <div className="min-w-0 space-y-4">
    <header>
      <h3 className="break-words text-lg font-bold text-ink">{report.title}</h3>
      <p className="flex flex-wrap gap-x-1.5 text-sm text-ink2">
        <NetworkDate value={report.range.start} />–<NetworkDate value={report.range.end} />
        <span>· {t('dates.time_zone')}</span>
      </p>
    </header>
    <dl className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {values.map(item => <div key={item.label} className={panel}>
        <dt className="text-sm font-semibold text-ink">{item.label}</dt>
        <dd className="break-words text-2xl font-bold text-ink">{amount(item.value)}</dd>
        <dd className="text-xs leading-relaxed text-ink2">{item.help}</dd>
      </div>)}
    </dl>
    <section className={panel}>
      <h3 className="font-semibold text-ink">{t('views.recording')}</h3>
      <p className="text-sm text-ink2">{report.views.tracked_from ? <>
        {t('views.began')} <NetworkDate value={report.views.tracked_from} showTime />
      </> : t('views.no_tracking')}</p>
      <details>
        <summary className="min-h-10 cursor-pointer py-2 text-sm font-semibold text-ink focus-visible:outline-2 focus-visible:outline-coral">{t('views.daily')}</summary>
        <table className="w-full text-left text-sm text-ink2">
          <caption className="sr-only">{t('views.daily')}</caption>
          <thead><tr>
            <th scope="col" className="py-2 pr-2">{t('entries.date')}</th>
            <th scope="col" className="py-2 pr-2">{t('views.count')}</th>
            <th scope="col" className="py-2">{t('views.coverage_title')}</th>
          </tr></thead>
          <tbody>{report.views.days.map(item => <tr key={item.date} className="border-t border-line">
            <th scope="row" className="py-2 pr-2 font-normal"><NetworkDate value={item.date} /></th>
            <td className="py-2 pr-2">{amount(item.count)}</td>
            <td className="py-2">{t(`views.states.${item.coverage}`)}</td>
          </tr>)}</tbody>
        </table>
      </details>
    </section>
    <div className="grid min-w-0 gap-3 lg:grid-cols-2">
      <section className={panel}>
        <h3 className="font-semibold text-ink">{t('milestones.heading')}</h3>
        {report.milestones.length ? <ul className="space-y-2">
          {report.milestones.map((item, index) => <li key={index} className="flex flex-wrap justify-between gap-2 text-sm text-ink2">
            <span>{t(`milestones.kinds.${item.kind}`)}</span><NetworkDate value={item.occurred_on} />
          </li>)}
        </ul> : <p className="text-sm text-ink2">{t('milestones.empty')}</p>}
        {report.milestones_truncated && <p className="text-xs text-ink2">{t('milestones.truncated')}</p>}
      </section>
      <section className={panel}>
        <h3 className="font-semibold text-ink">{t('entries.notes')}</h3>
        {notes.length ? <ul className="space-y-3">
          {notes.map(item => <li key={item.id} className="min-w-0 rounded-lg bg-paper p-3 text-sm text-ink2">
            <p className="flex flex-wrap justify-between gap-2 font-semibold text-ink">
              <span>{t(`entries.kinds.${item.kind}`)}</span><NetworkDate value={item.occurred_on} />
            </p>
            {item.text && <p className="mt-1 whitespace-pre-wrap [overflow-wrap:anywhere]">{item.text}</p>}
          </li>)}
        </ul> : <p className="text-sm text-ink2">{t(report.entries_truncated ? 'entries.notes_recent_empty' : 'entries.notes_empty')}</p>}
      </section>
    </div>
    {completed.length > 0 && <section className={panel}>
      <h3 className="font-semibold text-ink">{t('completed.entries')}</h3>
      <ul className="flex flex-wrap gap-2 text-sm text-ink2">
        {completed.map(item => <li key={item.id} className="rounded-lg bg-paper px-3 py-2"><NetworkDate value={item.occurred_on} /></li>)}
      </ul>
    </section>}
    {report.entries_truncated && <p className="text-xs text-ink2">{t('entries.truncated')}</p>}
  </div>
}
