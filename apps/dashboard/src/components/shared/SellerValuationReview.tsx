import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ValuationCurrency, ValuationFollowUp, ValuationReport, ValuationReportInput, ValuationSoldDecision } from '../../api/sellerValuation'
import { NetworkDate } from '../network/NetworkShared'
import { editorInput } from '../../pages/admin/WebsiteEditorFields'
import {
  ValuationCurrencyField, ValuationInput, ValuationMoney, ValuationPrice, ValuationText,
  valuationButton, valuationError, valuationGrid, valuationPanel, valuationPrimary,
} from './SellerValuationFields'

export type ValuationCounts = { asking: number; sold: number }
const noteLimit = 2000

function EvidenceCounts({ counts }: { counts: ValuationCounts }) {
  const { t } = useTranslation('seller_valuation')
  return <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold text-ink2">
    <li>{t('report.asking_count', { count: counts.asking })}</li>
    <li>{t('report.sold_count', { count: counts.sold })}</li>
  </ul>
}

export function ValuationReportPanel({ review, counts, disabled, onReview }: {
  review: ValuationReport | null; counts: ValuationCounts; disabled: boolean; onReview: () => void
}) {
  const { t } = useTranslation('seller_valuation')
  return <section className={valuationPanel}>
    <h2 className="text-lg font-bold text-ink">{t('report.heading')}</h2>
    <EvidenceCounts counts={counts} />
    {review ? <div className="min-w-0 space-y-2 rounded-lg border border-line bg-paper p-3">
      <p className="font-semibold text-ink">{t(`report.outcomes.${review.outcome}`)}</p>
      <p className="text-sm text-ink2"><NetworkDate value={review.reviewed_at} showTime /></p>
      {review.status === 'expired' && <p role="status" className="rounded-lg bg-amber-50 p-2 text-sm font-semibold text-amber-900">{t('report.expired')}</p>}
      {review.outcome === 'range' && review.price_low !== null && review.price_high !== null && review.currency &&
        <p className="break-words text-base font-bold text-ink">
          <ValuationPrice amount={review.price_low} currency={review.currency} /> – <ValuationPrice amount={review.price_high} currency={review.currency} />
        </p>}
      <p className="whitespace-pre-wrap [overflow-wrap:anywhere] text-sm text-ink2">{review.notes}</p>
    </div> : <p className="text-sm text-ink2">{t('report.empty')}</p>}
    <button type="button" className={valuationButton} disabled={disabled} onClick={onReview}>{t('report.open')}</button>
  </section>
}

export function ValuationReportForm({ counts, rangeEligible, disabled, markDirty, onSubmit }: {
  counts: ValuationCounts; rangeEligible: boolean; disabled: boolean
  markDirty: () => void; onSubmit: (value: ValuationReportInput) => void
}) {
  const { t } = useTranslation('seller_valuation')
  const [outcome, setOutcome] = useState<ValuationReportInput['outcome']>('insufficient_evidence')
  const [amounts, setAmounts] = useState({ low: '', high: '', currency: '' as ValuationCurrency | '' })
  const [notes, setNotes] = useState('')
  const [invalid, setInvalid] = useState(false)
  const range = outcome === 'range'
  return <form className="space-y-3" onSubmit={event => {
    event.preventDefault()
    const currency = amounts.currency
    if (!notes.trim() || (range && (!rangeEligible || !currency || Number(amounts.high) < Number(amounts.low)))) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    onSubmit({ outcome, notes: notes.trim(), ...(range && currency ? { price_low: amounts.low, price_high: amounts.high, currency } : {}) })
  }}>
    <EvidenceCounts counts={counts} />
    <p className="text-sm text-ink2">{t('report.help')}</p>
    <fieldset disabled={disabled} className="min-w-0 space-y-3">
      <label className="block text-sm font-semibold text-ink2">
        <span className="mb-1 block">{t('report.outcome')}</span>
        <select className={editorInput} value={outcome} onChange={event => {
          setOutcome(event.target.value as ValuationReportInput['outcome'])
          markDirty()
        }}>
          <option value="insufficient_evidence">{t('report.outcomes.insufficient_evidence')}</option>
          <option value="range" disabled={!rangeEligible}>{t('report.outcomes.range')}</option>
        </select>
      </label>
      {!rangeEligible && <p className="text-sm text-ink2">{t('report.range_needs_evidence')}</p>}
      {range && <div className={valuationGrid}>
        <ValuationMoney label={t('report.low')} value={amounts.low} change={low => { setAmounts({ ...amounts, low }); markDirty() }} />
        <ValuationMoney label={t('report.high')} value={amounts.high} change={high => { setAmounts({ ...amounts, high }); markDirty() }} />
        <ValuationCurrencyField value={amounts.currency} change={currency => { setAmounts({ ...amounts, currency }); markDirty() }} />
      </div>}
      <ValuationText required maxLength={noteLimit} label={t('report.notes')} value={notes} change={value => { setNotes(value); markDirty() }} />
      {invalid && <p role="alert" className={valuationError}>{t('report.validation')}</p>}
      <button className={valuationPrimary} type="submit">{t('report.save')}</button>
    </fieldset>
  </form>
}

