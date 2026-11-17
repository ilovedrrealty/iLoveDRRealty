import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { isAxiosError } from 'axios'
import { useTranslation } from 'react-i18next'
import {
  EDITORIAL_KINDS, EDITORIAL_LANGUAGES, EDITORIAL_PAGE_SIZE, EDITORIAL_SLUG_LIMIT,
  blankEditorialDraft, changeEditorialStatus, createEditorial,
  draftFromEditorial, editorialActions, getEditorial, listEditorial, listEditorialRevisions,
  normalizeEditorialSources, previewEditorialRevision, publicEditorialLink, saveEditorialDraft,
  type EditorialAction, type EditorialDetail, type EditorialDraft, type EditorialKind, type EditorialLanguage,
} from '../../api/editorial'
import { allowNetworkNavigation, useNetworkDraftGuard } from '../../components/network/NetworkShared'
import { ProfessionalConfirmation } from '../../components/shared/ProfessionalConfirmation'
import { ProfessionalDialog } from '../../components/shared/ProfessionalDialog'
import { EditorialFields, EditorialPreviewContent, editorialPrimary } from './EditorialFields'
import { editorButton, editorInput } from './WebsiteEditorFields'

type Screen = { kind: 'list' | 'new' } | { kind: 'saved'; id: string; initial?: EditorialDetail }
type Problem = 'conflict' | 'missing' | 'slug_taken' | 'sources' | 'uncertain' | 'validation'
type EditorialRead<T> = { state: 'loading' } | { state: 'error' } | { state: 'ready'; data: T }

const status = (error: unknown) => isAxiosError(error) ? error.response?.status : undefined
const accessDenied = (error: unknown) => [401, 403].includes(status(error) ?? 0)
const alertStyle = 'rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800'
const landing = import.meta.env.VITE_LANDING_URL

function useEditorialRead<T>(load: (signal: AbortSignal) => Promise<T>, onDenied: () => void, initial?: T) {
  const [read, setRead] = useState<EditorialRead<T>>(initial === undefined ? { state: 'loading' } : { state: 'ready', data: initial })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!attempt && initial !== undefined) return
    const controller = new AbortController()
    void load(controller.signal).then(data => {
      if (!controller.signal.aborted) setRead({ state: 'ready', data })
    }).catch(error => {
      if (controller.signal.aborted) return
      if (accessDenied(error)) onDenied()
      else setRead({ state: 'error' })
    })
    return () => controller.abort()
  }, [attempt, initial, load, onDenied])
  return {
    read,
    retry() {
      setRead({ state: 'loading' })
      setAttempt(value => value + 1)
    },
  }
}

function EditorialPagination({ page, onChange, count }: { page: number; onChange: (page: number) => void; count: number }) {
  const { t } = useTranslation('editorial')
  if (page === 1 && count < EDITORIAL_PAGE_SIZE) return null
  return <div className="flex flex-wrap items-center gap-2 text-sm text-dim">
    <button type="button" className={editorButton} disabled={page === 1} onClick={() => onChange(page - 1)}>{t('previous')}</button>
    <span>{t('page', { page })}</span>
    <button type="button" className={editorButton} disabled={count < EDITORIAL_PAGE_SIZE || page >= 1000}
      onClick={() => onChange(page + 1)}>{t('next')}</button>
  </div>
}

export function Editorial() {
  const { t } = useTranslation('editorial')
  const [screen, setScreen] = useState<Screen>({ kind: 'list' })
  const [denied, setDenied] = useState(false)
  const onDenied = useCallback(() => {
    setDenied(true)
    setScreen({ kind: 'list' })
  }, [])
  const back = () => {
    if (allowNetworkNavigation()) setScreen({ kind: 'list' })
  }

  if (denied) return <div className="space-y-3">
    <p role="alert" className={alertStyle}>{t('errors.access')}</p>
    <button type="button" className={editorButton} onClick={() => setDenied(false)}>{t('retry')}</button>
  </div>
  return <div className="min-w-0 max-w-5xl space-y-4 pb-12">
    {screen.kind === 'list'
      ? <><p className="text-sm text-ink2">{t('intro')}</p><EditorialIndex onDenied={onDenied}
          onNew={() => setScreen({ kind: 'new' })}
          onOpen={id => setScreen({ kind: 'saved', id })} /></>
      : <button type="button" className={editorButton} onClick={back}>{t('back')}</button>}
    {screen.kind === 'new' && <EditorialForm key="new" onDenied={onDenied}
      onCreated={detail => setScreen({ kind: 'saved', id: detail.id, initial: detail })} />}
    {screen.kind === 'saved' && <SavedEditorial key={screen.id} id={screen.id} initial={screen.initial} onDenied={onDenied} />}
  </div>
}

