import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getSignupCommunications, type SignupCommunications } from '../../api/communications'

const PAGE_SIZE = 10
const button = 'min-h-11 max-w-full rounded-lg border border-line px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-coral disabled:cursor-not-allowed disabled:opacity-40'
type ReadState = { kind: 'loading' | 'error' | 'denied' } | { kind: 'ready'; report: SignupCommunications }

export function SignupCommunicationHistory({ userId }: { userId: string }) {
  const { t } = useTranslation('communications')
  const [open, setOpen] = useState(false)
  return <section className="min-w-0 space-y-3">
    <button type="button" className={button} aria-expanded={open} onClick={() => setOpen(value => !value)}>{t(open ? 'account.hide' : 'account.open')}</button>
    {open ? <SignupHistoryRead key={userId} userId={userId} /> : null}
  </section>
}

function SignupHistoryRead({ userId }: { userId: string }) {
  const { t, i18n } = useTranslation('communications')
  const [offset, setOffset] = useState(0), [refresh, setRefresh] = useState(0)
  const [read, setRead] = useState<ReadState>({ kind: 'loading' })
  const locale = i18n.language.startsWith('es') ? 'es-DO' : 'en-US'
  const date = (value: string | null) => value ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : t('not_recorded')
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setRead({ kind: 'loading' })
    getSignupCommunications(userId, { limit: PAGE_SIZE, offset }, controller.signal)
      .then(report => { if (active && !controller.signal.aborted) setRead({ kind: 'ready', report }) })
      .catch(error => {
        if (!active || controller.signal.aborted) return
        const status = error?.response?.status
        setRead({ kind: status === 401 || status === 403 || status === 404 ? 'denied' : 'error' })
      })
    return () => { active = false; controller.abort() }
  }, [userId, offset, refresh])
  const loading = read.kind === 'loading'
  function reload() { setRead({ kind: 'loading' }); setRefresh(value => value + 1) }
  function page(next: number) { setRead({ kind: 'loading' }); setOffset(next) }
  return <section aria-label={t('account.title')} aria-busy={loading} className="min-w-0 space-y-3 rounded-xl border border-line bg-white p-3 text-sm">
    <h3 className="font-semibold text-ink">{t('account.title')}</h3>
    <p className="text-xs leading-relaxed text-ink2">{t('account.scope')}</p>
    <p className="text-xs leading-relaxed text-ink2">{t('account.accepted_note')}</p>
    <button type="button" className={button} disabled={loading} onClick={reload}>{t('refresh')}</button>
    {loading ? <p role="status">{t('account.loading')}</p> : null}
    {read.kind === 'error' ? <p role="alert">{t('account.load_error')}</p> : null}
    {read.kind === 'denied' ? <p role="alert">{t('account.access_lost')}</p> : null}
    {read.kind === 'ready' ? <>
      {read.report.items.length ? <ul className="space-y-3">{read.report.items.map(job => <li key={job.id} className="min-w-0 space-y-2 rounded-lg border border-line p-3">
        <h4 className="font-semibold text-ink">{t(/^email_\d+$/.test(job.step) ? 'steps.owner_email' : 'account.steps.' + job.step, { number: job.step.slice(6) })}</h4>
        <p className="font-semibold">{t('statuses.' + job.status)}</p>
        <dl className="grid min-w-0 grid-cols-2 gap-x-2 gap-y-1 text-xs text-ink2">
          <dt>{t('attempts')}</dt><dd>{job.attempts}/{job.max_attempts}</dd>
          <dt>{t('created')}</dt><dd>{date(job.created_at)}</dd>
          <dt>{t('last_attempt')}</dt><dd>{date(job.last_attempt_at)}</dd>
          {job.accepted_at ? <><dt>{t('accepted_at')}</dt><dd>{date(job.accepted_at)}</dd></> : null}
        </dl>
        {job.outcome_uncertain ? <p className="text-xs leading-relaxed text-amber-900">{t('account.uncertain')}</p> : job.error_code ? <p className="text-xs">{t('account.issue')}</p> : null}
      </li>)}</ul> : <p className="text-xs leading-relaxed">{t(read.report.tracked ? 'account.empty_page' : 'account.untracked')}</p>}
      <p className="text-xs">{t('account.total', { count: read.report.total })}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={button} disabled={offset === 0} onClick={() => page(Math.max(0, offset - PAGE_SIZE))}>{t('previous')}</button>
        <button type="button" className={button} disabled={offset + PAGE_SIZE >= read.report.total || offset + PAGE_SIZE > 10000} onClick={() => page(offset + PAGE_SIZE)}>{t('next')}</button>
      </div>
    </> : null}
  </section>
}
