import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Clock3, RefreshCw, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  DELIVERY_STATUSES, DeliveryRetryError, getDeliveryQueue, getDeliverySummary, getLeadDelivery,
  isDeliveryId, retryDelivery, type DeliveryDetail, type DeliveryJob, type DeliveryQueue,
  type DeliveryStatus, type DeliverySummary,
} from '../../api/leadDelivery'

const PAGE_SIZE = 25
const STALE_AFTER_MS = 180_000
const STATUS_TONE: Record<DeliveryStatus, string> = {
  pending: 'bg-slate-100 text-slate-800', processing: 'bg-blue-50 text-blue-900',
  retry_wait: 'bg-amber-50 text-amber-900', accepted: 'bg-green-50 text-green-900',
  failed: 'bg-red-50 text-red-900', needs_review: 'bg-orange-50 text-orange-950', skipped: 'bg-slate-100 text-slate-700',
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-2xl border border-line bg-paper p-4 sm:p-5"><h2 className="font-sans text-base font-bold text-ink">{title}</h2><div className="mt-4">{children}</div></section>
}

export function LeadDelivery({ initialLeadId = '', onOpenLead }: {
  initialLeadId?: string; onOpenLead?: (leadId: string) => void
}) {
  const { t, i18n } = useTranslation('lead_delivery')
  const initial = isDeliveryId(initialLeadId) ? initialLeadId.toLowerCase() : ''
  const [status, setStatus] = useState<DeliveryStatus | ''>('')
  const [leadInput, setLeadInput] = useState(initial)
  const [leadFilter, setLeadFilter] = useState(initial)
  const [inputError, setInputError] = useState(false)
  const [offset, setOffset] = useState(0)
  const [refresh, setRefresh] = useState(0)
  const [summary, setSummary] = useState<DeliverySummary | null>(null)
  const [queue, setQueue] = useState<DeliveryQueue | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [selectedLead, setSelectedLead] = useState<string | null>(initial || null)
  const [detail, setDetail] = useState<DeliveryDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailFailed, setDetailFailed] = useState(false)
  const [confirmJob, setConfirmJob] = useState<DeliveryJob | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [notice, setNotice] = useState<'queued' | 'not_retryable' | 'retry_unconfirmed' | null>(null)
  const confirmationRef = useRef<HTMLElement>(null)
  const locale = i18n.language.startsWith('es') ? 'es-DO' : 'en-US'
  const format = (value: number) => value.toLocaleString(locale)
  const dateTime = (value: string | null) => value ? new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(value)) : t('not_yet')
  const stepLabel = (value: string) => value.startsWith('email_') && value !== 'email_configuration'
    ? t('steps.email', { number: value.slice(6) }) : t(`steps.${value}`)

  useEffect(() => {
    const next = isDeliveryId(initialLeadId) ? initialLeadId.toLowerCase() : ''
    setLeadInput(next); setLeadFilter(next); setSelectedLead(next || null); setOffset(0)
  }, [initialLeadId])

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setLoading(true); setFailed(false); setSummary(null); setQueue(null)
    Promise.all([
      getDeliverySummary(controller.signal),
      getDeliveryQueue({ limit: PAGE_SIZE, offset, ...(status ? { status } : {}), ...(leadFilter ? { lead_id: leadFilter } : {}) }, controller.signal),
    ]).then(([nextSummary, nextQueue]) => {
      if (active && !controller.signal.aborted) { setSummary(nextSummary); setQueue(nextQueue) }
    }).catch(() => { if (active && !controller.signal.aborted) setFailed(true) })
      .finally(() => { if (active && !controller.signal.aborted) setLoading(false) })
    return () => { active = false; controller.abort() }
  }, [status, leadFilter, offset, refresh])

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setDetail(null); setDetailFailed(false)
    if (!selectedLead) { setDetailLoading(false); return () => controller.abort() }
    setDetailLoading(true)
    getLeadDelivery(selectedLead, controller.signal).then(next => {
      if (active && !controller.signal.aborted) setDetail(next)
    }).catch(() => { if (active && !controller.signal.aborted) setDetailFailed(true) })
      .finally(() => { if (active && !controller.signal.aborted) setDetailLoading(false) })
    return () => { active = false; controller.abort() }
  }, [selectedLead, refresh])

  useEffect(() => {
    if (!confirmJob) return
    confirmationRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    confirmationRef.current?.focus({ preventScroll: true })
  }, [confirmJob])

  function errorLabel(job: DeliveryJob) {
    if (job.outcome_uncertain) return t('errors.uncertain')
    const code = job.error_code
    if (!code) return null
    const http = /^(ghl|resend)_http_(\d{3})$/.exec(code)
    if (http) return t('errors.http', { provider: t(`providers.${http[1]}`), status: http[2] })
    if (code.includes('not_configured') || code.includes('notification_configuration')) return t('errors.configuration')
    if (code.includes('configuration_changed')) return t('errors.destination_changed')
    if (code.includes('payload') || code.includes('invalid_delivery')) return t('errors.payload_review')
    if (code.includes('idempotency_window_expired')) return t('errors.expired_window')
    if (code.includes('connection_not_established')) return t('errors.not_connected')
    if (code.includes('integration_disabled')) return t('errors.disabled')
    if (code === 'no_note_content') return t('errors.no_note')
    if (code.includes('unknown') || code.includes('conflict')) return t('errors.uncertain')
    return t('errors.review')
  }

  async function queueRetry() {
    if (!confirmJob || retrying) return
    setRetrying(true); setNotice(null)
    try {
      await retryDelivery(confirmJob.id)
      setNotice('queued')
    } catch (error) {
      setNotice(error instanceof DeliveryRetryError && error.code === 'not_retryable' ? 'not_retryable' : 'retry_unconfirmed')
    } finally {
      setRetrying(false); setConfirmJob(null); setRefresh(value => value + 1)
    }
  }

  function statusBadge(job: DeliveryJob) {
    return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_TONE[job.status]}`}>{t(`statuses.${job.status}`)}</span>
  }

  const workerState = summary ? !summary.enabled ? 'paused'
    : summary.worker.error_code ? 'error'
      : !summary.worker.last_poll_at ? 'awaiting'
        : Date.parse(summary.generated_at) - Date.parse(summary.worker.last_poll_at) > STALE_AFTER_MS ? 'stale' : 'polling' : null

  return <div className="space-y-5" aria-busy={loading}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="max-w-3xl"><p className="text-sm leading-relaxed text-ink2">{t('intro')}</p><p className="mt-2 text-xs leading-relaxed text-ink2">{t('manual_policy')}</p><p className="mt-2 text-xs leading-relaxed text-dim">{t('accepted_note')}</p></div>
      <button type="button" disabled={loading || retrying} onClick={() => { setNotice(null); setRefresh(value => value + 1) }} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line bg-paper px-3 text-sm font-semibold text-ink disabled:opacity-50"><RefreshCw size={15} aria-hidden="true" />{t('refresh')}</button>
    </div>
    {notice ? <div role={notice === 'queued' ? 'status' : 'alert'} className={`rounded-xl border p-4 text-sm ${notice === 'queued' ? 'border-green-200 bg-green-50 text-green-950' : 'border-amber-200 bg-amber-50 text-amber-950'}`}>{t(`notices.${notice}`)}</div> : null}
    {loading ? <div role="status" className="rounded-xl border border-line bg-paper p-5 text-sm text-ink2">{t('loading')}</div> : null}
    {failed ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-950"><p>{t('load_error')}</p><button type="button" onClick={() => setRefresh(value => value + 1)} className="mt-3 min-h-10 rounded-lg border border-red-300 bg-white px-3 font-semibold">{t('refresh')}</button></div> : null}

    {summary && queue ? <>
      <section className="rounded-xl border border-line bg-paper p-4" aria-label={t('worker.title')}>
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">{workerState === 'polling' ? <CheckCircle2 size={17} className="text-green-700" aria-hidden="true" /> : <AlertCircle size={17} className="text-amber-700" aria-hidden="true" />}{t('worker.title')}: {t(`worker.${workerState}`)}</div>
        <p className="mt-1 text-xs leading-relaxed text-ink2">{t(`worker.${workerState}_help`)}</p>
        <dl className="mt-3 grid gap-3 text-xs text-ink2 sm:grid-cols-3">
          <div><dt className="font-semibold">{t('worker.last_poll')}</dt><dd className="mt-1">{dateTime(summary.worker.last_poll_at)}</dd></div>
          <div><dt className="font-semibold">{t('worker.last_completed')}</dt><dd className="mt-1">{dateTime(summary.worker.last_completed_at)}</dd></div>
          <div><dt className="font-semibold">{t('updated')}</dt><dd className="mt-1">{dateTime(summary.generated_at)}</dd></div>
        </dl>
      </section>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {[
          ['tracked_leads', summary.tracked_leads], ['accepted', summary.status_counts.accepted],
          ['waiting', summary.status_counts.pending],
          ['failed', summary.status_counts.failed], ['needs_review', summary.status_counts.needs_review],
        ].map(([key, value]) => <section key={key} className="rounded-xl border border-line bg-paper p-4"><div className="text-2xl font-bold tabular-nums text-ink">{format(value as number)}</div><h2 className="mt-1 text-xs font-semibold text-ink2">{t(`counts.${key}`)}</h2></section>)}
      </div>
      <p className="text-xs leading-relaxed text-dim">{t('summary_scope')}</p>

      <Panel title={t('queue.title')}>
        <div className="flex flex-wrap items-end gap-3">
          <div><label htmlFor="delivery-status" className="mb-1 block text-xs font-semibold text-ink2">{t('queue.status_filter')}</label><select id="delivery-status" value={status} onChange={event => { setStatus(event.target.value as DeliveryStatus | ''); setOffset(0); setSelectedLead(null) }} className="min-h-10 rounded-lg border border-line bg-paper px-3 text-sm text-ink"><option value="">{t('queue.all_statuses')}</option>{DELIVERY_STATUSES.map(value => <option key={value} value={value}>{t(`statuses.${value}`)}</option>)}</select></div>
          <form onSubmit={event => {
            event.preventDefault()
            const next = leadInput.trim().toLowerCase()
            if (next && !isDeliveryId(next)) { setInputError(true); return }
            setInputError(false); setLeadFilter(next); setSelectedLead(next || null); setOffset(0)
          }} className="flex min-w-0 flex-1 flex-wrap items-end gap-2">
            <div className="min-w-48 flex-1"><label htmlFor="delivery-lead" className="mb-1 block text-xs font-semibold text-ink2">{t('queue.lead_filter')}</label><input id="delivery-lead" value={leadInput} maxLength={36} onChange={event => setLeadInput(event.target.value)} aria-invalid={inputError} aria-describedby={inputError ? 'delivery-lead-error' : undefined} placeholder={t('queue.lead_placeholder')} className="min-h-10 w-full rounded-lg border border-line bg-paper px-3 font-mono text-xs text-ink" /></div>
            <button type="submit" className="min-h-10 rounded-lg bg-navy px-3 text-sm font-semibold text-white">{t('queue.apply')}</button>
            {leadFilter ? <button type="button" onClick={() => { setLeadInput(''); setLeadFilter(''); setInputError(false); setOffset(0); setSelectedLead(null) }} className="min-h-10 rounded-lg border border-line px-3 text-sm font-semibold text-ink">{t('queue.clear')}</button> : null}
          </form>
        </div>
        {inputError ? <p id="delivery-lead-error" role="alert" className="mt-2 text-xs text-red-700">{t('queue.invalid_id')}</p> : null}
        {queue.items.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-168 border-collapse text-left text-sm"><caption className="sr-only">{t('queue.caption')}</caption><thead><tr className="border-b border-line text-xs text-dim">{['lead', 'step', 'status', 'attempts', 'updated', 'actions'].map(key => <th key={key} scope="col" className="px-2 py-3 font-semibold">{t(`table.${key}`)}</th>)}</tr></thead><tbody>{queue.items.map(job => <tr key={job.id} className="border-b border-line last:border-0">
          <td className="px-2 py-3 align-top"><button type="button" onClick={() => setSelectedLead(job.lead_id)} title={job.lead_id} className="min-h-10 break-all text-left font-mono text-xs font-semibold text-[#0b63ab] underline underline-offset-2">{job.lead_id.slice(0, 8)}…</button></td>
          <td className="px-2 py-3 align-top"><div className="font-semibold text-ink">{stepLabel(job.step)}</div><div className="mt-1 text-xs text-dim">{t(`providers.${job.provider}`)}</div></td>
          <td className="px-2 py-3 align-top">{statusBadge(job)}{job.blocked_by ? <p className="mt-2 max-w-60 text-xs text-ink2">{t('waiting_for_contact')}</p> : null}{errorLabel(job) ? <p className="mt-2 max-w-64 text-xs leading-relaxed text-ink2">{errorLabel(job)}</p> : null}</td>
          <td className="px-2 py-3 align-top tabular-nums text-ink2">{job.attempts}/{job.max_attempts}</td>
          <td className="px-2 py-3 align-top text-xs text-ink2">{dateTime(job.last_attempt_at || job.created_at)}{['failed', 'retry_wait'].includes(job.status) && !job.outcome_uncertain && job.attempts < job.max_attempts ? <p className="mt-2 flex max-w-56 items-start gap-1"><Clock3 size={12} className="mt-0.5 shrink-0" aria-hidden="true" />{t('next_attempt', { date: dateTime(job.next_attempt_at) })}</p> : null}</td>
          <td className="px-2 py-3 align-top">{job.can_retry ? <button type="button" disabled={retrying} onClick={() => { setNotice(null); setConfirmJob(job) }} className="min-h-10 rounded-lg border border-line bg-paper px-3 text-xs font-semibold text-ink disabled:opacity-50">{t('retry')}</button> : <button type="button" onClick={() => setSelectedLead(job.lead_id)} className="min-h-10 rounded-lg border border-line px-3 text-xs font-semibold text-ink">{t('inspect')}</button>}</td>
        </tr>)}</tbody></table></div> : <div className="mt-4 rounded-xl bg-line-soft p-5 text-sm text-ink2"><p>{t('queue.empty')}</p><p className="mt-2 text-xs leading-relaxed">{t('legacy_note')}</p></div>}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-ink2"><p>{t('queue.total', { count: queue.total })}</p><div className="flex items-center gap-2"><button type="button" disabled={offset === 0 || loading} onClick={() => setOffset(value => Math.max(0, value - PAGE_SIZE))} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-line px-3 font-semibold disabled:opacity-40"><ChevronLeft size={14} aria-hidden="true" />{t('previous')}</button><button type="button" disabled={offset + PAGE_SIZE >= queue.total || offset + PAGE_SIZE > 10000 || loading} onClick={() => setOffset(value => value + PAGE_SIZE)} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-line px-3 font-semibold disabled:opacity-40">{t('next')}<ChevronRight size={14} aria-hidden="true" /></button></div></div>
      </Panel>
    </> : null}

    {confirmJob ? <section ref={confirmationRef} tabIndex={-1} role="region" aria-label={t('confirm.title')} className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950 focus-visible:outline-2 focus-visible:outline-navy"><h2 className="font-semibold">{t('confirm.title')}</h2><p className="mt-2 text-sm leading-relaxed">{t('confirm.body', { step: stepLabel(confirmJob.step) })}</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={retrying} onClick={queueRetry} className="min-h-10 rounded-lg bg-navy px-4 text-sm font-semibold text-white disabled:opacity-50">{retrying ? t('confirm.queuing') : t('confirm.queue')}</button><button type="button" disabled={retrying} onClick={() => setConfirmJob(null)} className="min-h-10 rounded-lg border border-amber-400 bg-white px-4 text-sm font-semibold">{t('cancel')}</button></div></section> : null}

    {selectedLead ? <Panel title={t('detail.title')}><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="break-all font-mono text-xs text-ink2">{selectedLead}</p>{onOpenLead ? <button type="button" onClick={() => onOpenLead(selectedLead)} className="mt-2 min-h-10 text-sm font-semibold text-[#0b63ab] underline underline-offset-2">{t('detail.open_lead')}</button> : null}</div><button type="button" onClick={() => setSelectedLead(null)} aria-label={t('detail.close')} className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-line"><X size={16} aria-hidden="true" /></button></div>
      {detailLoading ? <p role="status" className="mt-4 text-sm text-ink2">{t('loading')}</p> : null}
      {detailFailed ? <p role="alert" className="mt-4 text-sm text-red-800">{t('detail.error')}</p> : null}
      {detail ? detail.tracked ? <ul className="mt-4 grid gap-3 md:grid-cols-2">{detail.jobs.map(job => <li key={job.id} className="rounded-xl border border-line p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold text-ink">{stepLabel(job.step)}</h3>{statusBadge(job)}</div><p className="mt-2 text-xs text-ink2">{t('detail.attempts', { count: job.attempts, max: job.max_attempts })}</p>{job.accepted_at ? <p className="mt-1 text-xs text-ink2">{t('detail.accepted_at', { date: dateTime(job.accepted_at) })}</p> : null}{errorLabel(job) ? <p className="mt-2 text-xs leading-relaxed text-ink2">{errorLabel(job)}</p> : null}{job.blocked_by ? <p className="mt-2 text-xs text-ink2">{t('waiting_for_contact')}</p> : null}{['failed', 'retry_wait'].includes(job.status) && !job.outcome_uncertain && job.attempts < job.max_attempts ? <p className="mt-2 text-xs text-ink2">{t('next_attempt', { date: dateTime(job.next_attempt_at) })}</p> : null}{job.status === 'needs_review' ? <p className="mt-2 text-xs font-semibold leading-relaxed text-orange-900">{t('detail.review_note')}</p> : null}{job.can_retry ? <button type="button" disabled={retrying} onClick={() => { setNotice(null); setConfirmJob(job) }} className="mt-3 min-h-10 rounded-lg border border-line px-3 text-xs font-semibold text-ink disabled:opacity-50">{t('retry')}</button> : null}</li>)}</ul> : <p className="mt-4 rounded-xl bg-line-soft p-4 text-sm leading-relaxed text-ink2">{t('legacy_note')}</p> : null}
    </Panel> : null}
  </div>
}
