import { useEffect, useId, useRef, useState } from 'react'
import { isAxiosError } from 'axios'
import { useTranslation } from 'react-i18next'
import {
  publishAdminFloorPlan, readAdminDraftContent, readAdminFloorPlan, stageAdminFloorPlan, withdrawAdminFloorPlan,
} from '../../api/listingFloorPlans'
import {
  FLOOR_PLAN_TYPES, floorPlanFileType, startFloorPlanDownload, type FloorPlanAsset, type FloorPlanState,
} from '../../../../../packages/listing-floor-plans'

const button = 'inline-flex min-h-11 items-center rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink focus-visible:outline-2 focus-visible:outline-sea disabled:opacity-45'
const panel = 'min-w-0 space-y-3 rounded-xl border border-line bg-white p-3 sm:p-4'

export function ListingFloorPlanEditor({ listingId }: { listingId: string }) {
  const { t } = useTranslation('admin', { keyPrefix: 'floor_plan' })
  const id = useId()
  const [open, setOpen] = useState(false)

  return <section className="mb-4 space-y-3 rounded-2xl border border-line bg-paper p-4" aria-label={t('title')}>
    <button type="button" className={button} aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      {t('manage')}
    </button>
    <div id={id} hidden={!open}>
      {open && <FloorPlanControls listingId={listingId} />}
    </div>
  </section>
}

