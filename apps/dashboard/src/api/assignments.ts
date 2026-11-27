import client from './axios'
import { getAdminUsers } from './admin'
import { getAdminLeads } from './leads'

export type AssignmentScope = 'lead' | 'account'
export type AssignmentIntent = Readonly<{ scope: AssignmentScope; targetId: string; realtorId: string | null; requestId: string }>
export type AssignmentNotice = {
  kind: 'lead_assigned_agent' | 'owner_upgrade_customer' | 'owner_assigned_agent'
  status: 'pending' | 'processing' | 'accepted' | 'failed' | 'needs_review' | 'skipped'
  attempts: number; created_at: string; attempted_at: string | null; accepted_at: string | null; outcome_uncertain: boolean
}
export type AssignmentEvent = { id: string; action: 'assigned' | 'cleared'; created_at: string; notices: AssignmentNotice[] }
export type AssignmentHistory = { total: number; limit: number; offset: number; tracked: boolean; items: AssignmentEvent[] }
export type CurrentAssignment = {
  realtor_id: string | null; realtor_name: string | null
  status?: 'new' | 'assigned' | 'schedule' | 'contacted' | 'closed'; assigned_at?: string | null
}

const noticeKeys = ['kind', 'status', 'attempts', 'created_at', 'attempted_at', 'accepted_at', 'outcome_uncertain']
function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function exact(value: Record<string, unknown>, keys: readonly string[]): boolean { return Object.keys(value).length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(value, key)) }
function id(value: unknown): value is string { return typeof value === 'string' && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value) }
function scope(value: unknown): value is AssignmentScope { return value === 'lead' || value === 'account' }
function count(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 }
function time(value: unknown): value is string { return typeof value === 'string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)) }
function nullableTime(value: unknown): value is string | null { return value === null || time(value) }
function targetPath(kind: AssignmentScope, target: string): string { return `/admin/${kind === 'lead' ? 'leads' : 'users'}/${target.toLowerCase()}` }
function validIntent(value: AssignmentIntent): boolean { return scope(value.scope) && id(value.targetId) && id(value.requestId) && (id(value.realtorId) || value.scope === 'account' && value.realtorId === null) }

export function createAssignmentIntent(kind: AssignmentScope, targetId: string, realtorId: string | null): AssignmentIntent {
  if (!scope(kind) || !id(targetId) || !(id(realtorId) || kind === 'account' && realtorId === null)) throw new Error('Invalid assignment')
  return Object.freeze({ scope: kind, targetId: targetId.toLowerCase(), realtorId: realtorId?.toLowerCase() ?? null, requestId: crypto.randomUUID() })
}

export class AssignmentChangeError extends Error {
  constructor(public readonly kind: 'denied' | 'refused' | 'unconfirmed') { super(kind) }
}

export async function submitAssignment(intent: AssignmentIntent, signal?: AbortSignal): Promise<void> {
  if (!validIntent(intent)) throw new AssignmentChangeError('refused')
  const suffix = intent.scope === 'lead' ? '/assign' : '/assign-realtor'
  try {
    const response = await client.put(targetPath(intent.scope, intent.targetId) + suffix,
      { realtor_id: intent.realtorId, request_id: intent.requestId }, { signal })
    if (response.status !== 204) throw new AssignmentChangeError('unconfirmed')
  } catch (error) {
    if (error instanceof AssignmentChangeError) throw error
    const status = record(error) && record(error.response) ? error.response.status : undefined
    if (status === 401 || status === 403) throw new AssignmentChangeError('denied')
    // A missing/ineligible selected agent is also404; the current target read
    // distinguishes that refusal from a deleted or inaccessible target.
    if (status === 400 || status === 404 || status === 409 || status === 422) throw new AssignmentChangeError('refused')
    throw new AssignmentChangeError('unconfirmed')
  }
}

function notice(value: unknown): AssignmentNotice {
  if (!record(value) || !exact(value, noticeKeys)
    || typeof value.kind !== 'string' || !['lead_assigned_agent', 'owner_upgrade_customer', 'owner_assigned_agent'].includes(value.kind)
    || typeof value.status !== 'string' || !['pending', 'processing', 'accepted', 'failed', 'needs_review', 'skipped'].includes(value.status)
    || !count(value.attempts) || value.attempts > 1 || !time(value.created_at)
    || !nullableTime(value.attempted_at) || !nullableTime(value.accepted_at) || typeof value.outcome_uncertain !== 'boolean'
    || (value.attempts === 0) !== (value.attempted_at === null)
    || (value.status === 'accepted') !== (value.accepted_at !== null)
    || (value.status === 'needs_review') !== value.outcome_uncertain
    || value.status === 'pending' && value.attempts !== 0
    || ['processing', 'accepted', 'needs_review'].includes(String(value.status)) && value.attempts !== 1) throw new Error('Assignment history unavailable')
  return { kind: value.kind as AssignmentNotice['kind'], status: value.status as AssignmentNotice['status'],
    attempts: value.attempts, created_at: value.created_at, attempted_at: value.attempted_at,
    accepted_at: value.accepted_at, outcome_uncertain: value.outcome_uncertain }
}

export async function getAssignmentHistory(kind: AssignmentScope, target: string,
  filters: { limit?: number; offset?: number } = {}, signal?: AbortSignal): Promise<AssignmentHistory> {
  const params = { limit: filters.limit ?? 10, offset: filters.offset ?? 0 }
  if (!scope(kind) || !id(target) || !count(params.limit) || params.limit < 1 || params.limit > 50
    || !count(params.offset) || params.offset > 10000) throw new Error('Invalid assignment history request')
  const value: unknown = (await client.get(targetPath(kind, target) + '/assignment-history', { params, signal })).data
  if (!record(value) || !exact(value, ['total', 'limit', 'offset', 'tracked', 'items']) || !count(value.total)
    || value.limit !== params.limit || value.offset !== params.offset || value.tracked !== (value.total > 0)
    || !Array.isArray(value.items) || value.items.length > params.limit || value.items.length > value.total) throw new Error('Assignment history unavailable')
  const items = value.items.map((item: unknown): AssignmentEvent => {
    if (!record(item) || !exact(item, ['id', 'action', 'created_at', 'notices']) || !id(item.id)
      || !(item.action === 'assigned' || item.action === 'cleared') || !time(item.created_at)
      || !Array.isArray(item.notices) || item.notices.length > 3 || kind === 'account' && item.notices.length !== 0) throw new Error('Assignment history unavailable')
    const notices = item.notices.map(notice)
    if (new Set(notices.map(row => row.kind)).size !== notices.length) throw new Error('Assignment history unavailable')
    return { id: item.id.toLowerCase(), action: item.action, created_at: item.created_at, notices }
  })
  if (new Set(items.map(row => row.id)).size !== items.length) throw new Error('Assignment history unavailable')
  return { total: value.total, limit: params.limit, offset: params.offset, tracked: value.tracked, items }
}

export async function getCurrentAssignment(kind: AssignmentScope, target: string, signal?: AbortSignal): Promise<CurrentAssignment> {
  if (!scope(kind) || !id(target)) throw new Error('Invalid assignment request')
  const rows: unknown = kind === 'lead' ? await getAdminLeads(undefined, signal) : await getAdminUsers(undefined, undefined, signal)
  if (!Array.isArray(rows)) throw new Error('Current assignment unavailable')
  const matches = rows.filter((row: unknown) => record(row) && typeof row.id === 'string' && row.id.toLowerCase() === target.toLowerCase())
  if (matches.length !== 1) throw new Error('Current assignment unavailable')
  const row = matches[0] as Record<string, unknown>
  if (!(row.assigned_realtor_id === null || id(row.assigned_realtor_id))
    || !(row.assigned_realtor_name === null || typeof row.assigned_realtor_name === 'string')) throw new Error('Current assignment unavailable')
  const current: CurrentAssignment = { realtor_id: row.assigned_realtor_id, realtor_name: row.assigned_realtor_name }
  if (kind === 'lead') {
    if (typeof row.status !== 'string' || !['new', 'assigned', 'schedule', 'contacted', 'closed'].includes(row.status) || !nullableTime(row.assigned_at)) throw new Error('Current assignment unavailable')
    current.status = row.status as CurrentAssignment['status']; current.assigned_at = row.assigned_at
  }
  return current
}
