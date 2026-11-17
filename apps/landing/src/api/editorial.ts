export type EditorialLocale = 'en' | 'es'
type EditorialKind = 'article' | 'guide' | 'neighborhood'
type Source = { label: string; url: string }
type PageSummary = { slug: string; kind: EditorialKind; title: string; summary: string; published_at: string }
export type PublishedEditorial = PageSummary & { body: string; sources: Source[] }

export const EDITORIAL_PAGE_SIZE = 20
const API = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/+$/, '')
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function editorialSlug(value: unknown): string | null {
  return typeof value === 'string' && value.length <= 80 && !/\s/.test(value) && SLUG.test(value) ? value : null
}

export function editorialLink(locale: EditorialLocale, slug?: string, page = 1): string {
  const query = new URLSearchParams({ lang: locale })
  if (slug) query.set('slug', slug)
  else if (page > 1) query.set('page', String(page))
  return `/local-guides/${slug ? 'read/' : ''}?${query}`
}

function badResponse(): never {
  throw new Error('Invalid editorial data')
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || !value || Array.isArray(value)) return badResponse()
  return value as Record<string, unknown>
}

function field(value: unknown, limit: number): string {
  if (typeof value !== 'string' || !value.trim() || [...value].length > limit) return badResponse()
  return value
}

export function editorialSourceUrl(value: unknown): string {
  const href = field(value, 800)
  let parsed: URL
  try { parsed = new URL(href) } catch { return badResponse() }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || !parsed.hostname || /[\s\\]/.test(href)) return badResponse()
  return parsed.href
}

function summary(value: unknown): PageSummary {
  const row = record(value)
  const { kind } = row
  const slug = editorialSlug(row.slug)
  if (!slug || (kind !== 'article' && kind !== 'guide' && kind !== 'neighborhood')) return badResponse()
  const published_at = field(row.published_at, 60)
  if (!Number.isFinite(Date.parse(published_at))) return badResponse()
  return { slug, kind, title: field(row.title, 160), summary: field(row.summary, 350), published_at }
}

async function read(path: string, signal: AbortSignal): Promise<Response> {
  const response = await fetch(API + '/site/editorial' + path, {
    cache: 'no-store',
    credentials: 'omit',
    redirect: 'error',
    signal,
  })
  if (!response.ok && response.status !== 404) throw new Error('Editorial content is unavailable')
  return response
}

export async function listPublishedEditorial(locale: EditorialLocale, page: number, signal: AbortSignal) {
  const params = new URLSearchParams({ locale, page: String(page), page_size: String(EDITORIAL_PAGE_SIZE) })
  const response = await read('?' + params, signal)
  if (!response.ok) return badResponse()
  const { items, total } = record(await response.json())
  if (!Array.isArray(items) || items.length > EDITORIAL_PAGE_SIZE || typeof total !== 'number'
    || !Number.isSafeInteger(total) || total < items.length) return badResponse()
  return { items: items.map(summary), total }
}

export async function getPublishedEditorial(slug: string, locale: EditorialLocale, signal: AbortSignal): Promise<PublishedEditorial | null> {
  if (editorialSlug(slug) !== slug) return badResponse()
  const response = await read(`/${slug}?locale=${locale}`, signal)
  if (response.status === 404) return null
  const row = record(await response.json())
  const item = summary(row)
  if (item.slug !== slug || !Array.isArray(row.sources) || row.sources.length > 8) return badResponse()
  const sources = row.sources.map(value => {
    const source = record(value)
    return { label: field(source.label, 120), url: editorialSourceUrl(source.url) }
  })
  return { ...item, body: field(row.body, 12000), sources }
}
