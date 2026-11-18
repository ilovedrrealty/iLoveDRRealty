import client from './axios'
import type { ViewingShortlistSource } from '../../../../packages/dashboard-links'

export const SHORTLIST_LIMIT = 20
export const SHORTLIST_TITLE_LIMIT = 100
export const SHORTLIST_TEXT_LIMIT = 2000
export const SHORTLIST_EXPIRIES = [7, 30, 90] as const
export type ShortlistView = 'owned' | 'received'
export type ShortlistExpiry = typeof SHORTLIST_EXPIRIES[number]
export type ShareState = 'active' | 'expired' | 'revoked' | 'unavailable'
export type ShortlistListing = { id: string; title: string; location: string; transaction: 'sale' | 'rent' | 'both' }
export type ShortlistFields = { title: string; shared_notes: string; shared_preferences: string }
export type ShortlistWrite = ShortlistFields & { listing_ids?: string[] }
export type ShortlistSummary = { id: string; title: string; expires_at: string | null }
export type ShortlistShare = { id: string; recipient_user_code: number; expires_at: string; state: ShareState }
export type ShortlistDetail = ShortlistFields & { id: string; version: number; items: ShortlistListing[] }
export type OwnedShortlist = ShortlistDetail & { share: ShortlistShare | null }
export type ReceivedShortlist = ShortlistDetail & { expires_at: string }

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i
const OFFSET_SUFFIX = /(?:Z|[+-]\d{2}:\d{2})$/
const HEADER = 'cache-control'

export function shortlistId(value: unknown): string | null {
  return typeof value === 'string' && UUID.test(value) ? value.toLowerCase() : null
}

