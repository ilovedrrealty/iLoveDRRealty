import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  httpsTradeContactLink, importTradeContacts, listTradeContacts, optionalTradeContactFields,
  readTradeContact, readTradeContactFile, requiredTradeContactFields, TRADE_CONTACT_BATCH_LIMIT, TRADE_CONTACT_FILE_LIMIT,
  TRADE_CONTACT_PAGE_SIZE, tradeVerificationStatuses, type TradeContact, type TradeContactEntry,
  type TradeContactFilters, type TradeContactImport, type TradeContactPage,
} from '../../api/tradeContacts'
import { ProfessionalDialog } from '../../components/shared/ProfessionalDialog'
import { professionalButton, professionalInput, professionalPrimary } from '../../components/shared/ProfessionalFields'

const emptyFilters: TradeContactFilters = { q: '', category: '', province: '' }
const emptyPage: TradeContactPage = { items: [], total: 0 }
const panel = 'min-w-0 rounded-2xl border border-line bg-white p-4 sm:p-5'
const entryFields = [...optionalTradeContactFields, 'source_authority', 'source_url', 'verified_on'] as const
const inputTypes: Record<string, string> = { email: 'email', source_url: 'url', verified_on: 'date', phone: 'tel' }
const example = [{
  name: 'Example business', category: 'Plomería', province: 'Puerto Plata',
  source_authority: 'Example business website', source_url: 'https://example.org/contact',
  verified_on: '2026-11-17', verification_status: 'public_source',
}]

type ImportMessage = {
  code: 'file_size' | 'invalid_file' | 'invalid_row' | 'too_many_rows' | 'preview_failed' | 'save_failed'
  row?: number
}
type ReviewedBatch = { entries: TradeContactEntry[]; result: TradeContactImport }

function ContactRecord({ entry }: { entry: TradeContact }) {
  const { t } = useTranslation('admin', { keyPrefix: 'trade_contacts_page' })
  const location = [entry.locality, entry.province].filter(Boolean).join(', ')
  return <article className="min-w-0 rounded-xl border border-line bg-white p-4 sm:p-5">
    <h2 className="text-base font-bold text-ink [overflow-wrap:anywhere]">{entry.name}</h2>
    <p className="mt-1 text-sm text-ink2 [overflow-wrap:anywhere]">
      {[entry.category, entry.subtype, location].filter(Boolean).join(' · ')}
    </p>
    <details className="mt-3 border-t border-line pt-3">
      <summary className="min-h-9 cursor-pointer text-sm font-semibold text-ink focus-visible:outline-2 focus-visible:outline-coral">
        {t('details')}
      </summary>
      <dl className="grid gap-x-5 gap-y-3 pt-1 text-sm sm:grid-cols-2">
        {entryFields.map(field => {
          const value = entry[field]
          if (!value) return null
          const link = field === 'source_url' || field === 'website' ? httpsTradeContactLink(value) : undefined
          return <div key={field} className="min-w-0 [overflow-wrap:anywhere]">
            <dt className="font-semibold text-ink">{t(`fields.${field}`)}</dt>
            <dd className="m-0 text-ink2">
              {link ? <a href={link} target="_blank" rel="noopener noreferrer" className="underline">{value}</a> : value}
            </dd>
          </div>
        })}
        <div>
          <dt className="font-semibold text-ink">{t('fields.verification_status')}</dt>
          <dd className="m-0 text-ink2">{t(`statuses.${entry.verification_status}`)}</dd>
        </div>
        {entry.source_count != null && <div>
          <dt className="font-semibold text-ink">{t('source_count')}</dt><dd className="m-0 text-ink2">{entry.source_count}</dd>
        </div>}
      </dl>
      {entry.source_details && Object.keys(entry.source_details).length > 0 && <div className="mt-4 border-t border-line pt-3">
        <h3 className="text-sm font-semibold text-ink">{t('source_details')}</h3>
        <dl className="mt-2 grid gap-x-5 gap-y-3 text-sm sm:grid-cols-2">
          {Object.entries(entry.source_details).map(([key, value]) => <div key={key} className="min-w-0 [overflow-wrap:anywhere]">
            <dt className="font-semibold text-ink">{key}</dt><dd className="m-0 text-ink2">{value}</dd>
          </div>)}
        </dl>
      </div>}
    </details>
  </article>
}

