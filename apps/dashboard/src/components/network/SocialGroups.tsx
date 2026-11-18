import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createGroup, getGroups, type GroupFields } from '../../api/socialGroups'
import { useGroupMutation } from '../../hooks/useGroupMutation'
import { useNetworkRead } from '../../hooks/useNetworkRead'
import { GroupWorkspace } from './GroupWorkspace'
import { GroupMemberships } from './GroupMemberships'
import { emptyGroupFields, GroupActionStatus, GroupFieldsEditor, GroupPhoto } from './GroupShared'
import { NETWORK_BUTTON, NETWORK_FIELD, NETWORK_PRIMARY, NetworkFreshness, NetworkPagination,
  NetworkPanel, allowNetworkNavigation, networkError, useNetworkDraftGuard } from './NetworkShared'

type Props = { actorId: string; actorCode: number | null; groupId: string; inviteCode?: number; onOpen: (id: string, guard?: boolean) => void }
export function SocialGroups({ actorId, actorCode, groupId, inviteCode, onOpen }: Props) {
  const { t } = useTranslation('property_network')
  const [view, setView] = useState<'mine' | 'discover' | 'invitations' | 'create'>('mine')
  const [query, setQuery] = useState(''), [search, setSearch] = useState(''), [page, setPage] = useState(1)
  const read = useNetworkRead(`groups:${actorId}:${view}:${search}:${page}`,
    signal => getGroups(view === 'discover' ? 'discover' : 'mine', search, page, signal), !groupId && ['mine', 'discover'].includes(view))
  if (groupId) return <GroupWorkspace key={`${actorId}:${groupId}`} actorId={actorId} actorCode={actorCode}
    id={groupId} inviteCode={inviteCode} onBack={() => onOpen('')} />
  function choose(next: typeof view) {
    if (!allowNetworkNavigation()) return
    setView(next); setQuery(''); setSearch(''); setPage(1)
  }
  return <div className="min-w-0 space-y-5">
    <header><h2 className="text-xl font-bold text-ink">{t('groups.title')}</h2>
      <p className="mt-2 max-w-3xl text-sm text-ink2">{t('groups.intro')}</p></header>
    {inviteCode && <p role="status" className="rounded-xl border border-line bg-paper p-4 text-sm">{t('groups.choose_invite_group', { code: inviteCode })}</p>}
    <nav aria-label={t('groups.views_label')} className="flex flex-wrap gap-2">
      {(['mine', 'discover', 'invitations', 'create'] as const).map(value => <button type="button" key={value}
        className={view === value ? NETWORK_PRIMARY : NETWORK_BUTTON} aria-current={view === value ? 'page' : undefined}
        onClick={() => choose(value)}>{t(`groups.views.${value}`)}</button>)}
    </nav>
    {view === 'create' ? <CreateGroupForm actorId={actorId} onCreated={id => onOpen(id, false)} />
      : view === 'invitations' ? <GroupMemberships actorId={actorId} onOpen={id => onOpen(id)} />
        : <>
          <form className="flex min-w-0 flex-wrap items-end gap-3" onSubmit={event => {
            event.preventDefault(); if (allowNetworkNavigation()) { setSearch(query.trim()); setPage(1); read.refresh() }
          }}>
            <label className="min-w-0 flex-1 text-sm font-semibold">{t('groups.search')}
              <input className={NETWORK_FIELD} value={query} maxLength={100} onChange={event => setQuery(event.target.value)} />
            </label><button className={NETWORK_BUTTON} type="submit">{t('search')}</button>
          </form>
          <NetworkFreshness read={read} />
          {read.error && <p role="alert" className="text-sm text-red-800">{t(networkError(read.error))}</p>}
          {!read.data ? !read.error && <p role="status">{t('loading')}</p> : <>
            <div className="grid min-w-0 gap-4 md:grid-cols-2">{read.data.items.map(group => <article key={group.id}
              className="min-w-0 space-y-3 rounded-2xl border border-line bg-paper p-4 sm:p-5">
              {group.image && <GroupPhoto id={group.image.id} context={`${actorId}:${group.id}:${group.version}`} />}
              <div className="flex flex-wrap gap-2 text-xs font-semibold text-sea">
                <span>{t(`groups.visibilities.${group.visibility}`)}</span><span>{t(`groups.statuses.${group.status}`)}</span>
              </div>
              <h3 className="break-words text-xl font-bold text-ink">{group.name}</h3>
              <p className="whitespace-pre-wrap break-words text-sm text-ink2">{group.description}</p>
              <p className="break-words text-xs text-dim">{group.area_label} · {t('groups.member_count', { count: group.member_count })}</p>
              {group.my_role && <p className="text-sm font-semibold">{t('groups.your_role', { role: t(`groups.roles.${group.my_role}`) })}</p>}
              {group.membership && !group.my_role && <p className="text-sm">{t(`groups.membership_states.${group.membership.state}`)}</p>}
              <button type="button" className={NETWORK_BUTTON} onClick={() => onOpen(group.id)}>{t('groups.open')}</button>
            </article>)}</div>
            {!read.data.items.length && <p className="rounded-xl bg-paper p-5 text-sm">{t('groups.empty')}</p>}
            <NetworkPagination page={page} total={read.data.total} busy={read.checking} onChange={setPage} />
          </>}
        </>}
  </div>
}
function CreateGroupForm({ actorId, onCreated }: { actorId: string; onCreated: (id: string) => void }) {
  const { t } = useTranslation('property_network')
  const [fields, setFields] = useState<GroupFields>(emptyGroupFields), [alias, setAlias] = useState('')
  const action = useGroupMutation(`create-group:${actorId}`)
  useNetworkDraftGuard(JSON.stringify(fields) !== JSON.stringify(emptyGroupFields()) || !!alias || action.pending, action.busy)
  return <NetworkPanel title={t('groups.views.create')}>
    <form className="space-y-4" onSubmit={event => {
      event.preventDefault()
      const input = { ...fields, name: fields.name.trim(), owner_alias: alias.trim() }
      action.run(id => createGroup({ ...input, submission_id: id }), receipt => onCreated(receipt.target_id))
    }}>
      <GroupFieldsEditor fields={fields} change={setFields} disabled={action.blocked} />
      <label className="block text-sm font-semibold">{t('groups.owner_alias')}
        <input className={NETWORK_FIELD} value={alias} required maxLength={100} disabled={action.blocked} onChange={event => setAlias(event.target.value)} />
      </label>
      <p className="text-sm text-ink2">{t('groups.alias_help')}</p>
      <p className="rounded-xl border border-line bg-white p-4 text-sm">{t(fields.visibility === 'private' ? 'groups.private_create_help' : 'groups.network_create_help')}</p>
      <p className="text-xs text-dim">{t('groups.scope_help')}</p>
      <GroupActionStatus action={action} />
      <button className={NETWORK_PRIMARY} type="submit" disabled={action.blocked || !fields.name.trim() || !alias.trim()}>{t('groups.create')}</button>
    </form>
  </NetworkPanel>
}
