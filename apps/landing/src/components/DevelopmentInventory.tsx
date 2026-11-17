'use client'

import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  developmentAvailabilityCurrent, developmentAvailabilityEnd, developmentFloorPlanHref, fetchDevelopmentInventory,
  type DevelopmentCurrency, type DevelopmentPaymentStage, type DevelopmentPhase, type DevelopmentUnit,
  type DevelopmentUnitStatus, type PublishedDevelopmentInventory,
} from '../api/developmentInventory'

const statusStyle: Record<DevelopmentUnitStatus, string> = {
  available: 'bg-green-50 text-green-800',
  reserved: 'bg-amber-50 text-amber-900',
  sold: 'bg-slate-100 text-slate-700',
  unconfirmed: 'bg-stone-100 text-stone-700',
}

function dateLabel(value: string, locale: string): string {
  const date = new Date(`${value}T12:00:00Z`)
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(date)
}

function priceLabel(price: string, currency: DevelopmentCurrency, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency', currency, currencyDisplay: 'code', minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(Number(price))
}

function DeliveryTarget({ value, locale }: { value: string; locale: string }) {
  const { t } = useTranslation('property_detail', { keyPrefix: 'development' })
  const quarter = /^(\d{4})-Q([1-4])$/.exec(value)
  const label = quarter ? t('quarter', { quarter: quarter[2], year: quarter[1] })
    : value.length === 4 ? value
    : value.length === 7 ? new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}-01T12:00:00Z`))
    : dateLabel(value, locale)
  return <p className="text-sm text-ink2">{t('delivery', { date: label })}</p>
}

function PhaseInventory({ phase, label, current, locale }: { phase: DevelopmentPhase; label: string; current: boolean; locale: string }) {
  const { t } = useTranslation('property_detail', { keyPrefix: 'development' })
  const heading = useId()
  const areaFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 3 })
  const unknown = t('unreported')
  function values(unit: DevelopmentUnit) {
    const status = current ? unit.status : 'unconfirmed'
    const floorPlan = developmentFloorPlanHref(unit.floor_plan_url)
    return {
      floor: unit.floor ?? unknown,
      area: unit.area_m2 !== null ? t('square_meters', { area: areaFormat.format(Number(unit.area_m2)) }) : unknown,
      price: unit.price !== null && unit.currency ? priceLabel(unit.price, unit.currency, locale) : unknown,
      status: <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle[status]}`}>{t(`status.${status}`)}</span>,
      plan: floorPlan ? <a href={floorPlan} target="_blank" rel="noopener noreferrer"
        aria-label={t('floor_plan_named', { unit: unit.code })} className="inline-flex min-h-11 items-center font-semibold text-sea underline">{t('view_floor_plan')}</a> : unknown,
    }
  }
  return <section aria-labelledby={heading} className="min-w-0 space-y-3">
    <h3 id={heading} className="break-words text-base font-bold text-ink">{label}</h3>
    {phase.target_delivery && <DeliveryTarget value={phase.target_delivery} locale={locale} />}
    {phase.units.length ? <>
      <ul className="grid min-w-0 gap-2 sm:grid-cols-2 xl:hidden">
        {phase.units.map(unit => {
          const details = values(unit)
          return <li key={unit.code} className="min-w-0 rounded-xl border border-line bg-white p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h4 className="max-w-full break-words font-bold text-ink">{unit.code}</h4>
              {details.status}
            </div>
            <dl className="mt-2 space-y-1 text-sm text-ink2">
              {(['floor', 'area', 'price', 'plan'] as const).map(key => <div key={key} className="flex min-w-0 flex-wrap items-center justify-between gap-x-2">
                <dt className="font-medium">{t(`column.${key}`)}</dt><dd className="break-words">{details[key]}</dd>
              </div>)}
            </dl>
          </li>
        })}
      </ul>
      <div className="hidden min-w-0 overflow-x-auto rounded-xl border border-line bg-white xl:block">
        <table className="w-full border-collapse text-left text-sm text-ink2">
          <caption className="sr-only">{t('units_in', { phase: label })}</caption>
          <thead className="bg-paper2 text-xs font-semibold text-ink">
            <tr>{(['unit', 'floor', 'area', 'price', 'status', 'plan'] as const).map(key =>
              <th key={key} scope="col" className="px-3 py-2">{t(`column.${key}`)}</th>
            )}</tr>
          </thead>
          <tbody>{phase.units.map(unit => {
            const details = values(unit)
            return <tr key={unit.code} className="border-t border-line">
              <th scope="row" className="break-words px-3 py-2 font-semibold text-ink">{unit.code}</th>
              {(['floor', 'area', 'price', 'status', 'plan'] as const).map(key =>
                <td key={key} className="break-words px-3 py-2">{details[key]}</td>
              )}
            </tr>
          })}</tbody>
        </table>
      </div>
    </> : <p className="text-sm text-dim">{t('no_units')}</p>}
  </section>
}

function PaymentStage({ stage, language, locale }: { stage: DevelopmentPaymentStage; language: 'en' | 'es'; locale: string }) {
  const percent = stage.percent !== null
    ? new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 }).format(Number(stage.percent) / 100)
    : null
  const amount = stage.amount !== null && stage.currency ? priceLabel(stage.amount, stage.currency, locale) : null
  return <li className="min-w-0 rounded-xl border border-line bg-white p-3 text-sm text-ink2">
    <p className="break-words font-semibold text-ink">{stage[`label_${language}`]}{(percent || amount) && <span className="ml-2">{percent || amount}</span>}</p>
    {stage[`due_${language}`] && <p className="mt-1 break-words">{stage[`due_${language}`]}</p>}
    {stage.due_date && <time className="mt-1 block" dateTime={stage.due_date}>{dateLabel(stage.due_date, locale)}</time>}
  </li>
}

