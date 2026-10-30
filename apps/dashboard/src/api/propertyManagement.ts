import { isAxiosError } from 'axios'
import client from './axios'

export const MANAGEMENT_KINDS = ['lease', 'maintenance', 'inspection', 'ledger', 'task'] as const
export type ManagementKind = typeof MANAGEMENT_KINDS[number]
export type ManagementTab = 'overview' | ManagementKind
export const MANAGEMENT_STATUSES: Record<ManagementKind, readonly string[]> = {
  lease: ['draft', 'active', 'ended', 'terminated'],
  maintenance: ['open', 'awaiting_approval', 'approved', 'in_progress', 'completed', 'cancelled'],
  inspection: ['scheduled', 'in_progress', 'completed', 'cancelled'],
  ledger: ['planned', 'recorded', 'void'],
  task: ['open', 'in_progress', 'completed', 'cancelled'],
}
export const INSPECTION_ITEMS = ['entrance', 'plumbing', 'electrical', 'cooling', 'appliances', 'safety', 'meters', 'condition'] as const
export const CHECK_RESULTS = ['not_checked', 'pass', 'issue', 'not_applicable'] as const
export const MANAGEMENT_OPTIONS = {
  maintenance_categories: ['plumbing', 'electrical', 'cooling', 'pool', 'generator', 'water', 'roof', 'security', 'other'],
  priorities: ['routine', 'urgent', 'emergency'],
  inspection_types: ['move_in', 'move_out', 'routine', 'turnover', 'storm_preparation'],
  directions: ['income', 'expense'],
  ledger_categories: ['rent', 'deposit', 'maintenance', 'hoa', 'utilities', 'management', 'insurance', 'tax', 'other'],
  task_categories: ['cleaning', 'maintenance', 'renewal', 'administration'],
  recurrences: ['none', 'weekly', 'monthly', 'quarterly', 'yearly'],
} as const
export type InspectionItem = typeof INSPECTION_ITEMS[number]
export type CheckResult = typeof CHECK_RESULTS[number]
export type ManagementCurrency = 'USD' | 'DOP'
export type ManagedProperty = { id: string; title: string; location: string; status?: string; can_approve: boolean }
export type ManagementRecord = {
  id: string; listing_id: string; kind: ManagementKind; title: string; status: string
  data: Record<string, unknown>; version: number; due_date: string | null
  currency: ManagementCurrency | null; amount: string | null
  approval_status: 'not_required' | 'pending' | 'approved' | 'declined'
  approval_limit: string | null; approved_at: string | null; origin_record_id: string | null
  created_at: string; updated_at: string
}
export type ManagementPage<T> = { items: T[]; total: number; page: number; page_size: number }
export type ManagementHistory = { version: number; action: string; snapshot: { record: ManagementRecord; comment: string }; created_at: string }
export type RentDue = { lease_id: string; title: string; due_date: string; currency: ManagementCurrency; expected: string; recorded_received: string; outstanding: string; overdue: boolean }
export type NativeTotals = { income: string; expenses: string; net: string; deposit_cash: string; deposit_balance: string }
export type ManagementStatement = {
  property: { id: string; title: string; location: string }
  period: { start: string; end: string; as_of: string; timezone: 'America/Santo_Domingo' }
  counts: Record<ManagementKind, number>
  totals: Partial<Record<ManagementCurrency, NativeTotals>>
  entries: ManagementRecord[]; rent_due: RentDue[]; open_work_orders: ManagementRecord[]
  due_items: ManagementRecord[]; renewals: ManagementRecord[]; can_approve: boolean; note: string
}
export type ManagementWrite = { listing_id: string; kind: ManagementKind; title: string; status: string; data: Record<string, unknown>; origin_record_id: string | null }
export type ManagementDraft = {
  kind: ManagementKind; title: string; status: string; notes: string
  tenant_name: string; tenant_email: string; tenant_phone: string; unit_reference: string
  start_date: string; end_date: string; rent: string; deposit: string; currency: ManagementCurrency
  due_day: string; first_due_date: string; first_rent: string; document_url: string
  maintenance_category: string; priority: string; due_date: string; vendor_name: string; vendor_phone: string
  estimated_cost: string; actual_cost: string; requires_approval: boolean; progress_notes: string
  inspection_type: string; inspector: string; checks: Record<InspectionItem, CheckResult>
  item_notes: Record<InspectionItem, string>; evidence_text: string
  direction: string; ledger_category: string; amount: string; transaction_date: string
  reference: string; lease_id: string; rent_period: string
  task_category: string; assigned_to: string; recurrence: string
}

