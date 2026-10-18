import { useEffect, useRef, useState } from 'react'
import { isAxiosError } from 'axios'
import { useTranslation } from 'react-i18next'
import { emptyProfessionalDraft, isAdminManagedProfessional, normalizeProfessionalDraft, professionalCustomServicesInvalid, professionalSubmissionIssues, type AdminProfessional, type ProfessionalDraft, type ProfessionalOptions } from '../../../../../packages/professionals/src'
import { createAdminProfessional, getAdminProfessional, saveAdminProfessional, submitAdminProfessional, uploadAdminProfessionalPhoto } from '../../api/professionals'
import { ProfessionalDialog } from '../shared/ProfessionalDialog'
import { ProfessionalConfirmation } from '../shared/ProfessionalConfirmation'
import { ProfessionalDraftFields } from '../shared/ProfessionalDraftFields'
import { professionalButton, professionalPrimary } from '../shared/ProfessionalFields'
import { ProfessionalPreview } from '../shared/ProfessionalPreview'

export function ManagedProfessionalEditor({ initial, options, onSaved, onClose }: {
  initial: AdminProfessional | null; options: ProfessionalOptions;
  onSaved: (profile: AdminProfessional) => void; onClose: () => void;
}) {
  const { t } = useTranslation('professionals')
  const [profile, setProfile] = useState(initial)
  const [draft, setDraft] = useState<ProfessionalDraft>(() => initial?.draft ?? emptyProfessionalDraft())
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [stale, setStale] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [showIssues, setShowIssues] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [confirmation, setConfirmation] = useState<'close' | 'reload' | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const dirty = JSON.stringify(draft) !== JSON.stringify(profile?.draft ?? emptyProfessionalDraft())
  const issues = professionalSubmissionIssues(normalizeProfessionalDraft(draft))
  const blocked = busy || uploading || stale

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty || busy || uploading) { event.preventDefault(); event.returnValue = '' } }
    const beforeNavigation = (event: Event) => {
      if (busy || uploading || (dirty && !window.confirm(t('managed_leave_confirm')))) event.preventDefault()
    }
    window.addEventListener('beforeunload', beforeUnload)
    window.addEventListener('ildr:before-dashboard-navigation', beforeNavigation)
    return () => { window.removeEventListener('beforeunload', beforeUnload); window.removeEventListener('ildr:before-dashboard-navigation', beforeNavigation) }
  }, [dirty, busy, uploading, t])
  useEffect(() => { if (error || showIssues) errorRef.current?.focus() }, [error, showIssues])

  function change<K extends keyof ProfessionalDraft>(key: K, value: ProfessionalDraft[K]) {
    setDraft(previous => ({ ...previous, [key]: value })); setError(''); setMessage('')
  }
  function fail(cause: unknown) {
    if (isAxiosError(cause) && cause.response?.status === 409) { setStale(true); setError(t('conflict')) }
    else setError(t('action_error'))
  }
  function close() {
    if (busy || uploading) return
    if (confirmation) { setConfirmation(null); return }
    if (dirty) setConfirmation('close')
    else onClose()
  }
  async function save(submit: boolean) {
    if (blocked || (profile && !isAdminManagedProfessional(profile))) return
    const normalized = normalizeProfessionalDraft(draft)
    if (professionalCustomServicesInvalid(normalized)) { setError(t('issues.custom_services')); return }
    setShowIssues(submit)
    if (submit && issues.length) return
    setBusy(true); setError(''); setMessage('')
    try {
      const saved = profile ? await saveAdminProfessional(profile.id, profile.version, normalized) : await createAdminProfessional(normalized)
      setProfile(saved); setDraft(saved.draft); onSaved(saved)
      if (submit) {
        const submitted = await submitAdminProfessional(saved.id, saved.version)
        setProfile(submitted); setDraft(submitted.draft); onSaved(submitted)
        onClose()
      } else setMessage(t('managed_saved'))
      setShowIssues(false)
    } catch (cause) { fail(cause) }
    finally { setBusy(false) }
  }
  async function reload() {
    if (!profile || busy || uploading) return
    setBusy(true); setError('')
    try {
      const next = await getAdminProfessional(profile.id)
      setProfile(next); setDraft(next.draft); setStale(false); setShowIssues(false); setMessage(''); onSaved(next)
    } catch (cause) { fail(cause) }
    finally { setBusy(false); setConfirmation(null) }
  }
  async function upload(file?: File) {
    if (!file || !profile || blocked || !isAdminManagedProfessional(profile)) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { setError(t('photo_error')); return }
    setUploading(true); setError('')
    try { change('photo_url', await uploadAdminProfessionalPhoto(profile.id, file)) }
    catch { setError(t('photo_failed')) }
    finally { setUploading(false) }
  }

  return <ProfessionalDialog title={t(profile ? 'managed_edit' : 'managed_add')} closeLabel={t('managed_close')} onClose={close}>
    {confirmation ? <ProfessionalConfirmation message={t(confirmation === 'close' ? 'managed_leave_confirm' : 'discard_confirm')} confirmLabel={t(busy ? 'saving' : 'confirm')} cancelLabel={t('cancel')} busy={busy || uploading} onCancel={() => setConfirmation(null)} onConfirm={() => { if (confirmation === 'close') onClose(); else void reload() }} /> : <div className="space-y-5 min-w-0">
      <p className="text-sm text-ink2">{t('managed_intro')}</p>
      {profile && !isAdminManagedProfessional(profile) ? <p role="alert">{t('managed_only')}</p> : <>
        <div className="flex flex-wrap gap-3 rounded-xl border border-line bg-white p-4 text-sm">
          <span>{t('managed_badge')}</span><span>{t('version', { version: profile?.version ?? 0 })}</span>
          <span>{t(`review.${profile?.review_status ?? 'draft'}`)} · {t(`listing.${profile?.listing_status ?? 'hidden'}`)}</span>
          {dirty && <span className="font-semibold text-coral">{t('unsaved')}</span>}
        </div>
        {profile?.listing_status === 'published' && <p className="text-sm text-ink2">{t('managed_published_edits')}</p>}
        {profile?.review_status === 'pending' && <p className="text-sm text-ink2">{t('managed_pending_edits')}</p>}
        {profile?.listing_status === 'suspended' && <p className="text-sm text-amber-900">{t('suspended_approval')}</p>}
        {(error || (showIssues && issues.length > 0)) && <div ref={errorRef} tabIndex={-1} role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900 outline-none">
          {error && <p>{error}</p>}{showIssues && issues.length > 0 && <><p>{t('required_notice')}</p><ul className="mt-2 list-disc pl-5">{issues.map(issue => <li key={issue}>{t(`issues.${issue}`)}</li>)}</ul></>}
        </div>}
        {message && <p role="status" className="rounded-xl border border-green-300 bg-green-50 p-4 text-sm">{message}</p>}
        <form onSubmit={event => { event.preventDefault(); void save(true) }}>
          <fieldset disabled={busy || uploading} className="space-y-5 min-w-0">
            <ProfessionalDraftFields draft={draft} options={options} onChange={change} onUpload={file => void upload(file)} uploading={uploading} adminManaged canUpload={Boolean(profile)} />
            <div className="flex flex-wrap gap-3">
              <button type="button" className={professionalButton} disabled={blocked || (Boolean(profile) && !dirty)} onClick={() => void save(false)}>{t(busy ? 'saving' : 'save')}</button>
              <button type="submit" className={professionalPrimary} disabled={blocked || profile?.listing_status === 'suspended' || (profile?.review_status === 'pending' && !dirty)}>{t(busy ? 'saving' : 'submit')}</button>
              <button type="button" className={professionalButton} aria-expanded={showPreview} onClick={() => setShowPreview(value => !value)}>{t('draft_preview')}</button>
            </div>
          </fieldset>
        </form>
        {stale && <button type="button" className={professionalButton} disabled={busy || uploading} onClick={() => setConfirmation('reload')}>{t('discard')}</button>}
        {showPreview && <section className="space-y-3"><h3 className="font-bold">{t('draft_preview')}</h3><ProfessionalPreview profile={draft} options={options} /></section>}
      </>}
    </div>}
  </ProfessionalDialog>
}
