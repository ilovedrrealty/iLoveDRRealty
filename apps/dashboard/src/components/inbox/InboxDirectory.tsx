import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getInboxBlocks, getInboxConversation, getInboxConversations, getInboxLegacy, getInboxPreferences, getInboxRecipients, InboxContractError,
  type Page, type Preferences, type Recipient, type Source, type Summary } from '../../api/inbox'
import { useInboxRead, inboxAccessLost } from '../../hooks/useInboxRead'
import { useInboxCommand } from '../../hooks/useInboxCommand'
import { allowNetworkNavigation, useNetworkDraftGuard } from '../network/NetworkShared'
import { INBOX_BUTTON, INBOX_FIELD, INBOX_PRIMARY, InboxCommandStatus, InboxDate, InboxPager, InboxPanel, InboxReadStatus, MemberName } from './InboxShared'

export function InboxConversations({ actor, oversight = false, onOpen, onReview }: { actor: string; oversight?: boolean; onOpen: (id: string) => void; onReview: (source: Source) => void }) {
  const { t } = useTranslation('inbox'), [page, setPage] = useState(1)
  const read = useInboxRead(`inbox-list:${actor}:${oversight}:${page}`, signal => getInboxConversations(oversight ? 'oversight' : 'mine', page, signal))
  return <InboxPanel title={t(oversight ? 'oversight' : 'conversations')}><p className="text-sm text-ink2">{t(oversight ? 'oversight_help' : 'conversations_help')}</p><InboxReadStatus read={read} />
    {read.data ? <><div className="space-y-3">{read.data.items.map(item => <article key={item.id} className="min-w-0 space-y-2 rounded-xl border border-line p-4">
      <h3 className="flex flex-wrap gap-2 font-semibold">{item.participants.map(member => <MemberName key={member.id} member={member} />)}</h3>
      <p className="text-xs text-dim"><InboxDate value={item.last_entry_at ?? item.created_at} /></p>
      {!oversight && item.last_entry_preview ? <p className="whitespace-pre-wrap break-words text-sm">{item.last_entry_preview}</p> : null}
      {!oversight ? <p className="text-sm">{t('unread_count', { count: item.unread_count })}</p> : null}
      <button type="button" className={INBOX_BUTTON} onClick={() => { if (allowNetworkNavigation()) oversight ? onReview({ kind: 'native', id: item.id, recipient_id: null }) : onOpen(item.id) }}>{t(oversight ? 'choose_review' : 'open_conversation')}</button>
    </article>)}</div>{!read.data.items.length ? <p>{t('empty_conversations')}</p> : null}<InboxPager page={page} total={read.data.total} busy={read.checking} change={setPage} /></> : null}
  </InboxPanel>
}

