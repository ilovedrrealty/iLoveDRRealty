import { useTranslation } from 'react-i18next'
import { CHECK_RESULTS, INSPECTION_ITEMS, dataText, safeManagementUrl, type ManagementRecord } from '../../api/propertyManagement'

export const MANAGEMENT_BUTTON = 'min-h-10 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink transition hover:border-sea focus-visible:outline-2 focus-visible:outline-sea disabled:cursor-not-allowed disabled:opacity-50'
export const MANAGEMENT_PRIMARY = 'min-h-10 rounded-lg bg-coral px-4 py-2 text-sm font-bold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-coral disabled:cursor-not-allowed disabled:opacity-50'
export const MANAGEMENT_FIELD = 'min-h-10 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-sea disabled:bg-line-soft'

export function managementMoney(value: string, currency: string, language: string): string {
  if (!/^-?\d+(?:\.\d+)?$/.test(value) || !['USD', 'DOP'].includes(currency)) return '—'
  return new Intl.NumberFormat(language === 'es' ? 'es-DO' : 'en-US', { style: 'currency', currency, currencyDisplay: 'code', maximumFractionDigits: 2 }).format(Number(value))
}
export function managementDate(value: string | null | undefined, language: string, withTime = false): string {
  if (!value) return '—'
  const date = new Date(value.length === 10 ? value + 'T12:00:00-04:00' : value)
  if (!Number.isFinite(date.getTime())) return '—'
  return new Intl.DateTimeFormat(language === 'es' ? 'es-DO' : 'en-US', { timeZone: 'America/Santo_Domingo', year: 'numeric', month: 'short', day: 'numeric', ...(withTime ? { hour: 'numeric' as const, minute: '2-digit' as const } : {}) }).format(date)
}

export function ManagementRecordBadges({ record }: { record: ManagementRecord }) {
  const { t } = useTranslation('management')
  return <span className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-line-soft px-2.5 py-1 font-semibold text-ink2">{t(`statuses.${record.status}`)}</span>
    {record.kind === 'maintenance' ? <span className={`rounded-full px-2.5 py-1 font-semibold ${record.approval_status === 'approved' ? 'bg-emerald-50 text-emerald-800' : record.approval_status === 'declined' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-950'}`}>{t(`approvals.${record.approval_status}`)}</span> : null}</span>
}

/** Human-readable immutable revision details; never an editable JSON payload. */
export function ManagementRecordSnapshot({ record }: { record: ManagementRecord }) {
  const { t, i18n } = useTranslation('management')
  const data = record.data
  const textKeys: Record<string, string[]> = {
    lease: ['tenant_name', 'tenant_email', 'tenant_phone', 'unit_reference', 'start_date', 'end_date', 'rent', 'deposit', 'currency', 'due_day', 'first_due_date', 'first_rent'],
    maintenance: ['category', 'priority', 'due_date', 'vendor_name', 'vendor_phone', 'estimated_cost', 'actual_cost', 'currency'],
    inspection: ['inspection_type', 'due_date', 'inspector'], ledger: ['direction', 'category', 'amount', 'currency', 'transaction_date', 'reference', 'lease_id', 'rent_period'], task: ['category', 'due_date', 'assigned_to', 'recurrence'],
  }
  const enumGroups: Record<string, string> = { priority: 'priorities', inspection_type: 'inspection_types', direction: 'directions', recurrence: 'recurrences' }
  const categoryGroup = record.kind === 'maintenance' ? 'maintenance_categories' : record.kind === 'ledger' ? 'ledger_categories' : 'task_categories'
  return <div className="space-y-3 text-sm">
    <p className="font-bold text-ink">{record.title}</p><ManagementRecordBadges record={record} />
    <dl className="grid gap-x-5 gap-y-2 sm:grid-cols-2">{textKeys[record.kind].map(key => {
      const value = dataText(data, key)
      if (!value) return null
      const label = key === 'category' ? `${record.kind}_category` : key
      const display = ['rent', 'deposit', 'first_rent', 'estimated_cost', 'actual_cost', 'amount'].includes(key) ? managementMoney(value, dataText(data, 'currency'), i18n.language) : key === 'category' ? t(`${categoryGroup}.${value}`) : enumGroups[key] ? t(`${enumGroups[key]}.${value}`) : key.endsWith('_date') || key === 'rent_period' ? managementDate(value, i18n.language) : value
      return <div key={key} className="min-w-0"><dt className="text-xs text-dim">{t(`fields.${label}`)}</dt><dd className="break-words text-ink2">{display}</dd></div>
    })}</dl>
    {record.kind === 'maintenance' ? <p>{t('requires_approval')}: {t(data.requires_approval ? 'yes' : 'no')}{record.approval_limit != null && record.currency ? ` · ${t('approval_limit')}: ${managementMoney(record.approval_limit, record.currency, i18n.language)}` : ''}</p> : null}
    {record.kind === 'inspection' ? <ul className="space-y-1">{INSPECTION_ITEMS.map(key => {
      const checks = typeof data.checks === 'object' && data.checks ? data.checks as Record<string, unknown> : {}
      const notes = typeof data.item_notes === 'object' && data.item_notes ? data.item_notes as Record<string, unknown> : {}
      const result = typeof checks[key] === 'string' && (CHECK_RESULTS as readonly string[]).includes(checks[key] as string) ? checks[key] as string : 'not_checked'
      return <li key={key}><strong>{t(`checks.${key}`)}:</strong> {t(`check_results.${result}`)}{typeof notes[key] === 'string' && notes[key] ? <p className="whitespace-pre-wrap break-words text-ink2">{notes[key] as string}</p> : null}</li>
    })}</ul> : null}
    {dataText(data, 'notes') ? <p className="whitespace-pre-wrap break-words rounded-lg bg-line-soft p-3 text-ink2">{dataText(data, 'notes')}</p> : null}
    {record.kind === 'maintenance' && dataText(data, 'progress_notes') ? <div><p className="text-xs font-bold text-dim">{t('fields.progress_notes')}</p><p className="whitespace-pre-wrap break-words text-ink2">{dataText(data, 'progress_notes')}</p></div> : null}
    {[dataText(data, 'document_url'), ...(Array.isArray(data.evidence_links) ? data.evidence_links.filter((url): url is string => typeof url === 'string') : [])].filter(url => !!url && safeManagementUrl(url)).map((url, index) => <a key={`${index}:${url}`} href={url} target="_blank" rel="noopener noreferrer" className="block break-all text-coral underline">{t('open_reference', { number: index + 1 })}</a>)}
  </div>
}
