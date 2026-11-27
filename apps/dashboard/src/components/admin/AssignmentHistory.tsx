import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getAssignmentHistory, type AssignmentHistory as History, type AssignmentScope } from '../../api/assignments'

export const assignmentButton = 'min-h-11 max-w-full rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-coral disabled:cursor-not-allowed disabled:opacity-40'
type Read = { kind: 'loading' | 'error' | 'denied' } | { kind: 'ready'; report: History }
const PAGE_SIZE = 10

export function AssignmentHistory({ scope, targetId, revision, onAccessLost }: {
  scope: AssignmentScope; targetId: string; revision: number; onAccessLost: () => void
}) {
  const { t } = useTranslation('communications')
  const [open, setOpen] = useState(false)
  return <section className="min-w-0 space-y-3">
    <button type="button" className={assignmentButton} aria-expanded={open} onClick={() => setOpen(value => !value)}>{t(open ? 'assignment.hide_history' : 'assignment.open_history')}</button>
    {open ? <AssignmentHistoryRead key={`${scope}:${targetId}:${revision}`} scope={scope} targetId={targetId} onAccessLost={onAccessLost} /> : null}
  </section>
}

function AssignmentHistoryRead({ scope, targetId, onAccessLost }: {
  scope: AssignmentScope; targetId: string; onAccessLost: () => void
}) {
  const { t, i18n } = useTranslation('communications')
  const [offset, setOffset] = useState(0), [refresh, setRefresh] = useState(0)
  const [read, setRead] = useState<Read>({ kind: 'loading' })
  const locale = i18n.language.startsWith('es') ? 'es-DO' : 'en-US'
  const date = (value: string | null) => value ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : t('not_recorded')
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setRead({ kind: 'loading' })
    getAssignmentHistory(scope, targetId, { limit: PAGE_SIZE, offset }, controller.signal).then(report => {
      if (active && !controller.signal.aborted) setRead({ kind: 'ready', report })
    }).catch(error => {
      if (!active || controller.signal.aborted) return
      const status = error?.response?.status
      if (status === 401 || status === 403 || status === 404) { setRead({ kind: 'denied' }); onAccessLost() }
      else setRead({ kind: 'error' })
    })
    return () => { active = false; controller.abort() }
  }, [scope, targetId, offset, refresh, onAccessLost])
  function reload() { setRead({ kind: 'loading' }); setRefresh(value => value + 1) }
  function page(next: number) { setRead({ kind: 'loading' }); setOffset(next) }
  return <section aria-label={t('assignment.history_title')} aria-busy={read.kind === 'loading'} className="min-w-0 space-y-3 rounded-xl border border-line bg-white p-3 text-sm">
    <h4 className="font-semibold text-ink">{t('assignment.history_title')}</h4>
    <p className="text-xs leading-relaxed text-ink2">{t('assignment.history_scope')}</p>
    <p className="text-xs leading-relaxed text-ink2">{t('assignment.accepted_note')}</p>
    <button type="button" className={assignmentButton} disabled={read.kind === 'loading'} onClick={reload}>{t('refresh')}</button>
    {read.kind === 'loading' ? <p role="status">{t('assignment.loading')}</p> : null}
    {read.kind === 'error' ? <p role="alert">{t('assignment.load_error')}</p> : null}
    {read.kind === 'denied' ? <p role="alert">{t('assignment.access_lost')}</p> : null}
    {read.kind === 'ready' ? <>
      {read.report.items.length ? <ol className="space-y-3">{read.report.items.map(event => <li key={event.id} className="min-w-0 space-y-2 rounded-lg border border-line p-3">
        <p className="font-semibold">{t('assignment.actions.' + event.action)}</p>
        <p className="text-xs text-ink2">{date(event.created_at)}</p>
        {event.notices.length ? <ul className="space-y-2">{event.notices.map(notice => <li key={notice.kind} className="min-w-0 space-y-1 rounded-lg bg-paper p-2">
          <p className="font-semibold">{t('assignment.kinds.' + notice.kind)}</p>
          <p>{t('assignment.statuses.' + notice.status)}</p>
          <dl className="grid min-w-0 grid-cols-2 gap-x-2 gap-y-1 text-xs text-ink2">
            <dt>{t('attempts')}</dt><dd>{notice.attempts}</dd>
            <dt>{t('created')}</dt><dd>{date(notice.created_at)}</dd>
            <dt>{t('last_attempt')}</dt><dd>{date(notice.attempted_at)}</dd>
            {notice.accepted_at ? <><dt>{t('accepted_at')}</dt><dd>{date(notice.accepted_at)}</dd></> : null}
          </dl>
          {notice.outcome_uncertain ? <p className="text-xs leading-relaxed text-amber-900">{t('assignment.email_uncertain')}</p> : null}
        </li>)}</ul> : <p className="text-xs">{t('assignment.no_email')}</p>}
      </li>)}</ol> : <p className="text-xs leading-relaxed">{t(read.report.tracked ? 'assignment.empty_page' : 'assignment.untracked')}</p>}
      <p className="text-xs">{t('assignment.total', { count: read.report.total })}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={assignmentButton} disabled={offset === 0} onClick={() => page(Math.max(0, offset - PAGE_SIZE))}>{t('previous')}</button>
        <button type="button" className={assignmentButton} disabled={offset + PAGE_SIZE >= read.report.total || offset + PAGE_SIZE > 10000} onClick={() => page(offset + PAGE_SIZE)}>{t('next')}</button>
      </div>
    </> : null}
  </section>
}
