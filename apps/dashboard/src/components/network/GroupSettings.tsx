import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GROUP_PHOTO_LIMIT, editGroup, uploadGroupPhoto, type Group, type GroupFields } from '../../api/socialGroups'
import { useGroupMutation } from '../../hooks/useGroupMutation'
import { GroupActionStatus, GroupFieldsEditor, GroupPhoto } from './GroupShared'
import { NETWORK_BUTTON, NETWORK_PRIMARY, useNetworkDraftGuard } from './NetworkShared'

function fieldsOf(group: Group): GroupFields {
  return { name: group.name, description: group.description, purpose: group.purpose, area_label: group.area_label,
    visibility: group.visibility, join_policy: group.join_policy, post_policy: group.post_policy, comments_enabled: group.comments_enabled }
}
export function GroupSettings({ actorId, group, fresh, onSaved }: { actorId: string; group: Group; fresh: boolean; onSaved: () => void }) {
  const { t } = useTranslation('property_network')
  const [baseline, setBaseline] = useState(group), [fields, setFields] = useState(() => fieldsOf(group))
  const [imageId, setImageId] = useState<string | null>(group.image?.id ?? null), [acknowledged, setAcknowledged] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const action = useGroupMutation(`edit-group:${actorId}:${group.id}`, onSaved)
  const upload = useGroupMutation(`group-image:${actorId}:${group.id}`, onSaved)
  const dirty = JSON.stringify(fields) !== JSON.stringify(fieldsOf(baseline)) || imageId !== (baseline.image?.id ?? null)
  const stale = baseline.version !== group.version, blocked = action.blocked || upload.blocked
  const publishing = baseline.visibility === 'private' && fields.visibility === 'network'
  useNetworkDraftGuard(dirty || action.pending || upload.pending, action.busy || upload.busy)
  useEffect(() => {
    if (!dirty && !blocked && baseline.version !== group.version) {
      setBaseline(group); setFields(fieldsOf(group)); setImageId(group.image?.id ?? null); setAcknowledged(false)
    }
  }, [group, baseline.version, dirty, blocked])
  function reset() {
    if (blocked || dirty && !window.confirm(t('leave_confirm'))) return
    setBaseline(group); setFields(fieldsOf(group)); setImageId(group.image?.id ?? null); setAcknowledged(false)
  }
  return <section className="min-w-0 space-y-4">
    <h3 className="text-lg font-bold">{t('groups.tabs.settings')}</h3>
    {stale && <p role="status" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-950">{t('groups.settings_changed')}</p>}
    <form className="space-y-4" onSubmit={event => {
      event.preventDefault()
      const input = { ...fields, name: fields.name.trim(), expected_version: baseline.version,
        image_media_id: imageId, publication_acknowledged: publishing && acknowledged }
      action.run(submission_id => editGroup(group.id, { ...input, submission_id }), receipt => {
        if (!receipt.current || !('owner_alias' in receipt.current)) throw new Error('Group access changed')
        setBaseline(receipt.current); setFields(fieldsOf(receipt.current)); setImageId(receipt.current.image?.id ?? null); setAcknowledged(false)
      })
    }}>
      <GroupFieldsEditor fields={fields} change={next => { setFields(next); if (next.visibility !== fields.visibility) setAcknowledged(false) }}
        disabled={blocked || stale || !fresh} canChooseNetwork={baseline.visibility === 'network' || group.can_publish} />
      <label className="block text-sm font-semibold">{t('groups.group_image')}
        <input type="file" className="mt-2 block max-w-full text-sm" accept="image/jpeg,image/png,image/webp" disabled={blocked || stale || !fresh}
          onChange={event => {
            const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''
            if (!file) return
            setPhotoError('')
            if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || !file.size || file.size > GROUP_PHOTO_LIMIT) {
              setPhotoError('photo_invalid'); return
            }
            upload.run(submission_id => uploadGroupPhoto(group.id, 'group_image', submission_id, file), receipt => {
              if (!receipt.current || !('kind' in receipt.current) || receipt.current.kind !== 'group_image'
                  || receipt.current.group_id !== group.id) throw new Error('Group image context changed')
              setImageId(receipt.current.id)
            }, false)
          }} />
      </label>
      <p className="text-xs text-dim">{t('photo_help')}</p>
      {photoError && <p role="alert" className="text-sm text-red-800">{t(photoError)}</p>}
      {imageId && <><GroupPhoto id={imageId} context={`${actorId}:${group.id}:${baseline.version}`} />
        <button type="button" className={NETWORK_BUTTON} disabled={blocked} onClick={() => setImageId(null)}>{t('groups.remove_image')}</button></>}
      <GroupActionStatus action={upload} />
      {publishing && <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
        <h4 className="font-bold">{t('groups.publication_title')}</h4>
        <p className="text-sm">{t('groups.publication_help', { network: group.publication_summary?.network_posts ?? 0,
          private: group.publication_summary?.private_posts ?? 0 })}</p>
        <label className="flex items-start gap-2 text-sm font-semibold"><input type="checkbox" className="mt-1" checked={acknowledged}
          disabled={blocked || !group.can_publish} onChange={event => setAcknowledged(event.target.checked)} />{t('groups.publication_acknowledge')}</label>
      </div>}
      {baseline.visibility === 'network' && fields.visibility === 'private' && <p className="rounded-xl border border-line p-4 text-sm">{t('groups.withdraw_publication_help')}</p>}
      <GroupActionStatus action={action} canRetry={fresh && !stale && !upload.blocked} />
      <div className="flex flex-wrap gap-2"><button type="submit" className={NETWORK_PRIMARY}
        disabled={blocked || stale || !fresh || !dirty || !fields.name.trim() || publishing && (!acknowledged || !group.can_publish)}>{t('groups.save_settings')}</button>
        <button type="button" className={NETWORK_BUTTON} disabled={blocked} onClick={reset}>{t('groups.reset_settings')}</button></div>
    </form>
  </section>
}
