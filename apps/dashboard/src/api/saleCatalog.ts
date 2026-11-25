import client from './axios'
import { SALE_PAGE_SIZE, validSaleFilters, saleListingPath, type SaleFilters } from '../lib/saleCatalog'

export type SaleProperty = { id: string; title: string; location: string; type: string; transaction: 'sale' | 'both'; price: number;
  currency: string; bedrooms: number | null; bathrooms: number | null; area_sqft: number | null; image: string | null }
export type SalePage = { items: SaleProperty[]; total: number; page: number; page_size: number }
export type SaleOptions = { locations: string[]; types: string[] }
const invalid = (): never => { throw new Error('Invalid public sale catalog response') }
function record(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : invalid() }
function text(value: unknown): string { return typeof value === 'string' ? value : invalid() }
function count(value: unknown): number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : invalid() }
function amount(value: unknown): number { const parsed = typeof value === 'number' || typeof value === 'string' && value.trim() ? Number(value) : NaN; return Number.isFinite(parsed) && parsed >= 0 ? parsed : invalid() }
function optionalAmount(value: unknown): number | null { return value === null ? null : amount(value) }
function publicImage(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null } catch { return null }
}
function property(value: unknown): SaleProperty {
  const row = record(value), id = text(row.id)
  if (!saleListingPath(id) || row.status !== 'active' || !['sale', 'both'].includes(text(row.transaction))) return invalid()
  const currency = text(row.currency)
  if (!currency.trim() || currency.length > 12 || /[\u0000-\u001f\u007f]/.test(currency)) return invalid()
  // Explicit projection: never retain owner, client, payout, agreement or private notes fields.
  return { id: id.toLowerCase(), title: text(row.title), location: text(row.location), type: text(row.type), transaction: row.transaction as 'sale' | 'both',
    price: amount(row.price), currency, bedrooms: optionalAmount(row.bedrooms), bathrooms: optionalAmount(row.bathrooms), area_sqft: optionalAmount(row.area_sqft),
    image: Array.isArray(row.images) ? publicImage(row.images[0]) : null }
}

export async function getSaleCatalog(filters: SaleFilters, page: number, signal: AbortSignal): Promise<SalePage> {
  if (!validSaleFilters(filters) || !Number.isSafeInteger(page) || page < 1 || page > 999999) return invalid()
  const response = await client.get('/listings', { signal, params: { purpose: 'sale', page, page_size: SALE_PAGE_SIZE,
    region: filters.region || undefined, type: filters.type || undefined, beds: filters.beds ? Number(filters.beds) : undefined,
    min_price: filters.min_price ? Number(filters.min_price) : undefined, max_price: filters.max_price ? Number(filters.max_price) : undefined,
    sort: filters.sort, price_currency: 'USD', usd_to_dop: Number(filters.usd_to_dop), include_aggregates: false } })
  const cache = response.headers['cache-control']
  if (typeof cache !== 'string' || !cache.toLowerCase().split(',').some((part: string) => part.trim() === 'no-store')) return invalid()
  const data = record(response.data)
  if (!Array.isArray(data.items) || data.items.length > SALE_PAGE_SIZE || data.page !== page || data.page_size !== SALE_PAGE_SIZE) return invalid()
  const items = data.items.map(property)
  if (new Set(items.map(item => item.id)).size !== items.length) return invalid()
  return { items, total: count(data.total), page, page_size: SALE_PAGE_SIZE }
}

export async function getSaleOptions(signal: AbortSignal): Promise<SaleOptions> {
  const response = await client.get('/listings/filter-options', { signal }), data = record(response.data)
  function values(raw: unknown): string[] {
    if (!Array.isArray(raw) || raw.length > 10000) return invalid()
    return [...new Set(raw.map(value => { const row = record(value); count(row.count); return text(row.value) }))]
  }
  return { locations: values(data.locations), types: values(data.types) }
}
