import { manualTargetUrl, publicSharePhoto, safeShareTitle, validateManualContent, type ManualContent, type ShareLocale } from '../../../../packages/sharing/manual'
import { manualCopy } from '../../../../packages/sharing/manualCopy'
import { listingBrochureFacts } from './listingBrochure'

/** Deliberate allowlist: no seller contact, exact coordinates, free-form descriptions, finance inputs or project fields. */
export function publicListingShareFacts(id: string, input: unknown, locale: ShareLocale): ManualContent | null {
  const facts = listingBrochureFacts(id, input)
  if (!facts || !input || typeof input !== 'object') return null
  const row = input as Record<string, unknown>, copy = manualCopy(locale), url = manualTargetUrl({ kind: 'listing', id: facts.id })
  if (!url) return null
  const verifiedArea = row.location_verified === true ? facts.area : null
  const title = row.location_verified === true ? safeShareTitle(facts.title, copy.types[facts.type]) : copy.types[facts.type]
  const lines: string[] = [facts.transaction === 'sale' ? copy.forSale : facts.transaction === 'rent' ? copy.forRent : copy.both]
  if (verifiedArea) lines[0] += ' · ' + verifiedArea
  if (facts.currency) {
    const money = new Intl.NumberFormat(locale === 'es' ? 'es-DO' : 'en-US', { style: 'currency', currency: facts.currency, currencyDisplay: 'code', maximumFractionDigits: 2 })
    for (const rate of facts.rates) lines.push(`${rate.basis === 'sale_price' ? copy.price : rate.basis === 'per_month' ? copy.monthly : copy.daily}: ${money.format(rate.amount)}`)
  }
  const rooms = [facts.bedrooms === null ? null : `${copy.beds}: ${facts.bedrooms}`, facts.bathrooms === null ? null : `${copy.baths}: ${facts.bathrooms}`].filter(Boolean)
  if (rooms.length) lines.push(rooms.join(' · '))
  return validateManualContent({ title, facts: lines, url, audience: 'public', photos: Array.isArray(row.images) ? row.images.filter(publicSharePhoto) : [] })
}

/** Anonymous, fresh read: an Admin session must never broaden a shared projection. */
export async function fetchPublicListingShare(id: string, locale: ShareLocale, signal: AbortSignal): Promise<ManualContent | null> {
  if (!manualTargetUrl({ kind: 'listing', id })) return null
  const base = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/+$/, '')
  const response = await fetch(`${base}/listings/${id.toLowerCase()}`, { signal, credentials: 'omit', cache: 'no-store', headers: { Accept: 'application/json' } })
  if (!response.ok || !(response.headers.get('cache-control') ?? '').split(',').some(value => value.trim().toLowerCase() === 'no-store')) return null
  return publicListingShareFacts(id, await response.json(), locale)
}