export const dataText = (data: Record<string, unknown>, key: string, fallback = '') => typeof data[key] === 'string' || typeof data[key] === 'number' ? String(data[key]) : fallback
export function todayInDR(now = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Santo_Domingo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}
export function validCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) < 1) return false
  const parsed = new Date(value + 'T12:00:00Z')
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}
export function validStatementPeriod(start: string, end: string): boolean {
  return validCalendarDate(start) && validCalendarDate(end) && start <= end && (Date.parse(end) - Date.parse(start)) / 86_400_000 <= 366
}
export function safeManagementUrl(value: string): boolean {
  if (!value) return true
  try {
    const url = new URL(value)
    return /^https:\/\//i.test(value) && url.protocol === 'https:' && !!url.hostname && !url.username && !url.password && !/[\u0000-\u0020]/.test(value) && value.length <= 1000
  } catch { return false }
}
function money(value: string, positive = false): boolean {
  return /^(?:\d{1,10}(?:\.\d{1,2})?|\.\d{1,2})$/.test(value) && Number(value) <= 9_999_999_999 && (positive ? Number(value) > 0 : Number(value) >= 0)
}
function uuid(value: string): boolean { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) }
function id(value: string): string { if (!uuid(value)) throw new Error('Invalid management reference'); return encodeURIComponent(value) }
export function newManagementDraft(kind: ManagementKind, today = todayInDR()): ManagementDraft {
  return {
    kind, title: '', status: MANAGEMENT_STATUSES[kind][0], notes: '',
    tenant_name: '', tenant_email: '', tenant_phone: '', unit_reference: '', start_date: today, end_date: '', rent: '', deposit: '0', currency: 'USD', due_day: '1', first_due_date: '', first_rent: '', document_url: '',
    maintenance_category: 'other', priority: 'routine', due_date: today, vendor_name: '', vendor_phone: '', estimated_cost: '0', actual_cost: '', requires_approval: true, progress_notes: '',
    inspection_type: 'routine', inspector: '', checks: Object.fromEntries(INSPECTION_ITEMS.map(key => [key, 'not_checked'])) as Record<InspectionItem, CheckResult>, item_notes: Object.fromEntries(INSPECTION_ITEMS.map(key => [key, ''])) as Record<InspectionItem, string>, evidence_text: '',
    direction: 'income', ledger_category: 'rent', amount: '', transaction_date: today, reference: '', lease_id: '', rent_period: '', task_category: 'administration', assigned_to: '', recurrence: 'none',
  }
}
export function draftFromRecord(record: ManagementRecord): ManagementDraft {
  const draft = newManagementDraft(record.kind)
  const data = record.data
  draft.title = record.title; draft.status = record.status; draft.notes = dataText(data, 'notes')
  const direct: (keyof ManagementDraft)[] = ['tenant_name', 'tenant_email', 'tenant_phone', 'unit_reference', 'start_date', 'end_date', 'rent', 'deposit', 'due_day', 'first_due_date', 'first_rent', 'document_url', 'priority', 'due_date', 'vendor_name', 'vendor_phone', 'estimated_cost', 'actual_cost', 'progress_notes', 'inspection_type', 'inspector', 'direction', 'amount', 'transaction_date', 'reference', 'lease_id', 'assigned_to', 'recurrence']
  for (const key of direct) if (key in data) (draft as unknown as Record<string, unknown>)[key] = dataText(data, key)
  draft.currency = data.currency === 'DOP' ? 'DOP' : 'USD'
  draft.requires_approval = data.requires_approval !== false
  draft.maintenance_category = dataText(data, 'category', 'other')
  draft.ledger_category = dataText(data, 'category', 'other')
  draft.task_category = dataText(data, 'category', 'administration')
  draft.rent_period = dataText(data, 'rent_period').slice(0, 7)
  const checks = data.checks && typeof data.checks === 'object' ? data.checks as Record<string, unknown> : {}
  const notes = data.item_notes && typeof data.item_notes === 'object' ? data.item_notes as Record<string, unknown> : {}
  for (const key of INSPECTION_ITEMS) {
    draft.checks[key] = CHECK_RESULTS.includes(checks[key] as CheckResult) ? checks[key] as CheckResult : 'not_checked'
    draft.item_notes[key] = typeof notes[key] === 'string' ? notes[key] as string : ''
  }
  draft.evidence_text = Array.isArray(data.evidence_links) ? data.evidence_links.filter(url => typeof url === 'string').join('\n') : ''
  return draft
}

