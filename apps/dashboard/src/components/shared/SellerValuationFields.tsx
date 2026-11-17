import type { ComponentPropsWithoutRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  VALUATION_CONDITIONS, VALUATION_PROPERTY_TYPES, type ValuationCondition, type ValuationCurrency,
  type ValuationPropertyFacts, type ValuationPropertyType, type ValuationSubject,
} from '../../api/sellerValuation'
import { editorButton, editorInput } from '../../pages/admin/WebsiteEditorFields'

export const valuationGrid = 'grid min-w-0 gap-3 sm:grid-cols-2'
export const valuationButton = `${editorButton} min-h-11`
export const valuationPrimary = 'min-h-11 rounded-lg border border-sea bg-sea px-4 py-2 text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral disabled:opacity-50'
export const valuationPanel = 'min-w-0 space-y-4 rounded-xl border border-line bg-white p-4 sm:p-5'
export const valuationError = 'rounded-lg bg-red-50 p-3 text-sm text-red-800'
const labelStyle = 'block min-w-0 text-sm font-semibold text-ink2'
const fieldStyle = `${editorInput} min-h-11`

export type PropertyFactFields = {
  property_type: ValuationPropertyType | ''
  location: string
  area_m2: string
  bedrooms: string
  bathrooms: string
}
export type SubjectFields = PropertyFactFields & { condition: ValuationCondition | '' }

export function subjectToFields(subject: ValuationSubject): SubjectFields {
  return {
    property_type: subject.property_type ?? '', location: subject.location ?? '', area_m2: subject.area_m2 ?? '',
    bedrooms: subject.bedrooms === null ? '' : String(subject.bedrooms), bathrooms: subject.bathrooms ?? '',
    condition: subject.condition ?? '',
  }
}

export function factsFromFields(fields: PropertyFactFields): ValuationPropertyFacts {
  return {
    property_type: fields.property_type || null,
    location: fields.location.trim() || null,
    area_m2: fields.area_m2 || null,
    bedrooms: fields.bedrooms === '' ? null : Number(fields.bedrooms),
    bathrooms: fields.bathrooms || null,
  }
}

type InputProps = Omit<ComponentPropsWithoutRef<'input'>, 'value' | 'onChange'> & {
  label: string; value: string; change: (value: string) => void
}
export function ValuationInput({ label, value, change, ...props }: InputProps) {
  return <label className={labelStyle}>
    <span className="mb-1 block">{label}</span>
    <input {...props} className={fieldStyle} value={value} onChange={event => change(event.target.value)} />
  </label>
}

export function ValuationText({ label, value, change, maxLength, required }: {
  label: string; value: string; change: (value: string) => void; maxLength: number; required?: boolean
}) {
  return <label className={labelStyle}>
    <span className="mb-1 block">{label}</span>
    <textarea className={fieldStyle} rows={3} value={value} onChange={event => change(event.target.value)} maxLength={maxLength} required={required} />
  </label>
}

export function ValuationPropertyTypeField({ value, change, required }: {
  value: PropertyFactFields['property_type']; change: (value: PropertyFactFields['property_type']) => void; required?: boolean
}) {
  const { t } = useTranslation('seller_valuation')
  return <label className={labelStyle}>
    <span className="mb-1 block">{t('fields.property_type')}</span>
    <select className={fieldStyle} required={required} value={value} onChange={event => change(event.target.value as PropertyFactFields['property_type'])}>
      <option value="">{t('fields.choose_type')}</option>
      {VALUATION_PROPERTY_TYPES.map(type => <option key={type} value={type}>{t(`property_types.${type}`)}</option>)}
    </select>
  </label>
}

export function ValuationFacts({ fields, change, required }: {
  fields: PropertyFactFields; change: (fields: PropertyFactFields) => void; required?: boolean
}) {
  const { t } = useTranslation('seller_valuation')
  return <div className={valuationGrid}>
    <ValuationPropertyTypeField value={fields.property_type} required={required} change={property_type => change({ ...fields, property_type })} />
    <ValuationInput label={t('fields.location')} value={fields.location} required={required} minLength={2} maxLength={80} autoComplete="off"
      change={location => change({ ...fields, location })} />
    <ValuationInput type="number" inputMode="decimal" min="0.01" max="99999999.99" step="0.01"
      label={t('fields.area')} value={fields.area_m2} change={area_m2 => change({ ...fields, area_m2 })} />
    <ValuationInput type="number" inputMode="numeric" min="0" max="1000" step="1"
      label={t('fields.bedrooms')} value={fields.bedrooms} change={bedrooms => change({ ...fields, bedrooms })} />
    <ValuationInput type="number" inputMode="decimal" min="0" max="1000" step="0.5"
      label={t('fields.bathrooms')} value={fields.bathrooms} change={bathrooms => change({ ...fields, bathrooms })} />
  </div>
}

export function ValuationSubjectFacts({ fields, change }: {
  fields: SubjectFields; change: (fields: SubjectFields) => void
}) {
  const { t } = useTranslation('seller_valuation')
  return <>
    <ValuationFacts fields={fields} change={facts => change({ ...fields, ...facts })} />
    <div className={valuationGrid}>
      <label className={labelStyle}>
        <span className="mb-1 block">{t('fields.condition')}</span>
        <select className={fieldStyle} value={fields.condition} onChange={event => change({ ...fields, condition: event.target.value as SubjectFields['condition'] })}>
          <option value="">{t('fields.choose_condition')}</option>
          {VALUATION_CONDITIONS.map(condition => <option key={condition} value={condition}>{t(`conditions.${condition}`)}</option>)}
        </select>
      </label>
    </div>
  </>
}

export function ValuationMoney({ label, value, change }: { label: string; value: string; change: (value: string) => void }) {
  return <ValuationInput label={label} value={value} change={change} type="number" inputMode="decimal"
    min="0.01" max="9999999999.99" step="0.01" required />
}

export function ValuationCurrencyField({ value, change }: { value: ValuationCurrency | ''; change: (value: ValuationCurrency | '') => void }) {
  const { t } = useTranslation('seller_valuation')
  return <label className={labelStyle}>
    <span className="mb-1 block">{t('fields.currency')}</span>
    <select className={fieldStyle} value={value} required onChange={event => change(event.target.value as ValuationCurrency | '')}>
      <option value="">{t('fields.choose_currency')}</option><option value="USD">USD</option><option value="DOP">DOP</option>
    </select>
  </label>
}

export function ValuationPrice({ amount, currency }: { amount: string; currency: ValuationCurrency }) {
  const { i18n } = useTranslation('seller_valuation')
  return <>{new Intl.NumberFormat(i18n.language.startsWith('es') ? 'es-DO' : 'en-US', {
    style: 'currency', currency, currencyDisplay: 'code', minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(Number(amount))}</>
}

export function ValuationFactsSummary({ facts }: { facts: ValuationPropertyFacts }) {
  const { t, i18n } = useTranslation('seller_valuation')
  const locale = i18n.language.startsWith('es') ? 'es-DO' : 'en-US'
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 })
  const values = [
    facts.property_type ? t(`property_types.${facts.property_type}`) : '',
    facts.location,
    facts.area_m2 !== null ? t('facts.area', { value: number.format(Number(facts.area_m2)) }) : '',
    facts.bedrooms !== null ? t('facts.bedrooms', { value: facts.bedrooms }) : '',
    facts.bathrooms !== null ? t('facts.bathrooms', { value: number.format(Number(facts.bathrooms)) }) : '',
  ].filter(Boolean)
  return values.length ? <p className="break-words text-sm text-ink2">{values.join(' · ')}</p> : null
}
