import { useId, useState, type ComponentPropsWithoutRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DEVELOPMENT_UNIT_STATUSES, type DevelopmentCurrency, type DevelopmentDraft, type DevelopmentDraftUnit,
  type DevelopmentPaymentStage, type DevelopmentPhase, type DevelopmentUnitStatus, type DevelopmentUpdate,
} from '../../api/developments'
import { editorButton, editorInput, TextField } from '../../pages/admin/WebsiteEditorFields'

const panel = 'min-w-0 space-y-3 rounded-xl border border-line bg-white p-4'
const nested = 'min-w-0 space-y-3 rounded-xl border border-line bg-paper p-3 sm:p-4'
const columns = 'grid min-w-0 gap-3 sm:grid-cols-2'
const legend = 'max-w-full break-words px-1 text-base font-semibold text-ink'
const unitPageSize = 25
const singleLineLimit = 160
const paragraphLimit = 1600

function replaceAt<T>(items: T[], index: number, value: T): T[] {
  return items.map((item, position) => position === index ? value : item)
}
function removeAt<T>(items: T[], index: number): T[] {
  return items.filter((_, position) => position !== index)
}

type InputProps = Omit<ComponentPropsWithoutRef<'input'>, 'onChange' | 'value'> & {
  label: string
  value: string | null
  onChange: (value: string) => void
}

function InputField({ label, value, onChange, ...props }: InputProps) {
  return <label className="block min-w-0 text-sm font-medium text-ink2">
    <span className="mb-1 block">{label}</span>
    <input {...props} className={editorInput} value={value ?? ''} onChange={event => onChange(event.target.value)} />
  </label>
}

function TranslatedPair({ label, en, es, onChange, multiline = false }: {
  label: string; en: string; es: string; multiline?: boolean
  onChange: (language: 'en' | 'es', value: string) => void
}) {
  const { t } = useTranslation('development_inventory', { keyPrefix: 'fields' })
  return <div className={columns}>{(['en', 'es'] as const).map(language =>
    <TextField key={language} label={t('with_language', { label, language: t(`languages.${language}`) })}
      value={language === 'en' ? en : es} onChange={text => onChange(language, text)}
      multiline={multiline} maxLength={multiline ? paragraphLimit : singleLineLimit} />,
  )}</div>
}

function DeliveryField({ value, onChange }: { value: string | null; onChange: (value: string | null) => void }) {
  const { t } = useTranslation('development_inventory', { keyPrefix: 'fields' })
  const hint = useId()
  return <div>
    <InputField label={t('target_delivery')} value={value} maxLength={10}
      pattern="[0-9]{4}(-(Q[1-4]|[0-9]{2}(-[0-9]{2})?))?"
      aria-describedby={hint} onChange={text => onChange(text || null)} />
    <p id={hint} className="mt-1 text-xs text-dim">{t('delivery_hint')}</p>
  </div>
}

function CurrencyField({ currency, disabled, onChange }: {
  currency: DevelopmentCurrency | null; disabled?: boolean; onChange: (currency: DevelopmentCurrency | null) => void
}) {
  const { t } = useTranslation('development_inventory', { keyPrefix: 'fields' })
  return <label className="block min-w-0 text-sm font-medium text-ink2">
    <span className="mb-1 block">{t('currency')}</span>
    <select className={editorInput} value={currency ?? ''} disabled={disabled} onChange={event => {
      const value = event.target.value
      onChange(value === 'USD' || value === 'DOP' ? value : null)
    }}>
      <option value="">{t('no_currency')}</option>
      <option value="USD">USD</option>
      <option value="DOP">DOP</option>
    </select>
  </label>
}

function canApproveFloorPlan(value: string | null): boolean {
  if (!value || !value.startsWith('https://') || /[\s\\]/.test(value)) return false
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.hash) return false
    const parameters = [...url.searchParams.keys()]
    return parameters.length <= 16 && parameters.every(key => !/^(?:key$|x-amz-|x-goog-)|token|secret|signature|credential|password|auth|session|apikey/i.test(key))
  } catch {
    return false
  }
}