function FloorPlanControls({ listingId }: { listingId: string }) {
  const { t, i18n } = useTranslation('admin', { keyPrefix: 'floor_plan' })
  const [state, setState] = useState<FloorPlanState | null>(null)
  const [reading, setReading] = useState(true)
  const [reload, setReload] = useState(0)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<'invalid' | 'load_error' | 'changed' | 'write_error' | 'file_error' | 'denied' | null>(null)
  const [notice, setNotice] = useState<'staged' | 'published' | 'withdrawn' | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [permission, setPermission] = useState(false)
  const [confirmWithdrawal, setConfirmWithdrawal] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const request = useRef<AbortController | null>(null)
  const transfer = useRef<(() => void) | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const previewButton = useRef<HTMLButtonElement>(null)
  const previewId = useId()
  const withdrawId = useId()
  const blocked = reading || working || !state
  const draft = state?.draft ?? null
  const published = state?.published ?? null
  const locale = i18n.language.startsWith('es') ? 'es-DO' : 'en-US'
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Santo_Domingo' })
  const number = new Intl.NumberFormat(locale)

  useEffect(() => {
    const controller = new AbortController()
    readAdminFloorPlan(listingId, controller.signal).then(current => {
      if (!controller.signal.aborted) setState(current)
    }).catch(failure => {
      if (controller.signal.aborted) return
      setError(isAxiosError(failure) && [401, 403, 404].includes(failure.response?.status ?? 0) ? 'denied' : 'load_error')
    }).finally(() => { if (!controller.signal.aborted) setReading(false) })
    return () => controller.abort()
  }, [listingId, reload])

  useEffect(() => () => {
    request.current?.abort()
    transfer.current?.()
  }, [])

  function clearPreview() {
    transfer.current?.()
    transfer.current = null
    setPreview(null)
  }

  function retry() {
    setState(null)
    setReading(true)
    setError(null)
    setNotice(null)
    setPermission(false)
    setConfirmWithdrawal(false)
    clearPreview()
    setReload(value => value + 1)
  }

  async function perform<Result>(
    action: (signal: AbortSignal) => Promise<Result>,
    onSuccess: (result: Result) => void,
    fallback: 'write_error' | 'file_error' | 'invalid',
  ) {
    if (blocked || request.current) return
    const controller = new AbortController()
    request.current = controller
    setWorking(true)
    setError(null)
    setNotice(null)
    try {
      const result = await action(controller.signal)
      if (!controller.signal.aborted) onSuccess(result)
    } catch (failure) {
      if (controller.signal.aborted) return
      const status = isAxiosError(failure) ? failure.response?.status : undefined
      if (status === 401 || status === 403) {
        setState(null)
        setPermission(false)
        setConfirmWithdrawal(false)
        clearPreview()
        setFile(null)
        setError('denied')
      } else if (fallback === 'invalid' && (status === 413 || status === 415 || status === 422)) {
        setError('invalid')
      } else if (fallback !== 'file_error' || status === 404 || status === 409) {
        setState(null)
        setPermission(false)
        setConfirmWithdrawal(false)
        clearPreview()
        setError(status === 404 || status === 409 ? 'changed' : 'write_error')
      } else setError(fallback)
    } finally {
      if (!controller.signal.aborted) {
        request.current = null
        setWorking(false)
      }
    }
  }

  function accept(next: FloorPlanState, success: 'staged' | 'published' | 'withdrawn') {
    setState(next)
    setPermission(false)
    setConfirmWithdrawal(false)
    clearPreview()
    setNotice(success)
  }

  function stage() {
    if (!file || !floorPlanFileType(file)) {
      setError('invalid')
      return
    }
    void perform(signal => stageAdminFloorPlan(listingId, file, draft?.id ?? null, signal), next => {
      accept(next, 'staged')
      setFile(null)
      if (fileInput.current) fileInput.current.value = ''
    }, 'invalid')
  }

  function showDraft(asset: FloorPlanAsset) {
    if (preview) {
      clearPreview()
      return
    }
    void perform(signal => readAdminDraftContent(listingId, asset, signal), blob => {
      clearPreview()
      if (asset.content_type === 'application/pdf') {
        transfer.current = startFloorPlanDownload(blob, asset, 'floor-plan-draft')
      } else {
        const url = URL.createObjectURL(blob)
        transfer.current = () => URL.revokeObjectURL(url)
        setPreview(url)
      }
    }, 'file_error')
  }

  const describe = (asset: FloorPlanAsset) => t('file_summary', {
    format: asset.content_type.split('/')[1].toUpperCase(),
    bytes: number.format(asset.byte_count), date: date.format(new Date(asset.created_at)),
  })

  return <div className="min-w-0 space-y-3" aria-busy={reading || working}>
    {reading && <p role="status" className="text-sm text-dim">{t('loading')}</p>}
    {notice && <p role="status" className="text-sm text-ink2">{t(notice)}</p>}
    {error && <p role="alert" className="text-sm text-red-800">{t(error)}</p>}
    {!reading && !state && error !== 'denied' && <button type="button" className={button} onClick={retry}>{t('reload')}</button>}
    {state && <div className="grid min-w-0 gap-3 sm:grid-cols-2">
      <section className={panel} aria-label={t('draft_title')}>
        <h3 className="text-sm font-bold">{t('draft_title')}</h3>
        <p className="text-sm text-ink2">{draft ? describe(draft) : t('no_draft')}</p>
        {draft && <>
          <button ref={previewButton} type="button" className={button} disabled={blocked}
            aria-expanded={draft.content_type !== 'application/pdf' ? Boolean(preview) : undefined}
            aria-controls={draft.content_type !== 'application/pdf' ? previewId : undefined} onClick={() => showDraft(draft)}>
            {t(draft.content_type === 'application/pdf' ? 'download_draft' : 'preview_draft')}
          </button>
          {draft.content_type !== 'application/pdf' && <div id={previewId} hidden={!preview}>
            {preview && <>
              <img className="max-h-80 w-full object-contain" alt={t('draft_image')} src={preview} />
              <button type="button" className={button} onClick={() => { clearPreview(); previewButton.current?.focus() }}>{t('close_preview')}</button>
            </>}
          </div>}
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={permission} disabled={blocked} onChange={event => setPermission(event.target.checked)} />
            <span>{t('permission')}</span>
          </label>
          <button type="button" className={button} disabled={blocked || !permission}
            onClick={() => void perform(signal => publishAdminFloorPlan(listingId, draft.id, published?.id ?? null, signal),
              next => accept(next, 'published'), 'write_error')}>{t('publish')}</button>
        </>}
        <label className="block space-y-1 text-sm font-semibold">
          <span>{t('choose')}</span>
          <input ref={fileInput} type="file" accept={FLOOR_PLAN_TYPES.join(',')} disabled={blocked}
            className="block min-h-11 w-full min-w-0 rounded-lg border border-line p-2 text-sm"
            onChange={event => { setFile(event.target.files?.[0] ?? null); setError(null); setNotice(null) }} />
        </label>
        <p className="text-xs text-dim">{t('formats')}</p>
        <button type="button" className={button} disabled={blocked || !file} onClick={stage}>{t('stage')}</button>
      </section>
      <section className={panel} aria-label={t('public_title')}>
        <h3 className="text-sm font-bold">{t('public_title')}</h3>
        <p className="text-sm text-ink2">{published ? describe(published) : t('no_published')}</p>
        {published && <>
          <button type="button" className={button} disabled={blocked} aria-expanded={confirmWithdrawal}
            aria-controls={withdrawId} onClick={() => setConfirmWithdrawal(true)}>{t('withdraw')}</button>
          <div id={withdrawId} hidden={!confirmWithdrawal}>
            {confirmWithdrawal && <div className="space-y-2">
              <p className="text-sm text-ink2">{t('withdraw_question')}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={button} disabled={blocked} onClick={() => setConfirmWithdrawal(false)}>{t('cancel')}</button>
                <button type="button" className={button} disabled={blocked}
                  onClick={() => void perform(signal => withdrawAdminFloorPlan(listingId, published.id, signal),
                    next => accept(next, 'withdrawn'), 'write_error')}>{t('confirm_withdraw')}</button>
              </div>
            </div>}
          </div>
        </>}
      </section>
    </div>}
  </div>
}