type IndexProps = { onNew: () => void; onOpen: (id: string) => void; onDenied: () => void }
function EditorialIndex(props: IndexProps) {
  const [page, setPage] = useState(1)
  return <EditorialIndexPage key={page} page={page} onPageChange={setPage} {...props} />
}

function EditorialIndexPage({ onNew, onOpen, onDenied, page, onPageChange }: IndexProps & { page: number; onPageChange: (page: number) => void }) {
  const { t } = useTranslation('editorial')
  const load = useCallback((signal: AbortSignal) => listEditorial(page, signal), [page])
  const { read, retry } = useEditorialRead(load, onDenied)
  return <section aria-label={t('list')} className="min-w-0 space-y-4">
    {read.state === 'ready' ? <>
      <button type="button" className={editorialPrimary} onClick={onNew}>{t('new')}</button>
      {read.data.length ? <ul className="space-y-2">
        {read.data.map(entry => <li key={entry.id} className="min-w-0 rounded-xl border border-line bg-white p-3">
          <button type="button" onClick={() => onOpen(entry.id)} className="max-w-full break-words text-left text-base font-bold text-ink hover:underline">
            {entry.title || t('untitled')}
          </button>
          <div className="break-all text-xs text-dim">{entry.slug}</div>
          <p className="mt-1 text-sm text-ink2">
            {t(`kinds.${entry.kind}`)} · {entry.published_revision === null ? t('unpublished') : t('published', { revision: entry.published_revision })}
          </p>
        </li>)}
      </ul> : <p className="text-sm text-dim">{t('empty')}</p>}
      <EditorialPagination page={page} count={read.data.length} onChange={onPageChange} />
    </> : <EditorialReadState failed={read.state === 'error'} retry={retry} />}
  </section>
}

function EditorialReadState({ failed, retry }: { failed: boolean; retry: () => void }) {
  const { t } = useTranslation('editorial')
  return failed ? <div className={alertStyle}>
    <p role="alert">{t('errors.read')}</p>
    <button type="button" className={`${editorButton} mt-2`} onClick={retry}>{t('retry')}</button>
  </div> : <p role="status" className="text-sm text-dim">{t('loading')}</p>
}

function SavedEditorial({ id, initial, onDenied }: { id: string; initial?: EditorialDetail; onDenied: () => void }) {
  const load = useCallback((signal: AbortSignal) => getEditorial(id, signal), [id])
  const { read, retry } = useEditorialRead(load, onDenied, initial)
  return read.state === 'ready'
    ? <EditorialForm initial={read.data} created={read.data === initial} onDenied={onDenied} onReload={retry} />
    : <EditorialReadState failed={read.state === 'error'} retry={retry} />
}