export function InboxRecipients({ actor, freshPolicy, onOpen }: { actor: string; freshPolicy: boolean; onOpen: (id: string) => void }) {
  const { t } = useTranslation('inbox'), [draft, setDraft] = useState(''), [query, setQuery] = useState(''), [page, setPage] = useState(1), [selected, setSelected] = useState<Recipient | null>(null)
  const read = useInboxRead(`inbox-recipients:${actor}:${query}:${page}`, signal => getInboxRecipients(query, page, signal))
  type Current = { directory: Page<Recipient>; conversation?: Summary }
  const command = useInboxCommand<Current>({
    load: async (receipt, attempt, signal) => {
      const directory = await getInboxRecipients(query, page, signal)
      if (attempt.action !== 'conversation_opened') return { directory }
      const conversation = await getInboxConversation(receipt.target_id, signal)
      if (conversation.is_observer || !conversation.participants.some(p => p.id === actor) || !conversation.participants.some(p => p.id === attempt.body.recipient_id)) throw new InboxContractError()
      return { directory, conversation }
    },
    authorize: async (_, signal) => ({ directory: await getInboxRecipients(query, page, signal) }),
    canRetry: (attempt, current) => current.directory.items.some(member => member.id === (attempt.body.recipient_id ?? attempt.target)),
    applied: current => { setSelected(null); read.refresh(); if (current.conversation) onOpen(current.conversation.id) }, reviewed: () => read.refresh(),
  }, inboxAccessLost(read.error))
  const locked = command.busy || command.pending !== null || command.denied
  useNetworkDraftGuard(locked, command.busy)
  useEffect(() => { if (inboxAccessLost(read.error) || command.denied) { setSelected(null); setDraft('') } }, [read.error, command.denied])
  return <InboxPanel title={t('new_conversation')}><p className="text-sm text-ink2">{t('routing_help')}</p><form className="flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); if (!locked) { setQuery(draft.trim()); setPage(1); setSelected(null) } }}>
    <label className="min-w-0 flex-1 text-sm font-semibold">{t('find_member')}<input className={INBOX_FIELD} value={draft} maxLength={80} disabled={locked} onChange={event => setDraft(event.target.value)} /></label><button className={INBOX_BUTTON} disabled={locked}>{t('search')}</button></form>
    <InboxReadStatus read={read} />{read.data && !command.denied ? <><ul className="space-y-3">{read.data.items.map(member => <li key={member.id} className="min-w-0 rounded-xl border border-line p-3"><p className="font-semibold"><MemberName member={member} /></p><p className="mt-1 text-xs">{t('roles.' + member.role)} · {t('relationships.' + member.relationship)}</p><button type="button" className={INBOX_BUTTON + ' mt-3'} disabled={locked || !freshPolicy || read.stale || !!read.error} onClick={() => setSelected(member)}>{t('select_member')}</button></li>)}</ul>{!read.data.items.length ? <p>{t('empty_recipients')}</p> : null}<InboxPager page={page} total={read.data.total} busy={read.checking || locked} change={value => { setPage(value); setSelected(null) }} /></> : null}
    {selected && !inboxAccessLost(read.error) && !command.denied ? <section className="space-y-3 rounded-xl bg-paper p-4"><h3 className="font-semibold"><MemberName member={selected} /></h3><p className="text-sm">{t('open_help')}</p><div className="flex flex-wrap gap-3"><button type="button" className={INBOX_PRIMARY} disabled={locked || read.stale || !!read.error || !freshPolicy} onClick={() => command.send({ action: 'conversation_opened', submission_id: crypto.randomUUID(), recipient_id: selected.id })}>{t('start_conversation')}</button><button type="button" className={INBOX_BUTTON} disabled={locked || read.stale || !!read.error || !freshPolicy} onClick={() => command.send({ action: 'block_saved', submission_id: crypto.randomUUID(), user_id: selected.id, blocked: true })}>{t('block')}</button></div></section> : null}
    <InboxCommandStatus command={command} />
  </InboxPanel>
}

export function InboxPreferences({ actor, freshPolicy }: { actor: string; freshPolicy: boolean }) {
  const { t } = useTranslation('inbox'), read = useInboxRead('inbox-preferences:' + actor, getInboxPreferences)
  const [baseline, setBaseline] = useState<Preferences | null>(null), [visibility, setVisibility] = useState<Preferences['visibility']>('private')
  const dirty = baseline !== null && visibility !== baseline.visibility
  const command = useInboxCommand({ load: (_, __, signal) => getInboxPreferences(signal), authorize: (_, signal) => getInboxPreferences(signal),
    canRetry: (attempt, current) => current.version === attempt.body.expected_version,
    applied: current => { setBaseline(current); setVisibility(current.visibility); read.refresh() },
    reviewed: current => { setBaseline(current); read.refresh() },
  }, inboxAccessLost(read.error))
  useEffect(() => {
    if (inboxAccessLost(read.error) || command.denied) { setBaseline(null); setVisibility('private') }
    else if (read.data && !read.stale && !read.error && !command.pending && (!baseline || !dirty)) { setBaseline(read.data); setVisibility(read.data.visibility) }
  }, [read.data, read.stale, read.error, command.pending, command.denied, baseline, dirty])
  useNetworkDraftGuard(dirty || command.pending !== null, command.busy)
  const locked = command.busy || command.pending !== null || command.denied || read.stale || !!read.error || !freshPolicy
  return <InboxPanel title={t('preferences')}><p className="text-sm">{t('visibility_help')}</p><p className="text-xs text-ink2">{t('oversight_notice')}</p><InboxReadStatus read={read} />
    {baseline && !inboxAccessLost(read.error) && !command.denied ? <form className="space-y-4" onSubmit={event => { event.preventDefault(); if (!locked && baseline.version === read.data?.version) command.send({ action: 'visibility_saved', actor_id: actor, submission_id: crypto.randomUUID(), expected_version: baseline.version, visibility }) }}>
      <label className="flex min-h-11 items-start gap-3 text-sm"><input className="mt-1" type="checkbox" checked={visibility === 'members'} disabled={locked} onChange={event => setVisibility(event.target.checked ? 'members' : 'private')} />{t('allow_discovery')}</label>
      {baseline.version === 0 ? <p className="text-xs">{t('default_visibility')}</p> : null}
      {read.data && read.data.version !== baseline.version ? <p role="status">{t('settings_changed')}</p> : null}
      <button type="submit" className={INBOX_PRIMARY} disabled={locked || !dirty || baseline.version !== read.data?.version}>{t('save_preferences')}</button>
      {read.data && read.data.version !== baseline.version ? <button type="button" className={INBOX_BUTTON} disabled={locked} onClick={() => setBaseline(read.data)}>{t('review_current')}</button> : null}
    </form> : null}
    <InboxCommandStatus command={command} />
  </InboxPanel>
}

