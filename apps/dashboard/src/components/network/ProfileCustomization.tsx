import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { saveNetworkProfile, uploadProfileMedia, type NetworkProfile } from '../../api/propertyNetwork'
import { NETWORK_BUTTON, NETWORK_FIELD, NETWORK_PRIMARY, NetworkPanel, allowNetworkNavigation, networkError, useNetworkDraftGuard } from './NetworkShared'
import { ProfileVisuals } from './ProfileVisuals'

export function ProfileCustomization({ profile, fresh, onSaved, onAccessLost }: {
  profile: NetworkProfile; fresh: boolean; onSaved: () => void; onAccessLost: () => void
}) {
  const { t } = useTranslation('property_network')
  const [baseline, setBaseline] = useState(profile)
  const [name, setName] = useState(profile.display_name), [bio, setBio] = useState(profile.bio), [status, setStatus] = useState(profile.status_text)
  const [visibility, setVisibility] = useState(profile.visibility), [wall, setWall] = useState(profile.wall_policy), [comments, setComments] = useState(profile.comments_enabled)
  const [avatar, setAvatar] = useState<string | null>(profile.avatar_media_id ?? null), [cover, setCover] = useState<string | null>(profile.cover_media_id ?? null)
  const [preview, setPreview] = useState(false), [busy, setBusy] = useState(false), [uploading, setUploading] = useState<'avatar' | 'cover' | null>(null)
  const [saveError, setSaveError] = useState(''), [photoError, setPhotoError] = useState(''), [saved, setSaved] = useState(false)
  const alive = useRef(true), locked = useRef(false), activeUpload = useRef<AbortController | null>(null)
  const denied = useRef(onAccessLost); denied.current = onAccessLost
  const dirty = name !== baseline.display_name || bio !== baseline.bio || status !== baseline.status_text || visibility !== baseline.visibility
    || wall !== baseline.wall_policy || comments !== baseline.comments_enabled || avatar !== (baseline.avatar_media_id ?? null) || cover !== (baseline.cover_media_id ?? null)
  const blocked = busy || uploading !== null || !!saveError || !fresh || !profile.can_edit
  useNetworkDraftGuard(dirty, busy || uploading !== null)
  useEffect(() => { alive.current = true; return () => { alive.current = false; activeUpload.current?.abort() } }, [])
  function adopt(value: NetworkProfile) {
    setName(value.display_name); setBio(value.bio); setStatus(value.status_text); setVisibility(value.visibility)
    setWall(value.wall_policy); setComments(value.comments_enabled); setAvatar(value.avatar_media_id ?? null); setCover(value.cover_media_id ?? null); setBaseline(value)
  }
  useEffect(() => {
    if (!busy && uploading === null && !dirty && profile.version > baseline.version) adopt(profile)
    // A fresh server version updates an untouched draft only; edited choices remain explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, baseline.version, busy, uploading, dirty])
  async function upload(kind: 'avatar' | 'cover', file?: File) {
    if (!file || blocked || locked.current) return
    setSaved(false)
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size < 1 || file.size > 5 * 1024 * 1024) { setPhotoError('photo_invalid'); return }
    const controller = new AbortController(); activeUpload.current = controller; locked.current = true; setUploading(kind); setPhotoError('')
    try {
      const media = await uploadProfileMedia(kind, file, controller.signal)
      if (alive.current && !controller.signal.aborted) { if (kind === 'avatar') setAvatar(media.id); else setCover(media.id) }
    } catch (cause) {
      if (alive.current && !controller.signal.aborted) { const error = networkError(cause); setPhotoError(error); if (error === 'error_access') denied.current() }
    } finally {
      if (alive.current) { activeUpload.current = null; locked.current = false; setUploading(null) }
    }
  }
  async function save() {
    if (blocked || locked.current || !name.trim() || !dirty && baseline.version !== 0) return
    const input = { expected_version: baseline.version, display_name: name.trim(), bio: bio.trim(), status_text: status.trim(), visibility,
      wall_policy: wall, comments_enabled: comments, avatar_media_id: avatar, cover_media_id: cover }
    locked.current = true; setBusy(true); setSaveError(''); setSaved(false)
    try {
      const value = await saveNetworkProfile(input)
      if (!alive.current) return
      if (value.user_code !== profile.user_code || value.version <= baseline.version
        || value.avatar_media_id?.toLowerCase() !== avatar?.toLowerCase() || value.cover_media_id?.toLowerCase() !== cover?.toLowerCase()) throw new Error('Profile context changed')
      if (!value.can_edit) { denied.current(); return }
      adopt(value); setPreview(false); setSaved(true); onSaved()
    } catch (cause) {
      if (alive.current) { const error = networkError(cause); setSaveError(error); if (error === 'error_access') denied.current() }
    } finally { if (alive.current) { locked.current = false; setBusy(false) } }
  }
  function discard() {
    if (blocked || locked.current || !allowNetworkNavigation()) return
    adopt(baseline); setPhotoError(''); setSaved(false); setPreview(false)
  }
  const presentation = { display_name: name, bio, status_text: status, visibility, avatar_media_id: avatar, cover_media_id: cover }
  return <NetworkPanel title={t('edit_network_profile')}>
    <p className="mb-3 text-xs text-dim">{t('profile_separate')}</p>
    <p className="mb-4 text-xs leading-relaxed text-dim">{t('customization.photo_help')}</p>
    {preview ? <section aria-label={t('customization.preview_title')} className="space-y-3">
      <p className="text-sm font-semibold text-ink">{t('customization.preview_note')}</p>
      <ProfileVisuals profile={presentation} preview onAccessLost={onAccessLost} />
      <div className="flex flex-wrap gap-2"><button type="button" className={NETWORK_BUTTON} disabled={blocked} onClick={() => setPreview(false)}>{t('customization.back_edit')}</button>
        <button type="button" className={NETWORK_PRIMARY} disabled={blocked || !name.trim() || !dirty && baseline.version !== 0} onClick={() => void save()}>{t(busy ? 'saving' : 'save_changes')}</button></div>
    </section> : <form className="space-y-4" onSubmit={event => { event.preventDefault(); void save() }}>
      <fieldset disabled={blocked} className="min-w-0 space-y-4">
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">{(['avatar', 'cover'] as const).map(kind => {
          const selected = kind === 'avatar' ? avatar : cover
          return <section key={kind} className="min-w-0 rounded-xl border border-line bg-white p-4">
            <label className="block text-sm font-semibold">{t(`customization.choose_${kind}`)}<input type="file" accept="image/jpeg,image/png,image/webp"
              className="mt-2 block w-full min-w-0 max-w-full text-sm" onChange={event => { const file = event.target.files?.[0]; event.currentTarget.value = ''; void upload(kind, file) }} /></label>
            {selected ? <p className="mt-2 text-xs text-sea">{t('customization.photo_ready')}</p> : <p className="mt-2 text-xs text-dim">{t('customization.no_photo')}</p>}
            <button type="button" className={NETWORK_BUTTON + ' mt-3'} disabled={!selected} onClick={() => { if (kind === 'avatar') setAvatar(null); else setCover(null); setSaved(false) }}>{t(`customization.remove_${kind}`)}</button>
          </section>
        })}</div>
        <label className="block text-sm font-semibold">{t('display_name')}<input className={NETWORK_FIELD} value={name} onChange={event => { setName(event.target.value); setSaved(false) }} required maxLength={100} /></label>
        <label className="block text-sm font-semibold">{t('bio')}<textarea className={NETWORK_FIELD} rows={4} value={bio} onChange={event => { setBio(event.target.value); setSaved(false) }} maxLength={2000} /></label>
        <label className="block text-sm font-semibold">{t('status_text')}<textarea className={NETWORK_FIELD} rows={2} value={status} onChange={event => { setStatus(event.target.value); setSaved(false) }} maxLength={280} /></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold">{t('visibility')}<select className={NETWORK_FIELD} value={visibility} onChange={event => { setVisibility(event.target.value as typeof visibility); setSaved(false) }}><option value="private">{t('visibility_private')}</option><option value="members">{t('visibility_members')}</option></select></label>
          <label className="block text-sm font-semibold">{t('wall_policy')}<select className={NETWORK_FIELD} value={wall} onChange={event => { setWall(event.target.value as typeof wall); setSaved(false) }}><option value="own_only">{t('wall_own_only')}</option><option value="approval_required">{t('wall_approval_required')}</option></select></label></div>
        <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={comments} onChange={event => { setComments(event.target.checked); setSaved(false) }} />{t('enable_comments')}</label>
        <p className="text-xs text-dim">{t('visibility_note')}</p>
        <div className="flex flex-wrap gap-2"><button type="button" className={NETWORK_BUTTON} onClick={() => setPreview(true)}>{t('customization.preview')}</button>
          <button type="submit" className={NETWORK_PRIMARY} disabled={!name.trim() || !dirty && baseline.version !== 0}>{t(busy ? 'saving' : 'save_changes')}</button>
          <button type="button" className={NETWORK_BUTTON} disabled={!dirty} onClick={discard}>{t('customization.discard')}</button></div>
      </fieldset>
    </form>}
    {uploading ? <p role="status" className="mt-3 text-sm text-dim">{t('uploading')}</p> : null}
    {photoError ? <p role="alert" className="mt-3 text-sm text-red-800">{t(photoError)}</p> : null}
    {saveError ? <p role="alert" className="mt-3 text-sm text-red-800">{t(saveError)} {t('reload_to_continue')}</p> : null}
    {saved ? <p role="status" className="mt-3 text-sm text-sea">{t('customization.saved')}</p> : null}
  </NetworkPanel>
}
