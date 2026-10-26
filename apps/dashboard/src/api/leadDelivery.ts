import client from './axios'

export const DELIVERY_STATUSES = ['pending', 'processing', 'retry_wait', 'accepted', 'failed', 'needs_review', 'skipped'] as const
export type DeliveryStatus = typeof DELIVERY_STATUSES[number]
export type DeliveryJob = {
  id: string; lead_id: string; step: string; provider: 'ghl' | 'resend'; status: DeliveryStatus
  attempts: number; max_attempts: number; created_at: string; first_attempt_at: string | null
  last_attempt_at: string | null; next_attempt_at: string; accepted_at: string | null
  error_code: string | null; blocked_by: 'crm_contact' | null; outcome_uncertain: boolean; can_retry: boolean
}
export type DeliverySummary = {
  generated_at: string; enabled: boolean; total_jobs: number; tracked_leads: number
  status_counts: Record<DeliveryStatus, number>
  by_step: { step: string; status: DeliveryStatus; count: number }[]
  worker: { last_poll_at: string | null; last_completed_at: string | null; last_batch_count: number; error_code: string | null }
  note: string
}
export type DeliveryQueue = { total: number; limit: number; offset: number; items: DeliveryJob[] }
export type DeliveryDetail = { lead_id: string; tracked: boolean; enabled: boolean; jobs: DeliveryJob[]; note: string | null }
export type DeliveryFilters = { status?: DeliveryStatus; lead_id?: string; limit?: number; offset?: number }

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function count(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}
export function isDeliveryId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value)
}
function time(value: unknown): value is string {
  return typeof value === 'string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value))
}
function nullableTime(value: unknown): value is string | null { return value === null || time(value) }
function status(value: unknown): value is DeliveryStatus {
  return typeof value === 'string' && (DELIVERY_STATUSES as readonly string[]).includes(value)
}
function step(value: unknown): value is string {
  return typeof value === 'string' && /^(?:crm_(?:contact|tags|note|task)|email_(?:[1-9]|10|configuration))$/.test(value)
}
function safeCode(value: unknown): value is string | null {
  return value === null || typeof value === 'string' && /^[a-z\d_]{1,120}$/.test(value)
}

// An invalid report is unavailable, never a collection of invented zeroes.
export function isDeliveryJob(value: unknown): value is DeliveryJob {
  if (!record(value) || !isDeliveryId(value.id) || !isDeliveryId(value.lead_id) || !step(value.step)
    || !status(value.status) || !['ghl', 'resend'].includes(String(value.provider))
    || !count(value.attempts) || !count(value.max_attempts) || value.max_attempts < 1 || value.max_attempts > 10
    || value.attempts > value.max_attempts || !time(value.created_at) || !time(value.next_attempt_at)
    || !['first_attempt_at', 'last_attempt_at', 'accepted_at'].every(key => nullableTime(value[key]))
    || !safeCode(value.error_code) || ![null, 'crm_contact'].includes(value.blocked_by as string | null)
    || typeof value.outcome_uncertain !== 'boolean' || typeof value.can_retry !== 'boolean') return false
  if ((value.step.startsWith('crm_')) !== (value.provider === 'ghl')) return false
  if (value.status === 'accepted' && (!time(value.accepted_at) || value.attempts < 1 || value.can_retry || value.outcome_uncertain)) return false
  if (value.can_retry && (value.status !== 'failed' || value.outcome_uncertain || value.attempts >= value.max_attempts)) return false
  if (value.blocked_by && !['pending', 'retry_wait'].includes(value.status)) return false
  return !['payload', 'payload_sha256', 'recipient', 'email', 'phone', 'message'].some(key => key in value)
}

export function isDeliverySummary(value: unknown): value is DeliverySummary {
  if (!record(value) || !time(value.generated_at) || typeof value.enabled !== 'boolean'
    || !count(value.total_jobs) || !count(value.tracked_leads) || value.tracked_leads > value.total_jobs
    || !record(value.status_counts) || !record(value.worker) || !Array.isArray(value.by_step)
    || typeof value.note !== 'string') return false
  const counts = value.status_counts
  if (!DELIVERY_STATUSES.every(key => count(counts[key]))
    || DELIVERY_STATUSES.reduce((sum, key) => sum + (counts[key] as number), 0) !== value.total_jobs) return false
  let stepTotal = 0
  const byStatus = Object.fromEntries(DELIVERY_STATUSES.map(key => [key, 0])) as Record<DeliveryStatus, number>
  const keys = new Set<string>()
  for (const bucket of value.by_step) {
    if (!record(bucket) || !step(bucket.step) || !status(bucket.status) || !count(bucket.count)) return false
    const key = `${bucket.step}/${bucket.status}`
    if (keys.has(key)) return false
    keys.add(key); stepTotal += bucket.count; byStatus[bucket.status] += bucket.count
  }
  if (stepTotal !== value.total_jobs || !DELIVERY_STATUSES.every(key => byStatus[key] === counts[key])) return false
  const worker = value.worker
  return nullableTime(worker.last_poll_at) && nullableTime(worker.last_completed_at)
    && count(worker.last_batch_count) && worker.last_batch_count <= 10 && safeCode(worker.error_code)
}

