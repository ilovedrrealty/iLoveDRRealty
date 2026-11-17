import { SEARCH_CATALOG_LOCATIONS } from '../data/searchLocations'
import type { EditorialLocale } from './editorial'

const API = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/+$/, '')
const PATH = '/site/market-reports'
const PAGE = '/local-guides/market-report/'
const LOCATION_SET = new Set(SEARCH_CATALOG_LOCATIONS)
const PROPERTY_TYPES = ['villa', 'apartment', 'condo', 'land', 'commercial'] as const
export const REPORT_CURRENCIES = ['USD', 'DOP'] as const
export const REPORT_TIME_ZONE = 'America/Santo_Domingo'
const MAX_BASE_PRICE_MILLS = BigInt('9999999999990')

export type MarketPropertyType = typeof PROPERTY_TYPES[number]
export type ReportCurrency = typeof REPORT_CURRENCIES[number]
export type MarketCohort = {
  property_type: MarketPropertyType; currency: ReportCurrency
  listing_count: number; price_count: number; size_count: number
  price_min: string | null; price_median: string | null; price_max: string | null
  median_price_per_sqm: string | null; area_basis: 'living' | 'lot' | null
}
export type MarketReport = {
  as_of: string; local_date: string; location: string | null
  total_listings: number; unclassified_currency_count: number; groups: MarketCohort[]
}

function invalid(): never { throw new Error('Invalid market report') }
function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid()
  const row = value as Record<string, unknown>
  if (Object.keys(row).length !== keys.length || keys.some(key => !Object.prototype.hasOwnProperty.call(row, key))) return invalid()
  return row
}
function count(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : invalid()
}
function oneOf<T extends string>(value: unknown, choices: readonly T[]): T {
  return typeof value === 'string' && choices.includes(value as T) ? value as T : invalid()
}
function mills(value: string) {
  const [whole, fractional = ''] = value.split('.')
  return BigInt(whole + fractional.padEnd(3, '0'))
}
function price(value: unknown, format: RegExp, required: boolean): string | null {
  if (!required) return value === null ? null : invalid()
  return typeof value === 'string' && format.test(value) ? value : invalid()
}
function marketCohort(value: unknown): MarketCohort {
  const row = record(value, ['property_type', 'currency', 'listing_count', 'price_count', 'price_min', 'price_median',
    'price_max', 'size_count', 'median_price_per_sqm', 'area_basis'])
  const property_type = oneOf(row.property_type, PROPERTY_TYPES)
  const currency = oneOf(row.currency, REPORT_CURRENCIES)
  const listing_count = count(row.listing_count), price_count = count(row.price_count), size_count = count(row.size_count)
  const area_basis = property_type === 'commercial' ? null : property_type === 'land' ? 'lot' : 'living'
  if (!listing_count || size_count > price_count || price_count > listing_count
    || row.area_basis !== area_basis || (area_basis === null && size_count > 0)) return invalid()
  const basePrice = /^(?:0|[1-9]\d{0,9})\.\d{2}$/
  const baseMedian = /^(?:0|[1-9]\d{0,9})\.\d{2,3}$/
  const price_min = price(row.price_min, basePrice, price_count > 0)
  const price_median = price(row.price_median, baseMedian, price_count > 0)
  const price_max = price(row.price_max, basePrice, price_count > 0)
  if (price_min && price_median && price_max
    && (mills(price_min) < BigInt(10) || mills(price_min) > mills(price_median)
      || mills(price_median) > mills(price_max) || mills(price_max) > MAX_BASE_PRICE_MILLS)) return invalid()
  const median_price_per_sqm = price(row.median_price_per_sqm, /^(?:0|[1-9]\d{0,11})\.\d{2}$/, size_count > 0)
  return { property_type, currency, listing_count, price_count, size_count, price_min, price_median, price_max,
    median_price_per_sqm, area_basis }
}

export function marketReportLocation(value: string | undefined): string | null {
  return value && LOCATION_SET.has(value) ? value : null
}

export function marketReportLink(locale: EditorialLocale, location: string | null = null): string {
  const params = new URLSearchParams({ lang: locale })
  if (location && marketReportLocation(location)) params.set('location', location)
  return PAGE + '?' + params
}

export function marketReportSearchLink(location: string | null): string {
  const params = new URLSearchParams({ purpose: 'sale' })
  if (location && marketReportLocation(location)) params.set('location', location)
  return '/search/?' + params
}

export async function getMarketReport(location: string | null, signal: AbortSignal): Promise<MarketReport> {
  if (location !== null && !marketReportLocation(location)) return invalid()
  const query = location === null ? '' : '?' + new URLSearchParams({ location })
  const response = await fetch(API + PATH + query, { cache: 'no-store', credentials: 'omit', redirect: 'error', signal })
  if (!response.ok) throw new Error('Market report is unavailable')
  const row = record(await response.json(), ['as_of', 'local_date', 'location', 'total_listings', 'unclassified_currency_count', 'groups'])
  const { as_of, local_date } = row
  if (typeof as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/.test(as_of)
    || typeof local_date !== 'string' || row.location !== location || !Array.isArray(row.groups)
    || row.groups.length > PROPERTY_TYPES.length * REPORT_CURRENCIES.length) return invalid()
  const snapshot = new Date(as_of)
  if (!Number.isFinite(snapshot.getTime()) || snapshot.toISOString().slice(0, 19) !== as_of.slice(0, 19)
    || new Intl.DateTimeFormat('sv-SE', { timeZone: REPORT_TIME_ZONE, dateStyle: 'short' }).format(snapshot) !== local_date) return invalid()
  const total_listings = count(row.total_listings), unclassified_currency_count = count(row.unclassified_currency_count)
  const groups = row.groups.map(marketCohort)
  if (new Set(groups.map(group => group.property_type + ':' + group.currency)).size !== groups.length
    || groups.reduce((total, group) => total + group.listing_count, unclassified_currency_count) !== total_listings) return invalid()
  return { as_of, local_date, location, total_listings, unclassified_currency_count, groups }
}

export function formatMarketMoney(value: string, currency: ReportCurrency, locale: EditorialLocale): string {
  const [whole, partial] = value.split('.')
  const fraction = partial.length === 3 && partial.endsWith('0') ? partial.slice(0, 2) : partial
  return new Intl.NumberFormat(locale === 'es' ? 'es-DO' : 'en-US', {
    style: 'currency', currency, currencyDisplay: 'code', minimumFractionDigits: fraction.length, maximumFractionDigits: fraction.length,
  }).formatToParts(BigInt(whole)).map(part => part.type === 'fraction' ? fraction : part.value).join('')
}
