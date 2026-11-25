import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getNetworkMediaBlob, type NetworkProfile } from '../../api/propertyNetwork'
import { networkError } from './NetworkShared'

export type ProfilePresentation = Pick<NetworkProfile, 'display_name' | 'bio' | 'status_text' | 'visibility'> & {
  avatar_media_id: string | null; cover_media_id: string | null
}

/** Authenticated bytes only; a profile never falls back to an account or Google image. */
function ProfilePhoto({ id, kind, onAccessLost }: { id: string; kind: 'avatar' | 'cover'; onAccessLost?: () => void }) {
  const { t } = useTranslation('property_network')
  const [url, setUrl] = useState(''), [error, setError] = useState(false)
  const denied = useRef(onAccessLost); denied.current = onAccessLost
  useEffect(() => {
    const controller = new AbortController(); let objectUrl = ''
    setUrl(''); setError(false)
    getNetworkMediaBlob(id, controller.signal).then(blob => {
      if (!controller.signal.aborted) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl) }
    }).catch(cause => {
      if (!controller.signal.aborted) { setError(true); if (networkError(cause) === 'error_access') denied.current?.() }
    })
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [id])
  const size = kind === 'cover' ? 'h-36 w-full sm:h-48' : 'h-24 w-24 rounded-full'
  return error ? <p role="status" className={size + ' grid place-items-center bg-ink p-2 text-center text-xs text-white'}>{t('photo_unavailable')}</p>
    : url ? <img src={url} alt={t(`customization.${kind}_alt`)} className={size + ' bg-ink object-contain'} onError={() => setError(true)} />
      : <p role="status" className={size + ' grid place-items-center bg-ink p-2 text-center text-xs text-white'}>{t('photo_loading')}</p>
}

export function ProfileVisuals({ profile, own = false, code, preview = false, onAccessLost }: {
  profile: ProfilePresentation; own?: boolean; code?: number; preview?: boolean; onAccessLost?: () => void
}) {
  const { t } = useTranslation('property_network')
  const alias = profile.display_name.trim() || t('customization.unnamed')
  return <header className="min-w-0 overflow-hidden rounded-2xl bg-ink text-white" aria-label={preview ? t('customization.preview_title') : undefined}>
    {profile.cover_media_id ? <ProfilePhoto key={'cover:' + profile.cover_media_id} id={profile.cover_media_id} kind="cover" onAccessLost={onAccessLost} />
      : <div aria-hidden="true" className="h-28 bg-gradient-to-r from-sea to-ink sm:h-36" />}
    <div className="min-w-0 p-5">
      <div className="mb-4 inline-block rounded-full border-4 border-white bg-ink">
        {profile.avatar_media_id ? <ProfilePhoto key={'avatar:' + profile.avatar_media_id} id={profile.avatar_media_id} kind="avatar" onAccessLost={onAccessLost} />
          : <span aria-hidden="true" className="grid h-24 w-24 place-items-center rounded-full text-3xl font-bold">{Array.from(alias)[0]?.toLocaleUpperCase()}</span>}
      </div>
      <p className="text-xs text-white/65">{t(profile.visibility === 'private' ? 'profile_private' : 'profile_members')}</p>
      <h1 className="mt-2 break-words text-2xl font-bold [overflow-wrap:anywhere]">{alias}</h1>
      <p className="mt-3 whitespace-pre-wrap break-words text-sm font-semibold text-white [overflow-wrap:anywhere]">{profile.status_text}</p>
      <p className="mt-3 whitespace-pre-wrap break-words text-sm text-white/75 [overflow-wrap:anywhere]">{profile.bio}</p>
      {own && code !== undefined ? <p className="mt-3 text-xs text-white/65">{t('your_member_code', { code })}</p> : null}
    </div>
  </header>
}
