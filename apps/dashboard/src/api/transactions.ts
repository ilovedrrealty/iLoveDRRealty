import { isAxiosError } from 'axios'
import client from './axios'
import type { Lead } from './leads'

export type TransactionRole = 'admin' | 'realtor' | 'buyer' | 'professional'
export type TransactionRoomSummary = {
  id: string; lead_id: string; listing_id: string; title: string
  status: 'open' | 'closed' | 'retired'; version: number; role: TransactionRole
}
export type TransactionMember = {
  user_id: string; grant_id: string | null; member_code: number | null; display_name: string
  role: Exclude<TransactionRole, 'admin'>; state: 'pending' | 'active' | 'revoked'
}
export const TASK_STATUSES = ['open', 'in_progress', 'done', 'cancelled'] as const
export type TransactionTaskStatus = typeof TASK_STATUSES[number]
export type TransactionTask = {
  id: string; title: string; assignee_user_id: string | null; due_on: string | null; status: TransactionTaskStatus
}
export type TransactionMilestone = { id: string; title: string; target_on: string | null; actual_on: string | null }
export type TransactionRoom = TransactionRoomSummary & {
  members: TransactionMember[]; tasks: TransactionTask[]; milestones: TransactionMilestone[]
}
export type TransactionInvitation = { id: string; invited_at: string }
export type TransactionHistoryEntry = {
  sequence: number; action: string; actor_role: TransactionRole | 'system'; created_at: string; target_id: string | null
}
export type TaskFields = Pick<TransactionTask, 'title' | 'assignee_user_id' | 'due_on'>
export type MilestoneFields = Omit<TransactionMilestone, 'id'>

export const TRANSACTION_TITLE_LIMIT = 120
export const TRANSACTION_WORK_TITLE_LIMIT = 160
export const TRANSACTION_PAGE_SIZE = 50
export const TRANSACTION_MAX_PAGE = 10_000
export const TRANSACTION_HISTORY_SIZE = 100
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i
const PREFIX = '/transactions'
const roomPath = (id: string) => `${PREFIX}/${encodeURIComponent(id)}`
const leadPath = (id: string) => `${PREFIX}/leads/${encodeURIComponent(id)}`
const scope = (room: TransactionRoomSummary) => ({ expected_version: room.version })

export function transactionOpenId(params: URLSearchParams): string | null {
  const values = params.getAll('openId')
  return values.length === 1 && values[0].length === 36 && UUID.test(values[0]) ? values[0].toLowerCase() : null
}

export function isTransactionRoomLead(lead: Pick<Lead, 'type' | 'from_user_id' | 'property_id' | 'assigned_realtor_id'>): boolean {
  return (lead.type === 'buyer_interest' || lead.type === 'property_inquiry')
    && Boolean(lead.from_user_id && lead.property_id && lead.assigned_realtor_id)
}

export function transactionAccountCode(value: string): number | null {
  const input = value.trim()
  if (!/^#?\d{1,10}$/.test(input)) return null
  const code = Number(input.replace(/^#/, ''))
  return code >= 1 && code <= 2_147_483_647 ? code : null
}

export function canManageTransaction(room: TransactionRoomSummary): boolean {
  return room.status === 'open' && (room.role === 'admin' || room.role === 'realtor')
}

export function transactionTaskStatuses(room: TransactionRoomSummary, task: TransactionTask, userId: string): readonly TransactionTaskStatus[] {
  if (canManageTransaction(room)) return TASK_STATUSES
  if (room.status === 'open' && task.assignee_user_id === userId && (task.status === 'open' || task.status === 'in_progress')) {
    return ['open', 'in_progress', 'done']
  }
  return []
}

export function transactionHttpStatus(error: unknown): number | undefined {
  return isAxiosError(error) ? error.response?.status : undefined
}

export function transactionAccessDenied(error: unknown): boolean {
  const status = transactionHttpStatus(error)
  return status === 401 || status === 403 || status === 404
}

export async function listTransactionRooms(page: number, signal: AbortSignal) {
  const { data } = await client.get<{ items: TransactionRoomSummary[] }>(PREFIX, {
    params: { page, page_size: TRANSACTION_PAGE_SIZE }, signal,
  })
  return data.items
}

export async function listTransactionInvitations(page: number, signal: AbortSignal) {
  const { data } = await client.get<{ items: TransactionInvitation[] }>(`${PREFIX}/invitations`, {
    params: { page, page_size: TRANSACTION_PAGE_SIZE }, signal,
  })
  return data.items
}

export async function transactionForLead(id: string, signal: AbortSignal) {
  const { data } = await client.get<{ room: TransactionRoomSummary | null }>(leadPath(id), { signal })
  return data
}

export async function createTransactionRoom(id: string, title: string, signal: AbortSignal) {
  const { data } = await client.post<TransactionRoom>(leadPath(id), { title }, { signal })
  return data
}

export async function getTransactionRoom(id: string, signal: AbortSignal) {
  const { data } = await client.get<TransactionRoom>(roomPath(id), { signal })
  if (data.id !== id) throw new Error('Unexpected transaction room')
  return data
}

export async function getTransactionHistory(id: string, before: number | undefined, signal: AbortSignal) {
  const { data } = await client.get<{ items: TransactionHistoryEntry[] }>(`${roomPath(id)}/history`, {
    params: { before, limit: TRANSACTION_HISTORY_SIZE }, signal,
  })
  return data.items
}

export async function acceptTransactionInvitation(id: string, signal: AbortSignal) {
  const { data } = await client.post<TransactionRoom>(`${PREFIX}/invitations/${encodeURIComponent(id)}/accept`, {}, { signal })
  return data
}

export async function inviteTransactionProfessional(room: TransactionRoomSummary, code: number, signal: AbortSignal) {
  const { data } = await client.post<TransactionRoom>(`${roomPath(room.id)}/invitations`, { ...scope(room), member_code: code }, { signal })
  return data
}

export async function revokeTransactionMember(room: TransactionRoomSummary, grant: string, signal: AbortSignal) {
  const path = `${roomPath(room.id)}/members/${encodeURIComponent(grant)}/revoke`
  const { data } = await client.post<TransactionRoom>(path, scope(room), { signal })
  return data
}

export async function createTransactionTask(room: TransactionRoomSummary, task: TaskFields, signal: AbortSignal) {
  const { data } = await client.post<TransactionRoom>(`${roomPath(room.id)}/tasks`, { ...scope(room), ...task }, { signal })
  return data
}

export async function updateTransactionTask(room: TransactionRoomSummary, id: string, task: Partial<TaskFields & { status: TransactionTaskStatus }>, signal: AbortSignal) {
  const path = `${roomPath(room.id)}/tasks/${encodeURIComponent(id)}`
  const { data } = await client.patch<TransactionRoom>(path, { ...scope(room), ...task }, { signal })
  return data
}

export async function saveTransactionMilestone(room: TransactionRoomSummary, fields: MilestoneFields, id: string | null, signal: AbortSignal) {
  const path = `${roomPath(room.id)}/milestones`
  const body = { ...scope(room), ...fields }
  const response = id
    ? await client.put<TransactionRoom>(`${path}/${encodeURIComponent(id)}`, body, { signal })
    : await client.post<TransactionRoom>(path, body, { signal })
  return response.data
}

export async function closeTransactionRoom(room: TransactionRoomSummary, signal: AbortSignal) {
  const { data } = await client.post<TransactionRoom>(`${roomPath(room.id)}/close`, scope(room), { signal })
  return data
}