export function managementDraftIssues(draft: ManagementDraft, today = todayInDR()): string[] {
  const issues: string[] = []
  if (!draft.title.trim() || draft.title.trim().length > 180) issues.push('title')
  if (!MANAGEMENT_STATUSES[draft.kind].includes(draft.status)) issues.push('status')
  if (draft.notes.length > 4000) issues.push('notes')
  if (draft.currency !== 'USD' && draft.currency !== 'DOP') issues.push('currency')
  if (draft.kind === 'lease') {
    if (!draft.tenant_name.trim() || draft.tenant_name.length > 160) issues.push('tenant')
    if (draft.tenant_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.tenant_email)) issues.push('email')
    if (draft.tenant_phone.length > 50 || draft.unit_reference.length > 80) issues.push('contact_length')
    if (!validCalendarDate(draft.start_date) || (draft.end_date && (!validCalendarDate(draft.end_date) || draft.end_date < draft.start_date)) || (['ended', 'terminated'].includes(draft.status) && !draft.end_date)) issues.push('lease_dates')
    if (draft.first_due_date && (!validCalendarDate(draft.first_due_date) || draft.first_due_date < draft.start_date || (draft.end_date && draft.first_due_date > draft.end_date))) issues.push('first_due_date')
    if (!/^(?:[1-9]|[12]\d|3[01])$/.test(draft.due_day)) issues.push('due_day')
    if (!money(draft.rent, true) || !money(draft.deposit) || (draft.first_rent && !money(draft.first_rent))) issues.push('money')
    if (!safeManagementUrl(draft.document_url)) issues.push('url')
  } else if (draft.kind === 'maintenance') {
    if (draft.progress_notes.length > 4000) issues.push('progress_notes')
    if (!(MANAGEMENT_OPTIONS.maintenance_categories as readonly string[]).includes(draft.maintenance_category) || !(MANAGEMENT_OPTIONS.priorities as readonly string[]).includes(draft.priority)) issues.push('category')
    if (draft.due_date && !validCalendarDate(draft.due_date)) issues.push('due_date')
    if (!money(draft.estimated_cost) || (draft.actual_cost && !money(draft.actual_cost))) issues.push('money')
    if (draft.vendor_name.length > 160 || draft.vendor_phone.length > 50) issues.push('contact_length')
  } else if (draft.kind === 'inspection') {
    if (!(MANAGEMENT_OPTIONS.inspection_types as readonly string[]).includes(draft.inspection_type) || INSPECTION_ITEMS.some(key => !CHECK_RESULTS.includes(draft.checks[key]))) issues.push('category')
    if (!validCalendarDate(draft.due_date)) issues.push('due_date')
    if (draft.inspector.length > 160) issues.push('contact_length')
    if (INSPECTION_ITEMS.some(key => draft.item_notes[key].length > 1000)) issues.push('inspection_notes')
    if (draft.status === 'completed' && INSPECTION_ITEMS.some(key => draft.checks[key] === 'not_checked' || (draft.checks[key] === 'issue' && !draft.item_notes[key].trim()))) issues.push('inspection_complete')
    const links = draft.evidence_text.split(/\r?\n/).map(value => value.trim()).filter(Boolean)
    if (links.length > 12 || links.some(url => !safeManagementUrl(url))) issues.push('evidence_links')
  } else if (draft.kind === 'ledger') {
    if (!(MANAGEMENT_OPTIONS.directions as readonly string[]).includes(draft.direction) || !(MANAGEMENT_OPTIONS.ledger_categories as readonly string[]).includes(draft.ledger_category)) issues.push('category')
    if (!money(draft.amount, true)) issues.push('money')
    if (!validCalendarDate(draft.transaction_date) || (draft.status === 'recorded' && draft.transaction_date > today)) issues.push('transaction_date')
    if (draft.reference.length > 120) issues.push('reference')
    if (draft.lease_id && !uuid(draft.lease_id)) issues.push('lease')
    if (draft.rent_period && (!/^\d{4}-\d{2}$/.test(draft.rent_period) || !validCalendarDate(draft.rent_period + '-01') || draft.ledger_category !== 'rent' || !draft.lease_id)) issues.push('rent_period')
  } else {
    if (!(MANAGEMENT_OPTIONS.task_categories as readonly string[]).includes(draft.task_category) || !(MANAGEMENT_OPTIONS.recurrences as readonly string[]).includes(draft.recurrence)) issues.push('category')
    if (!validCalendarDate(draft.due_date)) issues.push('due_date')
    if (draft.assigned_to.length > 160) issues.push('contact_length')
  }
  return [...new Set(issues)]
}