function EditorialForm({ initial, created, onCreated, onReload, onDenied }: {
  initial?: EditorialDetail
  created?: boolean
  onCreated?: (detail: EditorialDetail) => void
  onReload?: () => void
  onDenied: () => void
}) {
  const { t, i18n } = useTranslation('editorial')
  const [saved, setSaved] = useState(initial)
  const [draft, setDraft] = useState(() => initial ? draftFromEditorial(initial) : blankEditorialDraft())
  const [baseline, setBaseline] = useState(draft)
  const [slug, setSlug] = useState(initial?.slug ?? '')
  const [kind, setKind] = useState<EditorialKind>(initial?.kind ?? 'article')
  const [history, setHistory] = useState(false)
  const [preview, setPreview] = useState<number | null>(null)
  const [intent, setIntent] = useState<EditorialAction | null>(null)
  const [problem, setProblem] = useState<Problem | null>(null)
  const [notice, setNotice] = useState(created ? 'saved' : '')
  const [busy, setBusy] = useState(false)
  const activeWrite = useRef<AbortController | null>(null)
  useEffect(() => () => activeWrite.current?.abort(), [])
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline) || (!saved && (slug !== '' || kind !== 'article'))
  const stale = problem === 'conflict' || problem === 'uncertain' || problem === 'missing'
  const actions = saved ? editorialActions(saved) : null
  useNetworkDraftGuard(dirty, busy)

  async function write(pending: (signal: AbortSignal) => Promise<EditorialDetail>, success: string) {
    if (activeWrite.current || stale) return
    const controller = new AbortController()
    activeWrite.current = controller
    setBusy(true)
    setNotice('')
    setProblem(null)
    try {
      const detail = await pending(controller.signal)
      if (controller.signal.aborted) return
      if (!saved) onCreated?.(detail)
      else {
        const fields = draftFromEditorial(detail)
        setSaved(detail)
        setBaseline(fields)
        setDraft(fields)
        setNotice(success)
      }
    } catch (error) {
      if (controller.signal.aborted) return
      if (accessDenied(error)) onDenied()
      else {
        const code = status(error)
        setProblem(code === 409 ? (saved ? 'conflict' : 'slug_taken')
          : code === 422 || code === 400 ? 'validation' : code === 404 ? 'missing' : 'uncertain')
      }
    } finally {
      if (activeWrite.current === controller) activeWrite.current = null
      if (!controller.signal.aborted) {
        setBusy(false)
        setIntent(null)
      }
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || stale || (saved && !dirty)) return
    const sources = normalizeEditorialSources(draft.sources)
    if (!sources) {
      setProblem('sources')
      return
    }
    const payload = { ...draft, sources }
    return saved
      ? void write(signal => saveEditorialDraft(saved.id, saved.version, payload, signal), 'saved')
      : void write(signal => createEditorial(slug.trim(), kind, payload, signal), 'saved')
  }

  function confirm() {
    if (!saved || !intent || dirty || busy || stale) return
    void write(signal => changeEditorialStatus(saved.id, saved.version, intent, signal), `actions.${intent.action}.done`)
  }

  return <>
    {problem && <div className={alertStyle}>
      <p role="alert">{t(`errors.${problem}`)}</p>
      {stale && onReload && <button type="button" className={`${editorButton} mt-2`} onClick={() => {
        if (allowNetworkNavigation()) onReload()
      }}>{t('reload')}</button>}
    </div>}
    {notice && <p role="status" className="text-sm font-semibold text-sea">{t(notice)}</p>}
    <form className="min-w-0 space-y-4" onSubmit={submit}>
      <fieldset disabled={busy || stale} className="min-w-0 space-y-4">
        {saved ? <div className="min-w-0 rounded-xl border border-line bg-white p-4">
          <h2 className="break-words text-base font-bold text-ink">{t(`kinds.${saved.kind}`)} · <span className="break-all">{saved.slug}</span></h2>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink2">
            <li>{t('current', { revision: saved.draft_revision })}</li>
            {saved.reviewed_revision !== null && <li>{t('reviewed', { revision: saved.reviewed_revision })}</li>}
            <li>{saved.published_revision === null ? t('unpublished') : t('published', { revision: saved.published_revision })}</li>
          </ul>
          {saved.published_revision !== null && !stale && <div className="mt-3 flex flex-wrap gap-2">
            {EDITORIAL_LANGUAGES.map(language => <a key={language} href={publicEditorialLink(saved.slug, language, landing)}
              className={editorButton} target="_blank" rel="noopener noreferrer">{t(`public_link.${language}`)}</a>)}
          </div>}
        </div> : <div className="grid min-w-0 gap-3 rounded-xl border border-line bg-white p-4 sm:grid-cols-2">
          <div className="min-w-0 text-sm font-medium text-ink2">
            <label className="mb-1.5 block" htmlFor="editorial-slug">{t('slug')}</label>
            <input id="editorial-slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={EDITORIAL_SLUG_LIMIT} className={editorInput} value={slug}
              onChange={event => setSlug(event.target.value)} aria-describedby="editorial-slug-hint" />
            <p id="editorial-slug-hint" className="mt-1 text-xs text-dim">{t('slug_hint')}</p>
          </div>
          <label className="min-w-0 text-sm font-medium text-ink2">
            <span className="mb-1.5 block">{t('kind')}</span>
            <select className={editorInput} value={kind} onChange={event => setKind(event.target.value as EditorialKind)}>
              {EDITORIAL_KINDS.map(option => <option key={option} value={option}>{t(`kinds.${option}`)}</option>)}
            </select>
          </label>
        </div>}
        <EditorialFields draft={draft} change={setDraft} />
        <div className="flex flex-wrap gap-2">
          <button className={editorialPrimary} type="submit" disabled={!dirty}>{t(busy ? 'saving' : 'save')}</button>
          {saved && <button className={editorButton} type="button" disabled={dirty}
            onClick={() => setPreview(saved.draft_revision)}>{t('preview')}</button>}
        </div>
      </fieldset>
    </form>
    {saved && actions && <div className="space-y-3">
      {!actions.review && saved.reviewed_revision !== saved.draft_revision && <p className="text-sm text-dim">{t('publish_requirement')}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={editorButton} disabled={dirty || busy || stale || !actions.review}
          onClick={() => setIntent({ action: 'review', revision: saved.draft_revision })}>{t('actions.review.title')}</button>
        <button type="button" className={editorialPrimary} disabled={dirty || busy || stale || !actions.publish}
          onClick={() => setIntent({ action: 'publish', revision: saved.draft_revision })}>{t('actions.publish.title')}</button>
        {actions.unpublish && <button type="button" className={editorButton} disabled={dirty || busy || stale}
          onClick={() => setIntent({ action: 'unpublish' })}>{t('actions.unpublish.title')}</button>}
        <button type="button" className={editorButton} aria-expanded={history} onClick={() => setHistory(value => !value)}>
          {t(history ? 'history_close' : 'history')}
        </button>
      </div>
      {history && <EditorialHistory key={saved.version} document={saved} allowRestore={!dirty && !busy && !stale}
        onPreview={setPreview} onRestore={revision => setIntent({ action: 'restore', revision })} onDenied={onDenied} />}
    </div>}
    {saved && preview !== null && <SavedPreview key={preview} id={saved.id} revision={preview} onDenied={onDenied}
      language={i18n.language.startsWith('es') ? 'es' : 'en'} onClose={() => setPreview(null)} />}
    {intent && <ProfessionalDialog title={t(`actions.${intent.action}.title`)} closeLabel={t('confirmation_close')}
      onClose={() => { if (!activeWrite.current) setIntent(null) }}>
      <ProfessionalConfirmation message={t(`actions.${intent.action}.details`, { revision: 'revision' in intent ? intent.revision : undefined })}
        confirmLabel={t(`actions.${intent.action}.confirm`)} cancelLabel={t('cancel')} busy={busy}
        onConfirm={confirm} onCancel={() => setIntent(null)} />
    </ProfessionalDialog>}
  </>
}

