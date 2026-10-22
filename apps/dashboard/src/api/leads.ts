import client from './axios'

export interface Lead {
  id: string
  type: 'property_inquiry' | 'booking' | 'buyer_interest' | 'seller_interest' | 'rental_interest'
  name: string
  email: string | null
  phone: string | null
  message: string | null
  property_id: string | null
  property_title: string | null
  listing_realtor_id: string | null
  listing_realtor_name: string | null
  listing_owner_id: string | null
  listing_owner_name: string | null
  from_user_id: string | null
  from_user_code: string | null
  from_user_name: string | null
  from_user_avatar_url: string | null
  assigned_realtor_id: string | null
  assigned_realtor_name: string | null
  status: 'new' | 'assigned' | 'schedule' | 'contacted' | 'closed'
  created_at: string
  assigned_at: string | null
  contacted_at: string | null
  closed_at: string | null
  ghl_contact_url: string | null
  booking_status: string | null
  tracking_summary?: {
    form: string; page_path: string; locale: string; contact_consent: boolean
    intent: 'buy' | 'sell' | 'rent' | 'general' | 'unknown'
    measurement_consent: 'granted' | 'denied' | 'unset'; internal_test: boolean
    source: string | null; medium: string | null; campaign: string | null; has_ad_click_id: boolean
    measurement: { eligible: boolean; reason: string }
  } | null
}

export interface LeadTrackingSummary {
  window_days: number; total: number; tracked_submissions: number; internal_tests: number
  measurement_granted: number; with_ad_click_id: number; crm_linked: number; crm_errors: number
  by_intent: Record<string, number>; note: string
}

export async function getLeadTrackingSummary(): Promise<LeadTrackingSummary> {
  return (await client.get<LeadTrackingSummary>('/admin/leads/tracking-summary')).data
}

export interface LeadCreate {
  type?: string
  name: string
  email: string
  phone?: string
  message?: string
  property_id?: string
}

export async function getAdminLeads(params?: {
  type?: string
  status?: string
  assigned_realtor_id?: string
}): Promise<Lead[]> {
  const res = await client.get<Lead[]>('/admin/leads', { params })
  return res.data
}

export async function assignLead(leadId: string, realtorId: string): Promise<void> {
  await client.put(`/admin/leads/${leadId}/assign`, { realtor_id: realtorId })
}

export async function updateLeadStatus(leadId: string, status: string): Promise<void> {
  await client.put(`/admin/leads/${leadId}/status`, { status })
}

export async function updateRealtorLeadStatus(leadId: string, status: string): Promise<void> {
  await client.put(`/realtor/leads/${leadId}/status`, { status })
}

export async function getRealtorLeads(): Promise<Lead[]> {
  const res = await client.get<Lead[]>('/realtor/leads')
  return res.data
}

export async function getMyLeads(): Promise<Lead[]> {
  const res = await client.get<Lead[]>('/leads/mine')
  return res.data
}

export async function submitLead(data: LeadCreate): Promise<void> {
  await client.post('/leads', data)
}
