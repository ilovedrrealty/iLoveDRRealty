const API = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/+$/, '')

export type DevelopmentUnitStatus = 'available' | 'reserved' | 'sold' | 'unconfirmed'
export type DevelopmentCurrency = 'USD' | 'DOP'

export interface DevelopmentUnit {
  code: string
  floor: string | null
  area_m2: string | null
  price: string | null
  currency: DevelopmentCurrency | null
  status: DevelopmentUnitStatus
  floor_plan_url: string | null
}

export interface DevelopmentPhase {
  code: string
  name_en: string
  name_es: string
  target_delivery: string | null
  units: DevelopmentUnit[]
}

export interface DevelopmentPaymentStage {
  label_en: string
  label_es: string
  due_en: string
  due_es: string
  due_date: string | null
  percent: string | null
  amount: string | null
  currency: DevelopmentCurrency | null
}

export interface DevelopmentUpdate {
  date: string
  title_en: string
  title_es: string
  text_en: string
  text_es: string
}

export interface PublishedDevelopmentInventory {
  listing_id: string
  revision: number
  published_at: string
  verified_on: string
  availability_valid_through: string
  availability_current: boolean
  project: {
    name_en: string
    name_es: string
    summary_en: string
    summary_es: string
    target_delivery: string | null
    phases: DevelopmentPhase[]
    payment_stages: DevelopmentPaymentStage[]
    updates: DevelopmentUpdate[]
  }
}

export async function fetchDevelopmentInventory(listingId: string, signal: AbortSignal): Promise<PublishedDevelopmentInventory | null> {
  const response = await fetch(`${API}/listings/${encodeURIComponent(listingId)}/development`, { signal, cache: 'no-store', credentials: 'omit' })
  if (response.status === 404) return null
  if (!response.ok) throw new Error('Development inventory unavailable')
  const data: PublishedDevelopmentInventory = await response.json()
  return data.listing_id === listingId ? data : null
}

export function developmentAvailabilityEnd(day: string): number {
  // Availability is checked through the end of this day in Santo Domingo.
  return Date.parse(`${day}T23:59:59.999-04:00`) + 1
}

export function developmentAvailabilityCurrent(data: PublishedDevelopmentInventory, now: number): boolean {
  return data.availability_current && now < developmentAvailabilityEnd(data.availability_valid_through)
}

export function developmentFloorPlanHref(value: string | null): string | null {
  if (!value) return null
  try {
    const link = new URL(value)
    return link.protocol === 'https:' && !link.username && !link.password ? link.href : null
  } catch {
    return null
  }
}
