import client from './axios'

export const TRADE_CONTACT_BATCH_LIMIT = 250
export const TRADE_CONTACT_FILE_LIMIT = 512 * 1024
export const TRADE_CONTACT_PAGE_SIZE = 50
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
export type TradeContactFilters = { q: string; category: string; province: string }

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
      limit: TRADE_CONTACT_PAGE_SIZE, offset,
    },
    signal,
  })
  return data
}

export async function importTradeContacts(entries: TradeContactEntry[], dryRun: boolean) {
  const { data } = await client.post<TradeContactImport>('/admin/trade-contacts/import', { dry_run: dryRun, entries })
  return data
}
