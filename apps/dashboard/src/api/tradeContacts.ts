import client from './axios'
import type { DirectoryLocationFilters } from './directoryMaps'

export const TRADE_CONTACT_BATCH_LIMIT = 250
export const TRADE_CONTACT_FILE_LIMIT = 512 * 1024
export const TRADE_CONTACT_PAGE_SIZE = 50
export const tradeContactFilterLimits = { q: 160, category: 160, subtype: 160, province: 160, locality: 160, service_area: 320 } as const
export const tradeVerificationStatuses = ['owner_source', 'public_source', 'official_registry'] as const
export type TradeVerificationStatus = typeof tradeVerificationStatuses[number]

export const requiredTradeContactFields = ['name', 'category', 'source_authority', 'source_url', 'verified_on'] as const
export const optionalTradeContactFields = [
  'subtype', 'province', 'locality', 'service_area', 'contact_name', 'contact_title',
  'phone', 'email', 'website', 'address', 'postal_code', 'external_id',
] as const

type RequiredTradeContactField = typeof requiredTradeContactFields[number]
type OptionalTradeContactField = typeof optionalTradeContactFields[number]

export type TradeContactEntry = Record<RequiredTradeContactField, string>
  & Partial<Record<OptionalTradeContactField, string | null>>
  & { verification_status: TradeVerificationStatus; source_details?: Record<string, string> | null }

export type TradeContact = TradeContactEntry & { id: string; source_count?: number }
export type TradeContactPage = { items: TradeContact[]; total: number }
export type TradeContactImport = { inserted: number; updated: number; unchanged: number }
export type TradeContactFilters = DirectoryLocationFilters & { q: string; category: string; province: string; locality: string;
  subtype?: string; service_area?: string;
  verification_status: '' | TradeVerificationStatus; contact_channel: '' | 'phone' | 'email' | 'website' | 'no_contact' }
export type TradeContactOptions = { categories: string[]; provinces: string[]; localities: string[]; subtypes: string[]; service_areas: string[] }
export type TradeContactTable = { columns: string[]; rows: { row_number: number; values: string[] }[];
  file_sha256: string; sheets: string[]; sheet: string | null; suggested_mapping: Record<string, number> }
export type TradeContactIssue = { row: number; field: string; code: 'required' | 'invalid' | 'note_limit' }
export type TradeContactPreview = { entries: TradeContactEntry[]; issues: TradeContactIssue[];
  issue_count: number; result: TradeContactImport | null; preserve_source_details: true }

const inputFields = new Set<string>([
  ...requiredTradeContactFields, ...optionalTradeContactFields, 'verification_status', 'source_details',
])

export function httpsTradeContactLink(value: string | null | undefined) {
  if (!value) return undefined
  try {
    const url = new URL(value)
    if (url.protocol === 'https:' && !url.username && !url.password) return url.href
  } catch {
    return undefined
  }
  return undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isVerificationStatus(value: unknown): value is TradeVerificationStatus {
  return tradeVerificationStatuses.some(status => status === value)
}

export function readTradeContact(value: unknown): TradeContactEntry | null {
  if (!isRecord(value) || Object.keys(value).some(key => !inputFields.has(key))) return null
  const { name, category, source_authority, source_url, verified_on, verification_status, source_details } = value
  if (typeof name !== 'string' || !name.trim() || typeof category !== 'string' || !category.trim()
    || typeof source_authority !== 'string' || !source_authority.trim()
    || typeof source_url !== 'string' || !httpsTradeContactLink(source_url.trim())
    || typeof verified_on !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(verified_on)
    || !isVerificationStatus(verification_status)) return null

  const entry: TradeContactEntry = {
    name: name.trim(), category: category.trim(), source_authority: source_authority.trim(),
    source_url: source_url.trim(), verified_on, verification_status,
  }
  for (const field of optionalTradeContactFields) {
    const raw = value[field]
    if (raw == null) continue
    if (typeof raw !== 'string') return null
    if (raw.trim()) entry[field] = raw.trim()
  }
  if (source_details != null) {
    if (!isRecord(source_details)) return null
    const details = Object.entries(source_details)
    if (details.some(([, detail]) => typeof detail !== 'string')) return null
    entry.source_details = Object.fromEntries(details) as Record<string, string>
  }
  return entry
}

type TradeContactFile = { entries: TradeContactEntry[] } | { error: 'invalid_file' | 'too_many_rows' | 'invalid_row'; row?: number }

export function readTradeContactFile(text: string): TradeContactFile {
  let parsed: unknown
  try {
    parsed = JSON.parse(text.replace(/^\uFEFF/, ''))
  } catch {
    return { error: 'invalid_file' }
  }
  const rows = isRecord(parsed) ? parsed.entries : parsed
  if (!Array.isArray(rows) || !rows.length) return { error: 'invalid_file' }
  if (rows.length > TRADE_CONTACT_BATCH_LIMIT) return { error: 'too_many_rows' }
  const entries: TradeContactEntry[] = []
  for (const [index, row] of rows.entries()) {
    const entry = readTradeContact(row)
    if (!entry) return { error: 'invalid_row', row: index + 1 }
    entries.push(entry)
  }
  return { entries }
}

export async function listTradeContacts(filters: TradeContactFilters, offset: number, signal?: AbortSignal) {
  const { data } = await client.get<TradeContactPage>('/admin/trade-contacts', {
    params: {
      q: filters.q || undefined, category: filters.category || undefined, province: filters.province || undefined,
      locality: filters.locality || undefined, verification_status: filters.verification_status || undefined,
      contact_channel: filters.contact_channel || undefined,
      subtype: filters.subtype || undefined, service_area: filters.service_area || undefined,
      map_area: filters.map_area || undefined,
      location_status: filters.location_status && filters.location_status !== 'all' ? filters.location_status : undefined,
      limit: TRADE_CONTACT_PAGE_SIZE, offset,
    },
    signal,
  })
  return data
}

export async function importTradeContacts(entries: TradeContactEntry[], dryRun: boolean, preserveSourceDetails = false) {
  const body = { dry_run: dryRun, entries, ...(preserveSourceDetails ? { preserve_source_details: true } : {}) }
  const { data } = await client.post<TradeContactImport>('/admin/trade-contacts/import', body)
  return data
}

export async function getTradeContactOptions(signal?: AbortSignal) {
  return (await client.get<TradeContactOptions>('/admin/trade-contacts/options', { signal })).data
}

export async function getTradeContact(id: string, signal?: AbortSignal) {
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) throw new Error('Invalid contact identifier')
  return (await client.get<TradeContact>(`/admin/trade-contacts/${id.toLowerCase()}`, { signal })).data
}

export async function analyzeTradeContactFile(file: File, sheet?: string, delimiter = 'auto', signal?: AbortSignal) {
  const data = new FormData()
  data.append('file', file)
  if (sheet) data.append('sheet', sheet)
  data.append('delimiter', delimiter)
  return (await client.post<TradeContactTable>('/admin/trade-contacts/preview-file', data, { signal, timeout: 15000 })).data
}

export async function previewTradeContactMapping(table: TradeContactTable, mapping: Record<string, number>,
  defaults: Record<string, string>, signal?: AbortSignal) {
  return (await client.post<TradeContactPreview>('/admin/trade-contacts/preview-mapping', { table, mapping, defaults },
    { signal, timeout: 15000 })).data
}
