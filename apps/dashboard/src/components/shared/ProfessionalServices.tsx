import { useTranslation } from 'react-i18next'
import type { ProfessionalDraft, ProfessionalOptions } from '../../../../../packages/professionals/src'
import { ProfessionalChoices, ProfessionalField, professionalButton } from './ProfessionalFields'

export type ProfessionalDraftChange = <K extends keyof ProfessionalDraft>(key: K, value: ProfessionalDraft[K]) => void

export function ProfessionalServices({ draft, options, onChange }: { draft: ProfessionalDraft; options: ProfessionalOptions; onChange: ProfessionalDraftChange }) {
  const { t } = useTranslation('professionals')
  const services = draft.custom_services ?? []
  return <div className="space-y-4">
    <ProfessionalChoices title={t('categories')} values={draft.category_ids} options={options.categories} max={8} onChange={values => {
      onChange('category_ids', values)
      if (!values.includes('other_services') && services.length) onChange('custom_services', [])
      else if (values.includes('other_services') && !draft.category_ids.includes('other_services') && !services.length) onChange('custom_services', [''])
    }} />
    {draft.category_ids.includes('other_services') && <fieldset className="min-w-0 rounded-xl border border-line p-4 space-y-3">
      <legend className="px-1 text-sm font-bold text-ink">{t('custom_services')}</legend>
      <p className="text-xs text-dim">{t('custom_services_help')}</p>
      {services.map((value, index) => <div className="flex items-end gap-2 min-w-0" key={index}>
        <div className="min-w-0 flex-1"><ProfessionalField label={t('custom_service_number', { number: index + 1 })} value={value} maxLength={80} onChange={next => onChange('custom_services', services.map((service, at) => at === index ? next : service))} /></div>
        <button type="button" className={professionalButton} aria-label={t('custom_service_remove_number', { number: index + 1 })} onClick={() => onChange('custom_services', services.filter((_, at) => at !== index))}>{t('remove')}</button>
      </div>)}
      <button type="button" className={professionalButton} disabled={services.length >= 8} onClick={() => onChange('custom_services', [...services, ''])}>{t('custom_service_add')}</button>
    </fieldset>}
  </div>
}