function ContactEntryForm({ disabled, onPreview }: { disabled: boolean; onPreview: (entry: TradeContactEntry) => void }) {
  const { t } = useTranslation('admin', { keyPrefix: 'trade_contacts_page' })
  const [invalid, setInvalid] = useState(false)
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const entry = readTradeContact(Object.fromEntries(new FormData(event.currentTarget)))
    setInvalid(!entry)
    if (entry) onPreview(entry)
  }
  return <form className="space-y-4" onSubmit={submit} onChange={() => setInvalid(false)}>
    <fieldset disabled={disabled} className="grid min-w-0 gap-4 sm:grid-cols-2">
      {[...requiredTradeContactFields, ...optionalTradeContactFields].map(field => <label key={field} className="min-w-0 text-sm font-semibold text-ink">
        <span className="mb-1.5 block">{t(`fields.${field}`)}</span>
        <input name={field} className={professionalInput} type={inputTypes[field] ?? 'text'}
          required={requiredTradeContactFields.some(required => required === field)} />
      </label>)}
      <label className="min-w-0 text-sm font-semibold text-ink">
        <span className="mb-1.5 block">{t('fields.verification_status')}</span>
        <select name="verification_status" className={professionalInput} defaultValue="public_source" required>
          {tradeVerificationStatuses.map(status => <option key={status} value={status}>{t(`statuses.${status}`)}</option>)}
        </select>
      </label>
    </fieldset>
    {invalid && <p role="alert" className="text-sm text-red-800">{t('manual_invalid')}</p>}
    <button type="submit" className={professionalButton} disabled={disabled}>{t('preview')}</button>
  </form>
}

