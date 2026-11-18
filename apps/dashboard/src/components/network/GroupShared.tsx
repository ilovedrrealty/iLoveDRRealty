import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getGroupPhoto, type GroupFields } from '../../api/socialGroups'
import type { GroupMutation } from '../../hooks/useGroupMutation'
import { NETWORK_BUTTON, NETWORK_FIELD } from './NetworkShared'

export const emptyGroupFields = (): GroupFields => ({ name: '', description: '', purpose: 'community', area_label: '',
  visibility: 'private', join_policy: 'approval_required', post_policy: 'members', comments_enabled: true })
export function GroupActionStatus({ action, conflictLabel, canRetry = true }: { action: GroupMutation; conflictLabel?: string; canRetry?: boolean }) {
  const { t } = useTranslation('property_network')
  return <div className="min-w-0 space-y-3">
    {action.error && <p role="alert" className="text-sm text-red-800">{t(action.error === 'error_conflict' && conflictLabel ? conflictLabel : action.error)}</p>}
    {action.busy && <p role="status" className="text-sm text-dim">{t('groups.saving')}</p>}
    {action.pending && <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
      <p role="status" className="text-sm text-amber-950">{t('groups.uncertain')}</p>
      {action.notFound && <p className="text-sm text-amber-950">{t('groups.receipt_missing')}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={NETWORK_BUTTON} disabled={action.busy} onClick={() => void action.check()}>{t('groups.check_action')}</button>
        {action.retryAllowed && <button type="button" className={NETWORK_BUTTON} disabled={action.busy || !canRetry}
          onClick={() => { if (canRetry) action.retry() }}>{t('groups.retry_same')}</button>}
        <button type="button" className={NETWORK_BUTTON} disabled={action.busy}
          onClick={() => { if (window.confirm(t('groups.discard_uncertain'))) action.discard() }}>{t('groups.discard_draft')}</button>
      </div>
    </div>}
  </div>
}
export function GroupFieldsEditor({ fields, change, disabled, canChooseNetwork = true }: {
  fields: GroupFields; change: (fields: GroupFields) => void; disabled: boolean; canChooseNetwork?: boolean
}) {
  const { t } = useTranslation('property_network')
  const set = <K extends keyof GroupFields>(key: K, value: GroupFields[K]) => change({ ...fields, [key]: value })
  return <fieldset disabled={disabled} className="grid min-w-0 gap-4 sm:grid-cols-2">
    <label className="min-w-0 text-sm font-semibold sm:col-span-2">{t('groups.name')}
      <input className={NETWORK_FIELD} value={fields.name} maxLength={120} required onChange={event => set('name', event.target.value)} />
    </label>
    <label className="min-w-0 text-sm font-semibold sm:col-span-2">{t('groups.description')}
      <textarea className={NETWORK_FIELD} value={fields.description} maxLength={2000} rows={3} onChange={event => set('description', event.target.value)} />
    </label>
    <label className="min-w-0 text-sm font-semibold">{t('groups.purpose')}
      <select className={NETWORK_FIELD} value={fields.purpose} onChange={event => set('purpose', event.target.value as GroupFields['purpose'])}>
        {(['community', 'professional', 'local_area', 'property_project'] as const).map(value => <option key={value} value={value}>{t(`groups.purposes.${value}`)}</option>)}
      </select>
    </label>
    <label className="min-w-0 text-sm font-semibold">{t('groups.area')}
      <input className={NETWORK_FIELD} value={fields.area_label} maxLength={160} onChange={event => set('area_label', event.target.value)} />
    </label>
    <label className="min-w-0 text-sm font-semibold">{t('groups.visibility')}
      <select className={NETWORK_FIELD} value={fields.visibility} onChange={event => set('visibility', event.target.value as GroupFields['visibility'])}>
        <option value="private">{t('groups.visibilities.private')}</option>
        <option value="network" disabled={!canChooseNetwork}>{t('groups.visibilities.network')}</option>
      </select>
    </label>
    <label className="min-w-0 text-sm font-semibold">{t('groups.join_policy')}
      <select className={NETWORK_FIELD} value={fields.join_policy} onChange={event => set('join_policy', event.target.value as GroupFields['join_policy'])}>
        <option value="approval_required">{t('groups.join_policies.approval_required')}</option>
        <option value="open">{t('groups.join_policies.open')}</option>
      </select>
    </label>
    <label className="min-w-0 text-sm font-semibold">{t('groups.post_policy')}
      <select className={NETWORK_FIELD} value={fields.post_policy} onChange={event => set('post_policy', event.target.value as GroupFields['post_policy'])}>
        <option value="members">{t('groups.post_policies.members')}</option>
        <option value="moderated">{t('groups.post_policies.moderated')}</option>
      </select>
    </label>
    <label className="flex min-w-0 items-center gap-2 text-sm font-semibold">
      <input type="checkbox" checked={fields.comments_enabled} onChange={event => set('comments_enabled', event.target.checked)} />{t('groups.comments_enabled')}
    </label>
  </fieldset>
}
export function GroupPhoto({ id, context }: { id: string; context: string }) {
  const { t } = useTranslation('property_network')
  const key = `${context}:${id}`
  const [photo, setPhoto] = useState({ key, url: '', error: false })
  useEffect(() => {
    const controller = new AbortController(); let objectUrl = ''
    setPhoto({ key, url: '', error: false })
    getGroupPhoto(id, controller.signal).then(blob => {
      if (!controller.signal.aborted) { objectUrl = URL.createObjectURL(blob); setPhoto({ key, url: objectUrl, error: false }) }
    }).catch(() => { if (!controller.signal.aborted) setPhoto({ key, url: '', error: true }) })
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [id, context, key])
  const current = photo.key === key ? photo : { url: '', error: false }
  return current.error ? <p role="status" className="text-sm text-dim">{t('photo_unavailable')}</p>
    : current.url ? <img src={current.url} alt={t('groups.photo_alt')} className="max-h-80 max-w-full rounded-xl border border-line object-contain" />
      : <p role="status" className="text-sm text-dim">{t('photo_loading')}</p>
}
export function GroupPhotos({ ids, context }: { ids: string[]; context: string }) {
  return ids.length ? <div className="grid min-w-0 gap-3 sm:grid-cols-2">{ids.map(id => <GroupPhoto key={id} id={id} context={context} />)}</div> : null
}
