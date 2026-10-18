'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { professionalContactHref, professionalLabel, professionalOptionLabels, type ProfessionalOptions, type PublicProfessional } from '../../../../packages/professionals/src'

export function ProfessionalPortrait({ photo, name, large = false }: { photo: string; name: string; large?: boolean }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => { setFailed(false) }, [photo])
  const classes = large ? 'h-24 w-24' : 'h-20 w-20'
  return photo && !failed ? <img src={photo} alt="" onError={() => setFailed(true)} loading="lazy" className={`${classes} rounded-2xl object-cover shrink-0 bg-paper2`} /> : <div aria-hidden="true" className={`${classes} rounded-2xl bg-paper2 shrink-0 grid place-items-center text-3xl font-bold text-coral`}>{name.trim().charAt(0).toUpperCase()}</div>
}

export function ProfessionalDetails({ profile, options, loading, unavailable, onClose }: { profile: PublicProfessional | null; options: ProfessionalOptions; loading: boolean; unavailable: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation('professionals')
  const panel = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  const [shareMessage, setShareMessage] = useState('')
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'; panel.current?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); return }
      if (event.key !== 'Tab') return
      const controls = [...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex="0"]') ?? [])].filter(element => element.getClientRects().length > 0)
      const first = controls[0], last = controls[controls.length - 1]
      if (!first) { event.preventDefault(); panel.current?.focus() }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', keydown)
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keydown); previous?.focus() }
  }, [])
  useEffect(() => { setShareMessage('') }, [profile?.id])
  async function share() {
    try { await navigator.clipboard.writeText(window.location.href); setShareMessage(t('copied')) }
    catch { setShareMessage(t('copy_failed')) }
  }
  const name = profile?.business_name || profile?.contact_name || t('eyebrow')
  return <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-2 sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <div ref={panel} role="dialog" aria-modal="true" aria-label={name} tabIndex={-1} className="max-h-[94dvh] w-full min-w-0 max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 sm:p-8 outline-none">
      <div className="flex justify-end mb-3"><button type="button" aria-label={t('close')} onClick={onClose} className="rounded-full bg-paper2 p-2 text-ink"><X size={22} /></button></div>
      {loading ? <p role="status">{t('loading')}</p> : unavailable || !profile ? <p role="alert">{t('unavailable')}</p> : <article className="space-y-5 min-w-0 break-words">
        <div className="flex items-start gap-4"><ProfessionalPortrait photo={profile.photo_url} name={name} large /><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-coral">{t('eyebrow')}</p><h2 className="text-2xl sm:text-3xl font-extrabold text-ink mt-1">{name}</h2>{profile.contact_name && profile.contact_name !== profile.business_name && <p className="text-sm text-ink2 mt-2">{t('contact_name')}: {profile.contact_name}</p>}</div></div>
        <p className="font-semibold text-coral text-sm">{professionalOptionLabels(profile.category_ids, options.categories, i18n.language).join(' · ')}</p>
        <p className="text-sm text-ink2"><strong>{t('areas')}:</strong> {professionalOptionLabels(profile.service_area_ids, options.areas, i18n.language).join(', ')}</p>
        {profile.languages.length > 0 && <p className="text-sm text-ink2"><strong>{t('languages')}:</strong> {professionalOptionLabels(profile.languages, options.languages, i18n.language).join(', ')}</p>}
        <section><h3 className="font-bold text-ink mb-2">{t('about')}</h3><p className="text-sm leading-relaxed whitespace-pre-wrap text-ink2">{professionalLabel(profile.descriptions, i18n.language)}</p></section>
        <div className="grid sm:grid-cols-2 gap-3">{([
          ['phone', profile.public_phone, 'call'], ['whatsapp', profile.public_whatsapp, 'whatsapp'],
          ['email', profile.public_email, 'email'], ['website', profile.website_url, 'website'],
        ] as const).map(([kind, value, key]) => {
          const href = professionalContactHref(kind, value)
          return href ? <a key={kind} href={href} target={kind === 'website' || kind === 'whatsapp' ? '_blank' : undefined} rel="noopener noreferrer" className="min-w-0 rounded-xl border border-line p-4 text-sm font-semibold text-coral hover:border-coral focus-visible:outline-coral">{t(key)}<span className="block mt-1 break-all text-xs font-normal text-ink2">{value}</span></a> : null
        })}</div>
        <button type="button" onClick={() => void share()} className="text-sm font-semibold text-coral underline">{t('copy_link')}</button>
        {shareMessage && <p role="status" className="text-sm text-ink2">{shareMessage}</p>}
        <div className="rounded-xl bg-paper2 p-4 text-xs text-ink2"><p className="font-bold mb-1">{t('reviewed')}</p><p>{t('review_note')}</p></div>
      </article>}
    </div>
  </div>
}
