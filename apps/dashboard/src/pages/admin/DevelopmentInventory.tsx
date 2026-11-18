import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { isAxiosError } from 'axios'
import { useTranslation } from 'react-i18next'
import {
  changeDevelopmentStatus, getDevelopment, getDevelopmentRevision, saveDevelopmentDraft,
  type AdminDevelopment, type DevelopmentAction, type DevelopmentDraft,
  type DevelopmentRevision,
} from '../../api/developments'
import { DevelopmentInventoryFields } from '../../components/admin/DevelopmentInventoryFields'
import { allowNetworkNavigation, NetworkDate, useNetworkDraftGuard } from '../../components/network/NetworkShared'
import { ProfessionalDialog } from '../../components/shared/ProfessionalDialog'
import { ProfessionalConfirmation } from '../../components/shared/ProfessionalConfirmation'
import { landingBaseUrl } from '../../lib/siteUrls'
import { editorButton } from './WebsiteEditorFields'

const primary = 'rounded-xl bg-coral px-4 py-2.5 text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-coral disabled:opacity-50'
const alertStyle = 'rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800'
const keepPreviewReadOnly = () => {}

type PageProps = { listingId: string; listingTitle: string; onBack: () => void }
type Problem = 'access' | 'missing' | 'conflict' | 'validation' | 'too_large' | 'uncertain'
type Read = { kind: 'ready'; data: AdminDevelopment } | { kind: 'error'; problem: Problem } | { kind: 'loading' }
type Intent = DevelopmentAction & { expectedVersion: number }

const errorKind = (error: unknown): Problem => {
  const status = isAxiosError(error) ? error.response?.status : undefined
  switch (status) {
    case 401: case 403: return 'access'
    case 404: return 'missing'
    case 409: return 'conflict'
    case 413: return 'too_large'
    case 400: case 422: return 'validation'
    default: return 'uncertain'
  }
}

function blankDraft(): DevelopmentDraft {
  return {
    project: {
      name_en: '', name_es: '', summary_en: '', summary_es: '', target_delivery: null,
      phases: [], payment_stages: [], updates: [],
    },
    evidence: { source_reference: '', verified_on: null, availability_valid_through: null, private_note: '' },
  }
}

export default function DevelopmentInventory({ listingId, listingTitle, onBack }: PageProps) {
  const { t } = useTranslation('development_inventory')
  const [attempt, setAttempt] = useState(0)
  const [read, setRead] = useState<Read>({ kind: 'loading' })
  const title = useRef<HTMLHeadingElement>(null)
  const onDenied = useCallback(() => setRead({ kind: 'error', problem: 'access' }), [])
  const reload = () => {
    if (!allowNetworkNavigation()) return
    setRead({ kind: 'loading' })
    setAttempt(value => value + 1)
  }

  useEffect(() => {
    title.current?.focus()
  }, [listingId])

  useEffect(() => {
    const controller = new AbortController()
    getDevelopment(listingId, controller.signal).then(data => {
      if (!controller.signal.aborted) setRead({ kind: 'ready', data })
    }).catch(error => {
      if (!controller.signal.aborted) setRead({ kind: 'error', problem: errorKind(error) })
    })
    return () => controller.abort()
  }, [listingId, attempt])

  return <div className="w-full min-w-0 max-w-5xl space-y-4 pb-12">
    <button type="button" className={editorButton} onClick={() => { if (allowNetworkNavigation()) onBack() }}>{t('back')}</button>
    <header className="space-y-1">
      <h1 ref={title} tabIndex={-1} className="text-xl font-bold text-ink sm:text-2xl">{t('title')}</h1>
      <p className="break-words text-sm text-ink2">{listingTitle}</p>
    </header>
    {read.kind === 'loading' && <p role="status" className="text-sm text-ink2">{t('loading')}</p>}
    {read.kind === 'error' && <div className="space-y-2">
      <p role="alert" className={alertStyle}>{t(`errors.${read.problem}`)}</p>
      <button type="button" className={editorButton} onClick={reload}>{t('reload')}</button>
    </div>}
    {read.kind === 'ready' && <DevelopmentForm initial={read.data} onReload={reload} onDenied={onDenied} />}
  </div>
}

