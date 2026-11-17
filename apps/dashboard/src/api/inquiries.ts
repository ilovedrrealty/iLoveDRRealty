import client from './axios'

export interface Inquiry {
  id: string
  listing_id: string | null
  listing_title: string | null
  name: string
  email: string
  phone: string | null
  message: string | null
  created_at: string
}

export interface InquiryCreate {
  listing_id?: string
  name: string
  email: string
  phone?: string
  message: string
}

export async function submitInquiry(data: InquiryCreate): Promise<Inquiry> {
  const res = await client.post<Inquiry>('/inquiries', data)
  return res.data
}

export async function getMyInquiries(signal?: AbortSignal): Promise<Inquiry[]> {
  const res = await client.get<Inquiry[]>('/inquiries/mine', { signal })
  return res.data
}

export async function getOwnerInquiries(signal?: AbortSignal): Promise<Inquiry[]> {
  const res = await client.get<Inquiry[]>('/inquiries/for-owner', { signal })
  return res.data
}

export async function getRealtorInquiries(): Promise<Inquiry[]> {
  const res = await client.get<Inquiry[]>('/inquiries/for-realtor')
  return res.data
}
