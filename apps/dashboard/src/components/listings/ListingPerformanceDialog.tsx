import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { todayInDR } from '../../api/propertyManagement'
import {
  getListingPerformance, initialPerformanceRange, performanceAccessDenied, performanceHttpStatus, PERFORMANCE_ENTRY_KINDS,
  preparePerformanceEntry, recordListingPerformance, validPerformanceRange, type PerformanceEntryFields, type PerformanceEntryKind,
} from '../../api/listingPerformance'
import { useNetworkRead } from '../../hooks/useNetworkRead'
import { editorButton, editorInput } from '../../pages/admin/WebsiteEditorFields'
import { useNetworkDraftGuard } from '../network/NetworkShared'
import { ProfessionalDialog } from '../shared/ProfessionalDialog'
import { ListingPerformanceReport } from './ListingPerformanceReport'

const button = `${editorButton} min-h-11`
const alert = 'rounded-lg bg-red-50 p-3 text-sm text-red-800'
type EntryProblem = 'validation' | 'conflict' | 'uncertain'

export function ListingPerformanceAction({ listingId, disabled = false }: { listingId: string; disabled?: boolean }) {
  const { t } = useTranslation('listing_performance')
  const [open, setOpen] = useState(false)
  return <>
    <button type="button" className={button} aria-haspopup="dialog" disabled={disabled} onClick={() => setOpen(true)}>
      {t('action')}
    </button>
    {open && createPortal(<ListingPerformanceDialog key={listingId} listingId={listingId} onClose={() => setOpen(false)} />, document.body)}
  </>
}

