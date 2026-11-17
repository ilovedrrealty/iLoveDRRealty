import {
  isNeighborhoodDate, isNeighborhoodTopic, NEIGHBORHOOD_FACT_LIMIT, NEIGHBORHOOD_LOCATION_LIMIT,
  NEIGHBORHOOD_PAGE_SIZE, NEIGHBORHOOD_TOPICS, type NeighborhoodTopic,
} from '../../../../packages/editorial-neighborhoods'
import { editorialSlug, editorialSourceUrl, type EditorialLocale } from './editorial'

const API = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/+$/, '')
const PATH = '/site/neighborhoods'
export type NeighborhoodSummary = {
  slug: string; title: string; summary: string; published_at: string; listing_location: string | null
}
export type NeighborhoodFact = {
  topic: NeighborhoodTopic; text: string; checked_on: string; source: { label: string; url: string }
}
export type PublishedNeighborhood = NeighborhoodSummary & { facts: NeighborhoodFact[] }

function invalid(): never { throw new Error('Invalid neighborhood comparison data') }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid()
  return value as Record<string, unknown>
}
function text(value: unknown, limit: number): string {
  if (typeof value !== 'string' || !value.trim() || [...value].length > limit) return invalid()
  return value
}
function summary(value: unknown): NeighborhoodSummary {
  const row = record(value)
  const slug = editorialSlug(row.slug)
  const published_at = text(row.published_at, 60)
  if (!slug || !Number.isFinite(Date.parse(published_at))) return invalid()
  return {
    slug, title: text(row.title, 160), summary: text(row.summary, 350), published_at,
    listing_location: row.listing_location === null ? null : text(row.listing_location, NEIGHBORHOOD_LOCATION_LIMIT),
  }
}
function fact(value: unknown): NeighborhoodFact {
  const row = record(value)
  const source = record(row.source)
  if (!isNeighborhoodTopic(row.topic) || !isNeighborhoodDate(row.checked_on)) return invalid()
  return {
    topic: row.topic, text: text(row.text, NEIGHBORHOOD_FACT_LIMIT), checked_on: row.checked_on,
    source: { label: text(source.label, 120), url: editorialSourceUrl(source.url) },
  }
}
async function read(path: string, signal: AbortSignal): Promise<Response> {
  const response = await fetch(API + PATH + path, { cache: 'no-store', credentials: 'omit', redirect: 'error', signal })
  if (!response.ok && response.status !== 404) throw new Error('Neighborhood comparison is unavailable')
  return response
}

export async function listNeighborhoods(locale: EditorialLocale, page: number, signal: AbortSignal) {
  const params = new URLSearchParams({ locale, page: String(page), page_size: String(NEIGHBORHOOD_PAGE_SIZE) })
  const response = await read('?' + params, signal)
  if (!response.ok) return invalid()
  const { items, total } = record(await response.json())
  if (!Array.isArray(items) || items.length > NEIGHBORHOOD_PAGE_SIZE || typeof total !== 'number'
    || !Number.isSafeInteger(total) || total < items.length) return invalid()
  const summaries = items.map(summary)
  if (new Set(summaries.map(item => item.slug)).size !== summaries.length) return invalid()
  return { items: summaries, total }
}

export async function getNeighborhood(slug: string, locale: EditorialLocale, signal: AbortSignal): Promise<PublishedNeighborhood | null> {
  if (editorialSlug(slug) !== slug) return invalid()
  const response = await read('/' + slug + '?' + new URLSearchParams({ locale }), signal)
  if (response.status === 404) return null
  const row = record(await response.json())
  const item = summary(row)
  if (item.slug !== slug || !Array.isArray(row.facts) || !row.facts.length || row.facts.length > NEIGHBORHOOD_TOPICS.length) return invalid()
  const facts = row.facts.map(fact)
  if (new Set(facts.map(entry => entry.topic)).size !== facts.length) return invalid()
  return { ...item, facts }
}

export function neighborhoodCompareLink(locale: EditorialLocale): string {
  return '/local-guides/compare/?' + new URLSearchParams({ lang: locale })
}

export function neighborhoodListingLink(location: string | null): string | null {
  const place = location?.trim()
  if (!place || place.length > NEIGHBORHOOD_LOCATION_LIMIT || /[\x00-\x1f\x7f]/.test(place)) return null
  return '/search/?' + new URLSearchParams({ location: place })
}
