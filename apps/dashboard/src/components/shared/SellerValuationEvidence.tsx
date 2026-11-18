import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  getValuationCandidates, valuationAccessDenied,
  type ValuationCandidate, type ValuationComparable, type ValuationCurrency, type ValuationSoldInput,
} from '../../api/sellerValuation'
import { NetworkDate } from '../network/NetworkShared'
import {
  factsFromFields, ValuationCurrencyField, ValuationFacts, ValuationFactsSummary, ValuationInput, ValuationMoney,
  ValuationPrice, ValuationPropertyTypeField, ValuationText, valuationButton, valuationError, valuationGrid, valuationPanel,
  valuationPrimary, type PropertyFactFields,
} from './SellerValuationFields'

type CandidateQuery = { property_type: PropertyFactFields['property_type']; q: string }
type CandidateState = { kind: 'pending' } | { kind: 'error' } | { kind: 'ready'; items: ValuationCandidate[] }

export function AskingComparablePicker({ leadId, propertyType, captured, disabled, onAdd, onDenied }: {
  leadId: string; propertyType: PropertyFactFields['property_type']; captured: Set<string>; disabled: boolean
  onAdd: (listingId: string) => void; onDenied: () => void
}) {
  const { t } = useTranslation('seller_valuation')
  const [query, setQuery] = useState<CandidateQuery>({ property_type: propertyType, q: '' })
  const [submitted, submitQuery] = useState(query)
  const [result, setResult] = useState<CandidateState>({ kind: 'pending' })
  useEffect(() => {
    const controller = new AbortController()
    void getValuationCandidates(leadId, {
      property_type: submitted.property_type || undefined, q: submitted.q.trim() || undefined,
    }, controller.signal).then(items => {
      if (!controller.signal.aborted) setResult({ kind: 'ready', items })
    }).catch(error => {
      if (controller.signal.aborted) return
      if (valuationAccessDenied(error)) onDenied()
      else setResult({ kind: 'error' })
    })
    return () => controller.abort()
  }, [leadId, onDenied, submitted])
  return <div className="min-w-0 space-y-4">
    <p className="text-sm text-ink2">{t('asking.help')}</p>
    <form onSubmit={event => {
      event.preventDefault()
      setResult({ kind: 'pending' })
      submitQuery({ ...query })
    }} className="space-y-3">
      <fieldset disabled={disabled} className="min-w-0 space-y-3">
        <div className={valuationGrid}>
          <ValuationInput type="search" label={t('asking.search_label')} value={query.q} maxLength={80}
            change={q => setQuery({ ...query, q })} />
          <ValuationPropertyTypeField value={query.property_type} change={property_type => setQuery({ ...query, property_type })} />
        </div>
        <button type="submit" className={valuationButton}>{t('asking.search')}</button>
      </fieldset>
    </form>
    {result.kind === 'pending' && <p role="status" className="text-sm text-ink2">{t('asking.loading')}</p>}
    {result.kind === 'error' && <p role="alert" className={valuationError}>{t('asking.error')}</p>}
    {result.kind === 'ready' && (result.items.length ? <ul className="min-w-0 space-y-2">
      {result.items.map(item => <li key={item.listing_id} className="min-w-0 space-y-2 rounded-lg border border-line bg-white p-3">
        <h3 className="break-words text-sm font-bold text-ink">{item.title}</h3>
        <ValuationFactsSummary facts={item} />
        <p className="text-sm text-ink2"><ValuationPrice amount={item.price} currency={item.currency} /></p>
        <button type="button" className={valuationButton} disabled={disabled || captured.has(item.listing_id)}
          onClick={() => onAdd(item.listing_id)}>{t(captured.has(item.listing_id) ? 'asking.saved' : 'asking.add')}</button>
      </li>)}
    </ul> : <p className="text-sm text-ink2">{t('asking.empty')}</p>)}
  </div>
}