function ListingPerformanceDialog({ listingId, onClose }: { listingId: string; onClose: () => void }) {
  const { t } = useTranslation('listing_performance')
  const [range, setRange] = useState(initialPerformanceRange)
  const [rangeFields, setRangeFields] = useState(range)
  const [rangeError, setRangeError] = useState(false)
  const [draft, setDraft] = useState<PerformanceEntryFields | null>(null)
  const [problem, setProblem] = useState<EntryProblem | null>(null)
  const [notice, setNotice] = useState(false)
  const [busy, setBusy] = useState(false)
  const [retryRead, setRetryRead] = useState(0)
  const [writeDenied, setWriteDenied] = useState(false)
  const active = useRef<AbortController | null>(null)
  const attempt = useRef<{ signature: string; id: string } | null>(null)
  const read = useNetworkRead(`performance:${listingId}:${range.start}:${range.end}:${retryRead}`,
    signal => getListingPerformance(listingId, range, signal), !writeDenied)
  const report = read.data?.listing_id === listingId ? read.data : null
  const denied = writeDenied || performanceAccessDenied(read.error) || (read.data !== null && report === null)
  const readOnly = denied || (report !== null && !report.can_record)
  const dirty = !!draft && (draft.date !== '' || draft.note !== '' || draft.kind !== 'completed_showing' || draft.sharingConfirmed)
  const current = report !== null && !read.stale && !read.error && !denied
  useNetworkDraftGuard(dirty, busy)

  useEffect(() => () => active.current?.abort(), [])
  useEffect(() => {
    if (!readOnly) return
    active.current?.abort()
    attempt.current = null
    setDraft(null)
    setProblem(null)
    setNotice(false)
    setBusy(false)
  }, [readOnly])

  function canDismiss() {
    return !active.current && (!dirty || window.confirm(t('entries.discard')))
  }

  function applyDates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (draft || busy) return
    if (!validPerformanceRange(rangeFields)) {
      setRangeError(true)
      return
    }
    setRangeError(false)
    setNotice(false)
    if (range.start === rangeFields.start && range.end === rangeFields.end) read.refresh()
    else setRange(rangeFields)
  }

  function clearDraft() {
    setDraft(null)
    setProblem(null)
    attempt.current = null
  }

  async function saveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft || !current || !report?.can_record || active.current || problem === 'conflict') return
    const prepared = preparePerformanceEntry(draft, '')
    if (!prepared) {
      setProblem('validation')
      return
    }
    const signature = JSON.stringify(prepared)
    const previous = attempt.current
    const request = previous?.signature === signature ? previous : { signature, id: window.crypto.randomUUID() }
    attempt.current = request
    const controller = new AbortController()
    active.current = controller
    setBusy(true)
    setNotice(false)
    setProblem(null)
    try {
      await recordListingPerformance(listingId, { ...prepared, request_id: request.id }, controller.signal)
      if (controller.signal.aborted) return
      clearDraft()
      setNotice(true)
      read.refresh()
    } catch (error) {
      if (controller.signal.aborted) return
      if (performanceAccessDenied(error)) setWriteDenied(true)
      else {
        const status = performanceHttpStatus(error)
        setProblem(status === 409 ? 'conflict' : status === 400 || status === 422 ? 'validation' : 'uncertain')
      }
    } finally {
      if (active.current === controller) active.current = null
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  const loadProblem = denied ? 'errors.access' : read.error ? 'errors.read' : null
  const noteEntry = draft !== null && draft.kind !== 'completed_showing'
  const freezeFields = !current || busy || problem === 'uncertain' || problem === 'conflict'

  return <ProfessionalDialog title={t('title')} closeLabel={t('close')} onClose={() => { if (canDismiss()) onClose() }}>
    <div className="min-w-0 space-y-4">
      {!denied && <form onSubmit={applyDates} className="rounded-xl border border-line bg-white p-3 sm:p-4">
        <fieldset disabled={draft !== null || busy} className="flex min-w-0 flex-wrap items-end gap-3">
          <label className="min-w-0 text-sm font-semibold text-ink2">
            <span className="mb-1 block">{t('dates.start')}</span>
            <input type="date" required className={editorInput} value={rangeFields.start}
              onChange={event => setRangeFields({ ...rangeFields, start: event.target.value })} />
          </label>
          <label className="min-w-0 text-sm font-semibold text-ink2">
            <span className="mb-1 block">{t('dates.end')}</span>
            <input type="date" required min={rangeFields.start} className={editorInput} value={rangeFields.end}
              onChange={event => setRangeFields({ ...rangeFields, end: event.target.value })} />
          </label>
          <button type="submit" className={button}>{t('dates.apply')}</button>
        </fieldset>
        {rangeError && <p role="alert" className={`${alert} mt-2`}>{t('errors.range')}</p>}
      </form>}

      {loadProblem && <div className={alert}>
        <p role="alert">{t(loadProblem)}</p>
        <button type="button" className={`${button} mt-2`} onClick={() => {
          setWriteDenied(false)
          setRetryRead(value => value + 1)
        }}>{t('retry')}</button>
      </div>}
      {!report && !loadProblem && <p role="status" className="text-sm text-ink2">{t('loading')}</p>}
      {notice && <p role="status" className="text-sm font-semibold text-sea">{t('entries.saved')}</p>}

      {report?.can_record && current && !draft && <button type="button" className={button} onClick={() => {
        setNotice(false)
        setDraft({ kind: 'completed_showing', date: '', note: '', sharingConfirmed: false })
      }}>{t('entries.record')}</button>}

      {report?.can_record && !denied && draft && <form onSubmit={saveEntry} className="min-w-0 space-y-3 rounded-xl border border-line bg-white p-4">
        <h3 className="font-semibold text-ink">{t('entries.record')}</h3>
        <fieldset disabled={freezeFields} className="min-w-0 space-y-3">
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <label className="min-w-0 text-sm font-semibold text-ink2">
              <span className="mb-1 block">{t('entries.type')}</span>
              <select className={editorInput} value={draft.kind} onChange={event => setDraft({
                ...draft, kind: event.target.value as PerformanceEntryKind, note: '', sharingConfirmed: false,
              })}>
                {PERFORMANCE_ENTRY_KINDS.map(kind => <option key={kind} value={kind}>{t(`entries.kinds.${kind}`)}</option>)}
              </select>
            </label>
            <label className="min-w-0 text-sm font-semibold text-ink2">
              <span className="mb-1 block">{t('entries.date')}</span>
              <input type="date" required max={todayInDR()} className={editorInput} value={draft.date}
                onChange={event => setDraft({ ...draft, date: event.target.value })} />
            </label>
          </div>
          {noteEntry ? <>
            <p id="performance-note-help" className="text-sm text-ink2">{t('entries.sharing_help')}</p>
            <label className="block text-sm font-semibold text-ink2">
              <span className="mb-1 block">{t('entries.note')}</span>
              <textarea required aria-describedby="performance-note-help" maxLength={1000} rows={3} className={editorInput}
                value={draft.note} onChange={event => setDraft({ ...draft, note: event.target.value, sharingConfirmed: false })} />
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-ink2">
              <input type="checkbox" required checked={draft.sharingConfirmed}
                className="size-4 shrink-0 accent-coral" onChange={event => setDraft({ ...draft, sharingConfirmed: event.target.checked })} />
              {t('entries.share')}
            </label>
          </> : <p className="text-sm text-ink2">{t('completed.record_help')}</p>}
        </fieldset>
        {problem && <p role="alert" className={alert}>{t(`errors.${problem}`)}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={button} disabled={!current || busy || problem === 'conflict'}>
            {t(busy ? 'entries.saving' : problem === 'uncertain' ? 'entries.retry' : 'entries.save')}
          </button>
          <button type="button" className={button} disabled={busy} onClick={() => {
            if (canDismiss()) { clearDraft(); read.refresh() }
          }}>{t('entries.cancel')}</button>
        </div>
      </form>}

      {report && !denied && <ListingPerformanceReport report={report} />}
    </div>
  </ProfessionalDialog>
}
