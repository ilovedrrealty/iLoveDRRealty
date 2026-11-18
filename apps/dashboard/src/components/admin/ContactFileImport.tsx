import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { isAxiosError } from 'axios'
import { analyzeTradeContactFile, optionalTradeContactFields, previewTradeContactMapping, readTradeContactFile,
  requiredTradeContactFields, TRADE_CONTACT_BATCH_LIMIT, TRADE_CONTACT_FILE_LIMIT, tradeVerificationStatuses,
  type TradeContactEntry, type TradeContactImport, type TradeContactIssue, type TradeContactTable } from '../../api/tradeContacts'
import { professionalButton, professionalInput } from '../shared/ProfessionalFields'

const fields = [...requiredTradeContactFields, ...optionalTradeContactFields, 'verification_status'] as const
const errorCodes = new Set(['file_size', 'unsupported_file', 'invalid_file', 'invalid_csv', 'invalid_xlsx', 'empty_file',
  'utf8_required', 'table_limits', 'column_count', 'too_many_rows', 'xlsx_expansion', 'active_content', 'formula_cells',
  'invalid_cell', 'numeric_precision', 'unknown_sheet', 'invalid_mapping', 'parser_unavailable'])

export function ContactFileImport({ disabled, onBusy, onJSONPreview, onReviewed }: {
  disabled: boolean; onBusy: (value: boolean) => void; onJSONPreview: (entries: TradeContactEntry[]) => void
  onReviewed: (entries: TradeContactEntry[], result: TradeContactImport, preserveSourceDetails: true) => void
}) {
  const { t } = useTranslation('admin', { keyPrefix: 'trade_contacts_page' })
  const [file, setFile] = useState<File | null>(null)
  const [table, setTable] = useState<TradeContactTable | null>(null)
  const [json, setJSON] = useState<TradeContactEntry[] | null>(null)
  const [mapping, setMapping] = useState<Record<string, number>>({})
  const [defaults, setDefaults] = useState<Record<string, string>>({ verification_status: 'owner_source' })
  const [delimiter, setDelimiter] = useState('auto')
  const [issues, setIssues] = useState<TradeContactIssue[]>([])
  const [issueCount, setIssueCount] = useState(0)
  const [error, setError] = useState<{ code: string; row?: number } | null>(null)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])

  function failure(cause: unknown) {
    const detail = isAxiosError(cause) ? cause.response?.data?.detail : null
    setError(detail && typeof detail === 'object' && errorCodes.has(detail.code)
      ? { code: detail.code, row: typeof detail.row === 'number' ? detail.row : undefined }
      : { code: 'preview_failed' })
  }

  async function analyze(chosen: File, sheet?: string, separator = delimiter) {
    controller.current?.abort()
    const operation = new AbortController()
    controller.current = operation
    onBusy(true); setError(null); setIssues([]); setIssueCount(0); setTable(null); setJSON(null)
    try {
      const next = await analyzeTradeContactFile(chosen, sheet, separator, operation.signal)
      if (!operation.signal.aborted) { setTable(next); setMapping(next.suggested_mapping) }
    } catch (cause) { if (!operation.signal.aborted) failure(cause) }
    finally { if (!operation.signal.aborted) onBusy(false) }
  }

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!chosen || disabled) return
    setFile(chosen); setTable(null); setJSON(null); setError(null); setIssues([]); setIssueCount(0)
    setDefaults({ verification_status: 'owner_source' })
    if (chosen.size > TRADE_CONTACT_FILE_LIMIT) { setError({ code: 'file_size' }); return }
    if (/\.json$/i.test(chosen.name)) {
      onBusy(true)
      try {
        const parsed = readTradeContactFile(await chosen.text())
        if ('error' in parsed) setError({ code: parsed.error, row: parsed.row })
        else setJSON(parsed.entries)
      } catch { setError({ code: 'invalid_file' }) }
      finally { onBusy(false) }
    } else await analyze(chosen)
  }

  async function review() {
    if (!table || disabled) return
    controller.current?.abort()
    const operation = new AbortController()
    controller.current = operation
    onBusy(true); setError(null); setIssues([]); setIssueCount(0)
    try {
      const next = await previewTradeContactMapping(table, mapping, defaults, operation.signal)
      if (operation.signal.aborted) return
      if (next.issue_count) { setIssues(next.issues); setIssueCount(next.issue_count) }
      else if (next.result && next.entries.length && next.preserve_source_details === true) onReviewed(next.entries, next.result, true)
      else setError({ code: 'preview_failed' })
    } catch (cause) { if (!operation.signal.aborted) failure(cause) }
    finally { if (!operation.signal.aborted) onBusy(false) }
  }

  function changeMapping(field: string, value: string) {
    setMapping(previous => {
      const next = { ...previous }
      if (value === '') delete next[field]
      else next[field] = Number(value)
      return next
    })
    setIssues([]); setIssueCount(0)
  }

  return <div className="min-w-0 space-y-4">
    <p className="text-sm text-ink2">{t('file_help', { limit: TRADE_CONTACT_BATCH_LIMIT })}</p>
    <a href="/templates/contact-import.csv" download className="inline-block text-sm font-semibold underline">{t('download_contact_template')}</a>
    <label className="block min-w-0 text-sm font-semibold text-ink"><span className="mb-1.5 block">{t('select_file')}</span>
      <input type="file" accept=".json,.csv,.xlsx,application/json,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className={professionalInput} disabled={disabled} onChange={event => void choose(event)} /></label>
    {file && <p className="break-words text-sm text-ink2">{file.name}</p>}
    {file && /\.csv$/i.test(file.name) && <label className="block min-w-0 text-sm font-semibold">{t('file_mapping.delimiter')}
      <select className={`${professionalInput} min-w-0 max-w-full`} disabled={disabled} value={delimiter} onChange={event => {
        setDelimiter(event.target.value); void analyze(file, undefined, event.target.value)
      }}>{['auto', 'comma', 'semicolon', 'tab'].map(value => <option key={value} value={value}>{t(`file_mapping.delimiters.${value}`)}</option>)}</select></label>}
    {table && <>
      {table.sheet && <label className="block min-w-0 text-sm font-semibold">{t('file_mapping.worksheet')}
        <select className={`${professionalInput} min-w-0 max-w-full`} disabled={disabled} value={table.sheet} onChange={event => {
          if (file) void analyze(file, event.target.value)
        }}>{table.sheets.map(name => <option key={name} value={name}>{name}</option>)}</select></label>}
      <p className="text-sm text-ink2">{t('file_mapping.rows', { count: table.rows.length })}</p>
      <div className="max-w-full overflow-x-auto rounded-xl border border-line"><table className="w-full text-left text-xs"><caption className="p-2 text-left font-semibold">{t('file_mapping.sample')}</caption>
        <thead><tr>{table.columns.map((name, index) => <th className="min-w-28 p-2" key={index}>{name || t('file_mapping.column', { index: index + 1 })}</th>)}</tr></thead>
        <tbody>{table.rows.slice(0, 3).map(row => <tr key={row.row_number}>{row.values.map((value, index) => <td className="max-w-64 break-words p-2 align-top" key={index}>{value.slice(0, 160)}</td>)}</tr>)}</tbody>
      </table></div>
      <fieldset disabled={disabled} className="grid min-w-0 gap-3 sm:grid-cols-2"><legend className="mb-3 font-semibold">{t('file_mapping.match_columns')}</legend>
        {fields.map(field => <label key={field} className="min-w-0 text-sm font-semibold">{t(`fields.${field}`)}
          <select className={`${professionalInput} min-w-0 max-w-full`} value={mapping[field] ?? ''} onChange={event => changeMapping(field, event.target.value)}>
            <option value="">{t('file_mapping.not_mapped')}</option>{table.columns.map((name, index) => <option key={index} value={index}>{index + 1}. {name || t('file_mapping.column', { index: index + 1 })}</option>)}
          </select></label>)}
      </fieldset>
      <fieldset disabled={disabled} className="grid min-w-0 gap-3 sm:grid-cols-2"><legend className="mb-3 font-semibold">{t('file_mapping.shared_fields')}</legend>
        <p className="text-xs text-ink2 sm:col-span-2">{t('file_mapping.source_help')}</p>
        {['category', 'province', 'locality', 'source_authority', 'source_url', 'verified_on'].map(field => <label key={field} className="min-w-0 text-sm font-semibold">{t(`fields.${field}`)}
          <input className={professionalInput} type={field === 'verified_on' ? 'date' : field === 'source_url' ? 'url' : 'text'}
            value={defaults[field] ?? ''} onChange={event => { setDefaults(previous => ({ ...previous, [field]: event.target.value })); setIssues([]); setIssueCount(0) }} /></label>)}
        <label className="min-w-0 text-sm font-semibold">{t('fields.verification_status')}<select className={`${professionalInput} min-w-0 max-w-full`}
          value={defaults.verification_status} onChange={event => { setDefaults(previous => ({ ...previous, verification_status: event.target.value })); setIssues([]); setIssueCount(0) }}>
          {tradeVerificationStatuses.map(status => <option key={status} value={status}>{t(`statuses.${status}`)}</option>)}
        </select></label>
      </fieldset>
      <button type="button" className={professionalButton} disabled={disabled} onClick={() => void review()}>{t('preview')}</button>
    </>}
    {json && <><p className="text-sm text-ink2">{t('selected_file', { filename: file?.name, count: json.length })}</p>
      <button type="button" className={professionalButton} disabled={disabled} onClick={() => onJSONPreview(json)}>{t('preview')}</button></>}
    {error && <p role="alert" className="break-words rounded-xl bg-red-50 p-3 text-sm text-red-900">{t(`errors.${error.code}`, { row: error.row, limit: TRADE_CONTACT_BATCH_LIMIT })}</p>}
    {issueCount > 0 && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900"><p className="font-semibold">{t('file_mapping.issue_count', { count: issueCount })}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">{issues.map((issue, index) => <li key={index}>{t('file_mapping.row_issue', { row: issue.row, field: t(`fields.${issue.field}`), reason: t(`file_mapping.issues.${issue.code}`) })}</li>)}</ul>
      {issueCount > issues.length && <p className="mt-2">{t('file_mapping.first_issues', { count: issues.length })}</p>}
    </div>}
  </div>
}
