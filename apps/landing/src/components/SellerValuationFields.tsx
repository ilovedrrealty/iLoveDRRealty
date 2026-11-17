'use client'

import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import {
  VALUATION_CONDITIONS, VALUATION_LOCATION_LIMIT, VALUATION_PROPERTY_TYPES, type SellerValuationFields as Draft,
} from '../data/sellerValuation'

export function SellerValuationFields({ draft, onChange, fieldClass, disabled }: {
  draft: Draft
  onChange: (key: keyof Draft, value: string) => void
  fieldClass: string
  disabled: boolean
}) {
  const { t } = useTranslation('get_started', { keyPrefix: 'valuation' })
  const locationHint = useId()
  const areaHint = useId()
  const fields = `${fieldClass} min-w-0`
  const label = 'block min-w-0 text-sm font-semibold text-ink'
  return <fieldset disabled={disabled} className="min-w-0 space-y-4 border-b border-line-soft pb-4">
    <legend className="mb-2 text-sm font-bold text-ink">{t('fields_heading')}</legend>
    <label className={label}>{t('property_type')}
      <select name="valuation-property-type" required className={fields} value={draft.property_type} onChange={event => onChange('property_type', event.target.value)}>
        <option value="" disabled>{t('choose_type')}</option>
        {VALUATION_PROPERTY_TYPES.map(value => <option key={value} value={value}>{t(`types.${value}`)}</option>)}
      </select>
    </label>
    <div>
      <label className={label}>{t('location')}
        <input name="valuation-location" autoComplete="off" required minLength={2} maxLength={VALUATION_LOCATION_LIMIT} aria-describedby={locationHint}
          className={fields} value={draft.location} onChange={event => onChange('location', event.target.value)} />
      </label>
      <p id={locationHint} className="mt-1 text-xs text-ink2">{t('location_hint')}</p>
    </div>
    <div>
      <label className={label}>{t('area_m2')}
        <input name="valuation-area" inputMode="decimal" maxLength={12} aria-describedby={areaHint}
          className={fields} value={draft.area_m2} onChange={event => onChange('area_m2', event.target.value)} />
      </label>
      <p id={areaHint} className="mt-1 text-xs text-ink2">{t('area_hint')}</p>
    </div>
    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
      <label className={label}>{t('bedrooms')}
        <input name="valuation-bedrooms" inputMode="numeric" maxLength={4}
          className={fields} value={draft.bedrooms} onChange={event => onChange('bedrooms', event.target.value)} />
      </label>
      <label className={label}>{t('bathrooms')}
        <input name="valuation-bathrooms" inputMode="decimal" maxLength={6}
          className={fields} value={draft.bathrooms} onChange={event => onChange('bathrooms', event.target.value)} />
      </label>
    </div>
    <label className={label}>{t('condition')}
      <select name="valuation-condition" className={fields} value={draft.condition} onChange={event => onChange('condition', event.target.value)}>
        <option value="">{t('choose_condition')}</option>
        {VALUATION_CONDITIONS.map(value => <option key={value} value={value}>{t(`conditions.${value}`)}</option>)}
      </select>
    </label>
  </fieldset>
}