export function InboxBlocks({ actor, freshPolicy }: { actor: string; freshPolicy: boolean }) {
  const { t } = useTranslation('inbox'), [page, setPage] = useState(1), read = useInboxRead(`inbox-blocks:${actor}:${page}`, signal => getInboxBlocks(page, signal))
  const command = useInboxCommand({ load: (_, __, signal) => getInboxBlocks(page, signal), authorize: (_, signal) => getInboxBlocks(page, signal),
    canRetry: (attempt, current) => current.items.some(value => value.id === attempt.target), applied: read.refresh, reviewed: read.refresh,
  }, inboxAccessLost(read.error))
  useNetworkDraftGuard(command.pending !== null, command.busy)
  const locked = !freshPolicy || read.stale || !!read.error || command.busy || command.pending !== null || command.denied
  return <InboxPanel title={t('blocks')}><p className="text-sm">{t('block_help')}</p><InboxReadStatus read={read} />{read.data && !command.denied ? <><ul className="space-y-3">{read.data.items.map(member => <li key={member.id} className="min-w-0 space-y-3 rounded-xl border border-line p-4"><p className="font-semibold"><MemberName member={member} /></p><button type="button" className={INBOX_BUTTON} disabled={locked || actor === member.id} onClick={() => command.send({ action: 'block_saved', submission_id: crypto.randomUUID(), user_id: member.id, blocked: false })}>{t('unblock')}</button></li>)}</ul>{!read.data.items.length ? <p>{t('empty_blocks')}</p> : null}<InboxPager page={page} total={read.data.total} busy={read.checking || command.busy || command.pending !== null} change={value => { if (allowNetworkNavigation()) setPage(value) }} /></> : null}<InboxCommandStatus command={command} /></InboxPanel>
}
export function InboxLegacy({ actor, onReview }: { actor: string; onReview: (source: Source) => void }) {
  const { t } = useTranslation('inbox'), [page, setPage] = useState(1), read = useInboxRead(`inbox-legacy:${actor}:${page}`, signal => getInboxLegacy(page, signal))
  return <InboxPanel title={t('legacy')}><p className="text-sm">{t('legacy_help')}</p><InboxReadStatus read={read} />{read.data ? <><ul className="space-y-3">{read.data.items.map(item => <li key={item.source.kind + ':' + item.source.id + ':' + item.source.recipient_id} className="min-w-0 space-y-3 rounded-xl border border-line p-4"><h3 className="font-semibold">{t('sources.' + item.source.kind)}</h3><p className="break-all text-xs">{t('source_reference')}: {item.source.id}{item.source.recipient_id ? ' / ' + item.source.recipient_id : ''}</p><p className="text-sm">{t('entry_count', { count: item.total_messages })}</p><p className="text-xs"><InboxDate value={item.last_entry_at} /></p><button type="button" className={INBOX_BUTTON} onClick={() => onReview(item.source)}>{t('choose_review')}</button></li>)}</ul>{!read.data.items.length ? <p>{t('empty_legacy')}</p> : null}<InboxPager page={page} total={read.data.total} busy={read.checking} change={setPage} /></> : null}</InboxPanel>
}
