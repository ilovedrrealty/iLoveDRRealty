import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getInboxPolicy, getInboxUnread, inboxId, type Source } from '../../api/inbox'
import type { UserInfo } from '../../lib/auth'
import { inboxAccessLost, useInboxRead } from '../../hooks/useInboxRead'
import { allowNetworkNavigation } from '../../components/network/NetworkShared'
import { InboxBlocks, InboxConversations, InboxLegacy, InboxPreferences, InboxRecipients } from '../../components/inbox/InboxDirectory'
import { InboxAuditWorkspace, InboxNativeConversation } from '../../components/inbox/InboxThread'
import { INBOX_BUTTON, InboxReadStatus } from '../../components/inbox/InboxShared'

export function inboxConversationTarget(params: URLSearchParams): { id: string | null; invalid: boolean } {
  const values = params.getAll('conversation')
  if (!values.length) return { id: null, invalid: false }
  try { return values.length === 1 ? { id: inboxId(values[0]), invalid: false } : { id: null, invalid: true } }
  catch { return { id: null, invalid: true } }
}
type Tab = 'mine' | 'new' | 'preferences' | 'blocks' | 'oversight' | 'legacy'
export function NativeInbox({ user }: { user: UserInfo }) {
  const { t } = useTranslation('inbox'), [params, setParams] = useSearchParams(), target = inboxConversationTarget(params), query = params.toString()
  const [tab, setTab] = useState<Tab>('mine'), [auditSelection, setAuditSelection] = useState<{ source: Source; query: string } | null>(null)
  const audit = auditSelection?.query === query ? auditSelection.source : null
  const setAudit = (source: Source | null) => setAuditSelection(source ? { source, query } : null)
  const policy = useInboxRead('inbox-policy:' + user.id, getInboxPolicy), [policyReady, setPolicyReady] = useState(false)
  const allowed = (!!policy.data || policyReady) && !inboxAccessLost(policy.error)
  const unread = useInboxRead('inbox-unread:' + user.id, getInboxUnread, allowed)
  const fresh = !!policy.data && !policy.stale && !policy.error && !policy.checking
  useEffect(() => { if (policy.data) setPolicyReady(true); if (inboxAccessLost(policy.error)) setPolicyReady(false) }, [policy.data, policy.error])
  useEffect(() => { setAudit(null) }, [query])
  function chooseConversation(id: string | null) {
    const next = new URLSearchParams(), workspace = params.get('workspace')
    if (user.role === 'admin' && workspace && ['admin', 'buyer', 'owner', 'realtor'].includes(workspace)) next.set('workspace', workspace)
    if (id) next.set('conversation', inboxId(id))
    setAudit(null); setParams(next)
  }
  function changeTab(value: Tab) { if (allowNetworkNavigation()) { setTab(value); chooseConversation(null) } }
  const tabs: Tab[] = user.role === 'admin' ? ['mine', 'new', 'preferences', 'blocks', 'oversight', 'legacy'] : ['mine', 'new', 'preferences', 'blocks']
  return <div className="min-w-0 space-y-5">
    <p className="max-w-4xl text-sm leading-relaxed text-ink2">{t('intro')}</p><p className="rounded-xl border border-line bg-white p-4 text-sm">{t('oversight_notice')}</p><p className="text-xs leading-relaxed text-ink2">{t('channels_notice')}</p>
    <InboxReadStatus read={policy} />
    {allowed ? <>
      {unread.data && !unread.error ? <p role="status" className="text-sm">{t('unread_summary', unread.data)}</p> : null}
      <nav aria-label={t('inbox_sections')} className="flex flex-wrap gap-2">{tabs.map(value => <button key={value} type="button" className={INBOX_BUTTON} aria-current={tab === value && !audit && !target.id ? 'page' : undefined} onClick={() => changeTab(value)}>{t('tabs.' + value)}</button>)}</nav>
      {target.invalid ? <div role="alert" className="space-y-3"><p>{t('invalid_link')}</p><button type="button" className={INBOX_BUTTON} onClick={() => chooseConversation(null)}>{t('back_to_inbox')}</button></div>
        : audit || target.id ? <><button type="button" className={INBOX_BUTTON} onClick={() => { if (allowNetworkNavigation()) chooseConversation(null) }}>{t('back_to_inbox')}</button>
          {audit ? user.role === 'admin' ? <InboxAuditWorkspace key={user.id + ':' + JSON.stringify(audit)} source={audit} user={user} freshPolicy={fresh} /> : null
            : target.id ? <InboxNativeConversation key={user.id + ':' + target.id} id={target.id} user={user} freshPolicy={fresh} /> : null}</>
        : tab === 'mine' ? <InboxConversations actor={user.id} onOpen={chooseConversation} onReview={setAudit} />
        : tab === 'new' ? <InboxRecipients actor={user.id} freshPolicy={fresh} onOpen={chooseConversation} />
        : tab === 'preferences' ? <InboxPreferences actor={user.id} freshPolicy={fresh} />
        : tab === 'blocks' ? <InboxBlocks actor={user.id} freshPolicy={fresh} />
        : tab === 'oversight' && user.role === 'admin' ? <InboxConversations actor={user.id} oversight onOpen={chooseConversation} onReview={setAudit} />
        : tab === 'legacy' && user.role === 'admin' ? <InboxLegacy actor={user.id} onReview={setAudit} /> : null}
    </> : null}
  </div>
}
