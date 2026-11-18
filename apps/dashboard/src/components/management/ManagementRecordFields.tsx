import type { InputHTMLAttributes } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CHECK_RESULTS, INSPECTION_ITEMS, MANAGEMENT_OPTIONS, MANAGEMENT_STATUSES, dataText,
  type CheckResult, type ManagementDraft, type ManagementRecord,
} from '../../api/propertyManagement'

export type DraftChange = <K extends keyof ManagementDraft>(key: K, value: ManagementDraft[K]) => void
type TextKey = Exclude<{ [K in keyof ManagementDraft]: ManagementDraft[K] extends string ? K : never }[keyof ManagementDraft], 'kind' | 'currency'>
const FIELD = 'mt-1.5 w-full min-h-10 rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-sea disabled:bg-line-soft disabled:text-dim'

export function ManagementRecordFields({ draft, change, current, canApprove, leases, moreLeases, loadingLeases, loadMoreLeases }: {
  draft: ManagementDraft; change: DraftChange; current: ManagementRecord | null; canApprove: boolean
  leases: ManagementRecord[]; moreLeases: boolean; loadingLeases: boolean; loadMoreLeases: () => void
}) {
  const { t } = useTranslation('management')
  const input = (key: TextKey, options: InputHTMLAttributes<HTMLInputElement> = {}, hint?: string) => <label className="block text-sm font-semibold text-ink2" key={key}>
    {t(`fields.${key}`)}{options.required ? ' *' : ''}
    <input {...options} className={FIELD} value={draft[key]} onChange={event => change(key, event.target.value)} />
    {hint ? <span className="mt-1 block text-xs font-normal leading-relaxed text-dim">{hint}</span> : null}
  </label>
  const select = (key: TextKey, options: readonly string[], group: string = key) => <label className="block text-sm font-semibold text-ink2" key={key}>
    {t(`fields.${key}`)}
    <select className={FIELD} value={draft[key]} onChange={event => {
      change(key, event.target.value)
      if (key === 'ledger_category' && event.target.value !== 'rent') change('rent_period', '')
    }}>
      {options.map(value => {
        const approvalBlocked = draft.kind === 'maintenance' && draft.requires_approval && current?.approval_status !== 'approved' && ['approved', 'in_progress', 'completed'].includes(value)
        return <option key={value} value={value} disabled={approvalBlocked}>{t(`${group}.${value}`)}</option>
      })}
    </select>
  </label>
  const currency = <label className="block text-sm font-semibold text-ink2">{t('fields.currency')}
    <select className={FIELD} value={draft.currency} disabled={draft.kind === 'ledger' && !!draft.lease_id} onChange={event => change('currency', event.target.value === 'DOP' ? 'DOP' : 'USD')}>
      <option value="USD">USD · {t('currencies.USD')}</option><option value="DOP">DOP · {t('currencies.DOP')}</option>
    </select>
  </label>
  const decimal = { type: 'number', min: '0', max: '9999999999', step: '0.01', inputMode: 'decimal' as const }
  const approvalWillReset = draft.kind === 'maintenance' && current && (
    Number(draft.estimated_cost) !== Number(current.data.estimated_cost) || draft.vendor_name.trim() !== dataText(current.data, 'vendor_name')
    || draft.vendor_phone.trim() !== dataText(current.data, 'vendor_phone') || draft.maintenance_category !== current.data.category
    || draft.title.trim() !== current.title || draft.notes.trim() !== dataText(current.data, 'notes')
    || draft.currency !== current.data.currency || draft.requires_approval !== current.data.requires_approval
    || (current.approval_limit != null && Number(draft.actual_cost || '0') > Number(current.approval_limit))
  )
  return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2">
      {input('title', { required: true, maxLength: 180 })}
      {select('status', MANAGEMENT_STATUSES[draft.kind], 'statuses')}
    </div>
    {draft.kind === 'lease' ? <>
      <p className="rounded-lg bg-line-soft p-3 text-xs leading-relaxed text-ink2">{t('lease_note')}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {input('tenant_name', { required: true, maxLength: 160, autoComplete: 'off' })}
        {input('unit_reference', { maxLength: 80 }, t('whole_property_hint'))}
        {input('tenant_email', { type: 'email', maxLength: 254, autoComplete: 'off' })}
        {input('tenant_phone', { type: 'tel', maxLength: 50, autoComplete: 'off' })}
        {input('start_date', { type: 'date', required: true })}
        {input('end_date', { type: 'date', min: draft.start_date, required: ['ended', 'terminated'].includes(draft.status) })}
        {input('rent', { ...decimal, required: true, min: '0.01' })}{currency}
        {input('deposit', { ...decimal, required: true }, t('deposit_hint'))}
        {input('due_day', { type: 'number', min: '1', max: '31', step: '1', required: true }, t('due_day_hint'))}
        {input('first_due_date', { type: 'date', min: draft.start_date, max: draft.end_date || undefined }, t('first_due_hint'))}
        {input('first_rent', decimal, t('first_rent_hint'))}
      </div>
      {input('document_url', { type: 'url', maxLength: 1000, placeholder: 'https://…' }, t('reference_note'))}
    </> : null}
    {draft.kind === 'maintenance' ? <>
      <p className="rounded-lg bg-line-soft p-3 text-xs leading-relaxed text-ink2">{t('maintenance_note')}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {select('maintenance_category', MANAGEMENT_OPTIONS.maintenance_categories, 'maintenance_categories')}
        {select('priority', MANAGEMENT_OPTIONS.priorities, 'priorities')}
        {input('due_date', { type: 'date' })}{currency}
        {input('vendor_name', { maxLength: 160, autoComplete: 'off' })}
        {input('vendor_phone', { type: 'tel', maxLength: 50, autoComplete: 'off' })}
        {input('estimated_cost', { ...decimal, required: true })}{input('actual_cost', decimal)}
      </div>
      <label className="flex items-start gap-3 text-sm text-ink2"><input type="checkbox" checked={draft.requires_approval} disabled={!canApprove && current?.data.requires_approval !== false} onChange={event => change('requires_approval', event.target.checked)} className="mt-0.5 h-4 w-4 accent-coral" /><span>{t('requires_approval')}<span className="mt-1 block text-xs text-dim">{t('approval_controls_note')}</span></span></label>
      {approvalWillReset ? <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">{t('approval_reset_note')}</p> : null}
    </> : null}
    {draft.kind === 'inspection' ? <>
      <div className="grid gap-4 sm:grid-cols-2">
        {select('inspection_type', MANAGEMENT_OPTIONS.inspection_types, 'inspection_types')}
        {input('due_date', { type: 'date', required: true })}{input('inspector', { maxLength: 160 })}
      </div>
      <fieldset className="space-y-3"><legend className="mb-2 font-bold text-ink">{t('inspection_checklist')}</legend>
        <p className="mb-3 text-xs leading-relaxed text-ink2">{t('inspection_complete_note')}</p>
        {INSPECTION_ITEMS.map(key => <div key={key} className="rounded-xl border border-line bg-white p-3">
          <label className="grid items-center gap-2 text-sm font-semibold text-ink2 sm:grid-cols-2">{t(`checks.${key}`)}
            <select className={FIELD} value={draft.checks[key]} onChange={event => change('checks', { ...draft.checks, [key]: event.target.value as CheckResult })}>{CHECK_RESULTS.map(result => <option key={result} value={result}>{t(`check_results.${result}`)}</option>)}</select>
          </label>
          {draft.checks[key] === 'issue' || draft.item_notes[key] ? <label className="mt-2 block text-xs font-semibold text-ink2">{t('inspection_item_notes')}{draft.checks[key] === 'issue' ? ' *' : ''}<textarea className={FIELD} rows={2} required={draft.checks[key] === 'issue' && draft.status === 'completed'} maxLength={1000} value={draft.item_notes[key]} onChange={event => change('item_notes', { ...draft.item_notes, [key]: event.target.value })} /></label> : null}
        </div>)}
      </fieldset>
      <label className="block text-sm font-semibold text-ink2">{t('fields.evidence_text')}<textarea className={FIELD} rows={3} value={draft.evidence_text} onChange={event => change('evidence_text', event.target.value)} placeholder="https://…" /><span className="mt-1 block text-xs font-normal text-dim">{t('evidence_hint')}</span></label>
    </> : null}
    {draft.kind === 'ledger' ? <>
      <p className="rounded-lg bg-line-soft p-3 text-xs leading-relaxed text-ink2">{t('manual_note')}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {select('direction', MANAGEMENT_OPTIONS.directions, 'directions')}
        {select('ledger_category', MANAGEMENT_OPTIONS.ledger_categories, 'ledger_categories')}
        {input('amount', { ...decimal, required: true, min: '0.01' })}{currency}
        {input('transaction_date', { type: 'date', required: true }, t('transaction_date_hint'))}
        {input('reference', { maxLength: 120 })}
        <label className="block text-sm font-semibold text-ink2">{t('fields.lease_id')}
          <select value={draft.lease_id} className={FIELD} onChange={event => {
            change('lease_id', event.target.value)
            if (!event.target.value) change('rent_period', '')
            const lease = leases.find(row => row.id === event.target.value)
            if (lease) change('currency', lease.data.currency === 'DOP' ? 'DOP' : 'USD')
          }}><option value="">{t('no_linked_lease')}</option>
            {draft.lease_id && !leases.some(row => row.id === draft.lease_id) ? <option value={draft.lease_id}>{t('existing_linked_lease')}</option> : null}
            {leases.map(row => <option key={row.id} value={row.id}>{row.title} · {dataText(row.data, 'currency')} · {t(`statuses.${row.status}`)}</option>)}
          </select>
          {moreLeases ? <button type="button" disabled={loadingLeases} onClick={loadMoreLeases} className="mt-2 min-h-8 text-xs font-semibold text-coral underline">{t(loadingLeases ? 'loading' : 'load_more_leases')}</button> : null}
        </label>
        {draft.ledger_category === 'rent' && draft.lease_id ? input('rent_period', { type: 'month' }, t('rent_period_hint')) : null}
      </div>
      <p className="text-xs leading-relaxed text-ink2">{t('deposit_hint')}</p>
    </> : null}
    {draft.kind === 'task' ? <>
      <div className="grid gap-4 sm:grid-cols-2">
        {select('task_category', MANAGEMENT_OPTIONS.task_categories, 'task_categories')}
        {input('due_date', { type: 'date', required: true })}
        {input('assigned_to', { maxLength: 160 })}
        {select('recurrence', MANAGEMENT_OPTIONS.recurrences, 'recurrences')}
      </div>
      <p className="text-xs leading-relaxed text-ink2">{t('recurrence_note')}</p>
    </> : null}
    <label className="block text-sm font-semibold text-ink2">{t(draft.kind === 'maintenance' ? 'fields.work_scope' : 'fields.notes')}<textarea className={FIELD} rows={4} maxLength={4000} value={draft.notes} onChange={event => change('notes', event.target.value)} /></label>
    {draft.kind === 'maintenance' ? <label className="block text-sm font-semibold text-ink2">{t('fields.progress_notes')}<textarea className={FIELD} rows={3} maxLength={4000} value={draft.progress_notes} onChange={event => change('progress_notes', event.target.value)} /><span className="mt-1 block text-xs font-normal text-dim">{t('progress_note_hint')}</span></label> : null}
  </div>
}