export function managementWrite(listingId: string, draft: ManagementDraft, current: ManagementRecord | null = null): ManagementWrite {
  if (!uuid(listingId) || managementDraftIssues(draft).length) throw new Error('Check management fields')
  if (current && (current.listing_id !== listingId || current.kind !== draft.kind)) throw new Error('A management record cannot move')
  const common = { notes: draft.notes.trim() }
  let data: Record<string, unknown>
  if (draft.kind === 'lease') data = { ...common, tenant_name: draft.tenant_name.trim(), tenant_email: draft.tenant_email.trim() || null, tenant_phone: draft.tenant_phone.trim(), unit_reference: draft.unit_reference.trim(), start_date: draft.start_date, end_date: draft.end_date || null, rent: draft.rent, deposit: draft.deposit, currency: draft.currency, due_day: Number(draft.due_day), first_due_date: draft.first_due_date || null, first_rent: draft.first_rent || null, document_url: draft.document_url.trim() }
  else if (draft.kind === 'maintenance') data = { ...common, category: draft.maintenance_category, priority: draft.priority, due_date: draft.due_date || null, vendor_name: draft.vendor_name.trim(), vendor_phone: draft.vendor_phone.trim(), estimated_cost: draft.estimated_cost, actual_cost: draft.actual_cost || null, currency: draft.currency, requires_approval: draft.requires_approval, progress_notes: draft.progress_notes.trim() }
  else if (draft.kind === 'inspection') data = { ...common, inspection_type: draft.inspection_type, due_date: draft.due_date, inspector: draft.inspector.trim(), checks: { ...draft.checks }, item_notes: Object.fromEntries(INSPECTION_ITEMS.map(key => [key, draft.item_notes[key].trim()])), evidence_links: draft.evidence_text.split(/\r?\n/).map(url => url.trim()).filter(Boolean) }
  else if (draft.kind === 'ledger') data = { ...common, direction: draft.direction, category: draft.ledger_category, amount: draft.amount, currency: draft.currency, transaction_date: draft.transaction_date, reference: draft.reference.trim(), lease_id: draft.lease_id || null, rent_period: draft.rent_period ? draft.rent_period + '-01' : null }
  else data = { ...common, category: draft.task_category, due_date: draft.due_date, assigned_to: draft.assigned_to.trim(), recurrence: draft.recurrence }
  return { listing_id: listingId, kind: draft.kind, title: draft.title.trim(), status: draft.status, data, origin_record_id: current?.origin_record_id ?? null }
}

export function managementErrorKey(error: unknown): string {
  if (!isAxiosError(error)) return 'error_unavailable'
  const status = error.response?.status
  const detail = typeof error.response?.data?.detail === 'string' ? error.response.data.detail : ''
  if (status === 401 || status === 403) return 'error_access'
  if (status === 404) return 'error_missing'
  if (status === 409 && detail.includes('changed')) return 'error_conflict'
  if (status === 409 && detail.includes('overlaps')) return 'error_overlap'
  if (status === 409 && detail.includes('approval')) return 'error_approval'
  if (status === 409 && detail.includes('limit')) return 'error_limit'
  if (status === 422 || status === 413) return 'error_validation'
  if (status === 429) return 'error_rate'
  return 'error_unavailable'
}
export function uncertainManagementSave(error: unknown): boolean { return !isAxiosError(error) || !error.response || error.response.status >= 500 }