function UnitFields({ unit, number, change, remove }: {
  unit: DevelopmentDraftUnit; number: number; change: (value: DevelopmentDraftUnit) => void; remove: () => void
}) {
  const { t } = useTranslation('development_inventory', { keyPrefix: 'fields' })
  return <fieldset className={nested}>
    <legend className={legend}>{t('unit', { number })}</legend>
    <div className={columns}>
      <InputField label={t('unit_code')} value={unit.code} maxLength={60} required onChange={code => change({ ...unit, code })} />
      <InputField label={t('floor')} value={unit.floor} maxLength={60} onChange={floor => change({ ...unit, floor: floor || null })} />
      <InputField label={t('size')} value={unit.area_m2} type="number" inputMode="decimal" min="0.01" max="99999999.99" step="0.01"
        onChange={area_m2 => change({ ...unit, area_m2: area_m2 || null })} />
      <label className="block min-w-0 text-sm font-medium text-ink2">
        <span className="mb-1 block">{t('status')}</span>
        <select className={editorInput} value={unit.status} onChange={event => change({ ...unit, status: event.target.value as DevelopmentUnitStatus })}>
          {DEVELOPMENT_UNIT_STATUSES.map(status => <option key={status} value={status}>{t(`statuses.${status}`)}</option>)}
        </select>
      </label>
      <InputField label={t('price')} value={unit.price} type="number" inputMode="decimal" min="0.01" max="9999999999.99" step="0.01"
        onChange={price => change({ ...unit, price: price || null, currency: price ? unit.currency : null })} />
      <CurrencyField currency={unit.currency} onChange={currency => change({ ...unit, currency })} />
    </div>
    <InputField label={t('floor_plan')} value={unit.floor_plan_url} type="url" maxLength={800} pattern="https://.+"
      onChange={value => change({ ...unit, floor_plan_url: value || null, floor_plan_approved: false })} />
    <label className="flex min-h-10 items-center gap-2 text-sm font-medium text-ink2">
      <input type="checkbox" className="size-4 shrink-0 accent-coral" disabled={!canApproveFloorPlan(unit.floor_plan_url)}
        checked={unit.floor_plan_approved} onChange={event => change({ ...unit, floor_plan_approved: event.target.checked })} />
      {t('floor_plan_approved')}
    </label>
    <button type="button" className={editorButton} onClick={remove}>{t('remove_unit')}</button>
  </fieldset>
}

function PhaseFields({ phase, number, totalUnits, change, remove }: {
  phase: DevelopmentPhase<DevelopmentDraftUnit>; number: number; totalUnits: number
  change: (value: DevelopmentPhase<DevelopmentDraftUnit>) => void; remove: () => void
}) {
  const { t } = useTranslation('development_inventory', { keyPrefix: 'fields' })
  const [selectedPage, setPage] = useState(0)
  const lastPage = Math.max(0, Math.ceil(phase.units.length / unitPageSize) - 1)
  const page = Math.min(selectedPage, lastPage)
  const start = page * unitPageSize
  function addUnit() {
    setPage(Math.floor(phase.units.length / unitPageSize))
    change({ ...phase, units: [...phase.units, {
      code: '', floor: null, area_m2: null, price: null, currency: null, status: 'unconfirmed', floor_plan_url: null, floor_plan_approved: false,
    }] })
  }
  return <fieldset className={nested}>
    <legend className={legend}>{t('phase', { number })}</legend>
    <div className={columns}>
      <InputField label={t('phase_code')} value={phase.code} maxLength={60} required onChange={code => change({ ...phase, code })} />
      <DeliveryField value={phase.target_delivery} onChange={target_delivery => change({ ...phase, target_delivery })} />
    </div>
    <TranslatedPair label={t('phase_name')} en={phase.name_en} es={phase.name_es}
      onChange={(language, value) => change({ ...phase, [`name_${language}`]: value })} />
    {lastPage > 0 && <div className="flex flex-wrap items-center gap-2 text-xs text-ink2">
      <button type="button" className={editorButton} disabled={page === 0} onClick={() => setPage(page - 1)}>{t('previous')}</button>
      <p role="status">{t('unit_page', { start: start + 1, end: Math.min(start + unitPageSize, phase.units.length), total: phase.units.length })}</p>
      <button type="button" className={editorButton} disabled={page === lastPage} onClick={() => setPage(page + 1)}>{t('next')}</button>
    </div>}
    {phase.units.slice(start, start + unitPageSize).map((unit, position) => {
      const index = start + position
      return <UnitFields key={index} unit={unit} number={index + 1}
        change={value => change({ ...phase, units: replaceAt(phase.units, index, value) })}
        remove={() => change({ ...phase, units: removeAt(phase.units, index) })} />
    })}
    <div className="flex flex-wrap gap-2">
      <button type="button" className={editorButton} disabled={totalUnits >= 500} onClick={addUnit}>{t('add_unit')}</button>
      <button type="button" className={editorButton} onClick={remove}>{t('remove_phase')}</button>
    </div>
  </fieldset>
}

