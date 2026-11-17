export const NEIGHBORHOOD_TOPICS = ['access', 'utilities', 'internet', 'services', 'transport', 'lifestyle'] as const
export type NeighborhoodTopic = typeof NEIGHBORHOOD_TOPICS[number]
export const NEIGHBORHOOD_LOCATION_LIMIT = 80
export const NEIGHBORHOOD_FACT_LIMIT = 600
export const NEIGHBORHOOD_PAGE_SIZE = 20

export function isNeighborhoodTopic(value: unknown): value is NeighborhoodTopic {
  return typeof value === 'string' && NEIGHBORHOOD_TOPICS.includes(value as NeighborhoodTopic)
}

export function isNeighborhoodDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.slice(0, 4) === '0000') return false
  const date = new Date(value + 'T12:00:00Z')
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function neighborhoodToday(now = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Santo_Domingo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
}
