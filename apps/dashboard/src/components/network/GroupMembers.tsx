import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getGroupMembers, manageGroupMember, type Group, type GroupMembership, type GroupRole, type ManageMemberAction } from '../../api/socialGroups'
import { useGroupMutation } from '../../hooks/useGroupMutation'
import { useNetworkRead } from '../../hooks/useNetworkRead'
import { GroupActionStatus } from './GroupShared'
import { NETWORK_BUTTON, NETWORK_FIELD, NETWORK_PRIMARY, NetworkFreshness, NetworkPagination,
  allowNetworkNavigation, networkError, useNetworkDraftGuard } from './NetworkShared'

export function groupCanActOnMember(group: Group, row: GroupMembership, actorCode: number | null) {
  if (!row.user_code || row.user_code === actorCode || !group.my_role || group.my_role === 'member') return false
  if (row.role === 'admin' && group.my_role !== 'owner') return false
  return !(row.role === 'moderator' && group.my_role === 'moderator')
}
export function GroupMembers({ actorId, actorCode, group, fresh, inviteCode, onGroupChanged }: {
  actorId: string; actorCode: number | null; group: Group; fresh: boolean; inviteCode?: number; onGroupChanged: () => void
}) {
  const { t } = useTranslation('property_network')
  const [selected, setSelected] = useState<'active' | 'pending' | 'all'>(group.can_moderate ? 'all' : 'active')
  const [page, setPage] = useState(1), [code, setCode] = useState(inviteCode ? String(inviteCode) : '')
  const [expiry, setExpiry] = useState(7)
  const view = group.can_moderate ? selected : 'active'
  const read = useNetworkRead(`group-members:${actorId}:${group.id}:${view}:${page}:${group.my_role}`,
    signal => getGroupMembers(group.id, view, page, signal), group.can_read_members)
  const refresh = () => { read.refresh(); onGroupChanged() }
  const action = useGroupMutation(`invite-member:${actorId}:${group.id}`, refresh)
  useNetworkDraftGuard(!!code || action.pending, action.busy)
  const parsedCode = /^[1-9]\d{0,9}$/.test(code) && Number(code) <= 2147483647 ? Number(code) : null
  const ready = fresh && !read.stale && !read.checking
  return <section className="min-w-0 space-y-5">
    <h3 className="text-lg font-bold">{t('groups.tabs.members')}</h3>
    {group.can_manage && <form className="space-y-3 rounded-xl border border-line bg-paper p-4" onSubmit={event => {
      event.preventDefault(); if (!parsedCode || parsedCode === actorCode) return
      const existing = read.data?.items.find(row => row.user_code === parsedCode)
      const input = { action: 'invite' as const, expected_membership_version: existing?.version ?? 0, expires_in_days: expiry }
      action.run(submission_id => manageGroupMember(group.id, parsedCode, { ...input, submission_id }), () => setCode(''))
    }}>
      <h4 className="font-semibold">{t('groups.direct_invite')}</h4>
      <p className="text-sm text-ink2">{t('groups.direct_invite_help')}</p>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <label className="min-w-0 text-sm font-semibold">{t('groups.member_code')}
          <input className={NETWORK_FIELD} inputMode="numeric" pattern="[1-9][0-9]{0,9}" maxLength={10} value={code}
            disabled={action.blocked} required onChange={event => setCode(event.target.value)} />
        </label>
        <label className="min-w-0 text-sm font-semibold">{t('groups.expires_days')}
          <input className={NETWORK_FIELD} type="number" min={1} max={30} value={expiry} disabled={action.blocked}
            onChange={event => setExpiry(Number(event.target.value))} required />
        </label>
      </div>
      <GroupActionStatus action={action} conflictLabel="groups.member_changed" canRetry={ready && group.can_manage} />
      <button className={NETWORK_PRIMARY} type="submit" disabled={action.blocked || !ready || !parsedCode || parsedCode === actorCode}>{t('groups.invite')}</button>
    </form>}
    {!group.can_manage && <GroupActionStatus action={action} conflictLabel="groups.member_changed" canRetry={false} />}
    {group.can_moderate && <label className="block max-w-sm text-sm font-semibold">{t('groups.roster_filter')}
      <select className={NETWORK_FIELD} value={view} onChange={event => {
        if (allowNetworkNavigation()) { setSelected(event.target.value as typeof selected); setPage(1) }
      }}>{(['active', 'pending', 'all'] as const).map(value => <option key={value} value={value}>{t(`groups.roster_views.${value}`)}</option>)}</select>
    </label>}
    <NetworkFreshness read={read} />
    {!!read.error && <p role="alert" className="text-sm text-red-800">{t(networkError(read.error))}</p>}
    {!read.data ? !read.error && <p role="status">{t('loading')}</p> : <>
      <p className="min-w-0 rounded-xl bg-paper p-4 text-sm [overflow-wrap:anywhere]">{read.data.owner.member_alias} · {t('groups.roles.owner')}
        {read.data.owner.user_code ? ` · ${t('groups.code_value', { code: read.data.owner.user_code })}` : ''}</p>
      {read.data.items.map(row => <MemberRow key={`${actorId}:${row.id}`} actorId={actorId} actorCode={actorCode}
        group={group} row={row} ready={ready} onSaved={refresh} />)}
      {!read.data.items.length && <p className="text-sm text-dim">{t('groups.members_empty')}</p>}
      <NetworkPagination page={page} total={read.data.total} busy={read.checking} onChange={setPage} />
    </>}
  </section>
}
function MemberRow({ actorId, actorCode, group, row, ready, onSaved }: {
  actorId: string; actorCode: number | null; group: Group; row: GroupMembership; ready: boolean; onSaved: () => void
}) {
  const { t } = useTranslation('property_network')
  const [baseline, setBaseline] = useState(row)
  const [role, setRole] = useState<Exclude<GroupRole, 'owner'>>(row.role), [reason, setReason] = useState('')
  const action = useGroupMutation(`manage-member:${actorId}:${group.id}:${row.id}`, onSaved)
  const allowed = groupCanActOnMember(group, row, actorCode)
  const canRevoke = allowed && group.can_revoke_access
  const canChangeRole = allowed && ['owner', 'admin'].includes(group.my_role ?? '') && (group.can_manage || group.can_revoke_access)
  const ranks = { member: 1, moderator: 2, admin: 3 }
  const roleAllowed = canChangeRole && role !== row.role && (group.can_manage || ranks[role] < ranks[row.role])
    && (role !== 'admin' || group.my_role === 'owner')
  const dirty = !!reason || role !== baseline.role, stale = row.version !== baseline.version
  useNetworkDraftGuard(dirty || action.pending, action.busy)
  useEffect(() => {
    if (!dirty && !action.blocked && row.version !== baseline.version) { setBaseline(row); setRole(row.role) }
  }, [row, baseline.version, dirty, action.blocked])
  function act(value: ManageMemberAction) {
    if (!row.user_code) return
    const input = { action: value, expected_membership_version: baseline.version, reason: reason.trim(),
      ...(value === 'set_role' ? { role } : {}) }
    action.run(submission_id => manageGroupMember(group.id, row.user_code!, { ...input, submission_id }), () => { setReason(''); setRole(row.role) })
  }
  const disabled = action.blocked || !ready || stale
  return <article className="min-w-0 space-y-3 rounded-xl border border-line p-4">
    <h4 className="break-words font-semibold">{row.member_alias || t('groups.invited_member')}
      {row.user_code ? ` · ${t('groups.code_value', { code: row.user_code })}` : ''}</h4>
    <p className="text-sm">{t(`groups.roles.${row.role}`)} · {t(`groups.membership_states.${row.state}`)}</p>
    {stale && <div className="space-y-2"><p role="status" className="text-sm text-amber-950">{t('groups.member_changed')}</p>
      <button type="button" className={NETWORK_BUTTON} disabled={action.blocked} onClick={() => {
        if (!dirty || window.confirm(t('leave_confirm'))) { setBaseline(row); setRole(row.role); setReason('') }
      }}>{t('groups.reload_member')}</button></div>}
    {allowed && <>
      <label className="block text-sm font-semibold">{t('groups.reason')}
        <input className={NETWORK_FIELD} maxLength={500} value={reason} disabled={action.blocked} onChange={event => setReason(event.target.value)} />
      </label>
      <div className="flex flex-wrap gap-2">
        {row.state === 'requested' && group.can_post && group.can_moderate && <>
          <button type="button" className={NETWORK_PRIMARY} disabled={disabled} onClick={() => act('approve')}>{t('groups.approve_member')}</button>
          <button type="button" className={NETWORK_BUTTON} disabled={disabled} onClick={() => act('decline')}>{t('groups.decline_member')}</button>
        </>}
        {row.state === 'invited' && canRevoke && <button type="button" className={NETWORK_BUTTON} disabled={disabled} onClick={() => act('revoke_invite')}>{t('groups.revoke_invite')}</button>}
        {['expired', 'declined', 'cancelled', 'left', 'removed'].includes(row.state) && group.can_manage && <button type="button"
          className={NETWORK_BUTTON} disabled={disabled} onClick={() => act('invite')}>{t('groups.invite_again')}</button>}
        {row.state === 'active' && canRevoke && <button type="button" className={NETWORK_BUTTON} disabled={disabled}
          onClick={() => { if (window.confirm(t('groups.remove_confirm'))) act('remove') }}>{t('groups.remove')}</button>}
        {row.state !== 'blocked' && canRevoke && <button type="button" className={NETWORK_BUTTON} disabled={disabled}
          onClick={() => { if (window.confirm(t('groups.block_confirm'))) act('block') }}>{t('groups.block')}</button>}
        {row.state === 'blocked' && canRevoke && group.can_post && <button type="button" className={NETWORK_BUTTON} disabled={disabled} onClick={() => act('unblock')}>{t('groups.unblock')}</button>}
      </div>
      {row.state === 'active' && canChangeRole && <div className="flex min-w-0 flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 text-sm font-semibold">{t('groups.change_role')}
          <select className={NETWORK_FIELD} value={role} disabled={action.blocked} onChange={event => setRole(event.target.value as typeof role)}>
            {(['member', 'moderator', 'admin'] as const).map(value => <option key={value} value={value}
              disabled={value === 'admin' && group.my_role !== 'owner' || !group.can_manage && ranks[value] >= ranks[row.role]}>{t(`groups.roles.${value}`)}</option>)}
          </select>
        </label><button type="button" className={NETWORK_BUTTON} disabled={disabled || !roleAllowed} onClick={() => act('set_role')}>{t('groups.save_role')}</button>
      </div>}
    </>}
    <GroupActionStatus action={action} conflictLabel="groups.member_changed" canRetry={ready && !stale && allowed} />
  </article>
}
