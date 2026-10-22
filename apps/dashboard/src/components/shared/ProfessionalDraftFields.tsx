import { useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { ProfessionalDraft, ProfessionalOptions } from '../../../../../packages/professionals/src'
import { ProfessionalChoices, ProfessionalField, professionalButton, professionalInput } from './ProfessionalFields'
import { ProfessionalServices, type ProfessionalDraftChange } from './ProfessionalServices'

export function ProfessionalDraftFields({ draft, options, onChange, onUpload, uploading, adminManaged = false, canUpload = true }: {
  draft: ProfessionalDraft; options: ProfessionalOptions; onChange: ProfessionalDraftChange;
  onUpload: (file?: File) => void; uploading: boolean; adminManaged?: boolean; canUpload?: boolean;
}) {
  const { t } = useTranslation('professionals')
  const fileRef = useRef<HTMLInputElement>(null)
  const fieldId = useId()
  return <>
        <section className="space-y-4 rounded-2xl border border-line bg-white p-4 sm:p-6">
          <h2 className="text-lg font-bold text-ink">{t('details_heading')}</h2>
          <p className="text-xs text-dim">{t('name_help')}</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <ProfessionalField label={t('business_name')} value={draft.business_name} onChange={value => onChange('business_name', value)} maxLength={120} />
            <ProfessionalField label={t('contact_name')} value={draft.contact_name} onChange={value => onChange('contact_name', value)} maxLength={100} />
          </div>
          {draft.category_ids.includes('real_estate_agent') && <p className="text-sm text-ink2">{t('company_help')}</p>}
          <ProfessionalServices draft={draft} options={options} onChange={onChange} />
          <ProfessionalChoices title={t('areas')} values={draft.service_area_ids} options={options.areas} max={20} onChange={value => onChange('service_area_ids', value)} />
          <ProfessionalChoices title={t('languages')} values={draft.languages} options={options.languages} max={8} onChange={value => onChange('languages', value)} />
          <p className="text-xs text-dim">{t('description_help')}</p>
          <div className="grid lg:grid-cols-2 gap-4">{(['en', 'es'] as const).map(language => <div key={language} className="min-w-0 text-sm font-semibold text-ink">
            <label htmlFor={`${fieldId}-description-${language}`} className="block mb-1.5">{t(`description_${language}`)}</label>
            <textarea id={`${fieldId}-description-${language}`} rows={6} maxLength={4000} className={professionalInput} value={draft.descriptions[language]} onChange={event => onChange('descriptions', { ...draft.descriptions, [language]: event.target.value })} />
          </div>)}</div>
        </section>
        <section className="space-y-4 rounded-2xl border border-line bg-white p-4 sm:p-6">
          <h2 className="text-lg font-bold text-ink">{t('contacts_heading')}</h2>
          <p className="text-sm text-ink2">{t(adminManaged ? 'managed_consent_help' : 'consent_help')}</p>
          <p className="text-xs text-dim">{t(adminManaged ? 'managed_contact_help' : 'contact_help')}</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <ProfessionalField label={t('public_phone')} type="tel" value={draft.public_phone} maxLength={30} onChange={value => onChange('public_phone', value)} />
            <ProfessionalField label={t('public_whatsapp')} type="tel" value={draft.public_whatsapp} maxLength={30} onChange={value => onChange('public_whatsapp', value)} />
            <ProfessionalField label={t('public_email')} type="email" value={draft.public_email} maxLength={254} onChange={value => onChange('public_email', value)} />
            <ProfessionalField label={t('website_url')} type="url" value={draft.website_url} maxLength={2048} onChange={value => onChange('website_url', value)} />
          </div>
          <label htmlFor={`${fieldId}-consent`} className="flex items-start gap-3 text-sm text-ink2"><input id={`${fieldId}-consent`} className="mt-1 shrink-0 accent-coral" type="checkbox" checked={draft.public_contact_consent} onChange={event => onChange('public_contact_consent', event.target.checked)} /><span>{t(adminManaged ? 'managed_consent' : 'consent')}</span></label>
          <p className="text-xs font-semibold text-amber-800">{t('revoke_help')}</p>
        </section>
        <section className="space-y-3 rounded-2xl border border-line bg-white p-4 sm:p-6">
          <h2 className="text-lg font-bold text-ink">{t('photo_heading')}</h2><p className="text-xs text-dim">{t('photo_help')}</p>
          {adminManaged && !canUpload && <p className="text-xs text-dim">{t('managed_photo_save_first')}</p>}
          {draft.photo_url && <img src={draft.photo_url} alt="" className="h-28 w-28 rounded-xl object-cover" />}
          <div className="flex flex-wrap gap-3">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label={t('photo_upload')} disabled={!canUpload} onChange={event => { onUpload(event.target.files?.[0]); event.currentTarget.value = '' }} />
            <button type="button" className={professionalButton} disabled={!canUpload} onClick={() => fileRef.current?.click()}>{t(uploading ? 'photo_uploading' : 'photo_upload')}</button>
            {draft.photo_url && <button type="button" className={professionalButton} onClick={() => onChange('photo_url', '')}>{t('photo_remove')}</button>}
          </div>
        </section>
  </>
}