function PublishedInventory({ data, current }: { data: PublishedDevelopmentInventory; current: boolean }) {
  const { t, i18n } = useTranslation('property_detail', { keyPrefix: 'development' })
  const [phaseCode, setPhaseCode] = useState('')
  const heading = useId()
  const language = i18n.language.startsWith('es') ? 'es' : 'en'
  const locale = language === 'es' ? 'es-DO' : 'en-US'
  const { project } = data
  const selectedPhase = project.phases.find(phase => phase.code === phaseCode)
  const phases = selectedPhase ? [selectedPhase] : project.phases
  const updates = [...project.updates].sort((left, right) => right.date.localeCompare(left.date))
  return <section id="development-availability" aria-labelledby={heading} className="min-w-0 space-y-5 rounded-2xl border border-line-soft bg-paper2 p-4 sm:p-5">
    <header className="space-y-2">
      <h2 id={heading} className="text-[22px] font-semibold text-ink">{t('heading')}</h2>
      <p className="break-words font-semibold text-ink">{project[`name_${language}`]}</p>
      {project[`summary_${language}`] && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink2">{project[`summary_${language}`]}</p>}
      <p className="text-sm text-ink2">{t('verified_on', { date: dateLabel(data.verified_on, locale) })}</p>
      {current ? <p className="text-sm text-ink2">{t('current_through', { date: dateLabel(data.availability_valid_through, locale) })}</p>
        : <p role="status" className="rounded-lg bg-amber-50 p-2 text-sm font-semibold text-amber-900">{t('unconfirmed')}</p>}
      {project.target_delivery && <DeliveryTarget value={project.target_delivery} locale={locale} />}
    </header>
    {project.phases.length > 1 && <label className="block max-w-xs text-sm font-semibold text-ink">
      <span className="mb-1 block">{t('phase_filter')}</span>
      <select className="min-h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-coral"
        value={selectedPhase?.code ?? ''} onChange={event => setPhaseCode(event.target.value)}>
        <option value="">{t('all_phases')}</option>
        {project.phases.map(phase => <option key={phase.code} value={phase.code}>{phase[`name_${language}`]}</option>)}
      </select>
    </label>}
    {phases.map(phase => <PhaseInventory key={phase.code} phase={phase} label={phase[`name_${language}`]} locale={locale} current={current} />)}
    {!phases.length && <p className="text-sm text-dim">{t('no_units')}</p>}
    {project.payment_stages.length > 0 && <div className="space-y-2">
      <h3 className="font-semibold text-ink">{t('payment_stages')}</h3>
      <ol className="grid min-w-0 gap-2 sm:grid-cols-2">
        {project.payment_stages.map((stage, index) => <PaymentStage key={index} stage={stage} language={language} locale={locale} />)}
      </ol>
    </div>}
    {updates.length > 0 && <div className="space-y-2">
      <h3 className="font-semibold text-ink">{t('updates')}</h3>
      <ul className="space-y-2">
        {updates.map((update, index) => <li key={index} className="min-w-0 rounded-xl border border-line bg-white p-3">
          <h4 className="break-words font-semibold text-ink">{update[`title_${language}`]}</h4>
          <time dateTime={update.date} className="block text-xs text-dim">{dateLabel(update.date, locale)}</time>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink2">{update[`text_${language}`]}</p>
        </li>)}
      </ul>
    </div>}
  </section>
}

export function DevelopmentInventory({ listingId }: { listingId: string }) {
  const [snapshot, setSnapshot] = useState<{ listingId: string; data: PublishedDevelopmentInventory | null } | null>(null)
  const [clock, setClock] = useState(Date.now)
  const data = snapshot?.listingId === listingId ? snapshot.data : null
  const validThrough = data?.availability_valid_through
  useEffect(() => {
    let request: AbortController | null = null
    function refresh() {
      if (document.visibilityState === 'hidden') return
      setClock(Date.now())
      if (request) return
      const controller = new AbortController()
      request = controller
      void fetchDevelopmentInventory(listingId, controller.signal).then(data => {
        if (!controller.signal.aborted) {
          setClock(Date.now())
          setSnapshot({ listingId, data })
        }
      }).catch(() => {
        if (!controller.signal.aborted) setSnapshot({ listingId, data: null })
      }).finally(() => {
        if (request === controller) request = null
      })
    }
    refresh()
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      request?.abort()
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [listingId])
  useEffect(() => {
    if (!validThrough) return
    const end = developmentAvailabilityEnd(validThrough)
    if (!Number.isFinite(end)) return
    let timer = 0
    function expire() {
      const remaining = end - Date.now()
      if (remaining <= 0) setClock(Date.now())
      else timer = window.setTimeout(expire, Math.min(remaining, 2_147_000_000))
    }
    expire()
    return () => window.clearTimeout(timer)
  }, [validThrough])
  return data ? <div className="mt-7 min-w-0"><PublishedInventory key={listingId} data={data} current={developmentAvailabilityCurrent(data, clock)} /></div> : null
}
