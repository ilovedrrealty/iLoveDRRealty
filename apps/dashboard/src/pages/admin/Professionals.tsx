import { useEffect, useId, useRef, useState } from 'react'
import { isAxiosError } from 'axios'
import { useTranslation } from 'react-i18next'
import { canApproveProfessional, emptyProfessionalOptions, isAdminManagedProfessional, professionalOptionLabels, professionalServiceLabels, type AdminProfessional, type AdminProfessionalSummary, type ProfessionalOptions, type ProfessionalPage } from '../../../../../packages/professionals/src'
import { getAdminProfessional, getAdminProfessionals, getProfessionalOptions, moderateProfessional } from '../../api/professionals'
import { professionalButton, professionalInput, professionalPrimary } from '../../components/shared/ProfessionalFields'
import { ProfessionalPreview } from '../../components/shared/ProfessionalPreview'
import { ProfessionalDialog } from '../../components/shared/ProfessionalDialog'
import { ProfessionalConfirmation } from '../../components/shared/ProfessionalConfirmation'
import { ManagedProfessionalEditor } from '../../components/admin/ManagedProfessionalEditor'

const LIMIT = 20

export function AdminProfessionals() {
  const { t, i18n } = useTranslation('professionals')
  const [options, setOptions] = useState<ProfessionalOptions>(emptyProfessionalOptions)
  const [page, setPage] = useState<ProfessionalPage<AdminProfessionalSummary>>({ items: [], total: 0, limit: LIMIT, offset: 0 })
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [review, setReview] = useState('')
  const [visibility, setVisibility] = useState('')
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [revision, setRevision] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<AdminProfessional | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [stale, setStale] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [confirmAction, setConfirmAction] = useState<'approve' | 'reject' | 'suspend' | 'reinstate' | null>(null)
  const [managedEditor, setManagedEditor] = useState<{ initial: AdminProfessional | null } | null>(null)
  const detailRequest = useRef(0)
  const fieldId = useId()

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setLoadError(false)
    Promise.all([
      getAdminProfessionals({ q: search || undefined, review_status: review || undefined, listing_status: visibility || undefined, limit: LIMIT, offset }, controller.signal),
      getProfessionalOptions(),
    ]).then(([next, nextOptions]) => {
      if (!controller.signal.aborted) { setPage(next); setOptions(nextOptions) }
    }).catch(() => { if (!controller.signal.aborted) setLoadError(true) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [search, review, visibility, offset, revision])

  async function open(id: string) {
    const request = ++detailRequest.current
    setSelectedId(id); setDetail(null); setDetailLoading(true); setDetailError(''); setStale(false); setNote(''); setMessage(''); setConfirmAction(null)
    try {
      const next = await getAdminProfessional(id)
      if (request === detailRequest.current) setDetail(next)
    } catch { if (request === detailRequest.current) setDetailError(t('load_error')) }
    finally { if (request === detailRequest.current) setDetailLoading(false) }
  }
  function add() {
    detailRequest.current++
    setSelectedId(null); setDetail(null); setDetailLoading(false); setDetailError('')
    setNote(''); setConfirmAction(null); setStale(false); setMessage('')
    setManagedEditor({ initial: null })
  }
  function filterBy(reviewStatus: string, listingStatus: string) {
    setReview(reviewStatus); setVisibility(listingStatus); setOffset(0)
  }
  function close() {
    if (busy) return
    if (confirmAction) { setConfirmAction(null); return }
    detailRequest.current++; setSelectedId(null); setDetail(null)
  }
  function requestAction(action: 'approve' | 'reject' | 'suspend' | 'reinstate') {
    if (!detail || busy || stale) return
    if ((action === 'reject' || action === 'suspend') && !note.trim()) { setDetailError(t('reason_required')); return }
    setConfirmAction(action)
  }
  async function act() {
    const action = confirmAction
    if (!detail || !action || busy || stale) return
    setBusy(true); setDetailError(''); setMessage('')
    try {
      const next = await moderateProfessional(detail.id, action, detail.version, note.trim())
      setDetail(next); setNote(''); setMessage(t('moderated')); setRevision(previous => previous + 1)
    } catch (cause) {
      if (isAxiosError(cause) && cause.response?.status === 409) { setStale(true); setDetailError(t('admin_conflict')) }
      else setDetailError(t('action_error'))
    } finally { setBusy(false); setConfirmAction(null) }
  }
  const totalPages = Math.max(1, Math.ceil(page.total / LIMIT))
  const date = (value: string) => new Date(value).toLocaleString(i18n.language.startsWith('es') ? 'es-DO' : 'en-US')

  return <div className="min-w-0 space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-4"><p className="max-w-3xl text-sm leading-relaxed text-ink2">{t('admin_intro')}</p>
      <button type="button" className={professionalPrimary} disabled={loading || loadError} onClick={add}>{t('managed_add')}</button>
    </div>
    <div className="flex flex-wrap gap-2" role="group" aria-label={t('admin_filters')}>
      {[
        { label: 'admin_all_profiles', review: '', visibility: '' },
        { label: 'admin_private_drafts', review: 'draft', visibility: 'hidden' },
        { label: 'admin_awaiting_review', review: 'pending', visibility: '' },
      ].map(filter => <button key={filter.label} type="button" className={review === filter.review && visibility === filter.visibility ? professionalPrimary : professionalButton}
        aria-pressed={review === filter.review && visibility === filter.visibility}
        onClick={() => filterBy(filter.review, filter.visibility)}>{t(filter.label)}</button>)}
    </div>
    <p className="text-xs text-dim">{t('admin_filter_help')}</p>
    <form className="grid sm:grid-cols-2 xl:grid-cols-[1fr_180px_180px_auto] gap-3 items-end" onSubmit={event => { event.preventDefault(); setSearch(query.trim()); setOffset(0) }}>
      <label htmlFor={`${fieldId}-search`} className="text-sm font-semibold min-w-0"><span className="block mb-1.5">{t('search')}</span><input id={`${fieldId}-search`} type="search" maxLength={100} value={query} className={professionalInput} onChange={event => setQuery(event.target.value)} /></label>
      <label htmlFor={`${fieldId}-status`} className="text-sm font-semibold min-w-0"><span className="block mb-1.5">{t('status')}</span><select id={`${fieldId}-status`} className={professionalInput} value={review} onChange={event => { setReview(event.target.value); setOffset(0) }}>
        <option value="">{t('all')}</option>{['draft', 'pending', 'approved', 'rejected'].map(value => <option key={value} value={value}>{t(`review.${value}`)}</option>)}
      </select></label>
      <label htmlFor={`${fieldId}-visibility`} className="text-sm font-semibold min-w-0"><span className="block mb-1.5">{t('visibility')}</span><select id={`${fieldId}-visibility`} className={professionalInput} value={visibility} onChange={event => { setVisibility(event.target.value); setOffset(0) }}>
        <option value="">{t('all')}</option>{['hidden', 'published', 'suspended'].map(value => <option key={value} value={value}>{t(`listing.${value}`)}</option>)}
      </select></label>
      <button className={professionalButton}>{t('search_apply')}</button>
    </form>
    {loading ? <p role="status" className="text-sm text-ink2">{t('loading')}</p> : loadError ? <div role="alert"><p className="mb-3">{t('load_error')}</p><button className={professionalButton} onClick={() => setRevision(value => value + 1)}>{t('retry')}</button></div> : <>
      <p role="status" className="text-sm text-dim">{t('results', { count: page.total })}</p>
      {!page.items.length && <p className="rounded-xl border border-line bg-white p-6 text-sm text-ink2">{t('empty')}</p>}
      <div className="grid lg:grid-cols-2 gap-4">{page.items.map(item => <article key={item.id} className="rounded-2xl border border-line bg-white p-5 min-w-0 space-y-3">
        <h2 className="font-bold text-lg text-ink break-words">{item.business_name || item.contact_name}</h2>
        <div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-paper2 px-2 py-1">{t(`review.${item.review_status}`)}</span><span className="rounded-full bg-paper2 px-2 py-1">{t(`listing.${item.listing_status}`)}</span></div>
        <p className="text-sm text-ink2 break-words">{professionalServiceLabels(item, options.categories, i18n.language).join(' · ')}</p>
        <p className="text-xs text-dim">{professionalOptionLabels(item.service_area_ids, options.areas, i18n.language).join(' · ')}</p>
        <p className="text-xs text-dim break-all">{item.owner ? `${item.owner.display_name} · ${item.owner.email}` : t('managed_badge')}</p>
        <button className={professionalButton} onClick={() => void open(item.id)}>{t('review_profile')}</button>
      </article>)}</div>
      {page.total > LIMIT && <div className="flex flex-wrap items-center gap-3"><button className={professionalButton} disabled={offset === 0} onClick={() => setOffset(value => Math.max(0, value - LIMIT))}>{t('previous')}</button><span className="text-xs text-dim">{t('page', { page: Math.floor(offset / LIMIT) + 1, pages: totalPages })}</span><button className={professionalButton} disabled={offset + LIMIT >= page.total || offset + LIMIT > 10000} onClick={() => setOffset(value => value + LIMIT)}>{t('next')}</button></div>}
    </>}
    {selectedId && !managedEditor && <ProfessionalDialog title={t(confirmAction ?? 'review_profile')} closeLabel={t(confirmAction ? 'cancel' : 'close')} onClose={close}>
      {confirmAction ? <ProfessionalConfirmation message={t(`${confirmAction}_confirm`)} confirmLabel={t(busy ? 'saving' : 'confirm')} cancelLabel={t('cancel')} busy={busy} onConfirm={() => void act()} onCancel={() => setConfirmAction(null)} /> : detailLoading ? <p role="status">{t('loading')}</p> : <div className="space-y-5">
        {detailError && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">{detailError}</p>}
        {(stale || !detail) && <button className={professionalButton} disabled={busy} onClick={() => void open(selectedId)}>{t('reload_review')}</button>}
        {message && <p role="status" className="rounded-xl border border-green-300 bg-green-50 p-4 text-sm">{message}</p>}
        {detail && <>
          <section className="rounded-xl border border-line bg-white p-4 space-y-2"><h3 className="font-bold text-sm">{t(detail.owner ? 'owner' : 'managed_badge')}</h3>
            {detail.owner ? <p className="text-sm break-all">{detail.owner.display_name} · {detail.owner.email}</p> : <p className="text-sm text-ink2">{t('managed_no_account')}</p>}
            <p className="text-xs text-dim">{t('version', { version: detail.version })} · {t(`review.${detail.review_status}`)} · {t(`listing.${detail.listing_status}`)}</p>
            {isAdminManagedProfessional(detail) && <button type="button" className={professionalButton} disabled={busy || stale} onClick={() => setManagedEditor({ initial: detail })}>{t('managed_edit')}</button>}
          </section>
          <div className="grid lg:grid-cols-2 gap-4"><section className="space-y-2"><h3 className="font-bold text-sm">{t('submitted_info')}</h3><ProfessionalPreview profile={detail.draft} options={options} /></section>{detail.published_profile && <section className="space-y-2"><h3 className="font-bold text-sm">{t('approved_info')}</h3><ProfessionalPreview profile={detail.published_profile} options={options} /></section>}</div>
          <p className="text-xs text-dim">{t('review_warning')}</p>
          {detail.review_note && <p className="whitespace-pre-wrap break-words text-sm text-ink2">{t('review_note')}: {detail.review_note}</p>}
          <fieldset disabled={busy || stale} className="space-y-3 min-w-0">
            <label htmlFor={`${fieldId}-note`} className="block text-sm font-semibold"><span className="block mb-1.5">{t(isAdminManagedProfessional(detail) ? 'managed_reason' : 'reason')}</span><textarea id={`${fieldId}-note`} aria-describedby={`${fieldId}-note-help`} value={note} maxLength={1000} rows={3} className={professionalInput} onChange={event => setNote(event.target.value)} /></label><p id={`${fieldId}-note-help`} className="mt-1 text-xs font-normal text-dim">{t(isAdminManagedProfessional(detail) ? 'managed_reason_help' : 'reason_help')}</p>
            {detail.listing_status === 'suspended' && <p className="text-sm text-amber-900">{t('suspended_approval')}</p>}
            {detail.review_status !== 'pending' && <p className="text-xs text-dim">{t('not_pending')}</p>}
            <div className="flex flex-wrap gap-3">
              <button className={professionalPrimary} disabled={!canApproveProfessional(detail)} onClick={() => requestAction('approve')}>{t('approve')}</button>
              <button className={professionalButton} disabled={detail.review_status !== 'pending'} onClick={() => requestAction('reject')}>{t('reject')}</button>
              {detail.listing_status !== 'suspended' ? <button className={`${professionalButton} !text-red-700`} onClick={() => requestAction('suspend')}>{t('suspend')}</button> : <button className={professionalButton} onClick={() => requestAction('reinstate')}>{t('reinstate')}</button>}
            </div>
          </fieldset>
          {detail.history.length > 0 && <details className="rounded-xl border border-line bg-white p-4"><summary className="font-bold text-sm cursor-pointer">{t('history')}</summary><ol className="space-y-3 mt-4">{detail.history.map(item => <li key={item.version} className="text-xs text-ink2"><p>{t('version', { version: item.version })} · {t(`history_actions.${item.action}`, { defaultValue: item.action })} · {date(item.created_at)}</p>{item.note && <p className="whitespace-pre-wrap break-words mt-1">{item.note}</p>}</li>)}</ol></details>}
        </>}
      </div>}
    </ProfessionalDialog>}
    {managedEditor && <ManagedProfessionalEditor initial={managedEditor.initial} options={options} onClose={() => setManagedEditor(null)} onSaved={next => { setDetail(next); setSelectedId(next.id); setRevision(value => value + 1); setStale(false); setDetailError(''); setMessage('') }} />}
  </div>
}
