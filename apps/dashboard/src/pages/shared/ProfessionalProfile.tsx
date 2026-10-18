import { useEffect, useRef, useState } from 'react'
import { isAxiosError } from 'axios'
import { useTranslation } from 'react-i18next'
import { emptyProfessionalDraft, emptyProfessionalOptions, normalizeProfessionalDraft, professionalSubmissionIssues, type ProfessionalDraft, type ProfessionalOptions, type ProfessionalProfile as Profile } from '../../../../../packages/professionals/src'
import { getMyProfessionalProfile, getProfessionalOptions, saveProfessionalDraft, submitProfessionalProfile, uploadProfessionalPhoto, withdrawProfessionalProfile } from '../../api/professionals'
import { ProfessionalChoices, ProfessionalField, professionalButton, professionalInput, professionalPrimary } from '../../components/shared/ProfessionalFields'
import { ProfessionalPreview } from '../../components/shared/ProfessionalPreview'
import { ProfessionalDialog } from '../../components/shared/ProfessionalDialog'
import { ProfessionalConfirmation } from '../../components/shared/ProfessionalConfirmation'

const LANDING_URL = import.meta.env.VITE_LANDING_URL ?? 'https://ilovedrrealty.com'

export function ProfessionalProfile() {
  const { t } = useTranslation('professionals')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [draft, setDraft] = useState<ProfessionalDraft>(emptyProfessionalDraft)
  const [options, setOptions] = useState<ProfessionalOptions>(emptyProfessionalOptions)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [stale, setStale] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [showIssues, setShowIssues] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'withdraw' | 'discard' | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const dirty = JSON.stringify(draft) !== JSON.stringify(profile?.draft ?? emptyProfessionalDraft())
  const issues = professionalSubmissionIssues(normalizeProfessionalDraft(draft))
  const blocked = busy || uploading || stale

  async function load() {
    setLoading(true); setLoadError(false)
    try {
      const [next, nextOptions] = await Promise.all([getMyProfessionalProfile(), getProfessionalOptions()])
      setProfile(next); setDraft(next?.draft ?? emptyProfessionalDraft()); setOptions(nextOptions)
      setStale(false); setError(''); setMessage(''); setShowIssues(false)
    } catch { setLoadError(true) }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty || busy || uploading) { event.preventDefault(); event.returnValue = '' }
    }
    const beforeNavigation = (event: Event) => {
      if (busy || uploading || (dirty && !window.confirm(t('leave_confirm')))) event.preventDefault()
    }
    window.addEventListener('beforeunload', beforeUnload)
    window.addEventListener('ildr:before-dashboard-navigation', beforeNavigation)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      window.removeEventListener('ildr:before-dashboard-navigation', beforeNavigation)
    }
  }, [dirty, busy, uploading, t])
  useEffect(() => { if (error || showIssues) errorRef.current?.focus() }, [error, showIssues])

  function change<K extends keyof ProfessionalDraft>(key: K, value: ProfessionalDraft[K]) {
    setDraft(previous => ({ ...previous, [key]: value })); setMessage(''); setError('')
  }
  function handleFailure(cause: unknown) {
    if (isAxiosError(cause) && cause.response?.status === 409) { setStale(true); setError(t('conflict')) }
    else setError(t('action_error'))
  }
  async function save(submit: boolean) {
    if (blocked) return
    setShowIssues(submit)
    if (submit && issues.length) return
    setBusy(true); setError(''); setMessage('')
    try {
      const saved = await saveProfessionalDraft(profile?.version ?? 0, normalizeProfessionalDraft(draft))
      setProfile(saved); setDraft(saved.draft)
      if (submit) {
        const submitted = await submitProfessionalProfile(saved.version)
        setProfile(submitted); setDraft(submitted.draft)
      }
      setShowIssues(false); setMessage(t(submit ? 'submitted' : 'saved'))
    } catch (cause) { handleFailure(cause) }
    finally { setBusy(false) }
  }
  async function withdraw() {
    if (!profile || blocked) return
    setBusy(true); setError(''); setMessage('')
    try {
      const next = await withdrawProfessionalProfile(profile.version)
      setProfile(next)
      if (!dirty) setDraft(next.draft)
      setMessage(t('withdrawn'))
    } catch (cause) { handleFailure(cause) }
    finally { setBusy(false); setConfirmAction(null) }
  }
  async function upload(file?: File) {
    if (!file || blocked) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { setError(t('photo_error')); return }
    setUploading(true); setError('')
    try { change('photo_url', await uploadProfessionalPhoto(file)) }
    catch { setError(t('photo_failed')) }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }
  if (loading) return <p role="status" className="text-sm text-ink2">{t('loading')}</p>
  if (loadError) return <div role="alert" className="space-y-3"><p>{t('load_error')}</p><button className={professionalButton} onClick={() => void load()}>{t('retry')}</button></div>

  return <div className="min-w-0 space-y-5">
    <p className="text-sm leading-relaxed text-ink2">{t('profile_intro')}</p>
    <a href={`${LANDING_URL.replace(/\/$/, '')}/professionals/`} target="_blank" rel="noopener noreferrer" className="inline-block text-sm font-semibold text-coral">{t('directory')} ↗</a>
    <div className="flex flex-wrap gap-3 rounded-xl border border-line bg-white p-4 text-sm">
      <span><strong>{t('status')}:</strong> {t(`review.${profile?.review_status ?? 'draft'}`)}</span>
      <span><strong>{t('visibility')}:</strong> {t(`listing.${profile?.listing_status ?? 'hidden'}`)}</span>
      <span className="text-dim">{t('version', { version: profile?.version ?? 0 })}</span>
      {dirty && <span className="font-semibold text-coral">{t('unsaved')}</span>}
    </div>
    {profile?.review_note && <div className="rounded-xl border border-line bg-white p-4"><h2 className="text-sm font-bold">{t('review_note')}</h2><p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink2">{profile.review_note}</p></div>}
    {profile?.listing_status === 'published' && <p className="text-sm text-ink2">{t('published_edits')}</p>}
    {profile?.review_status === 'pending' && <p className="text-sm text-ink2">{t('pending_edits')}</p>}
    {profile?.listing_status === 'suspended' && <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{t('suspended_help')}</p>}
    {(error || (showIssues && issues.length > 0)) && <div ref={errorRef} tabIndex={-1} role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900 outline-none">
      {error && <p>{error}</p>}
      {showIssues && issues.length > 0 && <><p>{t('required_notice')}</p><ul className="list-disc pl-5 mt-2">{issues.map(issue => <li key={issue}>{t(`issues.${issue}`)}</li>)}</ul></>}
    </div>}
    {message && <p role="status" className="rounded-xl border border-green-300 bg-green-50 p-4 text-sm text-green-900">{message}</p>}
    <form onSubmit={event => { event.preventDefault(); void save(true) }}>
      <fieldset disabled={busy || uploading} className="space-y-5 min-w-0">
        <section className="space-y-4 rounded-2xl border border-line bg-white p-4 sm:p-6">
          <h2 className="text-lg font-bold text-ink">{t('details_heading')}</h2>
          <p className="text-xs text-dim">{t('name_help')}</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <ProfessionalField label={t('business_name')} value={draft.business_name} onChange={value => change('business_name', value)} maxLength={120} />
            <ProfessionalField label={t('contact_name')} value={draft.contact_name} onChange={value => change('contact_name', value)} maxLength={100} />
          </div>
          <ProfessionalChoices title={t('categories')} values={draft.category_ids} options={options.categories} max={8} onChange={value => change('category_ids', value)} />
          <ProfessionalChoices title={t('areas')} values={draft.service_area_ids} options={options.areas} max={20} onChange={value => change('service_area_ids', value)} />
          <ProfessionalChoices title={t('languages')} values={draft.languages} options={options.languages} max={8} onChange={value => change('languages', value)} />
          <p className="text-xs text-dim">{t('description_help')}</p>
          <div className="grid lg:grid-cols-2 gap-4">{(['en', 'es'] as const).map(language => <label key={language} className="block min-w-0 text-sm font-semibold text-ink">
            <span className="block mb-1.5">{t(`description_${language}`)}</span>
            <textarea rows={6} maxLength={4000} className={professionalInput} value={draft.descriptions[language]} onChange={event => change('descriptions', { ...draft.descriptions, [language]: event.target.value })} />
          </label>)}</div>
        </section>
        <section className="space-y-4 rounded-2xl border border-line bg-white p-4 sm:p-6">
          <h2 className="text-lg font-bold text-ink">{t('contacts_heading')}</h2>
          <p className="text-sm text-ink2">{t('consent_help')}</p>
          <p className="text-xs text-dim">{t('contact_help')}</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <ProfessionalField label={t('public_phone')} type="tel" value={draft.public_phone} maxLength={30} onChange={value => change('public_phone', value)} />
            <ProfessionalField label={t('public_whatsapp')} type="tel" value={draft.public_whatsapp} maxLength={30} onChange={value => change('public_whatsapp', value)} />
            <ProfessionalField label={t('public_email')} type="email" value={draft.public_email} maxLength={254} onChange={value => change('public_email', value)} />
            <ProfessionalField label={t('website_url')} type="url" value={draft.website_url} maxLength={2048} onChange={value => change('website_url', value)} />
          </div>
          <label className="flex items-start gap-3 text-sm text-ink2"><input className="mt-1 shrink-0 accent-coral" type="checkbox" checked={draft.public_contact_consent} onChange={event => change('public_contact_consent', event.target.checked)} /><span>{t('consent')}</span></label>
          <p className="text-xs font-semibold text-amber-800">{t('revoke_help')}</p>
        </section>
        <section className="space-y-3 rounded-2xl border border-line bg-white p-4 sm:p-6">
          <h2 className="text-lg font-bold text-ink">{t('photo_heading')}</h2><p className="text-xs text-dim">{t('photo_help')}</p>
          {draft.photo_url && <img src={draft.photo_url} alt="" className="h-28 w-28 rounded-xl object-cover" />}
          <div className="flex flex-wrap gap-3">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label={t('photo_upload')} onChange={event => void upload(event.target.files?.[0])} />
            <button type="button" className={professionalButton} onClick={() => fileRef.current?.click()}>{t(uploading ? 'photo_uploading' : 'photo_upload')}</button>
            {draft.photo_url && <button type="button" className={professionalButton} onClick={() => change('photo_url', '')}>{t('photo_remove')}</button>}
          </div>
        </section>
        <div className="flex flex-wrap gap-3">
          <button type="button" className={professionalButton} disabled={blocked || !dirty} onClick={() => void save(false)}>{t(busy ? 'saving' : 'save')}</button>
          <button type="submit" className={professionalPrimary} disabled={blocked || profile?.listing_status === 'suspended' || (profile?.review_status === 'pending' && !dirty)}>{t(busy ? 'saving' : 'submit')}</button>
          <button type="button" className={professionalButton} onClick={() => setShowPreview(value => !value)} aria-expanded={showPreview}>{t('draft_preview')}</button>
        </div>
      </fieldset>
    </form>
    {(dirty || stale) && <button className={professionalButton} disabled={busy || uploading} onClick={() => setConfirmAction('discard')}>{t('discard')}</button>}
    {profile && (profile.listing_status === 'published' || profile.review_status === 'pending') && <button className={`${professionalButton} !text-red-700 ml-0 sm:ml-3`} disabled={blocked} onClick={() => setConfirmAction('withdraw')}>{t('withdraw')}</button>}
    {showPreview && <section className="space-y-3"><h2 className="font-bold text-ink">{t('draft_preview')}</h2><ProfessionalPreview profile={draft} options={options} /><p className="text-xs text-dim">{t('review_warning')}</p></section>}
    {profile?.published_profile && profile.listing_status === 'published' && <section className="space-y-3"><h2 className="font-bold text-ink">{t('public_preview')}</h2><ProfessionalPreview profile={profile.published_profile} options={options} /></section>}
    {confirmAction && <ProfessionalDialog title={t(confirmAction)} closeLabel={t('cancel')} onClose={() => { if (!busy) setConfirmAction(null) }}>
      <ProfessionalConfirmation message={t(`${confirmAction}_confirm`)} confirmLabel={t(busy ? 'saving' : 'confirm')} cancelLabel={t('cancel')} busy={busy}
        onCancel={() => setConfirmAction(null)} onConfirm={() => { if (confirmAction === 'withdraw') void withdraw(); else { setConfirmAction(null); void load() } }} />
    </ProfessionalDialog>}
  </div>
}
