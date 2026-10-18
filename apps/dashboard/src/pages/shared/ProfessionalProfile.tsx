import { useEffect, useRef, useState } from 'react'
import { isAxiosError } from 'axios'
import { useTranslation } from 'react-i18next'
import { emptyProfessionalDraft, emptyProfessionalOptions, normalizeProfessionalDraft, professionalCustomServicesInvalid, professionalSubmissionIssues, type ProfessionalDraft, type ProfessionalOptions, type ProfessionalProfile as Profile } from '../../../../../packages/professionals/src'
import { getMyProfessionalProfile, getProfessionalOptions, saveProfessionalDraft, submitProfessionalProfile, uploadProfessionalPhoto, withdrawProfessionalProfile } from '../../api/professionals'
import { professionalButton, professionalPrimary } from '../../components/shared/ProfessionalFields'
import { ProfessionalDraftFields } from '../../components/shared/ProfessionalDraftFields'
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
    if (professionalCustomServicesInvalid(normalizeProfessionalDraft(draft))) { setError(t('issues.custom_services')); return }
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
    finally { setUploading(false) }
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
        <ProfessionalDraftFields draft={draft} options={options} onChange={change} onUpload={file => void upload(file)} uploading={uploading} />
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