export function SoldComparableForm({ disabled, markDirty, onSubmit }: {
  disabled: boolean; markDirty: () => void; onSubmit: (input: ValuationSoldInput) => void
}) {
  const { t } = useTranslation('seller_valuation')
  const [fields, setFields] = useState<PropertyFactFields>({ property_type: '', location: '', area_m2: '', bedrooms: '', bathrooms: '' })
  const [details, setDetails] = useState({ price: '', currency: '' as ValuationCurrency | '', closed_on: '', source_label: '', source_reference: '' })
  const [invalid, setInvalid] = useState(false)
  function patch<K extends keyof typeof details>(key: K, value: typeof details[K]) {
    markDirty()
    setDetails(previous => ({ ...previous, [key]: value }))
  }
  return <form className="space-y-3" onSubmit={event => {
    event.preventDefault()
    const facts = factsFromFields(fields)
    if (!facts.property_type || !facts.location || !details.currency || !details.source_label.trim() || !details.source_reference.trim()) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    onSubmit({
      ...facts, ...details, property_type: facts.property_type, location: facts.location, currency: details.currency,
      source_label: details.source_label.trim(), source_reference: details.source_reference.trim(),
    })
  }}>
    <p className="text-sm text-ink2">{t('sold.help')}</p>
    <fieldset disabled={disabled} className="min-w-0 space-y-3">
      <ValuationFacts fields={fields} required change={next => { setFields(next); markDirty() }} />
      <div className={valuationGrid}>
        <ValuationMoney label={t('sold.price')} value={details.price} change={value => patch('price', value)} />
        <ValuationCurrencyField value={details.currency} change={value => patch('currency', value)} />
        <ValuationInput type="date" required label={t('sold.date')} value={details.closed_on} change={value => patch('closed_on', value)} />
        <ValuationInput required maxLength={120} label={t('sold.source_label')} value={details.source_label} change={value => patch('source_label', value)} />
      </div>
      <ValuationText required maxLength={500} label={t('sold.source_reference')} value={details.source_reference} change={value => patch('source_reference', value)} />
      {invalid && <p role="alert" className={valuationError}>{t('errors.validation')}</p>}
      <button className={valuationPrimary} type="submit">{t('sold.save')}</button>
    </fieldset>
  </form>
}

export function ValuationEvidence({ comparables, disabled, onAsking, onSold, onSoldReview, onRemove }: {
  comparables: ValuationComparable[]; disabled: boolean
  onAsking: () => void; onSold: () => void
  onSoldReview: (id: string, decision: 'verified' | 'rejected') => void; onRemove: (id: string) => void
}) {
  const { t } = useTranslation('seller_valuation')
  return <section className={valuationPanel}>
    <h2 className="text-lg font-bold text-ink">{t('evidence.heading')}</h2>
    <p className="text-sm text-ink2">{t('evidence.intro')}</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" className={valuationButton} disabled={disabled} onClick={onAsking}>{t('asking.open')}</button>
      <button type="button" className={valuationButton} disabled={disabled} onClick={onSold}>{t('sold.open')}</button>
    </div>
    {comparables.length ? <ul className="min-w-0 space-y-2">
      {comparables.map(item => <li key={item.id} className="min-w-0 space-y-2 rounded-lg border border-line bg-paper p-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 className="break-words text-sm font-bold text-ink">{item.title || item.source_label || t('sold.label')}</h3>
          <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-ink2">
            {item.kind === 'asking' ? t('evidence.asking') : t(`sold.state.${item.sold_review?.decision ?? 'pending'}`)}
          </span>
        </div>
        <ValuationFactsSummary facts={item} />
        <div className="flex flex-wrap items-center gap-2 text-sm text-ink2">
          <ValuationPrice amount={item.price} currency={item.currency} />
          {item.kind === 'asking'
            ? <span>{t('evidence.captured')} <NetworkDate value={item.captured_at} showTime /></span>
            : item.closed_on && <span>{t('sold.closed_on')} <NetworkDate value={item.closed_on} /></span>}
        </div>
        {item.source_reference && <p className="whitespace-pre-wrap [overflow-wrap:anywhere] text-sm text-ink2">{item.source_reference}</p>}
        {item.sold_review && <p className="break-words text-sm text-ink2">
          <NetworkDate value={item.sold_review.reviewed_at} showTime /> {item.sold_review.review_note}
        </p>}
        <div className="flex flex-wrap gap-2">
          {item.kind === 'sold' && <>
            <button type="button" className={valuationButton} disabled={disabled || item.sold_review?.decision === 'verified'}
              onClick={() => onSoldReview(item.id, 'verified')}>{t('sold.verify')}</button>
            <button type="button" className={valuationButton} disabled={disabled || item.sold_review?.decision === 'rejected'}
              onClick={() => onSoldReview(item.id, 'rejected')}>{t('sold.reject')}</button>
          </>}
          <button type="button" className={valuationButton} disabled={disabled} onClick={() => onRemove(item.id)}>{t('evidence.remove')}</button>
        </div>
      </li>)}
    </ul> : <p className="text-sm text-ink2">{t('evidence.empty')}</p>}
  </section>
}
