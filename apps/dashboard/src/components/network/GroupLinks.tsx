import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createGroupLink, getGroupLinks, revokeGroupLink, type Group, type GroupLink } from '../../api/socialGroups'
import { useGroupMutation } from '../../hooks/useGroupMutation'
import { useNetworkRead } from '../../hooks/useNetworkRead'
import { createGroupInviteToken } from '../../lib/groupInviteMemory'
import { GroupActionStatus } from './GroupShared'
import { NETWORK_BUTTON, NETWORK_FIELD, NETWORK_PRIMARY, NetworkDate, NetworkFreshness, NetworkPagination,
  networkError, useNetworkDraftGuard } from './NetworkShared'

export function GroupLinks({ actorId, group, fresh }: { actorId: string; group: Group; fresh: boolean }) {
  const { t } = useTranslation('property_network')
  const [page, setPage] = useState(1), [days, setDays] = useState(7), [uses, setUses] = useState(100)
  const [secret, setSecret] = useState<{ id: string; token: string } | null>(null)
  const [manualCopy, setManualCopy] = useState(''), [copied, setCopied] = useState(false)
  const read = useNetworkRead(`group-links:${actorId}:${group.id}:${page}:${group.my_role}`,
    signal => getGroupLinks(group.id, page, signal), group.can_manage || group.can_revoke_links)
  const action = useGroupMutation(`create-group-link:${actorId}:${group.id}`, read.refresh)
  useNetworkDraftGuard(!!secret || days !== 7 || uses !== 100 || action.pending, action.busy)
  const current = read.data?.items.find(row => row.id === secret?.id)
  const copyAllowed = group.can_manage && fresh && !read.stale && !read.checking && current?.state === 'active'
  async function copy() {
    if (!secret || !copyAllowed) return
    const url = new URL('/group-invite/', window.location.origin)
    url.hash = 'token=' + secret.token
    try { await navigator.clipboard.writeText(url.href); setCopied(true); setManualCopy('') }
    catch { setManualCopy(url.href) }
  }
  return <section className="min-w-0 space-y-5">
    <h3 className="text-lg font-bold">{t('groups.tabs.links')}</h3>
    <p className="text-sm text-ink2">{t('groups.link_help')}</p>
    {group.can_manage && <form className="space-y-3 rounded-xl border border-line bg-paper p-4" onSubmit={event => {
      event.preventDefault()
      const token = createGroupInviteToken(), input = { token, expires_in_days: days, max_uses: uses }
      action.run(submission_id => createGroupLink(group.id, { ...input, submission_id }), receipt => {
        if (!receipt.current || !('max_uses' in receipt.current)) throw new Error('Link access changed')
        setSecret({ id: receipt.target_id, token }); setCopied(false); setManualCopy(''); setPage(1); setDays(7); setUses(100)
      })
    }}>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <label className="min-w-0 text-sm font-semibold">{t('groups.expires_days')}<input className={NETWORK_FIELD}
          type="number" min={1} max={30} required value={days} disabled={action.blocked} onChange={event => setDays(Number(event.target.value))} /></label>
        <label className="min-w-0 text-sm font-semibold">{t('groups.max_uses')}<input className={NETWORK_FIELD}
          type="number" min={1} max={1000} required value={uses} disabled={action.blocked} onChange={event => setUses(Number(event.target.value))} /></label>
      </div><GroupActionStatus action={action} canRetry={fresh && group.can_manage} />
      <button type="submit" className={NETWORK_PRIMARY} disabled={action.blocked || !fresh || !!secret}>{t('groups.create_link')}</button>
    </form>}
    {secret && group.can_manage && <div className="space-y-3 rounded-xl border border-line p-4">
      <p className="text-sm">{t('groups.link_ready')}</p>
      <div className="flex flex-wrap gap-2"><button type="button" className={NETWORK_PRIMARY} disabled={!copyAllowed} onClick={() => void copy()}>{t('groups.copy_link')}</button>
        <button type="button" className={NETWORK_BUTTON} onClick={() => { setSecret(null); setManualCopy(''); setCopied(false) }}>{t('groups.done_copying')}</button></div>
      {copied && <p role="status" className="text-sm text-sea">{t('groups.link_copied')}</p>}
      {manualCopy && copyAllowed && <label className="block text-sm font-semibold">{t('groups.manual_copy')}
        <textarea className={NETWORK_FIELD} readOnly rows={3} value={manualCopy} onFocus={event => event.target.select()} /></label>}
    </div>}
    <NetworkFreshness read={read} />
    {read.error && <p role="alert" className="text-sm text-red-800">{t(networkError(read.error))}</p>}
    {!read.data ? !read.error && <p role="status">{t('loading')}</p> : <>
      {read.data.items.map(row => <LinkRow key={row.id} row={row} actorId={actorId} group={group}
        fresh={fresh && !read.stale && !read.checking} onSaved={() => {
          if (row.id === secret?.id) { setSecret(null); setManualCopy(''); setCopied(false) }
          read.refresh()
        }} />)}
      {!read.data.items.length && <p className="text-sm text-dim">{t('groups.links_empty')}</p>}
      <NetworkPagination page={page} total={read.data.total} busy={read.checking} onChange={setPage} />
    </>}
  </section>
}
function LinkRow({ row, actorId, group, fresh, onSaved }: { row: GroupLink; actorId: string; group: Group; fresh: boolean; onSaved: () => void }) {
  const { t } = useTranslation('property_network')
  const action = useGroupMutation(`revoke-group-link:${actorId}:${group.id}:${row.id}`, onSaved)
  useNetworkDraftGuard(action.pending, action.busy)
  return <article className="min-w-0 space-y-3 rounded-xl border border-line p-4">
    <p className="font-semibold">{t(`groups.link_states.${row.state}`)}</p>
    <p className="text-sm">{t('groups.link_uses', { used: row.use_count, maximum: row.max_uses })}</p>
    <p className="text-sm">{t('groups.expires')} <NetworkDate value={row.expires_at} showTime /></p>
    {group.can_revoke_links && row.state === 'active' && <button type="button" className={NETWORK_BUTTON}
      disabled={action.blocked || !fresh} onClick={() => {
        if (!window.confirm(t('groups.revoke_link_confirm'))) return
        const input = { expected_version: row.version }
        action.run(submission_id => revokeGroupLink(group.id, row.id, { ...input, submission_id }), () => {})
      }}>{t('groups.revoke_link')}</button>}
    <GroupActionStatus action={action} canRetry={fresh && group.can_revoke_links} />
  </article>
}