type HistoryProps = {
  document: EditorialDetail; allowRestore: boolean; onDenied: () => void
  onPreview: (revision: number) => void; onRestore: (revision: number) => void
}
function EditorialHistory(props: HistoryProps) {
  const [page, setPage] = useState(1)
  return <EditorialHistoryPage key={page} page={page} onPageChange={setPage} {...props} />
}

function EditorialHistoryPage({ document, allowRestore, onDenied, onPreview, onRestore, page, onPageChange }:
  HistoryProps & { page: number; onPageChange: (page: number) => void }) {
  const { t, i18n } = useTranslation('editorial')
  const load = useCallback((signal: AbortSignal) => listEditorialRevisions(document.id, page, signal), [document.id, page])
  const { read, retry } = useEditorialRead(load, onDenied)
  const dates = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })
  return <section aria-label={t('history')} className="space-y-2 rounded-xl border border-line bg-white p-4">
    {read.state === 'ready' ? <><ul className="space-y-3">
      {read.data.map(row => {
        const date = new Date(row.saved_at)
        return <li key={row.revision} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-2 last:border-0">
          <p className="min-w-0 text-sm font-semibold text-ink2">
            {t('revision', { revision: row.revision })}
            {!Number.isNaN(date.valueOf()) && <time className="ml-2 text-xs text-dim" dateTime={row.saved_at}>{dates.format(date)}</time>}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={editorButton} onClick={() => onPreview(row.revision)}>{t('preview_revision', { revision: row.revision })}</button>
            <button type="button" className={editorButton} disabled={!allowRestore || row.revision === document.draft_revision}
              onClick={() => onRestore(row.revision)}>{t('restore_revision', { revision: row.revision })}</button>
          </div>
        </li>
      })}
    </ul><EditorialPagination page={page} count={read.data.length} onChange={onPageChange} />
    </> : <EditorialReadState failed={read.state === 'error'} retry={retry} />}
  </section>
}

function SavedPreview({ id, revision, language, onDenied, onClose }: {
  id: string; revision: number; language: EditorialLanguage; onDenied: () => void; onClose: () => void
}) {
  const { t } = useTranslation('editorial')
  const load = useCallback((signal: AbortSignal) => previewEditorialRevision(id, revision, signal), [id, revision])
  const { read, retry } = useEditorialRead(load, onDenied)
  return <ProfessionalDialog title={t('preview_heading')} closeLabel={t('preview_close')} onClose={onClose}>
    {read.state === 'ready' ? <EditorialPreviewContent initialLanguage={language} entry={read.data} />
      : <EditorialReadState failed={read.state === 'error'} retry={retry} />}
  </ProfessionalDialog>
}
