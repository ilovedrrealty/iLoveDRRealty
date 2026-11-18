import client from './axios'

export type LocationStatus = 'unreviewed' | 'needs_review' | 'verified'
export type LocationPrecision = 'exact' | 'area' | 'hidden'
export type LocationReviewFilter = 'all' | 'missing' | 'unreviewed' | 'needs_review' | 'verified' | 'private'
export type LocationListingStatus = 'active' | 'pending_approval' | 'draft' | 'rejected' | 'archived' | 'all'
export type LocationSource = 'owner_confirmation' | 'partner_record' | 'site_visit' | 'property_document' | 'map_destination'
export type LocationReviewQuery = { listing_status: LocationListingStatus; q?: string }
export type LocationSummary = { total: number; coordinate_available: number; missing_coordinates: number; verified: number; unreviewed: number; needs_review: number; public_mapped: number; private_positions: number; with_source_reference: number }
export type LocationRow = { listing_id: string; title: string; location: string; source_ref: string | null; listing_status: LocationListingStatus; listing_updated_at: string; version: number; review_status: LocationStatus; public_precision: LocationPrecision; has_coordinates: boolean; public_mapped: boolean; projection_mismatch: boolean; reviewed_at: string | null }
export type LocationDetail = LocationRow & { latitude: string | null; longitude: string | null; maps_url: string | null; source_type: string | null; source_reference: string; review_note: string; reviewed_by: string | null; history: { version: number; action: string; created_at: string }[] }
export type SaveLocation = { expected_version: number; expected_listing_updated_at: string; latitude: string | null; longitude: string | null; maps_url: string | null; review_status: LocationStatus; public_precision: LocationPrecision; source_type: LocationSource | null; source_reference: string; review_note: string; confirmed_property: boolean }
export type LocationPage = { items: LocationRow[]; total: number; limit: number; offset: number }

export async function getLocationSummary(query: LocationReviewQuery, signal?: AbortSignal) {
  return (await client.get<LocationSummary>('/admin/location-review/summary', { params: query, signal })).data
}
export async function getLocationQueue(query: LocationReviewQuery & { review_filter: LocationReviewFilter; offset: number; limit: number }, signal?: AbortSignal) {
  return (await client.get<LocationPage>('/admin/location-review', { params: query, signal })).data
}
export async function getLocationReview(id: string, signal?: AbortSignal) {
  return (await client.get<LocationDetail>(`/admin/location-review/${encodeURIComponent(id)}`, { signal })).data
}
export async function saveLocationReview(id: string, body: SaveLocation) {
  return (await client.patch<LocationDetail>(`/admin/location-review/${encodeURIComponent(id)}`, body)).data
}
export async function downloadLocationWorksheet(query: LocationReviewQuery) {
  const response = await client.get<Blob>('/admin/location-review/request-worksheet', { params: query, responseType: 'blob' })
  const url = URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = url; link.download = 'property-location-request.csv'; link.click()
  URL.revokeObjectURL(url)
}

export function safeLocationMapUrl(value: string): boolean {
  try {
    const url = new URL(value)
    const path = decodeURIComponent(url.pathname).toLowerCase()
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || value.length > 2048 || /[\s\\\u0000-\u001f\u007f]/.test(value)) return false
    if (path.split('/').some(part => part === '.' || part === '..') || path === '/maps/api' || path.startsWith('/maps/api/')) return false
    for (const key of url.searchParams.keys()) if (['key', 'api_key', 'access_token', 'token'].includes(key.trim().toLowerCase())) return false
    if (['google.com', 'www.google.com'].includes(url.hostname)) return url.pathname === '/maps' || url.pathname.startsWith('/maps/')
    if (url.hostname === 'maps.google.com') return ['', '/', '/maps'].includes(url.pathname) || url.pathname.startsWith('/maps/')
    if (url.hostname === 'maps.app.goo.gl') return !!url.pathname.split('/').join('')
    return url.hostname === 'goo.gl' && url.pathname.startsWith('/maps/') && !!url.pathname.slice(6).split('/').join('')
  } catch { return false }
}

export function locationDestinationCandidate(value: string): { latitude: string; longitude: string } | null {
  if (!safeLocationMapUrl(value)) return null
  const url = new URL(value)
  const pair = (latitude: string, longitude: string) => {
    const lat = Number(latitude), lng = Number(longitude)
    return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
      ? { latitude: lat.toFixed(7), longitude: lng.toFixed(7) } : null
  }
  const candidates: { latitude: string; longitude: string }[] = []
  for (const key of ['query', 'q', 'destination']) for (const query of url.searchParams.getAll(key)) {
    const match = query.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/)
    if (match) { const candidate = pair(match[1], match[2]); if (candidate) candidates.push(candidate) }
  }
  const pattern = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(value))) { const candidate = pair(match[1], match[2]); if (candidate) candidates.push(candidate) }
  return candidates.length && new Set(candidates.map(candidate => `${candidate.latitude},${candidate.longitude}`)).size === 1 ? candidates[0] : null
}
