import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CALL_OUTCOMES, ENTRY_KINDS, getInboxConversation, getInboxLegacy, getInboxThread, InboxContractError,
  type Entry, type Source, type ThreadPage } from '../../api/inbox'
import type { UserInfo } from '../../lib/auth'
import { useInboxRead, inboxAccessLost, inboxStatus } from '../../hooks/useInboxRead'
import { useInboxCommand } from '../../hooks/useInboxCommand'
import { useNetworkDraftGuard } from '../network/NetworkShared'
import { INBOX_BUTTON, INBOX_FIELD, INBOX_PRIMARY, InboxCommandStatus, InboxDate, InboxPanel, InboxReadStatus, MemberName, useReviewExpired } from './InboxShared'

export function InboxEntry({ entry }: { entry: Entry }) {
  const { t } = useTranslation('inbox')
  return <li className="min-w-0 space-y-2 rounded-xl border border-line bg-white p-4">
    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold"><MemberName member={entry.author} /><span className="rounded bg-paper px-2 py-1 text-xs">{t('roles.' + entry.author.role)}</span>{entry.context_role ? <span className="text-xs">{t('context_roles.' + entry.context_role)}</span> : null}</p>
    <p className="text-xs text-dim"><InboxDate value={entry.created_at} /></p>
    <p className="whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">{entry.body}</p>
    {entry.kind !== 'message' ? <div className="space-y-1 rounded-lg bg-paper p-3 text-xs"><p className="font-semibold">{t('kinds.' + entry.kind)}</p><p>{t('manual_record_notice')}</p><p>{t('occurred_at')}: <InboxDate value={entry.occurred_at} /></p><p>{t('reported_direction')}: {t('directions.' + entry.reported_direction)}</p>{entry.call_outcome ? <p>{t('reported_outcome')}: {t('outcomes.' + entry.call_outcome)}</p> : null}</div> : <p className="text-xs text-dim">{t('delivery.' + entry.delivery_state)}</p>}
  </li>
}