export function shortlistMemberCode(value: string): number | null {
  const raw = value.trim()
  if (!/^#?\d{1,10}$/.test(raw)) return null
  const code = Number(raw.replace(/^#/, ''))
  return code > 0 && code <= 2_147_483_647 ? code : null
}

export function shortlistExpiryAt(value: unknown): number {
  return typeof value === 'string' && OFFSET_SUFFIX.test(value) ? Date.parse(value) : NaN
}

export function shortlistShareUrl(origin: string, grantId: string): string {
  const grant = shortlistId(grantId)
  if (!grant) throw new Error('Invalid shortlist grant')
  const url = new URL('/shortlists', origin)
  url.searchParams.set('grant', grant)
  return url.href
}

export function prepareShortlist(fields: ShortlistFields, listingIds?: string[]): ShortlistWrite | null {
  const title = fields.title.trim()
  const shared_notes = fields.shared_notes.trim()
  const shared_preferences = fields.shared_preferences.trim()
  if (!title || [...title].length > SHORTLIST_TITLE_LIMIT
    || [shared_notes, shared_preferences].some(value => [...value].length > SHORTLIST_TEXT_LIMIT)) return null
  if (listingIds && (listingIds.length > SHORTLIST_LIMIT || new Set(listingIds).size !== listingIds.length
    || listingIds.some(id => shortlistId(id) !== id))) return null
  return { title, shared_notes, shared_preferences, ...(listingIds ? { listing_ids: listingIds } : {}) }
}

function denied(): never { throw new Error('Invalid shortlist response') }
function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || !value || Array.isArray(value)) return denied()
  return value as Record<string, unknown>
}
function text(value: unknown): string { return typeof value === 'string' ? value : denied() }
function idValue(value: unknown): string { return shortlistId(value) ?? denied() }
function timestamp(value: unknown): string { return Number.isFinite(shortlistExpiryAt(value)) ? text(value) : denied() }
function version(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : denied()
}

function listing(value: unknown): ShortlistListing {
  const row = record(value)
  const { transaction } = row
  if (transaction !== 'sale' && transaction !== 'rent' && transaction !== 'both') return denied()
  return { id: idValue(row.id), title: text(row.title), location: text(row.location), transaction }
}

function detail(value: unknown, expectedId?: string): ShortlistDetail {
  const row = record(value)
  const id = idValue(row.id)
  const revision = version(row.version)
  if (revision === 0 || revision > 2_147_483_647) return denied()
  if ((expectedId && id !== expectedId) || !Array.isArray(row.items) || row.items.length > SHORTLIST_LIMIT) return denied()
  const items = row.items.map(listing)
  if (new Set(items.map(item => item.id)).size !== items.length) return denied()
  return { id, version: revision, title: text(row.title), shared_notes: text(row.shared_notes),
    shared_preferences: text(row.shared_preferences), items }
}

function owned(value: unknown, expectedId?: string): OwnedShortlist {
  const result = detail(value, expectedId)
  const row = record(value)
  if (row.share === null) return { ...result, share: null }
  const { id, recipient_user_code, expires_at, state } = record(row.share)
  if (state !== 'active' && state !== 'expired' && state !== 'revoked' && state !== 'unavailable') return denied()
  if (typeof recipient_user_code !== 'number' || shortlistMemberCode(String(recipient_user_code)) !== recipient_user_code) return denied()
  return { ...result, share: { id: idValue(id), recipient_user_code, expires_at: timestamp(expires_at), state } }
}

function received(value: unknown, expectedId: string): ReceivedShortlist {
  const expires_at = timestamp(record(value).expires_at)
  return { ...detail(value, expectedId), expires_at }
}

function privateData(response: { data: unknown; headers: { [name: string]: unknown } }): unknown {
  const cache = response.headers[HEADER]
  if (typeof cache !== 'string' || !cache.toLowerCase().split(',').some(directive => directive.trim() === 'no-store')) return denied()
  return response.data
}

export async function listShortlists(view: ShortlistView, signal: AbortSignal): Promise<ShortlistSummary[]> {
  const response = await client.get(`/shortlists/${view}`, { signal })
  const { items } = record(privateData(response))
  if (!Array.isArray(items)) return denied()
  return items.map(value => {
    const { id, title, expires_at } = record(value)
    if (view === 'received' && expires_at === null) return denied()
    return { id: idValue(id), title: text(title), expires_at: expires_at === null ? null : timestamp(expires_at) }
  })
}

export async function createShortlist(input: ShortlistWrite): Promise<OwnedShortlist> {
  return owned(privateData(await client.post('/shortlists/owned', input)))
}

export async function readOwnedShortlist(id: string, signal: AbortSignal): Promise<OwnedShortlist> {
  return owned(privateData(await client.get(`/shortlists/owned/${idValue(id)}`, { signal })), id)
}

export async function readReceivedShortlist(id: string, signal: AbortSignal): Promise<ReceivedShortlist> {
  return received(privateData(await client.get(`/shortlists/received/${idValue(id)}`, { signal })), id)
}

export async function readViewingShortlist({ id, scope }: ViewingShortlistSource, signal: AbortSignal) {
  if (scope === 'owned') {
    const { items } = await readOwnedShortlist(id, signal)
    return { items }
  }
  const { items, expires_at } = await readReceivedShortlist(id, signal)
  return { items, expires_at }
}

export async function editOwnedShortlist(id: string, expectedVersion: number, input: ShortlistWrite): Promise<OwnedShortlist> {
  return owned(privateData(await client.put(`/shortlists/owned/${idValue(id)}`, { ...input, expected_version: expectedVersion })), id)
}

export async function editReceivedShortlist(id: string, expectedVersion: number, input: ShortlistWrite): Promise<ReceivedShortlist> {
  return received(privateData(await client.put(`/shortlists/received/${idValue(id)}`, { ...input, expected_version: expectedVersion })), id)
}

export async function shareShortlist(id: string, code: number, duration: ShortlistExpiry): Promise<OwnedShortlist> {
  return owned(privateData(await client.post(`/shortlists/owned/${idValue(id)}/share`, {
    recipient_user_code: code, expires_in_days: duration,
  })), id)
}

export async function revokeShortlist(id: string, grantId: string): Promise<OwnedShortlist> {
  return owned(privateData(await client.post(`/shortlists/owned/${idValue(id)}/shares/${idValue(grantId)}/revoke`, {})), id)
}

export async function archiveShortlist(id: string, expectedVersion: number): Promise<void> {
  const response = await client.post(`/shortlists/owned/${idValue(id)}/archive`, { expected_version: expectedVersion })
  if (response.status !== 204) return denied()
  privateData(response)
}

export async function shortlistCatalog(page: number, signal: AbortSignal): Promise<{ items: ShortlistListing[]; total: number }> {
  const response = await client.get('/listings', { signal, params: { page, page_size: SHORTLIST_LIMIT, include_aggregates: false } })
  const { items, total } = record(response.data)
  if (!Array.isArray(items)) return denied()
  return { items: items.map(listing), total: version(total) }
}
