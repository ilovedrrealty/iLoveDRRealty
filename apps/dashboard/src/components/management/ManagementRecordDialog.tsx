import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ProfessionalDialog as ManagementDialog } from '../shared/ProfessionalDialog'
import { ProfessionalConfirmation as Confirmation } from '../shared/ProfessionalConfirmation'
import {
  approveManagementRecord, dataText, draftFromRecord, getManagementHistory, getManagementRecord, getManagementRecords,
  managementDraftIssues, managementErrorKey, managementWrite, newManagementDraft, saveManagementRecord, scheduleNextManagementTask, uncertainManagementSave,
  type ManagementHistory, type ManagementKind, type ManagementPage, type ManagementRecord,
} from '../../api/propertyManagement'
import { ManagementRecordFields, type DraftChange } from './ManagementRecordFields'
import { MANAGEMENT_BUTTON, MANAGEMENT_FIELD, MANAGEMENT_PRIMARY, ManagementRecordBadges, ManagementRecordSnapshot, managementDate, managementMoney } from './ManagementDisplay'

type ConfirmationAction = 'discard' | 'reload' | 'approved' | 'declined' | 'schedule' | null

export function ManagementRecordDialog({ listingId, kind, record, canApprove, onClose, onSaved }: {
  listingId: string; kind: ManagementKind; record: ManagementRecord | null; canApprove: boolean; onClose: () => void; onSaved: () => void
}) {
  const { t, i18n } = useTranslation('management')
  const [current, setCurrent] = useState(record)
  const [draft, setDraft] = useState(() => record ? draftFromRecord(record) : newManagementDraft(kind))
  const [baseline, setBaseline] = useState(() => JSON.stringify(record ? draftFromRecord(record) : newManagementDraft(kind)))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [issues, setIssues] = useState<string[]>([])
  const [success, setSuccess] = useState<string | null>(null)
  const [uncertain, setUncertain] = useState(false)
  const [confirmation, setConfirmation] = useState<ConfirmationAction>(null)
  const [limit, setLimit] = useState(record?.approval_limit ?? (record ? String(Math.max(Number(dataText(record.data, 'estimated_cost', '0')), Number(dataText(record.data, 'actual_cost', '0')))) : ''))
  const [approvalComment, setApprovalComment] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyPage, setHistoryPage] = useState(1)
  const [history, setHistory] = useState<ManagementPage<ManagementHistory> | null>(null)
  const [historyBusy, setHistoryBusy] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [leases, setLeases] = useState<ManagementRecord[]>([])
  const [leasePage, setLeasePage] = useState(1)
  const [leaseTotal, setLeaseTotal] = useState(0)
  const [leasesBusy, setLeasesBusy] = useState(false)
  const [leasesError, setLeasesError] = useState<string | null>(null)
  const [revisionTick, setRevisionTick] = useState(0)
  const alive = useRef(true)
  const statusRef = useRef<HTMLDivElement>(null)
  const dirty = JSON.stringify(draft) !== baseline
  const change: DraftChange = (key, value) => { setDraft(previous => ({ ...previous, [key]: value })); setSuccess(null); setIssues([]) }

  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => { if (error || issues.length || success) statusRef.current?.focus() }, [error, issues, success])
  useEffect(() => {
    if (kind !== 'ledger') return
    const controller = new AbortController()
    let active = true
    setLeasesBusy(true); setLeasesError(null)
    getManagementRecords(listingId, 'lease', leasePage, controller.signal).then(result => {
      if (!active) return
      setLeases(previous => leasePage === 1 ? result.items : [...previous, ...result.items.filter(row => !previous.some(existing => existing.id === row.id))])
      setLeaseTotal(result.total)
    }).catch(reason => { if (active) setLeasesError(managementErrorKey(reason)) }).finally(() => { if (active) setLeasesBusy(false) })
    return () => { active = false; controller.abort() }
  }, [kind, listingId, leasePage])
  useEffect(() => {
    if (!historyOpen || !current) return
    const controller = new AbortController()
    let active = true
    setHistoryBusy(true); setHistoryError(null); setHistory(null)
    getManagementHistory(current.id, historyPage, controller.signal).then(result => { if (active) setHistory(result) })
      .catch(reason => { if (active) setHistoryError(managementErrorKey(reason)) }).finally(() => { if (active) setHistoryBusy(false) })
    return () => { active = false; controller.abort() }
  }, [historyOpen, current?.id, historyPage, revisionTick])

  const replaceCurrent = (saved: ManagementRecord) => {
    setCurrent(saved); const next = draftFromRecord(saved); setDraft(next); setBaseline(JSON.stringify(next))
    setLimit(saved.approval_limit ?? String(Math.max(Number(dataText(saved.data, 'estimated_cost', '0')), Number(dataText(saved.data, 'actual_cost', '0')))))
    setUncertain(false); setIssues([]); setError(null); setRevisionTick(value => value + 1); setHistoryPage(1)
  }
  const close = () => { if (!busy) dirty && !uncertain ? setConfirmation('discard') : onClose() }
  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || uncertain) return
    const found = managementDraftIssues(draft)
    setIssues(found); setError(null); setSuccess(null)
    if (found.length) return
    setBusy(true)
    try {
      const saved = await saveManagementRecord(managementWrite(listingId, draft, current), current)
      if (alive.current) { replaceCurrent(saved); setSuccess('saved'); onSaved() }
    } catch (reason) {
      if (alive.current) { setError(managementErrorKey(reason)); setUncertain(uncertainManagementSave(reason)) }
    } finally { if (alive.current) setBusy(false) }
  }
  const reload = async () => {
    if (!current || busy) return
    setConfirmation(null); setBusy(true); setError(null); setSuccess(null)
    try { const latest = await getManagementRecord(current.id); if (alive.current) { replaceCurrent(latest); setSuccess('reloaded') } }
    catch (reason) { if (alive.current) setError(managementErrorKey(reason)) }
    finally { if (alive.current) setBusy(false) }
  }
  const requestApproval = (decision: 'approved' | 'declined') => {
    setError(null); setSuccess(null)
    if (dirty) { setError('save_before_action'); return }
    if (decision === 'approved' && limit && (!/^(?:\d{1,10}(?:\.\d{1,2})?|\.\d{1,2})$/.test(limit) || Number(limit) > 9_999_999_999)) { setError('error_limit'); return }
    if (approvalComment.length > 1000) { setError('error_validation'); return }
    setConfirmation(decision)
  }
  const act = async () => {
    if (!current || busy) return
    const action = confirmation
    setConfirmation(null); setBusy(true); setError(null); setSuccess(null)
    try {
      if (action === 'approved' || action === 'declined') {
        const saved = await approveManagementRecord(current, action, action === 'approved' ? limit : '', approvalComment.trim())
        if (alive.current) { replaceCurrent(saved); setApprovalComment(''); setSuccess(action === 'approved' ? 'approval_saved' : 'decline_saved'); onSaved() }
      } else if (action === 'schedule') {
        await scheduleNextManagementTask(current)
        if (alive.current) { setSuccess('next_scheduled'); onSaved() }
      }
    } catch (reason) { if (alive.current) { setError(managementErrorKey(reason)); setUncertain(uncertainManagementSave(reason)) } }
    finally { if (alive.current) setBusy(false) }
  }

  const title = current ? t('edit_record', { kind: t(`kinds.${kind}`) }) : t('new_record', { kind: t(`kinds.${kind}`) })
  return <ManagementDialog title={title} closeLabel={t('close')} onClose={close}>
    {confirmation ? <Confirmation busy={busy} message={t(`confirm_${confirmation}`)} confirmLabel={t(confirmation === 'discard' ? 'discard' : confirmation === 'reload' ? 'reload_record' : confirmation === 'schedule' ? 'schedule_next' : confirmation === 'approved' ? 'approve' : 'decline')} cancelLabel={t('keep_editing')} onCancel={() => setConfirmation(null)} onConfirm={confirmation === 'discard' ? onClose : confirmation === 'reload' ? reload : act} /> : <>
      <div className="mb-4 space-y-2">
        {current ? <><ManagementRecordBadges record={current} /><p className="text-xs text-dim">{t('record_metadata', { version: current.version, date: managementDate(current.updated_at, i18n.language, true) })}</p></> : <p className="text-xs text-dim">{t('private_record_note')}</p>}
        <p className="text-xs leading-relaxed text-ink2">{t('manual_note')}</p>
      </div>
      <div ref={statusRef} tabIndex={-1} className="outline-none" aria-live="polite">
        {error ? <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">{t(error)}</p> : null}
        {issues.length ? <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900"><p className="font-bold">{t('check_fields')}</p><ul className="mt-2 list-disc pl-5">{issues.map(issue => <li key={issue}>{t(`validation.${issue}`)}</li>)}</ul></div> : null}
        {success ? <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{t(success)}</p> : null}
      </div>
      {uncertain ? <div className="mb-4 space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><p>{t('uncertain_save')}</p>{current ? <button type="button" className={MANAGEMENT_BUTTON} disabled={busy} onClick={() => setConfirmation('reload')}>{t('reload_record')}</button> : <button type="button" className={MANAGEMENT_BUTTON} onClick={() => { onSaved(); onClose() }}>{t('close_refresh')}</button>}</div> : null}
      <form onSubmit={save}>
        <fieldset disabled={busy || uncertain} className="min-w-0">
          <ManagementRecordFields draft={draft} change={change} current={current} canApprove={canApprove} leases={leases} moreLeases={leases.length < leaseTotal} loadingLeases={leasesBusy} loadMoreLeases={() => setLeasePage(page => page + 1)} />
          {leasesError ? <p role="alert" className="mt-3 text-sm text-red-800">{t(leasesError)}</p> : null}
          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-4"><button type="submit" className={MANAGEMENT_PRIMARY} disabled={busy || uncertain || (!!current && !dirty)}>{t(busy ? 'saving' : 'save_record')}</button><button type="button" className={MANAGEMENT_BUTTON} onClick={close}>{t('close')}</button>{dirty ? <span className="text-xs text-dim">{t('unsaved_changes')}</span> : null}</div>
        </fieldset>
      </form>
      {current?.kind === 'maintenance' ? <section className="mt-6 rounded-xl border border-line bg-white p-4">
        <h3 className="font-bold text-ink">{t('approval_title')}</h3>
        <p className="mt-2 text-xs leading-relaxed text-ink2">{t('approval_note')}</p>
        {current.approval_limit != null && current.currency ? <p className="mt-2 text-sm">{t('approved_limit_value', { amount: managementMoney(current.approval_limit, current.currency, i18n.language) })}</p> : null}
        {canApprove && current.data.requires_approval !== false && !['completed', 'cancelled'].includes(current.status) ? <fieldset disabled={busy || uncertain} className="mt-4 space-y-3"><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold text-ink2">{t('approval_limit')} ({current.currency})<input className={MANAGEMENT_FIELD + ' mt-1'} type="number" min="0" max="9999999999" step="0.01" value={limit} onChange={event => setLimit(event.target.value)} /></label><label className="text-sm font-semibold text-ink2">{t('approval_comment')}<textarea className={MANAGEMENT_FIELD + ' mt-1'} maxLength={1000} rows={2} value={approvalComment} onChange={event => setApprovalComment(event.target.value)} /></label></div><div className="flex flex-wrap gap-3"><button type="button" className={MANAGEMENT_PRIMARY} onClick={() => requestApproval('approved')}>{t('approve')}</button><button type="button" className={MANAGEMENT_BUTTON} onClick={() => requestApproval('declined')}>{t('decline')}</button></div></fieldset> : <p className="mt-3 text-xs text-dim">{t(['completed', 'cancelled'].includes(current.status) ? 'approval_closed' : canApprove ? 'approval_not_required' : 'approval_owner_only')}</p>}
      </section> : null}
      {current?.kind === 'task' && current.status === 'completed' && dataText(current.data, 'recurrence', 'none') !== 'none' ? <section className="mt-6 rounded-xl border border-line bg-white p-4"><h3 className="font-bold text-ink">{t('next_occurrence')}</h3><p className="my-3 text-xs leading-relaxed text-ink2">{t('recurrence_note')}</p><button type="button" className={MANAGEMENT_BUTTON} disabled={busy || uncertain} onClick={() => { if (dirty) setError('save_before_action'); else setConfirmation('schedule') }}>{t('schedule_next')}</button></section> : null}
      {current ? <section className="mt-6 border-t border-line pt-4"><button type="button" className={MANAGEMENT_BUTTON} disabled={busy} aria-expanded={historyOpen} onClick={() => setHistoryOpen(open => !open)}>{t(historyOpen ? 'hide_history' : 'show_history')}</button><button type="button" className={MANAGEMENT_BUTTON + ' ml-2'} disabled={busy} onClick={() => dirty ? setConfirmation('reload') : reload()}>{t('reload_record')}</button>
        {historyOpen ? <div className="mt-4 space-y-3" aria-busy={historyBusy}>{historyBusy ? <p role="status" className="text-sm text-dim">{t('loading')}</p> : null}{historyError ? <p role="alert" className="text-sm text-red-800">{t(historyError)}</p> : null}{history?.items.map(revision => <details key={revision.version} className="rounded-xl border border-line bg-white p-4"><summary className="cursor-pointer font-semibold text-ink">{t('history_revision', { version: revision.version, action: t(`history_actions.${revision.action}`, { defaultValue: t('history_actions.updated') }), date: managementDate(revision.created_at, i18n.language, true) })}</summary><div className="mt-4"><ManagementRecordSnapshot record={revision.snapshot.record} />{revision.snapshot.comment ? <p className="mt-3 whitespace-pre-wrap break-words text-sm text-ink2">{t('approval_comment')}: {revision.snapshot.comment}</p> : null}</div></details>)}{history && !history.items.length ? <p className="text-sm text-dim">{t('empty_history')}</p> : null}{history && history.total > history.page_size ? <div className="flex flex-wrap items-center gap-3"><button type="button" className={MANAGEMENT_BUTTON} disabled={historyBusy || historyPage <= 1} onClick={() => setHistoryPage(page => page - 1)}>{t('previous')}</button><span className="text-xs text-dim">{t('page_number', { page: history.page, total: Math.ceil(history.total / history.page_size) })}</span><button type="button" className={MANAGEMENT_BUTTON} disabled={historyBusy || historyPage * history.page_size >= history.total} onClick={() => setHistoryPage(page => page + 1)}>{t('next')}</button></div> : null}</div> : null}
      </section> : null}
    </>}
  </ManagementDialog>
}
