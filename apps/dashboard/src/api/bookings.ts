import client from './axios'

export interface Booking {
  id: string
  listing_id: string
  listing_title: string | null
  listing_location: string | null
  listing_images: string[]
  check_in: string
  check_out: string
  guests: number
  total_price: number | null
  notes: string | null
  status: string
  created_at: string
  guest_name: string | null
  guest_email: string | null
  guest_phone: string | null
  ghl_contact_url: string | null
  // Payment fields (Phase 38)
  payment_status: 'unpaid' | 'authorized' | 'captured' | 'voided' | 'refunded' | null
  payout_status: 'pending' | 'paid' | 'failed' | null
  booked_price_per_day: number | null
  platform_fee: number | null
  payout_amount: number | null
  owner_name: string | null
}

export interface BookingCreate {
  listing_id: string
  check_in: string
  check_out: string
  guests?: number
  notes?: string
}

export async function getMyBookings(): Promise<Booking[]> {
  const res = await client.get<Booking[]>('/bookings/mine')
  return res.data
}

export async function getOwnerBookings(signal?: AbortSignal): Promise<Booking[]> {
  const res = await client.get<Booking[]>('/bookings/for-owner', { signal })
  return res.data
}

export async function getRealtorBookings(): Promise<Booking[]> {
  const res = await client.get<Booking[]>('/bookings/for-owner')
  return res.data
}

export async function createBooking(data: BookingCreate): Promise<Booking> {
  const res = await client.post<Booking>('/bookings', data)
  return res.data
}

export async function cancelBooking(id: string): Promise<void> {
  await client.put(`/bookings/${id}/cancel`)
}

export async function acceptBooking(id: string): Promise<void> {
  await client.put(`/bookings/${id}/accept`)
}

export async function declineBooking(id: string): Promise<void> {
  await client.put(`/bookings/${id}/decline`)
}

export async function releasePayout(id: string): Promise<void> {
  await client.post(`/bookings/${id}/release-payout`)
}

export async function requestPayout(id: string): Promise<void> {
  await client.post(`/bookings/${id}/request-payout`)
}

export async function getAdminBookings(): Promise<Booking[]> {
  const res = await client.get<Booking[]>('/admin/bookings')
  return res.data
}
