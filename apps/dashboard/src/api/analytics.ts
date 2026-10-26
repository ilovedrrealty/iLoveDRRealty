import client from './axios'

export type AnalyticsDays = 7 | 30 | 90
export const ANALYTICS_BUCKET_KEYS = {
  roles: ['buyer', 'owner', 'realtor', 'admin', 'other'],
  listingStatuses: ['active', 'pending_approval', 'draft', 'rejected', 'archived', 'other'],
  purposes: ['sale', 'rent', 'both', 'other'],
  propertyTypes: ['villa', 'apartment', 'condo', 'land', 'commercial', 'other'],
  leadStatuses: ['new', 'assigned', 'contacted', 'closed', 'other'],
  leadTypes: ['buyer_interest', 'seller_interest', 'rental_interest', 'property_inquiry', 'booking', 'other'],
  bookingStatuses: ['pending', 'confirmed', 'cancelled', 'other'],
} as const
export type AnalyticsDay = { date: string; accounts_created: number; inquiries_received: number; booking_records_created: number }
export type AdminAnalytics = {
  generated_at: string
  window: { days: AnalyticsDays; start_at: string; end_at: string; timezone: 'UTC' }
  snapshot: {
    accounts: number; active_accounts: number; accounts_by_role: Record<string, number>
    listing_records: number; active_listings: number; listings_by_status: Record<string, number>
    active_listings_by_purpose: Record<string, number>; active_listings_by_type: Record<string, number>
  }
  period: {
    accounts_created: number; listings_created: number
    inquiries: {
      received: number; excluded_internal_tests: number; unknown_tracking: number
      contact_recorded: number; crm_linked: number; crm_errors: number
      by_type: Record<string, number>; current_status: Record<string, number>
    }
    booking_records_created: number; booking_current_status: Record<string, number>
  }
  daily: AnalyticsDay[]
  financial_values_reported: false
  definitions_version: 1
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function count(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}
function counts(value: unknown, keys: readonly string[]): value is Record<string, number> {
  return record(value) && keys.every(key => count(value[key]))
}
function sum(values: Record<string, number>, keys: readonly string[]) {
  return keys.reduce((total, key) => total + values[key], 0)
}
function validTime(value: unknown): value is string {
  return typeof value === 'string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value))
}

// Missing/inconsistent metrics are an unavailable report, never invented zeroes.
export function isAdminAnalytics(value: unknown, days: AnalyticsDays): value is AdminAnalytics {
  if (!record(value) || !record(value.window) || !record(value.snapshot) || !record(value.period)) return false
  const { window, snapshot, period } = value
  const inquiry = period.inquiries
  if (!record(inquiry) || !validTime(value.generated_at) || !validTime(window.start_at) || !validTime(window.end_at)
    || window.days !== days || window.timezone !== 'UTC' || Date.parse(window.start_at) > Date.parse(window.end_at)
    || value.financial_values_reported !== false || value.definitions_version !== 1) return false
  if (!['accounts', 'active_accounts', 'listing_records', 'active_listings'].every(key => count(snapshot[key]))
    || !['accounts_created', 'listings_created', 'booking_records_created'].every(key => count(period[key]))
    || !['received', 'excluded_internal_tests', 'unknown_tracking', 'contact_recorded', 'crm_linked', 'crm_errors'].every(key => count(inquiry[key]))) return false
  const buckets: [unknown, readonly string[], unknown][] = [
    [snapshot.accounts_by_role, ANALYTICS_BUCKET_KEYS.roles, snapshot.accounts],
    [snapshot.listings_by_status, ANALYTICS_BUCKET_KEYS.listingStatuses, snapshot.listing_records],
    [snapshot.active_listings_by_purpose, ANALYTICS_BUCKET_KEYS.purposes, snapshot.active_listings],
    [snapshot.active_listings_by_type, ANALYTICS_BUCKET_KEYS.propertyTypes, snapshot.active_listings],
    [inquiry.current_status, ANALYTICS_BUCKET_KEYS.leadStatuses, inquiry.received],
    [inquiry.by_type, ANALYTICS_BUCKET_KEYS.leadTypes, inquiry.received],
    [period.booking_current_status, ANALYTICS_BUCKET_KEYS.bookingStatuses, period.booking_records_created],
  ]
  if (!buckets.every(([values, keys, total]) => counts(values, keys) && sum(values, keys) === total)) return false
  if ((snapshot.active_accounts as number) > (snapshot.accounts as number) || (snapshot.active_listings as number) > (snapshot.listing_records as number)
    || ['unknown_tracking', 'contact_recorded', 'crm_linked', 'crm_errors'].some(key => (inquiry[key] as number) > (inquiry.received as number))) return false
  if (!Array.isArray(value.daily) || value.daily.length !== days) return false
  const firstDay = new Date(window.start_at).toISOString().slice(0, 10)
  const firstTimestamp = Date.parse(`${firstDay}T00:00:00Z`)
  const lastDayTimestamp = firstTimestamp + (days - 1) * 86_400_000
  if (Date.parse(window.start_at) !== firstTimestamp || Date.parse(window.end_at) < lastDayTimestamp
    || Date.parse(window.end_at) >= lastDayTimestamp + 86_400_000
    || Date.parse(value.generated_at) !== Date.parse(window.end_at)) return false
  for (let index = 0; index < days; index += 1) {
    const day: unknown = value.daily[index]
    const expected = new Date(Date.parse(`${firstDay}T00:00:00Z`) + index * 86_400_000).toISOString().slice(0, 10)
    if (!record(day) || day.date !== expected || !['accounts_created', 'inquiries_received', 'booking_records_created'].every(key => count(day[key]))) return false
  }
  const daily = value.daily as AnalyticsDay[]
  return daily.reduce((n, day) => n + day.accounts_created, 0) === period.accounts_created
    && daily.reduce((n, day) => n + day.inquiries_received, 0) === inquiry.received
    && daily.reduce((n, day) => n + day.booking_records_created, 0) === period.booking_records_created
}

export async function getAdminAnalytics(days: AnalyticsDays, signal?: AbortSignal): Promise<AdminAnalytics> {
  const data: unknown = (await client.get<unknown>('/admin/analytics', { params: { days }, signal })).data
  if (!isAdminAnalytics(data, days)) throw new Error('Analytics response is unavailable')
  return data
}
