import client from './axios'

export const INQUIRY_STATES = ['all', 'open', 'closed'] as const
export type InquiryState = typeof INQUIRY_STATES[number]
export type InquiryStatus = 'new' | 'assigned' | 'schedule' | 'contacted' | 'closed' | 'unknown'
export type OwnerLead = {
  id: string; type: 'property_inquiry'; property_id: string; property_title: string
  name: string; email: string | null; phone: string | null; message: string | null; status: InquiryStatus
  created_at: string; assigned_at: string | null; contacted_at: string | null; closed_at: string | null
  assigned_realtor_id: string | null; assigned_realtor_name: string | null
}
export type OwnerLeadPage = {
  items: OwnerLead[]; total: number; page: number; page_size: 50; state: InquiryState
  summary: { all_total: number; open_total: number; closed_total: number; unknown_total: number }
}
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value)
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const nullable = (value: unknown): value is string | null => value === null || typeof value === 'string'
const time = (value: unknown): value is string => typeof value === 'string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value))
export function isOwnerLeadPage(value: unknown, page: number, state: InquiryState): value is OwnerLeadPage {
  if (!object(value) || !count(value.total) || value.page !== page || value.page_size !== 50 || value.state !== state
    || !object(value.summary) || !Array.isArray(value.items) || value.items.length > 50) return false
  const summary = value.summary
  if (!['all_total', 'open_total', 'closed_total', 'unknown_total'].every(key => count(summary[key]))
    || summary.all_total !== (summary.open_total as number) + (summary.closed_total as number) + (summary.unknown_total as number)
    || value.total !== summary[state === 'open' ? 'open_total' : state === 'closed' ? 'closed_total' : 'all_total']) return false
  const ids = new Set<string>()
  return value.items.every(item => {
    if (!object(item) || !uuid(item.id) || ids.has(item.id) || item.type !== 'property_inquiry' || !uuid(item.property_id)
      || typeof item.property_title !== 'string' || typeof item.name !== 'string' || !time(item.created_at)
      || !['email', 'phone', 'message', 'assigned_realtor_name'].every(key => nullable(item[key]))
      || !['assigned_at', 'contacted_at', 'closed_at'].every(key => item[key] === null || time(item[key]))
      || !(item.assigned_realtor_id === null || uuid(item.assigned_realtor_id))
      || !['new', 'assigned', 'schedule', 'contacted', 'closed', 'unknown'].includes(String(item.status))
      || ['tracking', 'tracking_summary', 'ghl_contact_id', 'ghl_contact_url', 'ghl_sync_error', 'from_user_id', 'payload'].some(key => key in item)) return false
    ids.add(item.id)
    return state === 'all' || (state === 'closed' ? item.status === 'closed' : ['new', 'assigned', 'schedule', 'contacted'].includes(String(item.status)))
  })
}
export async function getOwnerLeads(page = 1, state: InquiryState = 'all', signal?: AbortSignal): Promise<OwnerLeadPage> {
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000 || !INQUIRY_STATES.includes(state)) throw new Error('Invalid inquiry page')
  const data: unknown = (await client.get('/owner/leads', { params: { page, state }, signal })).data
  if (!isOwnerLeadPage(data, page, state)) throw new Error('Inquiries unavailable')
  return data
}