function PaymentFields({ stage, number, change, remove }: {
  stage: DevelopmentPaymentStage; number: number; change: (value: DevelopmentPaymentStage) => void; remove: () => void
}) {
  const { t } = useTranslation('development_inventory', { keyPrefix: 'fields' })
  const hasPercent = stage.percent !== null
  const hasAmount = stage.amount !== null || stage.currency !== null
  return <fieldset className={nested}>
    <legend className={legend}>{t('payment', { number })}</legend>
    <TranslatedPair label={t('payment_label')} en={stage.label_en} es={stage.label_es}
      onChange={(language, value) => change({ ...stage, [`label_${language}`]: value })} />
    <TranslatedPair label={t('payment_due')} en={stage.due_en} es={stage.due_es}
      onChange={(language, value) => change({ ...stage, [`due_${language}`]: value })} />
    <InputField label={t('payment_date')} value={stage.due_date} type="date" onChange={due_date => change({ ...stage, due_date: due_date || null })} />
    <p className="text-xs text-dim">{t('payment_hint')}</p>
    <div className="grid min-w-0 gap-3 sm:grid-cols-3">
      <InputField label={t('payment_percent')} value={stage.percent} disabled={hasAmount} type="number" inputMode="decimal"
        min="0" max="100" step="0.01" onChange={percent => change({ ...stage, percent: percent || null })} />
      <InputField label={t('payment_amount')} value={stage.amount} disabled={hasPercent} type="number" inputMode="decimal"
        min="0.01" max="9999999999.99" step="0.01"
        onChange={amount => change({ ...stage, amount: amount || null, currency: amount ? stage.currency : null })} />
      <CurrencyField currency={stage.currency} disabled={hasPercent} onChange={currency => change({ ...stage, currency })} />
    </div>
    <button type="button" className={editorButton} onClick={remove}>{t('remove_payment')}</button>
  </fieldset>
}

function UpdateFields({ update, number, change, remove }: {
  update: DevelopmentUpdate; number: number; change: (value: DevelopmentUpdate) => void; remove: () => void
}) {
  const { t } = useTranslation('development_inventory', { keyPrefix: 'fields' })
  return <fieldset className={nested}>
    <legend className={legend}>{t('update', { number })}</legend>
    <InputField label={t('update_date')} value={update.date} type="date" required onChange={date => change({ ...update, date })} />
    <TranslatedPair label={t('update_title')} en={update.title_en} es={update.title_es}
      onChange={(language, value) => change({ ...update, [`title_${language}`]: value })} />
    <TranslatedPair label={t('update_text')} en={update.text_en} es={update.text_es} multiline
      onChange={(language, value) => change({ ...update, [`text_${language}`]: value })} />
    <button type="button" className={editorButton} onClick={remove}>{t('remove_update')}</button>
  </fieldset>
}

