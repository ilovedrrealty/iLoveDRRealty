import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { actOnOwnMembership, archiveGroup, getGroup, type Group, type OwnMemberAction } from '../../api/socialGroups'
import { useGroupMutation } from '../../hooks/useGroupMutation'
import { useNetworkRead } from '../../hooks/useNetworkRead'
import { GroupActionStatus, GroupPhoto } from './GroupShared'
import { GroupMembers } from './GroupMembers'
import { GroupLinks } from './GroupLinks'
import { GroupSettings } from './GroupSettings'
import { GroupFeed } from './GroupFeed'
import { NETWORK_BUTTON, NETWORK_FIELD, NETWORK_PRIMARY, NetworkFreshness, allowNetworkNavigation,
  networkError, useNetworkDraftGuard } from './NetworkShared'

export function GroupWorkspace({ id, actorId, actorCode, inviteCode, onBack }: {
  id: string; actorId: string; actorCode: number | null; inviteCode?: number; onBack: () => void
}) {
  const { t } = useTranslation('property_network')
  const read = useNetworkRead(`group:${actorId}:${id}`, signal => getGroup(id, signal))
  const [selected, setSelected] = useState(inviteCode ? 'members' : 'feed')
  const group = read.data, fresh = !read.stale && !read.checking
  const action = useGroupMutation(`group-archive:${actorId}:${id}`, read.refresh)
  const [reason, setReason] = useState('')
  useNetworkDraftGuard(action.pending || !!reason, action.busy)
  const tabs = group ? [group.can_read_feed && 'feed', group.can_read_members && 'members',
    (group.can_manage || group.can_revoke_links) && 'links', group.can_manage && 'settings'].filter(Boolean) as string[] : []
  const tab = tabs.includes(selected) ? selected : tabs[0]
  return <div className="min-w-0 space-y-5">
    <button type="button" className={NETWORK_BUTTON} onClick={onBack}>{t('groups.back')}</button>
    <NetworkFreshness read={read} />
    {read.error && <p role="alert" className="text-sm text-red-800">{t(networkError(read.error))}</p>}
    {!group ? !read.error && <p role="status">{t('loading')}</p> : <>
      <header className="min-w-0 space-y-3 rounded-2xl bg-ink p-5 text-white">
        <p className="text-xs font-semibold">{t(`groups.visibilities.${group.visibility}`)} · {t(`groups.statuses.${group.status}`)}</p>
        <h2 className="break-words text-2xl font-bold">{group.name}</h2>
        <p className="whitespace-pre-wrap break-words text-sm text-white/80">{group.description}</p>
        <p className="break-words text-sm">{group.area_label} · {t('groups.member_count', { count: group.member_count })}</p>
        <p className="text-sm [overflow-wrap:anywhere]">{t('groups.owner', { alias: group.owner_alias })}</p>
        {group.my_role && <p className="text-sm">{t('groups.your_role', { role: t(`groups.roles.${group.my_role}`) })}</p>}
        {group.image && <GroupPhoto id={group.image.id} context={`${actorId}:${id}:${group.version}`} />}
      </header>
      <p className="text-xs text-dim">{t('groups.scope_help')}</p>
      <OwnMembership key={`${actorId}:${id}`} group={group} actorId={actorId} fresh={fresh} onSaved={read.refresh} />
      {!!tabs.length && <nav className="flex flex-wrap gap-2" aria-label={t('groups.workspace_tabs')}>
        {tabs.map(value => <button type="button" key={value} className={tab === value ? NETWORK_PRIMARY : NETWORK_BUTTON}
          aria-current={tab === value ? 'page' : undefined} onClick={() => { if (allowNetworkNavigation()) setSelected(value) }}>{t(`groups.tabs.${value}`)}</button>)}
      </nav>}
      {tab === 'feed' && <GroupFeed key={`${actorId}:${id}`} actorId={actorId} group={group} fresh={fresh} onGroupChanged={read.refresh} />}
      {tab === 'members' && <GroupMembers key={`${actorId}:${id}`} actorId={actorId} actorCode={actorCode} group={group}
        fresh={fresh} inviteCode={inviteCode} onGroupChanged={read.refresh} />}
      {tab === 'links' && <GroupLinks key={`${actorId}:${id}`} actorId={actorId} group={group} fresh={fresh} />}
      {tab === 'settings' && <GroupSettings key={`${actorId}:${id}`} actorId={actorId} group={group} fresh={fresh} onSaved={read.refresh} />}
      {group.can_archive && group.status === 'active' && <section className="space-y-3 rounded-xl border border-line p-4">
        <h3 className="font-semibold">{t('groups.archive_title')}</h3><p className="text-sm text-ink2">{t('groups.archive_help')}</p>
        <label className="block text-sm font-semibold">{t('groups.reason')}<input className={NETWORK_FIELD} value={reason}
          disabled={action.blocked} maxLength={500} onChange={event => setReason(event.target.value)} /></label>
        <GroupActionStatus action={action} canRetry={fresh} />
        <button type="button" className={NETWORK_BUTTON} disabled={action.blocked || !fresh} onClick={() => {
          if (!window.confirm(t('groups.archive_confirm'))) return
          const input = { expected_version: group.version, action: 'archive' as const, reason: reason.trim() }
          action.run(submission_id => archiveGroup(id, { ...input, submission_id }), () => setReason(''))
        }}>{t('groups.archive')}</button>
      </section>}
    </>}
  </div>
}
function OwnMembership({ group, actorId, fresh, onSaved }: { group: Group; actorId: string; fresh: boolean; onSaved: () => void }) {
  const { t } = useTranslation('property_network')
  const [alias, setAlias] = useState('')
  const action = useGroupMutation(`group-own-member:${actorId}:${group.id}`, onSaved)
  useNetworkDraftGuard(!!alias || action.pending, action.busy)
  const membership = group.membership, state = membership?.state
  const needsAlias = group.can_join || state === 'invited'
  function act(value: OwnMemberAction) {
    const input = { expected_membership_version: membership?.version ?? 0, action: value, member_alias: alias.trim() }
    action.run(submission_id => actOnOwnMembership(group.id, { ...input, submission_id }), () => setAlias(''))
  }
  if (group.my_role === 'owner') return <p className="text-xs text-dim">{t('groups.owner_leave_help')}</p>
  if (!needsAlias && !['active', 'requested'].includes(state ?? '')) return null
  return <section className="space-y-3 rounded-xl border border-line bg-paper p-4">
    {state && <p className="text-sm">{t(`groups.membership_states.${state}`)}</p>}
    {needsAlias && <><label className="block text-sm font-semibold">{t('groups.member_alias')}
      <input className={NETWORK_FIELD} value={alias} maxLength={100} disabled={action.blocked} onChange={event => setAlias(event.target.value)} />
    </label><p className="text-xs text-dim">{t('groups.alias_help')}</p></>}
    <div className="flex flex-wrap gap-2">
      {group.can_join && <button type="button" className={NETWORK_PRIMARY} disabled={action.blocked || !fresh || !alias.trim()}
        onClick={() => act(group.join_policy === 'open' ? 'join' : 'request')}>{t(group.join_policy === 'open' ? 'groups.join' : 'groups.request')}</button>}
      {state === 'invited' && <><button type="button" className={NETWORK_PRIMARY} disabled={action.blocked || !fresh || !alias.trim()}
        onClick={() => act('accept_invite')}>{t('groups.accept_invite')}</button>
        <button type="button" className={NETWORK_BUTTON} disabled={action.blocked || !fresh} onClick={() => act('decline_invite')}>{t('groups.decline_invite')}</button></>}
      {state === 'requested' && <button type="button" className={NETWORK_BUTTON} disabled={action.blocked || !fresh} onClick={() => act('cancel')}>{t('groups.cancel_request')}</button>}
      {state === 'active' && <button type="button" className={NETWORK_BUTTON} disabled={action.blocked || !fresh}
        onClick={() => { if (window.confirm(t('groups.leave_confirm'))) act('leave') }}>{t('groups.leave')}</button>}
    </div><GroupActionStatus action={action} conflictLabel="groups.new_activity_unavailable" canRetry={fresh} />
  </section>
}