export function AdminTradeContacts() {
  const { t } = useTranslation('admin', { keyPrefix: 'trade_contacts_page' })
  const [inputs, setInputs] = useState(emptyFilters)
  const [filters, setFilters] = useState(emptyFilters)
  const [offset, setOffset] = useState(0)
  const [page, setPage] = useState(emptyPage)
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState(false)
  const [revision, setRevision] = useState(0)
  const [editor, setEditor] = useState<'manual' | 'file' | null>(null)
  const [selection, setSelection] = useState<{ filename: string; entries: TradeContactEntry[] } | null>(null)
  const [review, setReview] = useState<ReviewedBatch | null>(null)
  const [receipt, setReceipt] = useState<TradeContactImport | null>(null)
  const [importError, setImportError] = useState<ImportMessage | null>(null)
  const [busy, setBusy] = useState<'read' | 'preview' | 'save' | null>(null)
  const reviewHeading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setListError(false)
    listTradeContacts(filters, offset, controller.signal)
      .then(next => { if (!controller.signal.aborted) setPage(next) })
      .catch(() => { if (!controller.signal.aborted) setListError(true) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [filters, offset, revision])
  useEffect(() => {
    if (review) reviewHeading.current?.focus()
  }, [review])

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setOffset(0)
    setFilters({ q: inputs.q.trim(), category: inputs.category.trim(), province: inputs.province.trim() })
  }

  function resetEditor(next: typeof editor) {
    if (busy) return
    setEditor(next)
    setImportError(null)
    setSelection(null)
    setReview(null)
    if (next) setReceipt(null)
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file || busy) return
    setSelection(null)
    setReview(null)
    setImportError(null)
    if (file.size > TRADE_CONTACT_FILE_LIMIT) {
      setImportError({ code: 'file_size' })
      return
    }
    setBusy('read')
    try {
      const parsed = readTradeContactFile(await file.text())
      if ('error' in parsed) setImportError({ code: parsed.error, row: parsed.row })
      else setSelection({ filename: file.name, entries: parsed.entries })
    } catch {
      setImportError({ code: 'invalid_file' })
    } finally {
      setBusy(null)
    }
  }

  async function preview(entries: TradeContactEntry[]) {
    if (busy) return
    setBusy('preview')
    setImportError(null)
    setReview(null)
    try {
      const result = await importTradeContacts(entries, true)
      setReview({ entries, result })
    } catch {
      setImportError({ code: 'preview_failed' })
    } finally {
      setBusy(null)
    }
  }

  async function save() {
    if (!review || busy) return
    setBusy('save')
    setImportError(null)
    try {
      const result = await importTradeContacts(review.entries, false)
      setReceipt(result)
      setReview(null)
      setSelection(null)
      setEditor(null)
      setOffset(0)
      setRevision(value => value + 1)
    } catch {
      setImportError({ code: 'save_failed' })
    } finally {
      setBusy(null)
    }
  }

  return <div className="min-w-0 space-y-5">
    <div className="flex flex-wrap gap-2">
      <button type="button" className={professionalPrimary} onClick={() => resetEditor('manual')}>{t('add')}</button>
      <button type="button" className={professionalButton} onClick={() => resetEditor('file')}>{t('import')}</button>
    </div>
    {receipt && <p role="status" className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-900">
      {t('saved', receipt)}
    </p>}
    <form className={`${panel} grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]`} onSubmit={search}>
      {(['q', 'category', 'province'] as const).map(key => <label key={key} className="min-w-0 text-sm font-semibold text-ink">
        <span className="mb-1.5 block">{t(`filters.${key}`)}</span>
        <input className={professionalInput} type={key === 'q' ? 'search' : 'text'} value={inputs[key]} maxLength={120}
          onChange={event => setInputs(previous => ({ ...previous, [key]: event.target.value }))} />
      </label>)}
      <button type="submit" className={professionalButton}>{t('search')}</button>
    </form>
    {loading ? <p role="status" className="text-sm text-ink2">{t('loading')}</p> : listError ?
      <div className={`${panel} space-y-3`}><p role="alert" className="text-sm text-red-800">{t('list_error')}</p>
        <button type="button" className={professionalButton} onClick={() => setRevision(value => value + 1)}>{t('retry')}</button>
      </div> : <>
        <p role="status" className="text-sm text-ink2">{t('results', { count: page.total })}</p>
        {!page.items.length && <p className={`${panel} text-sm text-ink2`}>{t('empty')}</p>}
        <div className="grid min-w-0 gap-3 lg:grid-cols-2">
          {page.items.map(entry => <ContactRecord key={entry.id} entry={entry} />)}
        </div>
        {page.total > TRADE_CONTACT_PAGE_SIZE && <nav aria-label={t('pages')} className="flex flex-wrap items-center gap-3">
          <button type="button" className={professionalButton} disabled={offset === 0}
            onClick={() => setOffset(value => Math.max(0, value - TRADE_CONTACT_PAGE_SIZE))}>{t('previous')}</button>
          <span className="text-sm text-ink2">{t('page_range', { from: offset + 1, to: Math.min(offset + TRADE_CONTACT_PAGE_SIZE, page.total), total: page.total })}</span>
          <button type="button" className={professionalButton} disabled={offset + TRADE_CONTACT_PAGE_SIZE >= page.total}
            onClick={() => setOffset(value => value + TRADE_CONTACT_PAGE_SIZE)}>{t('next')}</button>
        </nav>}
      </>}
    {editor && <ProfessionalDialog title={t(editor === 'manual' ? 'add' : 'import')} closeLabel={t('close')} onClose={() => resetEditor(null)}>
      <div className="min-w-0 space-y-4">
        {editor === 'manual' ? <div hidden={!!review}><ContactEntryForm disabled={!!busy || !!review} onPreview={entry => void preview([entry])} /></div> :
          !review && <div className="space-y-4">
            <p className="text-sm text-ink2">{t('file_help', { limit: TRADE_CONTACT_BATCH_LIMIT })}</p>
            <details className="rounded-xl border border-line bg-white p-3 text-sm">
              <summary className="cursor-pointer font-semibold text-ink">{t('json_example')}</summary>
              <pre className="max-w-full overflow-x-auto whitespace-pre-wrap [overflow-wrap:anywhere]">{JSON.stringify(example, null, 2)}</pre>
              <p className="text-xs text-ink2 [overflow-wrap:anywhere]">{t('json_optional')} {optionalTradeContactFields.join(', ')}, source_details</p>
            </details>
            <label className="block text-sm font-semibold text-ink">
              <span className="mb-1.5 block">{t('select_file')}</span>
              <input type="file" className={professionalInput} accept=".json,application/json" disabled={!!busy} onChange={event => void chooseFile(event)} />
            </label>
            {selection && <p className="text-sm text-ink2 [overflow-wrap:anywhere]">
              {t('selected_file', { filename: selection.filename, count: selection.entries.length })}
            </p>}
            <button type="button" className={professionalButton} disabled={!selection || !!busy}
              onClick={() => { if (selection) void preview(selection.entries) }}>{t('preview')}</button>
          </div>}
        {busy && <p role="status" className="text-sm text-ink2">{t(busy === 'read' ? 'reading' : busy === 'preview' ? 'previewing' : 'saving')}</p>}
        {importError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          {t(`errors.${importError.code}`, { row: importError.row, limit: TRADE_CONTACT_BATCH_LIMIT })}
        </p>}
        {review && <section className={`${panel} space-y-4`} aria-label={t('preview')}>
          <h3 ref={reviewHeading} tabIndex={-1} className="font-bold text-ink">{t('preview')}</h3>
          {review.entries.length === 1 && <p className="font-semibold text-ink [overflow-wrap:anywhere]">{review.entries[0].name}</p>}
          <p role="status" className="text-sm text-ink2">{t('planned', review.result)}</p>
          <p className="text-sm text-ink2">{t('review_note')}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={professionalPrimary} disabled={!!busy}
              onClick={() => void save()}>{t(editor === 'manual' ? 'save' : 'confirm_import')}</button>
            <button type="button" className={professionalButton} disabled={!!busy}
              onClick={() => { setReview(null); setImportError(null) }}>{t('back')}</button>
          </div>
        </section>}
      </div>
    </ProfessionalDialog>}
  </div>
}