export function isDeliveryQueue(value: unknown, filters: DeliveryFilters): value is DeliveryQueue {
  if (!record(value) || !count(value.total) || value.limit !== (filters.limit ?? 25)
    || value.offset !== (filters.offset ?? 0) || !Array.isArray(value.items)
    || value.items.length > (value.limit as number) || !value.items.every(isDeliveryJob)) return false
  // The bounded result and total can shift during live intake; never invent
  // rows merely to reconcile pagination metadata from separate read statements.
  return new Set(value.items.map(row => row.id)).size === value.items.length
    && value.items.every(row => (!filters.status || row.status === filters.status)
      && (!filters.lead_id || row.lead_id.toLowerCase() === filters.lead_id.toLowerCase()))
}

export async function getDeliverySummary(signal?: AbortSignal): Promise<DeliverySummary> {
  const data: unknown = (await client.get('/admin/leads/delivery-summary', { signal })).data
  if (!isDeliverySummary(data)) throw new Error('Delivery summary unavailable')
  return data
}

export async function getDeliveryQueue(filters: DeliveryFilters, signal?: AbortSignal): Promise<DeliveryQueue> {
  const params = { limit: filters.limit ?? 25, offset: filters.offset ?? 0,
    ...(filters.status ? { status: filters.status } : {}), ...(filters.lead_id ? { lead_id: filters.lead_id.toLowerCase() } : {}) }
  if (!Number.isInteger(params.limit) || params.limit < 1 || params.limit > 100
    || !Number.isInteger(params.offset) || params.offset < 0 || params.offset > 10000
    || filters.status && !status(filters.status) || filters.lead_id && !isDeliveryId(filters.lead_id)) throw new Error('Invalid delivery filters')
  const data: unknown = (await client.get('/admin/lead-deliveries', { params, signal })).data
  if (!isDeliveryQueue(data, filters)) throw new Error('Delivery queue unavailable')
  return data
}

export async function getLeadDelivery(leadId: string, signal?: AbortSignal): Promise<DeliveryDetail> {
  if (!isDeliveryId(leadId)) throw new Error('Invalid lead identifier')
  const data: unknown = (await client.get(`/admin/leads/${leadId.toLowerCase()}/delivery`, { signal })).data
  if (!record(data) || data.lead_id !== leadId.toLowerCase() || typeof data.tracked !== 'boolean'
    || typeof data.enabled !== 'boolean' || !Array.isArray(data.jobs) || !data.jobs.every(isDeliveryJob)
    || data.tracked !== (data.jobs.length > 0) || data.jobs.some(row => row.lead_id !== data.lead_id)
    || new Set(data.jobs.map(row => row.id)).size !== data.jobs.length
    || !(data.note === null || typeof data.note === 'string')) throw new Error('Lead delivery unavailable')
  return data as DeliveryDetail
}

export class DeliveryRetryError extends Error {
  constructor(public readonly code: 'not_retryable' | 'unavailable') { super(code) }
}
export async function retryDelivery(jobId: string): Promise<void> {
  if (!isDeliveryId(jobId)) throw new DeliveryRetryError('unavailable')
  try {
    const data: unknown = (await client.post(`/admin/lead-deliveries/${jobId.toLowerCase()}/retry`, {})).data
    if (!record(data) || data.id !== jobId.toLowerCase() || data.status !== 'retry_wait' || typeof data.enabled !== 'boolean') throw new DeliveryRetryError('unavailable')
  } catch (error) {
    if (record(error) && record(error.response) && error.response.status === 409) throw new DeliveryRetryError('not_retryable')
    if (error instanceof DeliveryRetryError) throw error
    throw new DeliveryRetryError('unavailable')
  }
}
