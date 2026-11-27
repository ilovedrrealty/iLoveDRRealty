import { useTranslation } from 'react-i18next'
import { professionalOptionLabels, type ProfessionalDraft, type ProfessionalOptions } from '../../../../../packages/professionals/src'
import { ProfessionalChoices } from './ProfessionalFields'
import type { ProfessionalDraftChange } from './ProfessionalServices'

export function ProfessionalFacetChoices({ draft, options, onChange }: { draft: ProfessionalDraft; options: ProfessionalOptions; onChange: ProfessionalDraftChange }) {
  const { t } = useTranslation('professionals')
  return <section className="min-w-0 space-y-4" aria-label={t('facets.heading')}>
    <h3 className="text-base font-bold text-ink">{t('facets.heading')}</h3>
    <p className="text-sm leading-relaxed text-ink2">{t('facets.declared_help')}</p>
    <ProfessionalChoices title={t('facets.provider_kinds')} values={draft.provider_kind_ids ?? []} options={options.provider_kinds ?? []} max={10} onChange={values => onChange('provider_kind_ids', values)} />
    <ProfessionalChoices title={t('facets.property_classes')} values={draft.property_class_ids ?? []} options={options.property_classes ?? []} max={10} onChange={values => onChange('property_class_ids', values)} />
    <ProfessionalChoices title={t('facets.work_scopes')} values={draft.work_scope_ids ?? []} options={options.work_scopes ?? []} max={12} onChange={values => onChange('work_scope_ids', values)} />
  </section>
}

export function ProfessionalFacetSummary({ profile, options }: { profile: Pick<ProfessionalDraft, 'provider_kind_ids' | 'property_class_ids' | 'work_scope_ids'>; options: ProfessionalOptions }) {
  const { t, i18n } = useTranslation('professionals')
  const fields = [
    ['provider_kind_ids', 'facets.provider_kinds', options.provider_kinds ?? []],
    ['property_class_ids', 'facets.property_classes', options.property_classes ?? []],
    ['work_scope_ids', 'facets.work_scopes', options.work_scopes ?? []],
  ] as const
  return <div className="space-y-2 text-xs text-ink2">
    <dl className="space-y-2">{fields.map(([field, label, choices]) => <div key={field} className="min-w-0 [overflow-wrap:anywhere]">
      <dt className="font-semibold">{t(label)}</dt>
      <dd>{professionalOptionLabels(profile[field] ?? [], choices, i18n.language).join(' · ') || t('facets.not_specified')}</dd>
    </div>)}</dl>
    <p className="text-dim">{t('facets.declared_note')}</p>
  </div>
}
