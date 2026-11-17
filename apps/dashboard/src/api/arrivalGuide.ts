import client from './axios'

export const ARRIVAL_GUIDE_MAX_LENGTH = 1500
export const ARRIVAL_GUIDE_FIELDS = ['directions', 'check_in', 'check_out', 'house_notes'] as const
type ArrivalGuideField = typeof ARRIVAL_GUIDE_FIELDS[number]
export type ArrivalGuideLanguage = 'en' | 'es'
export type ArrivalGuideContent = Record<ArrivalGuideLanguage, Record<ArrivalGuideField, string>>

export interface OwnerArrivalGuide {
  version: number
  content: ArrivalGuideContent | null
}

export interface GuestArrivalGuide {
  content: ArrivalGuideContent
  available_until: string
}

export function emptyArrivalGuide(): ArrivalGuideContent {
  return {
    en: { directions: '', check_in: '', check_out: '', house_notes: '' },
    es: { directions: '', check_in: '', check_out: '', house_notes: '' },
  }
}

export function prepareArrivalGuide(draft: unknown): ArrivalGuideContent | null {
  if (typeof draft !== 'object' || draft === null) return null
  const content = emptyArrivalGuide()
  let hasText = false
  for (const language of ['en', 'es'] as const) {
    const translations = (draft as Record<string, unknown>)[language]
    if (typeof translations !== 'object' || translations === null) return null
    for (const field of ARRIVAL_GUIDE_FIELDS) {
      const instruction = (translations as Record<string, unknown>)[field]
      if (typeof instruction !== 'string') return null
      const value = instruction.trim()
      if (Array.from(value).length > ARRIVAL_GUIDE_MAX_LENGTH) return null
      content[language][field] = value
      hasText ||= value.length > 0
    }
  }
  return hasText ? content : null
}

export function arrivalGuideFields(content: ArrivalGuideContent, preferredLanguage: ArrivalGuideLanguage) {
  const otherLanguage = preferredLanguage === 'en' ? 'es' : 'en'
  return ARRIVAL_GUIDE_FIELDS.flatMap(field => {
    const language = content[preferredLanguage][field] ? preferredLanguage : otherLanguage
    const value = content[language][field]
    return value ? [{ field, language, value }] : []
  })
}

export function arrivalGuideExpiry(value: unknown): number {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return NaN
  return Date.parse(value)
}

function ownerGuide(data: OwnerArrivalGuide): OwnerArrivalGuide {
  if (!data || !Number.isSafeInteger(data.version) || data.version < 0) throw new Error('Invalid arrival guide response')
  const content = data.content === null ? null : prepareArrivalGuide(data.content)
  if (data.content !== null && !content) throw new Error('Invalid arrival guide response')
  return { version: data.version, content }
}

export async function getOwnerArrivalGuide(listingId: string, signal: AbortSignal): Promise<OwnerArrivalGuide> {
  const response = await client.get<OwnerArrivalGuide>(`/bookings/listings/${listingId}/arrival-guide`, { signal })
  return ownerGuide(response.data)
}

export async function saveOwnerArrivalGuide(
  listingId: string,
  expectedVersion: number,
  content: ArrivalGuideContent | null,
  signal: AbortSignal,
): Promise<OwnerArrivalGuide> {
  const response = await client.put<OwnerArrivalGuide>(`/bookings/listings/${listingId}/arrival-guide`, {
    expected_version: expectedVersion,
    content,
  }, { signal })
  return ownerGuide(response.data)
}

export async function getGuestArrivalGuide(bookingId: string, signal: AbortSignal): Promise<GuestArrivalGuide> {
  const response = await client.get<GuestArrivalGuide>(`/bookings/${bookingId}/arrival-guide`, { signal })
  const content = prepareArrivalGuide(response.data?.content)
  if (!content || !Number.isFinite(arrivalGuideExpiry(response.data?.available_until))) throw new Error('Invalid arrival guide response')
  return { content, available_until: response.data.available_until }
}
