import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { actOnOwnMembership, getGroup, getGroupMemberships, type GroupMembership, type OwnMemberAction } from '../../api/socialGroups'
import { useGroupMutation } from '../../hooks/useGroupMutation'
import { useNetworkRead } from '../../hooks/useNetworkRead'
import { GroupActionStatus } from './GroupShared'
import { NETWORK_BUTTON, NETWORK_FIELD, NETWORK_PRIMARY, NetworkFreshness, NetworkPagination,
  allowNetworkNavigation, networkError, useNetworkDraftGuard } from './NetworkShared'

export function GroupMemberships({ actorId, onOpen }: { actorId: string; onOpen: (id: string) => void }) {
  const { t } = useTranslation('property_network')
  const [state, setState] = useState<'all' | 'invited' | 'requested' | 'active'>('all'), [page, setPage] = useState(1)
  const read = useNetworkRead(`own-group-memberships:${actorId}:${state}:${page}`, signal => getGroupMemberships(state, page, signal))
  return <section className="min-w-0 space-y-4">
    <label className="block max-w-sm text-sm font-semibold">{t('groups.membership_filter')}
      <select className={NETWORK_FIELD} value={state} onChange={event => { if (allowNetworkNavigation()) { setState(event.target.value as typeof state); setPage(1) } }}>
        {(['all', 'invited', 'requested', 'active'] as const).map(value => <option key={value} value={value}>{t(`groups.membership_filters.${value}`)}</option>)}
      </select>
    </label>
    <NetworkFreshness read={read} />
    {!!read.error && <p role="alert" className="text-sm text-red-800">{t(networkError(read.error))}</p>}
    {!read.data ? !read.error && <p role="status">{t('loading')}</p> : <>
      {read.data.items.map(row => <MembershipCard key={`${actorId}:${row.id}`} actorId={actorId} row={row}
        fresh={!read.stale && !read.checking} onSaved={read.refresh} onOpen={onOpen} />)}
      {!read.data.items.length && <p className="text-sm text-dim">{t('groups.inbox_empty')}</p>}
      <NetworkPagination page={page} total={read.data.total} busy={read.checking} onChange={setPage} />
    </>}
  </section>
}
function MembershipCard({ actorId, row, fresh, onSaved, onOpen }: {
  actorId: string; row: GroupMembership; fresh: boolean; onSaved: () => void; onOpen: (id: string) => void
}) {
  const { t } = useTranslation('property_network')
  const [alias, setAlias] = useState(row.member_alias ?? '')
  const header = useNetworkRead(`membership-header:${actorId}:${row.group_id}:${row.version}`, signal => getGroup(row.group_id, signal),
    ['active', 'invited', 'requested'].includes(row.state))
  const action = useGroupMutation(`own-membership:${actorId}:${row.id}`, onSaved)
  useNetworkDraftGuard(action.pending || row.state === 'invited' && !!alias.trim(), action.busy)
  function act(value: OwnMemberAction) {
    const input = { expected_membership_version: row.version, action: value, member_alias: alias.trim() }
    action.run(id => actOnOwnMembership(row.group_id, { ...input, submission_id: id }), () => setAlias(''))
  }
  return <article className="min-w-0 space-y-3 rounded-xl border border-line bg-paper p-4">
    <h3 className="break-words font-bold text-ink">{header.data?.name ?? t('groups.inbox_item')}</h3>
    <p className="text-sm">{t(`groups.membership_states.${row.state}`)}</p>
    {header.data && <button type="button" className={NETWORK_BUTTON} onClick={() => onOpen(row.group_id)}>{t('groups.open')}</button>}
    {row.state === 'invited' && <label className="block text-sm font-semibold">{t('groups.member_alias')}
      <input className={NETWORK_FIELD} value={alias} maxLength={100} disabled={action.blocked} onChange={event => setAlias(event.target.value)} />
    </label>}
    {row.state === 'invited' && <p className="text-xs text-dim">{t('groups.alias_help')}</p>}
    <div className="flex flex-wrap gap-2">
      {row.state === 'invited' && <><button type="button" className={NETWORK_PRIMARY}
        disabled={action.blocked || !fresh || !alias.trim()}
        onClick={() => act('accept_invite')}>{t('groups.accept_invite')}</button>
        <button type="button" className={NETWORK_BUTTON} disabled={action.blocked || !fresh} onClick={() => act('decline_invite')}>{t('groups.decline_invite')}</button></>}
      {row.state === 'requested' && <button type="button" className={NETWORK_BUTTON} disabled={action.blocked || !fresh} onClick={() => act('cancel')}>{t('groups.cancel_request')}</button>}
      {row.state === 'active' && <button type="button" className={NETWORK_BUTTON} disabled={action.blocked || !fresh}
        onClick={() => { if (window.confirm(t('groups.leave_confirm'))) act('leave') }}>{t('groups.leave')}</button>}
    </div>
    <GroupActionStatus action={action} conflictLabel="groups.new_activity_unavailable" canRetry={fresh} />
  </article>
}