function isObject(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value) }
function decimalText(value: unknown): value is string { return typeof value === 'string' && /^-?\d+(?:\.\d{1,2})?$/.test(value) && Number.isFinite(Number(value)) }
function count(value: unknown): value is number { return Number.isSafeInteger(value) && Number(value) >= 0 }
function unavailable(): never { throw new Error('Management response is unavailable') }
export function isManagementRecord(value: unknown): value is ManagementRecord {
  if (!isObject(value) || typeof value.id !== 'string' || !uuid(value.id) || typeof value.listing_id !== 'string' || !uuid(value.listing_id)
    || !(MANAGEMENT_KINDS as readonly unknown[]).includes(value.kind) || typeof value.title !== 'string' || !isObject(value.data)
    || !count(value.version) || value.version < 1 || typeof value.status !== 'string' || !MANAGEMENT_STATUSES[value.kind as ManagementKind].includes(value.status)
    || !(value.due_date === null || typeof value.due_date === 'string' && validCalendarDate(value.due_date))
    || !(value.currency === null || value.currency === 'USD' || value.currency === 'DOP') || !(value.amount === null || decimalText(value.amount))
    || !(value.approval_limit === null || decimalText(value.approval_limit)) || !['not_required', 'pending', 'approved', 'declined'].includes(String(value.approval_status))
    || !(value.origin_record_id === null || typeof value.origin_record_id === 'string' && uuid(value.origin_record_id))
    || !['created_at', 'updated_at'].every(key => typeof value[key] === 'string' && Number.isFinite(Date.parse(value[key] as string)))) return false
  return true
}
function readRecord(value: unknown): ManagementRecord { return isManagementRecord(value) ? value : unavailable() }
function readPage<T>(value: unknown, isItem: (item: unknown) => item is T): ManagementPage<T> {
  if (!isObject(value) || !Array.isArray(value.items) || !count(value.total) || !count(value.page) || value.page < 1 || value.page_size !== 50
    || value.items.length > 50 || value.items.length > value.total || !value.items.every(isItem)) return unavailable()
  return value as ManagementPage<T>
}
export function isManagementStatement(value: unknown, listingId: string, start: string, end: string): value is ManagementStatement {
  if (!isObject(value) || !isObject(value.property) || value.property.id !== listingId || typeof value.property.title !== 'string' || typeof value.property.location !== 'string'
    || !isObject(value.period) || value.period.start !== start || value.period.end !== end || value.period.timezone !== 'America/Santo_Domingo' || typeof value.period.as_of !== 'string' || !validCalendarDate(value.period.as_of)
    || !isObject(value.counts) || !MANAGEMENT_KINDS.every(key => count((value.counts as Record<string, unknown>)[key]))
    || !isObject(value.totals) || Object.keys(value.totals).some(key => key !== 'USD' && key !== 'DOP') || typeof value.can_approve !== 'boolean' || typeof value.note !== 'string') return false
  for (const total of Object.values(value.totals)) if (!isObject(total) || !['income', 'expenses', 'net', 'deposit_cash', 'deposit_balance'].every(key => decimalText(total[key]))) return false
  for (const key of ['entries', 'open_work_orders', 'due_items', 'renewals']) if (!Array.isArray(value[key]) || !(value[key] as unknown[]).every(row => isManagementRecord(row) && row.listing_id === listingId)) return false
  if (!(value.entries as ManagementRecord[]).every(row => row.kind === 'ledger' && row.status === 'recorded' && decimalText(row.data.amount)
    && (row.data.currency === 'USD' || row.data.currency === 'DOP') && ['income', 'expense'].includes(String(row.data.direction))
    && typeof row.data.transaction_date === 'string' && validCalendarDate(row.data.transaction_date) && row.data.transaction_date >= start && row.data.transaction_date <= end)) return false
  if (!(value.open_work_orders as ManagementRecord[]).every(row => row.kind === 'maintenance' && !['completed', 'cancelled'].includes(row.status))
    || !(value.due_items as ManagementRecord[]).every(row => ['task', 'inspection'].includes(row.kind) && !['completed', 'cancelled'].includes(row.status))
    || !(value.renewals as ManagementRecord[]).every(row => row.kind === 'lease' && row.status === 'active')) return false
  if (!Array.isArray(value.rent_due) || !value.rent_due.every(row => isObject(row) && typeof row.lease_id === 'string' && uuid(row.lease_id) && typeof row.title === 'string'
    && typeof row.due_date === 'string' && validCalendarDate(row.due_date) && (row.currency === 'USD' || row.currency === 'DOP') && typeof row.overdue === 'boolean'
    && ['expected', 'recorded_received', 'outstanding'].every(key => decimalText(row[key])))) return false
  return true
}

