import client from './axios'
import { santoDomingoVisitStart } from './serviceWork'

export const VIEWING_ZONE = 'America/Santo_Domingo'
export const VIEWING_DURATION_MINUTES = 30
export const VIEWING_STOP_LIMIT = 6
export const VIEWING_PAGE_SIZE = 30
export type ViewingMode = 'in_person' | 'virtual'
export type ViewingStatus = 'requested' | 'proposed' | 'confirmed' | 'declined' | 'cancelled' | 'unavailable'
export type ViewingAction = 'propose' | 'confirm' | 'accept' | 'decline' | 'cancel'
export type ViewingProperty = { id: string; title: string; location: string }
export type ViewingContact = { listing: ViewingProperty; agent_name: string | null; scheduling_url: string | null }
export type Viewing = ViewingContact & {
  id: string; version: number; status: ViewingStatus; mode: ViewingMode; starts_at: string;
  timezone: typeof VIEWING_ZONE; attendee_name: string | null; note: string;
  meeting_details: string | null; meeting_url: string | null;
}
export type ViewingItinerary = { id: string; title: string; items: Viewing[] }
export type ViewingDraft = { listing_id: string; mode: ViewingMode; local_start: string; note: string }
type ViewingWrite = { listing_id: string; mode: ViewingMode; starts_at: string; note: string }
type CreateViewing = { request_id: string; title: string; stops: ViewingWrite[] }
type UpdateViewing = { expected_version: number; action: ViewingAction; starts_at?: string;
  meeting_details?: string; meeting_url?: string; availability_checked?: true }

export function viewingId(value: unknown): string | null {
  return typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value) ? value.toLowerCase() : null
}

export function viewingTime(value: string, now = Date.now()): string | null {
  const parsed = santoDomingoVisitStart(value)
  return parsed && Date.parse(parsed) > now ? parsed : null
}

export function prepareViewingStops(drafts: ViewingDraft[], now = Date.now()): ViewingWrite[] | null {
  if (!drafts.length || drafts.length > VIEWING_STOP_LIMIT || new Set(drafts.map(draft => draft.listing_id)).size !== drafts.length) return null
  const stops: ViewingWrite[] = []
  for (const draft of drafts) {
    const starts_at = viewingTime(draft.local_start, now)
    if (!starts_at || !viewingId(draft.listing_id) || (draft.mode !== 'virtual' && draft.mode !== 'in_person')) return null
    stops.push({ listing_id: draft.listing_id, mode: draft.mode, starts_at, note: draft.note.trim() })
  }
  return stops
}

function httpsUrl(value: string): URL | null {
  if (!value || value.length > 600 || /[^!-~]|\\|#/.test(value)) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && !url.port ? url : null
  } catch { return null }
}

export function viewingMeetingUrl(value: string): string | null {
  const raw = value.trim()
  const url = httpsUrl(raw)
  if (!url) return null
  const { hostname, pathname } = url
  if (hostname === 'meet.google.com' && /^\/[a-z]{3}-[a-z]{4}-[a-z]{3}\/?$/.test(pathname)) return raw
  if ((hostname === 'zoom.us' || hostname.endsWith('.zoom.us')) && /^\/(?:j\/\d+|my\/[\w.-]+)\/?$/.test(pathname)) return raw
  if (['teams.microsoft.com', 'teams.live.com'].includes(hostname)
    && (pathname.startsWith('/l/meetup-join/') || /^\/meet\/[^/]+\/?$/.test(pathname))) return raw
  return null
}

export function viewingSchedulingUrl(value: string | null): string | null {
  const url = value && httpsUrl(value)
  if (!url) return null
  const { hostname, pathname } = url
  if (['calendly.com', 'www.calendly.com', 'calendar.app.google'].includes(hostname) && pathname.replaceAll('/', '')) return value
  return hostname === 'calendar.google.com' && /^\/calendar\/(?:u\/\d+\/)?appointments\/schedules\/[^/]+\/?$/.test(pathname) ? value : null
}

export function viewingActions(status: ViewingStatus, assigned: boolean): ViewingAction[] {
  if (status === 'requested') return assigned ? ['confirm', 'propose', 'decline', 'cancel'] : ['cancel']
  if (status === 'proposed') return assigned ? ['propose', 'decline', 'cancel'] : ['accept', 'decline', 'cancel']
  return status === 'confirmed' ? ['cancel'] : []
}

function requiredId(value: unknown) {
  const id = viewingId(value)
  if (!id) throw new Error('Invalid viewing ID')
  return id
}

function privateData<T>(response: { data: T; headers: { [name: string]: unknown } }): T {
  const cache = response.headers['cache-control']
  if (typeof cache !== 'string' || !cache.toLowerCase().split(',').some(directive => directive.trim() === 'no-store')) {
    throw new Error('Invalid private viewing response')
  }
  return response.data
}

function boundViewing(row: Viewing, expectedId?: string): Viewing {
  if (!row || !viewingId(row.id) || expectedId && row.id !== expectedId || row.timezone !== VIEWING_ZONE
    || !Number.isSafeInteger(row.version) || row.version < 1
    || row.mode !== 'in_person' && row.mode !== 'virtual'
    || !['requested', 'proposed', 'confirmed', 'declined', 'cancelled', 'unavailable'].includes(row.status)
    || typeof row.starts_at !== 'string' || !/(?:Z|[+-]\d{2}:\d{2})$/.test(row.starts_at) || !Number.isFinite(Date.parse(row.starts_at))
    || !row.listing || !viewingId(row.listing.id)) throw new Error('Invalid viewing response')
  return row
}

function itinerary(row: ViewingItinerary): ViewingItinerary {
  if (!row || !viewingId(row.id) || !Array.isArray(row.items) || row.items.length > VIEWING_STOP_LIMIT) {
    throw new Error('Invalid viewing itinerary')
  }
  return { ...row, items: row.items.map(item => boundViewing(item)) }
}

export async function getMyViewings(page: number, signal: AbortSignal): Promise<ViewingItinerary[]> {
  const response = await client.get<{ items: ViewingItinerary[] }>('/viewings/mine', { signal, params: { page, page_size: VIEWING_PAGE_SIZE } })
  return privateData(response).items.map(itinerary)
}

export async function getAssignedViewings(page: number, signal: AbortSignal): Promise<Viewing[]> {
  const response = await client.get<{ items: Viewing[] }>('/viewings/assigned', { signal, params: { page, page_size: VIEWING_PAGE_SIZE } })
  return privateData(response).items.map(item => boundViewing(item))
}

export async function getViewingContact(listingId: string, signal: AbortSignal): Promise<ViewingContact> {
  const id = requiredId(listingId)
  const response = await client.get<ViewingContact>(`/viewings/contact/${id}`, { signal })
  const contact = privateData(response)
  if (contact.listing?.id !== id) throw new Error('Unexpected viewing property')
  return contact
}

export async function submitViewing(input: CreateViewing): Promise<ViewingItinerary> {
  return itinerary(privateData(await client.post<ViewingItinerary>('/viewings', input)))
}

export async function updateViewing(id: string, input: UpdateViewing): Promise<Viewing> {
  const stop = requiredId(id)
  const response = await client.post<Viewing>(`/viewings/${stop}/action`, input)
  return boundViewing(privateData(response), stop)
}
