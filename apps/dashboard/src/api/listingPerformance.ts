import { isAxiosError } from 'axios'
import client from './axios'
import { todayInDR, validCalendarDate } from './propertyManagement'

export type PerformanceCoverage = 'complete' | 'partial' | 'unavailable'
export const PERFORMANCE_ENTRY_KINDS = ['completed_showing', 'owner_feedback', 'marketing_update'] as const
export type PerformanceEntryKind = typeof PERFORMANCE_ENTRY_KINDS[number]
export type PerformanceRange = { start: string; end: string }
export type PerformanceEntry = { id: string; kind: PerformanceEntryKind; occurred_on: string; text: string | null }
export type PerformanceMilestone = {
  kind: 'submitted' | 'approved' | 'archived' | 'rejected' | 'edit_approved'
  occurred_on: string
}
export type ListingPerformance = {
  listing_id: string
  title: string
  status: string
  can_record: boolean
  range: PerformanceRange & { time_zone: 'America/Santo_Domingo' }
  views: {
    lifetime: number
    range_total: number | null
    tracked_from: string | null
    coverage: PerformanceCoverage
    days: Array<{ date: string; count: number | null; coverage: PerformanceCoverage }>
  }
  totals: { property_inquiries: number; confirmed_viewings: number; recorded_completed_showings: number }
  milestones: PerformanceMilestone[]
  entries: PerformanceEntry[]
  milestones_truncated: boolean
  entries_truncated: boolean
}
export type PerformanceEntryFields = {
  kind: PerformanceEntryKind
  date: string
  note: string
  sharingConfirmed: boolean
}
export type PerformanceEntryInput = { request_id: string; occurred_on: string } & (
  { kind: 'completed_showing' } | { kind: 'owner_feedback' | 'marketing_update'; text: string; share_with_owner: true }
)

const day = 86_400_000
const reportPath = (id: string) => `/listings/${encodeURIComponent(id)}/performance`

export function initialPerformanceRange(now = new Date()): PerformanceRange {
  const end = todayInDR(now)
  const start = new Date(Date.parse(end) - 29 * day).toISOString().slice(0, 10)
  return { start, end }
}

export function validPerformanceRange({ start, end }: PerformanceRange, today = todayInDR()): boolean {
  return validCalendarDate(start) && validCalendarDate(end) && start <= end
    && Date.parse(end) - Date.parse(start) < 366 * day
    && Date.parse(end) - Date.parse(today) <= 366 * day
}

export function preparePerformanceEntry(fields: PerformanceEntryFields, requestId: string, today = todayInDR()): PerformanceEntryInput | null {
  if (!validCalendarDate(fields.date) || fields.date > today) return null
  const common = { request_id: requestId, occurred_on: fields.date }
  if (fields.kind === 'completed_showing') return { ...common, kind: fields.kind }
  const text = fields.note.trim()
  if (!fields.sharingConfirmed || !text || text.length > 1000) return null
  return { ...common, kind: fields.kind, text, share_with_owner: true }
}

export function performanceHttpStatus(error: unknown): number | undefined {
  return isAxiosError(error) ? error.response?.status : undefined
}

export function performanceAccessDenied(error: unknown): boolean {
  const status = performanceHttpStatus(error)
  return status === 401 || status === 403 || status === 404
}

export async function getListingPerformance(id: string, range: PerformanceRange, signal: AbortSignal): Promise<ListingPerformance> {
  const { data } = await client.get<ListingPerformance>(reportPath(id), { params: range, signal })
  return data
}

export async function recordListingPerformance(id: string, entry: PerformanceEntryInput, signal: AbortSignal): Promise<PerformanceEntry> {
  const { data } = await client.post<PerformanceEntry>(`${reportPath(id)}/entries`, entry, { signal })
  return data
}