export async function getManagedProperties(query: string, page: number, signal?: AbortSignal) {
  const value = (await client.get<unknown>('/property-management/properties', { params: { q: query, page }, signal })).data
  return readPage(value, (item): item is ManagedProperty => isObject(item) && typeof item.id === 'string' && uuid(item.id) && typeof item.title === 'string' && typeof item.location === 'string' && typeof item.can_approve === 'boolean')
}
export async function getManagementStatement(listingId: string, start: string, end: string, signal?: AbortSignal) {
  if (!validStatementPeriod(start, end)) throw new Error('Invalid statement period')
  const value = (await client.get<unknown>(`/property-management/properties/${id(listingId)}/statement`, { params: { start, end }, signal })).data
  return isManagementStatement(value, listingId, start, end) ? value : unavailable()
}
export async function getManagementRecords(listingId: string, kind: ManagementKind, page: number, signal?: AbortSignal) {
  id(listingId)
  const result = readPage((await client.get<unknown>('/property-management/records', { params: { listing_id: listingId, kind, page }, signal })).data, isManagementRecord)
  return result.items.every(row => row.listing_id === listingId && row.kind === kind) ? result : unavailable()
}
export async function getManagementRecord(recordId: string) { const value = readRecord((await client.get<unknown>(`/property-management/records/${id(recordId)}`)).data); return value.id === recordId ? value : unavailable() }
export async function saveManagementRecord(body: ManagementWrite, current: ManagementRecord | null) {
  const value = readRecord(current ? (await client.put<unknown>(`/property-management/records/${id(current.id)}`, { ...body, expected_version: current.version })).data
    : (await client.post<unknown>('/property-management/records', body)).data)
  return value.listing_id === body.listing_id && value.kind === body.kind && (!current || value.id === current.id) ? value : unavailable()
}
export async function approveManagementRecord(current: ManagementRecord, decision: 'approved' | 'declined', limit: string, comment: string) {
  const value = readRecord((await client.post<unknown>(`/property-management/records/${id(current.id)}/approval`, { expected_version: current.version, decision, limit: limit || null, comment })).data)
  return value.id === current.id && value.listing_id === current.listing_id && value.kind === 'maintenance' ? value : unavailable()
}
export async function scheduleNextManagementTask(current: ManagementRecord) {
  const value = readRecord((await client.post<unknown>(`/property-management/records/${id(current.id)}/schedule-next`, { expected_version: current.version })).data)
  return value.kind === 'task' && value.listing_id === current.listing_id && value.origin_record_id === current.id ? value : unavailable()
}
export async function getManagementHistory(recordId: string, page: number, signal?: AbortSignal) {
  return readPage((await client.get<unknown>(`/property-management/records/${id(recordId)}/history`, { params: { page }, signal })).data, (item): item is ManagementHistory => isObject(item) && count(item.version) && item.version > 0 && typeof item.action === 'string' && typeof item.created_at === 'string' && Number.isFinite(Date.parse(item.created_at)) && isObject(item.snapshot) && isManagementRecord(item.snapshot.record) && item.snapshot.record.id === recordId && item.snapshot.record.version === item.version && typeof item.snapshot.comment === 'string')
}

export function safeCsvCell(value: unknown): string {
  const raw = String(value ?? '')
  const safe = /^[\s\uFEFF]*[=+\-@]/.test(raw) || /^[\t\r\n]/.test(raw) ? "'" + raw : raw
  return '"' + safe.replace(/"/g, '""') + '"'
}
export function statementCsv(statement: ManagementStatement, labels: Record<string, string>): string {
  const rows: unknown[][] = [
    [labels.property, statement.property.title], [labels.location, statement.property.location],
    [labels.period, statement.period.start, statement.period.end], [labels.manual_note], [],
    [labels.currency, labels.income, labels.expenses, labels.net, labels.deposit_cash, labels.deposit_balance],
  ]
  for (const currency of ['USD', 'DOP'] as const) {
    const total = statement.totals[currency]
    if (total) rows.push([currency, total.income, total.expenses, total.net, total.deposit_cash, total.deposit_balance])
  }
  rows.push([], [labels.title, labels.date, labels.direction, labels.category, labels.currency, labels.amount, labels.reference, labels.lease, labels.rent_period])
  for (const row of statement.entries) rows.push([row.title, dataText(row.data, 'transaction_date'), dataText(row.data, 'direction'), dataText(row.data, 'category'), dataText(row.data, 'currency'), dataText(row.data, 'amount'), dataText(row.data, 'reference'), dataText(row.data, 'lease_id'), dataText(row.data, 'rent_period')])
  return '\uFEFF' + rows.map(row => row.map(safeCsvCell).join(',')).join('\r\n')
}
