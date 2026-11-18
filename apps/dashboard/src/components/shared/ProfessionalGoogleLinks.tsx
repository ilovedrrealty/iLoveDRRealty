import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { professionalGoogleEmbedHref, professionalGoogleProfileHref } from '../../../../../packages/professionals/src'
import { professionalButton } from './ProfessionalFields'

export function ProfessionalGoogleLinks({ profileUrl, embedUrl, name }: { profileUrl?: string; embedUrl?: string; name: string }) {
  const { t } = useTranslation('professionals')
  const profile = professionalGoogleProfileHref(profileUrl), embed = professionalGoogleEmbedHref(embedUrl)
  const [loaded, setLoaded] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState<string | null>(null)
  const source = `${profile ?? ''}\n${embed ?? ''}`
  if (!profile) return null
  return <section className="min-w-0 space-y-3 rounded-xl border border-line p-4">
    <h4 className="font-semibold text-ink">{t('google.heading')}</h4>
    <p className="text-xs leading-relaxed text-ink2">{t('google.member_help')}</p>
    <a href={profile} target="_blank" rel="noopener noreferrer" className={professionalButton}>{t('google.open_profile')}</a>
    {embed && <div className="min-w-0 space-y-3">
      <p className="text-xs leading-relaxed text-dim">{t('google.load_help')}</p>
      {unavailable === source && <p role="status" className="text-xs text-ink2">{t('google.unavailable')}</p>}
      {loaded === source ? <>
        <iframe title={t('google.map_title', { name })} src={embed} className="h-[300px] min-w-0 w-full rounded-lg border-0"
          loading="lazy" referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin" allowFullScreen
          onError={() => { setUnavailable(source); setLoaded(null) }} />
        <button type="button" className={professionalButton} onClick={() => setLoaded(null)}>{t('google.hide_map')}</button>
      </> : <button type="button" className={professionalButton} onClick={() => { setUnavailable(null); setLoaded(source) }}>{t('google.load_map')}</button>}
    </div>}
  </section>
}
