import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { inboxAccessLost, inboxStatus, type InboxRead } from '../../hooks/useInboxRead'
import { useInboxCommand } from '../../hooks/useInboxCommand'
import { InboxContractError, type Member } from '../../api/inbox'

export const INBOX_BUTTON = 'min-h-11 min-w-0 rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold text-ink disabled:opacity-40'
export const INBOX_PRIMARY = INBOX_BUTTON + ' !bg-sea !text-white'
export const INBOX_FIELD = 'mt-1.5 min-h-11 min-w-0 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink'
export function InboxPanel({ children, title }: { children: ReactNode; title: string }) { return <section className="min-w-0 space-y-4 rounded-2xl border border-line bg-white p-4 sm:p-5"><h2 className="break-words text-lg font-bold">{title}</h2>{children}</section> }
export function InboxDate({ value }: { value: string | null }) {
  const { i18n } = useTranslation('inbox')
  return value ? <time dateTime={value} title={value}>{new Date(value).toLocaleString(i18n.language.startsWith('es') ? 'es-DO' : 'en-US')}</time> : null
}
export function MemberName({ member }: { member: Member }) {
  const { t } = useTranslation('inbox')
  return <span className="[overflow-wrap:anywhere]">{member.display_name.trim() || t('unnamed_member', { code: member.user_code ?? '—' })}</span>
}
export function InboxReadStatus({ read }: { read: InboxRead<unknown> }) {
  const { t } = useTranslation('inbox'), status = inboxStatus(read.error)
  const error = read.error instanceof InboxContractError ? 'read_error' : inboxAccessLost(read.error) ? 'access_lost' : status === 410 ? 'review_expired' : status === 429 ? 'rate_limit' : 'read_error'
  return <div className="space-y-2 text-sm" aria-live="polite">
    {read.error ? <p role="alert" className="text-red-800">{t(error)}</p> : read.checking ? <p role="status">{t('checking')}</p> : null}
    {read.stale && read.data ? <p className="text-amber-950">{t('stale')}</p> : null}
    {read.checkedAt ? <p className="text-xs text-dim">{t('last_checked')} <InboxDate value={new Date(read.checkedAt).toISOString()} /></p> : null}
    <button type="button" className={INBOX_BUTTON} disabled={read.checking} onClick={read.refresh}>{t('refresh')}</button>
  </div>
}
export function InboxPager({ page, total, busy, change }: { page: number; total: number; busy: boolean; change: (page: number) => void }) {
  const { t } = useTranslation('inbox')
  return <nav aria-label={t('list_pages')} className="flex flex-wrap items-center gap-3">
    <button type="button" className={INBOX_BUTTON} disabled={busy || page <= 1} onClick={() => change(page - 1)}>{t('previous')}</button>
    <span className="text-sm">{t('page', { page })}</span>
    <button type="button" className={INBOX_BUTTON} disabled={busy || page >= 1000 || page * 30 >= total} onClick={() => change(page + 1)}>{t('next')}</button>
  </nav>
}
export function InboxCommandStatus({ command }: { command: Omit<ReturnType<typeof useInboxCommand<unknown>>, 'send'> }) {
  const { t } = useTranslation('inbox')
  return <div className="space-y-3 text-sm" aria-live="polite">
    {command.invalid ? <p role="alert" className="text-red-800">{t('invalid_fields')}</p> : null}
    {command.error ? <p role="alert" className="text-red-800">{t('errors.' + command.error)}</p> : null}
    {command.saved ? <p role="status">{t('saved')}</p> : null}
    {command.pending && !command.denied ? <><p>{t(command.busy ? 'saving' : 'uncertain')}</p>
      <button type="button" className={INBOX_BUTTON} disabled={command.busy} onClick={command.check}>{t('check_result')}</button>
      {command.checked ? <><p>{t('checked_unknown')}</p><button type="button" className={INBOX_BUTTON} disabled={command.busy} onClick={command.conflicted ? command.reviewConflict : command.retry}>{t(command.conflicted ? 'review_current' : 'retry_same')}</button></> : null}
    </> : null}
  </div>
}
/** Hides expired review bodies immediately at their advertised deadline; the API is authoritative. */
export function useReviewExpired(expires: string | null) {
  const [expired, setExpired] = useState(false)
  useEffect(() => {
    const delay = expires ? Date.parse(expires) - Date.now() : Infinity
    setExpired(delay <= 0)
    if (Number.isFinite(delay) && delay > 0) { const timer = window.setTimeout(() => setExpired(true), Math.min(delay, 2147483647)); return () => window.clearTimeout(timer) }
  }, [expires])
  return expired || !!expires && Date.parse(expires) <= Date.now()
}