function DevelopmentForm({ initial, onReload, onDenied }: {
  initial: AdminDevelopment; onReload: () => void; onDenied: () => void
}) {
  const { t } = useTranslation('development_inventory')
  const [saved, setSaved] = useState(initial)
  const [baseline, setBaseline] = useState(() => initial.draft ?? blankDraft())
  const [draft, setDraft] = useState(baseline)
  const [problem, setProblem] = useState<Problem | null>(null)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<number | null>(null)
  const [intent, setIntent] = useState<Intent | null>(null)
  const pending = useRef<AbortController | null>(null)
  const dirty = draft !== baseline
  const stale = problem === 'conflict' || problem === 'missing' || problem === 'uncertain'
  const revision = saved.draft_revision
  const canReview = revision !== null && saved.reviewed_revision !== revision
  const canPublish = revision !== null && saved.reviewed_revision === revision && saved.published_revision !== revision
  const canWithdraw = saved.published_revision !== null
  useNetworkDraftGuard(dirty, busy)
  useEffect(() => () => pending.current?.abort(), [])

  async function write(operation: 'save' | DevelopmentAction['action'], request: (signal: AbortSignal) => Promise<AdminDevelopment>) {
    if (pending.current || stale) return
    const controller = new AbortController()
    pending.current = controller
    setBusy(true)
    setProblem(null)
    setNotice('')
    try {
      const result = await request(controller.signal)
      if (controller.signal.aborted) return
      setSaved(result)
      if (operation === 'save' && result.draft) {
        setBaseline(result.draft)
        setDraft(result.draft)
      }
      setNotice(operation)
    } catch (error) {
      if (controller.signal.aborted) return
      const kind = errorKind(error)
      if (kind === 'access') onDenied()
      else setProblem(kind)
    } finally {
      if (pending.current === controller) pending.current = null
      if (!controller.signal.aborted) { setBusy(false); setIntent(null) }
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!dirty) return
    void write('save', signal => saveDevelopmentDraft(saved.listing_id, saved.version, draft, signal))
  }

  function confirm() {
    if (!intent) return
    void write(intent.action, signal => changeDevelopmentStatus(saved.listing_id, intent.expectedVersion, intent, signal))
  }

  const publicListing = new URL(`/listing/${encodeURIComponent(saved.listing_id)}/`, landingBaseUrl(import.meta.env.VITE_LANDING_URL)).toString()

  return <>
    <div className="rounded-xl border border-line bg-paper px-4 py-3 text-sm text-ink2">
      <p>{revision === null ? t('no_draft') : t('draft_number', { revision })}</p>
      {saved.reviewed_revision !== null && <p>{t('reviewed_number', { revision: saved.reviewed_revision })}</p>}
      <p>{saved.published_revision === null ? t('unpublished') : t('published_number', { revision: saved.published_revision })}</p>
      {saved.published && <div className="mt-2 space-y-1">
        <p>{t('published_cutoff')}{' '}<NetworkDate value={saved.published.availability_valid_through} /></p>
        {!saved.published.availability_current && <p>{t('availability_expired')}</p>}
        <a className="font-semibold text-coral underline" href={publicListing} target="_blank" rel="noopener noreferrer">{t('public_listing')}</a>
      </div>}
    </div>
    <form onSubmit={save} className="min-w-0 space-y-4">
      <DevelopmentInventoryFields draft={draft} onChange={setDraft} disabled={busy || stale} />
      {problem && <div className="space-y-2">
        <p role="alert" className={alertStyle}>{t(`errors.${problem}`)}</p>
        {stale && <button type="button" className={editorButton} onClick={onReload}>{t('reload')}</button>}
      </div>}
      {notice && <p role="status" className="text-sm font-semibold text-ink2">{t(`success.${notice}`)}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={primary} disabled={busy || stale || !dirty}>{t('save')}</button>
        {revision !== null && <button type="button" className={editorButton} disabled={busy || stale}
          onClick={() => setPreview(revision)}>{t('preview')}</button>}
        {revision !== null && canReview && <button type="button" className={editorButton} disabled={busy || stale || dirty}
          onClick={() => setIntent({ action: 'review', revision, expectedVersion: saved.version })}>{t('actions.review.label')}</button>}
        {revision !== null && canPublish && <button type="button" className={editorButton} disabled={busy || stale || dirty}
          onClick={() => setIntent({ action: 'publish', revision, expectedVersion: saved.version })}>{t('actions.publish.label')}</button>}
        {canWithdraw && <button type="button" className={editorButton} disabled={busy || stale}
          onClick={() => setIntent({ action: 'withdraw', expectedVersion: saved.version })}>{t('actions.withdraw.label')}</button>}
      </div>
      {dirty && revision !== null && !stale && <p className="text-sm text-ink2">{t('unsaved')}</p>}
    </form>
    {preview !== null && <DevelopmentPreview
      listingId={saved.listing_id} revision={preview} onClose={() => setPreview(null)} onDenied={onDenied}
    />}
    {intent && <ProfessionalDialog title={t(`actions.${intent.action}.label`)} closeLabel={t('close')}
      onClose={() => { if (!busy) setIntent(null) }}>
      <ProfessionalConfirmation
        message={t(`actions.${intent.action}.description`, 'revision' in intent ? { revision: intent.revision } : {})}
        confirmLabel={t(`actions.${intent.action}.confirm`)} cancelLabel={t('cancel')}
        busy={busy} onConfirm={confirm} onCancel={() => setIntent(null)}
      />
    </ProfessionalDialog>}
  </>
}

function DevelopmentPreview({ listingId, revision, onClose, onDenied }: {
  listingId: string; revision: number; onClose: () => void; onDenied: () => void
}) {
  const { t } = useTranslation('development_inventory')
  const [draft, setDraft] = useState<DevelopmentRevision | null>(null)
  const [problem, setProblem] = useState<Problem | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    getDevelopmentRevision(listingId, revision, controller.signal).then(data => {
      if (!controller.signal.aborted) setDraft(data)
    }).catch(error => {
      if (controller.signal.aborted) return
      const kind = errorKind(error)
      if (kind === 'access') onDenied()
      else setProblem(kind)
    })
    return () => controller.abort()
  }, [listingId, revision, onDenied])
  return <ProfessionalDialog title={t('preview_title', { revision })} closeLabel={t('close')} onClose={onClose}>
    {problem && <p role="alert" className={alertStyle}>{t(`errors.${problem}`)}</p>}
    {!problem && !draft && <p role="status" className="text-sm text-ink2">{t('loading')}</p>}
    {draft && <div className="space-y-3">
      <p className="text-sm text-ink2">{t('saved_on')}{' '}<NetworkDate value={draft.saved_at} showTime /></p>
      <DevelopmentInventoryFields draft={draft} onChange={keepPreviewReadOnly} disabled />
    </div>}
  </ProfessionalDialog>
}