export function SoldReviewForm({ decision, disabled, markDirty, onSubmit }: {
  decision: ValuationSoldDecision; disabled: boolean; markDirty: () => void; onSubmit: (note: string) => void
}) {
  const { t } = useTranslation('seller_valuation')
  const [note, setNote] = useState('')
  return <form className="space-y-3" onSubmit={event => {
    event.preventDefault()
    if (note.trim()) onSubmit(note.trim())
  }}>
    <p className="text-sm text-ink2">{t(decision === 'verified' ? 'sold.review_verify_help' : 'sold.review_reject_help')}</p>
    <fieldset disabled={disabled} className="min-w-0 space-y-3">
      <ValuationText required maxLength={noteLimit} label={t('sold.review_note')} value={note} change={value => { setNote(value); markDirty() }} />
      <button className={valuationPrimary} disabled={!note.trim()} type="submit">{t(decision === 'verified' ? 'sold.confirm_verify' : 'sold.confirm_reject')}</button>
    </fieldset>
  </form>
}

export function ValuationFollowUps({ items, disabled, onSchedule, onComplete }: {
  items: ValuationFollowUp[]; disabled: boolean; onSchedule: () => void; onComplete: (id: string) => void
}) {
  const { t } = useTranslation('seller_valuation')
  return <section className={valuationPanel}>
    <h2 className="text-lg font-bold text-ink">{t('follow.heading')}</h2>
    <button type="button" className={valuationButton} disabled={disabled} onClick={onSchedule}>{t('follow.schedule')}</button>
    {items.length ? <ul className="min-w-0 space-y-2">
      {items.map(item => <li key={item.id} className="min-w-0 space-y-1.5 rounded-lg border border-line bg-paper p-3 text-sm text-ink2">
        <p className="font-semibold">{t('follow.date')} <NetworkDate value={item.follow_up_on} /></p>
        <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{item.note}</p>
        {item.completed_at
          ? <p>{t('follow.completed')} <NetworkDate value={item.completed_at} showTime /></p>
          : <button type="button" className={valuationButton} disabled={disabled} onClick={() => onComplete(item.id)}>{t('follow.complete')}</button>}
      </li>)}
    </ul> : <p className="text-sm text-ink2">{t('follow.empty')}</p>}
  </section>
}

export function ValuationFollowUpForm({ disabled, markDirty, onSubmit }: {
  disabled: boolean; markDirty: () => void; onSubmit: (date: string, note: string) => void
}) {
  const { t } = useTranslation('seller_valuation')
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  return <form className="space-y-3" onSubmit={event => {
    event.preventDefault()
    if (date && note.trim()) onSubmit(date, note.trim())
  }}>
    <p className="text-sm text-ink2">{t('follow.help')}</p>
    <fieldset disabled={disabled} className="min-w-0 space-y-3">
      <ValuationInput type="date" required label={t('follow.date')} value={date} change={value => { setDate(value); markDirty() }} />
      <ValuationText required maxLength={noteLimit} label={t('follow.note')} value={note} change={value => { setNote(value); markDirty() }} />
      <button type="submit" className={valuationPrimary} disabled={!date || !note.trim()}>{t('follow.save')}</button>
    </fieldset>
  </form>
}
