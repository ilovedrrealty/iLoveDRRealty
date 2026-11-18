import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { getMe } from '../../api/auth'
import { acceptGroupInvite, resolveGroupInvite, type GroupInvitation } from '../../api/socialGroups'
import { useGroupMutation } from '../../hooks/useGroupMutation'
import { clearGroupInvite, groupInviteSnapshot, subscribeGroupInvite } from '../../lib/groupInviteMemory'
import { landingBaseUrl } from '../../lib/siteUrls'
import { GroupActionStatus } from './GroupShared'
import { NETWORK_BUTTON, NETWORK_FIELD, NETWORK_PRIMARY, NetworkDate, allowNetworkNavigation,
  networkError, useNetworkDraftGuard } from './NetworkShared'

const LANDING = landingBaseUrl(import.meta.env.VITE_LANDING_URL).replace(/\/$/, '')
export function GroupInvite() {
  const { t, i18n } = useTranslation('property_network')
  const memory = useSyncExternalStore(subscribeGroupInvite, groupInviteSnapshot, groupInviteSnapshot)
  const [viewer, setViewer] = useState<{ id: string; generation: number; authEpoch: number } | null>(null), [checking, setChecking] = useState(false)
  const [authError, setAuthError] = useState(''), [accepted, setAccepted] = useState('')
  const authEpoch = useRef(0)
  async function checkUser() {
    const epoch = ++authEpoch.current
    const generation = groupInviteSnapshot().generation
    setChecking(true); setViewer(null); setAuthError('')
    try {
      const user = await getMe()
      if (authEpoch.current === epoch && groupInviteSnapshot().generation === generation) setViewer({ id: user.id, generation, authEpoch: epoch })
    } catch (cause) {
      if (authEpoch.current === epoch && groupInviteSnapshot().generation === generation) setAuthError(networkError(cause))
    } finally { if (authEpoch.current === epoch && groupInviteSnapshot().generation === generation) setChecking(false) }
  }
  useEffect(() => {
    if (memory.token) { setAccepted(''); void checkUser() }
    return () => { authEpoch.current++ }
  }, [memory.generation])
  return <main className="min-h-screen min-w-0 bg-paper px-4 py-8 text-ink">
    <div className="mx-auto max-w-2xl space-y-5 rounded-2xl border border-line bg-white p-4 sm:p-7">
      <div className="flex flex-wrap justify-between gap-3"><p className="font-bold">I ♥ DR Realty</p>
        <div className="flex gap-2" aria-label={t('groups.language')}>
          {(['en', 'es'] as const).map(language => <button type="button" key={language} className={NETWORK_BUTTON}
            aria-pressed={i18n.language.startsWith(language)} onClick={() => void i18n.changeLanguage(language)}>{language === 'en' ? 'English' : 'Español'}</button>)}
        </div></div>
      <h1 className="text-2xl font-bold">{t('groups.invite_title')}</h1>
      {accepted ? <><p role="status" className="text-sm">{t('groups.invite_saved')}</p>
        <a className={NETWORK_PRIMARY + ' inline-block'} href={`/property-network?tab=groups&group=${encodeURIComponent(accepted)}`}>{t('groups.open')}</a></>
        : !memory.token ? <p role="status" className="text-sm">{t(memory.invalid ? 'groups.invite_invalid' : 'groups.invite_missing')}</p>
          : <>
            <p className="text-sm text-ink2">{t('groups.invite_privacy')}</p>
            {checking ? <p role="status">{t('groups.checking_signin')}</p> : viewer && viewer.generation === memory.generation
              ? <AuthenticatedInvite key={`${viewer.id}:${viewer.authEpoch}:${memory.generation}`} actorId={viewer.id} token={memory.token}
                generation={memory.generation} isCurrent={() => {
                  const current = groupInviteSnapshot()
                  return authEpoch.current === viewer.authEpoch && current.generation === memory.generation && current.token === memory.token
                }} onSaved={groupId => {
                  const current = groupInviteSnapshot()
                  if (authEpoch.current !== viewer.authEpoch || current.generation !== memory.generation || current.token !== memory.token) return
                  setAccepted(groupId); clearGroupInvite()
                }} />
              : <div className="space-y-3"><p className="text-sm">{t('groups.signin_help')}</p>
                {authError && authError !== 'error_access' && <p role="alert" className="text-sm text-red-800">{t(authError)}</p>}
                <div className="flex flex-wrap gap-2"><a className={NETWORK_PRIMARY + ' inline-block'} href={`${LANDING}/login/`} target="_blank" rel="noopener noreferrer">{t('groups.signin')}</a>
                  <a className={NETWORK_BUTTON + ' inline-block'} href={`${LANDING}/signup/`} target="_blank" rel="noopener noreferrer">{t('groups.signup')}</a></div>
              </div>}
            <button type="button" className={NETWORK_BUTTON} disabled={checking}
              onClick={() => { if (allowNetworkNavigation()) void checkUser() }}>{t('groups.check_signin')}</button>
          </>}
      <a href="/property-network?tab=groups" className="inline-block text-sm font-semibold text-sea underline">{t('groups.back')}</a>
    </div>
  </main>
}
function AuthenticatedInvite({ actorId, token, generation, isCurrent, onSaved }: {
  actorId: string; token: string; generation: number; isCurrent: () => boolean; onSaved: (id: string) => void
}) {
  const { t } = useTranslation('property_network')
  const [preview, setPreview] = useState<GroupInvitation | null>(null), [alias, setAlias] = useState('')
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const controller = useRef<AbortController | null>(null)
  const action = useGroupMutation(`group-link-accept:${actorId}:${generation}`)
  useNetworkDraftGuard(!!alias || action.pending, busy || action.busy)
  useEffect(() => () => controller.current?.abort(), [])
  const accessDenied = action.error === 'error_access'
  useEffect(() => { if (accessDenied) { setPreview(null); setAlias('') } }, [accessDenied])
  async function resolve() {
    if (busy || action.blocked) return
    controller.current?.abort()
    const request = new AbortController(); controller.current = request
    action.discard()
    setBusy(true); setPreview(null); setError('')
    try {
      const next = await resolveGroupInvite(token, request.signal)
      if (!request.signal.aborted && isCurrent()) setPreview(next)
    } catch (cause) { if (!request.signal.aborted && isCurrent()) setError(networkError(cause)) }
    finally { if (!request.signal.aborted && isCurrent()) setBusy(false) }
  }
  return <section className="space-y-4">
    <button type="button" className={NETWORK_BUTTON} disabled={busy || action.blocked} onClick={() => void resolve()}>{t('groups.preview_invite')}</button>
    {busy && <p role="status">{t('loading')}</p>}
    {error && <p role="alert" className="text-sm text-red-800">{t(error === 'error_access' ? 'groups.invite_unavailable' : error)}</p>}
    <GroupActionStatus action={action} conflictLabel="groups.new_activity_unavailable" />
    {preview && !accessDenied && <div className="min-w-0 space-y-3 rounded-xl border border-line bg-paper p-4">
      <h2 className="break-words text-xl font-bold">{preview.name}</h2>
      <p className="whitespace-pre-wrap break-words text-sm text-ink2">{preview.description}</p>
      <p className="text-sm">{t(`groups.visibilities.${preview.visibility}`)}</p>
      <p className="text-sm">{t('groups.expires')} <NetworkDate value={preview.expires_at} showTime /></p>
      {preview.already_member ? <a className={NETWORK_PRIMARY + ' inline-block'}
        href={`/property-network?tab=groups&group=${encodeURIComponent(preview.group_id)}`}>{t('groups.open')}</a> : <form className="space-y-3" onSubmit={event => {
          event.preventDefault()
          const input = { token, member_alias: alias.trim() }, groupId = preview.group_id
          action.run(submission_id => acceptGroupInvite({ ...input, submission_id }), receipt => {
            if (!receipt.current || !('member_alias' in receipt.current) || receipt.current.group_id !== groupId) throw new Error('Invitation membership context changed')
            if (!isCurrent()) return
            onSaved(groupId)
          })
        }}>
          <label className="block text-sm font-semibold">{t('groups.member_alias')}
            <input className={NETWORK_FIELD} value={alias} maxLength={100} required disabled={action.blocked} onChange={event => setAlias(event.target.value)} />
          </label><p className="text-xs text-dim">{t('groups.alias_help')}</p>
          <button type="submit" className={NETWORK_PRIMARY} disabled={action.blocked || !alias.trim()}>{t('groups.accept_link')}</button>
        </form>}
    </div>}
  </section>
}