export function InboxThread({ source, reviewId = null, user, freshPolicy }: { source: Source; reviewId?: string | null; user: UserInfo; freshPolicy: boolean }) {
  const { t } = useTranslation('inbox'), [cursors, setCursors] = useState<(string | null)[]>([null]), cursor = cursors[cursors.length - 1]
  const read = useInboxRead(JSON.stringify(['inbox-thread', user.id, source, cursor, reviewId]), signal => getInboxThread(source, cursor, reviewId, signal))
  const [body, setBody] = useState(''), [kind, setKind] = useState<Entry['kind']>('message'), [occurred, setOccurred] = useState('')
  const [direction, setDirection] = useState<'incoming' | 'outgoing'>('outgoing'), [outcome, setOutcome] = useState<typeof CALL_OUTCOMES[number]>('unspecified'), [manualConfirmed, setManualConfirmed] = useState(false), [fieldsError, setFieldsError] = useState(false)
  const denied = inboxAccessLost(read.error), expired = useReviewExpired(read.data?.review_expires_at ?? null) || inboxStatus(read.error) === 410
  const command = useInboxCommand<ThreadPage>({
    load: (receipt, attempt, signal) => getInboxThread(source, attempt.action === 'entry_created' ? null : cursor, reviewId, signal),
    authorize: (_, signal) => getInboxThread(source, cursor, reviewId, signal),
    canRetry: (attempt, current) => {
      const primary = current.conversation?.participants.some(member => member.id === user.id) && !current.conversation.is_observer
      if (attempt.action === 'entry_created') return !current.read_only && (attempt.body.review_id ?? null) === reviewId
      return !!primary && (attempt.action !== 'read_marked' || Number(attempt.body.last_read_sequence) <= current.conversation!.last_sequence)
    },
    applied: (_, receipt) => { if (receipt.action === 'entry_created') { setBody(''); setOccurred(''); setManualConfirmed(false); setCursors([null]) } read.refresh() },
    reviewed: () => read.refresh(),
  }, denied)
  useEffect(() => { if (denied) { setBody(''); setOccurred(''); setManualConfirmed(false) } }, [denied])
  const hasDraft = !!body || !!occurred || manualConfirmed, pending = command.pending !== null, busy = command.busy
  useNetworkDraftGuard(hasDraft || pending, busy)
  const fresh = freshPolicy && !read.stale && !read.checking && !read.error && !!read.data && !expired && !command.denied
  const thread = !denied && !expired ? read.data : null, conversation = thread?.conversation
  const primary = !!conversation && !conversation.is_observer && conversation.participants.some(member => member.id === user.id)
  const other = primary ? conversation?.participants.find(member => member.id !== user.id) : null
  const shownSequence = Math.max(0, ...(thread?.items.map(entry => entry.sequence ?? 0) ?? []))
  const writable = !!thread && (primary || user.role === 'admin' && reviewId !== null) && !thread.read_only && fresh && !busy && !pending
  function post() {
    if (!writable || kind !== 'message' && !manualConfirmed) return
    let at: string | undefined
    try { if (kind !== 'message') at = new Date(occurred).toISOString() } catch { setFieldsError(true); return }
    setFieldsError(false)
    command.send({ action: 'entry_created', conversation_id: source.id, submission_id: crypto.randomUUID(), kind, body,
      ...(kind === 'message' ? {} : { occurred_at: at, reported_direction: direction }), ...(kind === 'manual_call' ? { call_outcome: outcome } : {}), ...(reviewId ? { review_id: reviewId } : {}) })
  }
  function older() {
    const next = thread?.next_cursor
    if (next && !cursors.includes(next)) setCursors([...cursors, next])
  }
  return <InboxPanel title={t('thread')}><p className="text-sm text-ink2">{t('oversight_notice')}</p><p className="text-sm font-semibold">{t('sources.' + source.kind)}</p>
    <InboxReadStatus read={read} />{expired ? <p role="alert">{t('review_expired')}</p> : null}
    {thread ? <>
      {conversation ? <header className="space-y-2 rounded-xl bg-paper p-4"><h3 className="flex flex-wrap gap-3 font-bold">{conversation.participants.map(member => <MemberName key={member.id} member={member} />)}</h3><p className="text-xs">{t('two_participants')}</p>{conversation.brokerage_subject_id ? <p className="text-xs">{t('assignment_history')}</p> : null}</header> : <p className="text-sm">{t('legacy_read_only')}</p>}
      {thread.read_only_reason ? <p role="status" className="rounded-lg bg-paper p-3 text-sm">{t('reasons.' + thread.read_only_reason)}</p> : null}
      <p className="text-sm">{t('entry_count', { count: thread.total })}</p>
      <ol className="space-y-3">{thread.items.slice().reverse().map(entry => <InboxEntry key={entry.id} entry={entry} />)}</ol>{!thread.items.length ? <p>{t('empty_thread')}</p> : null}
      <nav aria-label={t('history_navigation')} className="flex flex-wrap gap-3"><button type="button" className={INBOX_BUTTON} disabled={read.checking || cursors.length <= 1} onClick={() => setCursors(cursors.slice(0, -1))}>{t('newer')}</button><button type="button" className={INBOX_BUTTON} disabled={read.checking || !thread.next_cursor || cursors.includes(thread.next_cursor)} onClick={older}>{t('older')}</button><button type="button" className={INBOX_BUTTON} disabled={read.checking || cursor === null} onClick={() => setCursors([null])}>{t('latest')}</button></nav>
      {primary ? <div className="flex flex-wrap gap-3"><button type="button" className={INBOX_BUTTON} disabled={!fresh || busy || pending || shownSequence === 0} onClick={() => command.send({ action: 'read_marked', submission_id: crypto.randomUUID(), conversation_id: source.id, last_read_sequence: shownSequence })}>{t('mark_shown_read')}</button>{other ? <button type="button" className={INBOX_BUTTON} disabled={!fresh || busy || pending} onClick={() => command.send({ action: 'block_saved', submission_id: crypto.randomUUID(), user_id: other.id, blocked: true })}>{t('block_member')}</button> : null}</div> : null}
      {source.kind === 'native' ? <form className="space-y-4 border-t border-line pt-4" onSubmit={event => { event.preventDefault(); post() }}>
        {reviewId ? <p className="text-sm font-semibold">{t('admin_posts_as_self', { name: user.display_name.trim() || t('roles.admin') })}</p> : null}
        <fieldset disabled={!writable} className="min-w-0 space-y-4"><label className="block text-sm font-semibold">{t('entry_kind')}<select className={INBOX_FIELD} value={kind} onChange={event => { setKind(event.target.value as Entry['kind']); setManualConfirmed(false); setFieldsError(false) }}>{ENTRY_KINDS.map(value => <option key={value} value={value}>{t('kinds.' + value)}</option>)}</select></label>
          <label className="block text-sm font-semibold">{t(kind === 'message' ? 'message_body' : 'manual_body')}<textarea className={INBOX_FIELD} rows={5} maxLength={4000} value={body} required onChange={event => setBody(event.target.value)} /></label>
          <p className="text-xs text-dim">{t('body_limit', { count: [...body.trim()].length })}</p>
          {kind !== 'message' ? <div className="space-y-4 rounded-xl bg-paper p-4"><p className="text-sm">{t('manual_record_notice')}</p><label className="block text-sm font-semibold">{t('occurred_local')}<input type="datetime-local" step="1" className={INBOX_FIELD} value={occurred} required onChange={event => setOccurred(event.target.value)} /></label><label className="block text-sm font-semibold">{t('reported_direction')}<select className={INBOX_FIELD} value={direction} onChange={event => setDirection(event.target.value as typeof direction)}>{['incoming', 'outgoing'].map(value => <option key={value} value={value}>{t('directions.' + value)}</option>)}</select></label>{kind === 'manual_call' ? <label className="block text-sm font-semibold">{t('reported_outcome')}<select className={INBOX_FIELD} value={outcome} onChange={event => setOutcome(event.target.value as typeof outcome)}>{CALL_OUTCOMES.map(value => <option key={value} value={value}>{t('outcomes.' + value)}</option>)}</select></label> : null}<label className="flex min-h-11 items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={manualConfirmed} onChange={event => setManualConfirmed(event.target.checked)} />{t('manual_confirm')}</label></div> : null}
          <button type="submit" className={INBOX_PRIMARY} disabled={!body.trim() || [...body.trim()].length > 2000 || kind !== 'message' && !manualConfirmed}>{t(kind === 'message' ? 'post_message' : 'save_manual')}</button>
        </fieldset>{fieldsError ? <p role="alert">{t('invalid_fields')}</p> : null}
      </form> : null}
    </> : null}
    <InboxCommandStatus command={command} />
  </InboxPanel>
}

export function InboxAuditWorkspace({ source, user, freshPolicy }: { source: Source; user: UserInfo; freshPolicy: boolean }) {
  const { t } = useTranslation('inbox'), [reason, setReason] = useState<'oversight' | 'support'>('oversight'), [reviewId, setReviewId] = useState<string | null>(null), [expires, setExpires] = useState<string | null>(null)
  const command = useInboxCommand<ThreadPage | boolean>({
    load: (receipt, _, signal) => getInboxThread(source, null, receipt.target_id, signal),
    authorize: async (_, signal) => { if (source.kind === 'native') await getInboxConversation(source.id, signal); else await getInboxLegacy(1, signal); return true },
    canRetry: () => true,
    applied: (current, receipt) => { if (typeof current === 'boolean') throw new InboxContractError(); setReviewId(receipt.target_id); setExpires(current.review_expires_at) },
  }, user.role !== 'admin')
  useNetworkDraftGuard(command.pending !== null, command.busy)
  if (user.role !== 'admin') return null
  return <div className="space-y-5"><InboxPanel title={t('audited_review')}><p className="text-sm">{t('audit_help')}</p><p className="text-sm font-semibold">{t('sources.' + source.kind)}</p>{expires ? <p className="text-xs">{t('review_deadline')} <InboxDate value={expires} /></p> : null}<label className="block text-sm font-semibold">{t('review_reason')}<select className={INBOX_FIELD} value={reason} disabled={command.busy || command.pending !== null} onChange={event => setReason(event.target.value as typeof reason)}><option value="oversight">{t('review_oversight')}</option><option value="support">{t('review_support')}</option></select></label><button type="button" className={INBOX_PRIMARY} disabled={!freshPolicy || command.busy || command.pending !== null} onClick={() => command.send({ action: 'review_opened', submission_id: crypto.randomUUID(), source, reason })}>{t(reviewId ? 'renew_review' : 'open_review')}</button><InboxCommandStatus command={command} /></InboxPanel>
    {reviewId ? <InboxThread source={source} reviewId={reviewId} user={user} freshPolicy={freshPolicy} /> : null}
  </div>
}

export function InboxNativeConversation({ id, user, freshPolicy }: { id: string; user: UserInfo; freshPolicy: boolean }) {
  const read = useInboxRead(`inbox-native-header:${user.id}:${id}`, signal => getInboxConversation(id, signal))
  return <div className="space-y-4"><InboxReadStatus read={read} />{read.data ? read.data.is_observer
    ? user.role === 'admin' ? <InboxAuditWorkspace source={{ kind: 'native', id, recipient_id: null }} user={user} freshPolicy={freshPolicy && !read.stale && !read.error} /> : null
    : <InboxThread source={{ kind: 'native', id, recipient_id: null }} user={user} freshPolicy={freshPolicy && !read.stale && !read.error} /> : null}</div>
}