export function DevelopmentInventoryFields({ draft, onChange, disabled }: {
  draft: DevelopmentDraft; onChange: (value: DevelopmentDraft) => void; disabled: boolean
}) {
  const { t } = useTranslation('development_inventory', { keyPrefix: 'fields' })
  const { project, evidence } = draft
  const totalUnits = project.phases.reduce((count, phase) => count + phase.units.length, 0)
  const changeProject = (patch: Partial<typeof project>) => onChange({ ...draft, project: { ...project, ...patch } })
  const changeEvidence = (patch: Partial<typeof evidence>) => onChange({ ...draft, evidence: { ...evidence, ...patch } })

  return <fieldset disabled={disabled} className="min-w-0 space-y-4">
    <fieldset className={panel}>
      <legend className={legend}>{t('project')}</legend>
      <TranslatedPair label={t('project_name')} en={project.name_en} es={project.name_es}
        onChange={(language, value) => changeProject({ [`name_${language}`]: value })} />
      <TranslatedPair label={t('summary')} en={project.summary_en} es={project.summary_es} multiline
        onChange={(language, value) => changeProject({ [`summary_${language}`]: value })} />
      <DeliveryField value={project.target_delivery} onChange={target_delivery => changeProject({ target_delivery })} />
    </fieldset>
    <fieldset className={panel}>
      <legend className={legend}>{t('evidence')}</legend>
      <TextField label={t('source_reference')} value={evidence.source_reference} multiline maxLength={1200}
        onChange={source_reference => changeEvidence({ source_reference })} />
      <div className={columns}>
        <InputField label={t('verified_on')} value={evidence.verified_on} type="date"
          onChange={verified_on => changeEvidence({ verified_on: verified_on || null })} />
        <InputField label={t('valid_through')} value={evidence.availability_valid_through} type="date" min={evidence.verified_on ?? undefined}
          onChange={availability_valid_through => changeEvidence({ availability_valid_through: availability_valid_through || null })} />
      </div>
      <TextField label={t('private_note')} value={evidence.private_note} multiline maxLength={2000}
        onChange={private_note => changeEvidence({ private_note })} />
    </fieldset>
    <fieldset className={panel}>
      <legend className={legend}>{t('phases')}</legend>
      {project.phases.map((phase, index) => <PhaseFields key={index} phase={phase} number={index + 1} totalUnits={totalUnits}
        change={value => changeProject({ phases: replaceAt(project.phases, index, value) })}
        remove={() => changeProject({ phases: removeAt(project.phases, index) })} />)}
      <button type="button" className={editorButton} disabled={project.phases.length >= 20}
        onClick={() => changeProject({ phases: [...project.phases, { code: '', name_en: '', name_es: '', target_delivery: null, units: [] }] })}>
        {t('add_phase')}
      </button>
    </fieldset>
    <fieldset className={panel}>
      <legend className={legend}>{t('payments')}</legend>
      {project.payment_stages.map((stage, index) => <PaymentFields key={index} stage={stage} number={index + 1}
        change={value => changeProject({ payment_stages: replaceAt(project.payment_stages, index, value) })}
        remove={() => changeProject({ payment_stages: removeAt(project.payment_stages, index) })} />)}
      <button type="button" className={editorButton} disabled={project.payment_stages.length >= 24}
        onClick={() => changeProject({ payment_stages: [...project.payment_stages, {
          label_en: '', label_es: '', due_en: '', due_es: '', due_date: null, percent: null, amount: null, currency: null,
        }] })}>{t('add_payment')}</button>
    </fieldset>
    <fieldset className={panel}>
      <legend className={legend}>{t('updates')}</legend>
      {project.updates.map((update, index) => <UpdateFields key={index} update={update} number={index + 1}
        change={value => changeProject({ updates: replaceAt(project.updates, index, value) })}
        remove={() => changeProject({ updates: removeAt(project.updates, index) })} />)}
      <button type="button" className={editorButton} disabled={project.updates.length >= 36}
        onClick={() => changeProject({ updates: [...project.updates, { date: '', title_en: '', title_es: '', text_en: '', text_es: '' }] })}>
        {t('add_update')}
      </button>
    </fieldset>
  </fieldset>
}
