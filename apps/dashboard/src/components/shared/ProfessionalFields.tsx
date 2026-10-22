import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { ProfessionalOption } from '../../../../../packages/professionals/src'
import { professionalLabel } from '../../../../../packages/professionals/src'

export const professionalInput = 'w-full min-w-0 rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink focus:outline-2 focus:outline-coral disabled:opacity-60'
export const professionalButton = 'inline-flex items-center justify-center rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink hover:border-coral focus-visible:outline-2 focus-visible:outline-coral disabled:opacity-50 disabled:cursor-not-allowed'
export const professionalPrimary = `${professionalButton} !bg-coral !text-white !border-coral`

export function ProfessionalField({ label, value, onChange, type = 'text', maxLength = 120 }: { label: string; value: string; onChange: (value: string) => void; type?: string; maxLength?: number }) {
  const id = useId()
  return <div className="min-w-0 text-sm font-semibold text-ink">
    <label htmlFor={id} className="block mb-1.5">{label}</label>
    <input id={id} className={professionalInput} type={type} value={value} maxLength={maxLength} onChange={event => onChange(event.target.value)} />
  </div>
}

export function ProfessionalChoices({ title, values, options, max, onChange }: { title: string; values: string[]; options: ProfessionalOption[]; max: number; onChange: (values: string[]) => void }) {
  const { t, i18n } = useTranslation('professionals')
  const id = useId()
  return <fieldset className="min-w-0 rounded-xl border border-line p-4">
    <legend className="px-1 text-sm font-bold text-ink">{title}</legend>
    <p className="text-xs text-dim mb-3">{t('multi_help', { count: max })}</p>
    <div className="max-h-60 overflow-y-auto grid sm:grid-cols-2 gap-x-4 gap-y-2">
      {options.map(option => <label key={option.id} htmlFor={`${id}-${option.id}`} className="flex items-start gap-2 text-sm text-ink2">
        <input id={`${id}-${option.id}`} type="checkbox" className="mt-1 shrink-0 accent-coral" checked={values.includes(option.id)} disabled={!values.includes(option.id) && values.length >= max}
          onChange={event => onChange(event.target.checked ? [...values, option.id] : values.filter(id => id !== option.id))} />
        <span>{professionalLabel(option.label, i18n.language)}</span>
      </label>)}
    </div>
  </fieldset>
}
