export type DirectoryLocationStatus = 'all' | 'mapped' | 'unmapped'
export type DirectoryLocationFilters = { map_area?: string; location_status?: DirectoryLocationStatus }
export type ProfessionalDirectoryFilters = DirectoryLocationFilters & {
  category: string[]; area: string[]; language?: string; q: string
}
export type DirectoryMapArea = {
  area_key: string; label: string; latitude: number; longitude: number
  reference_country_code: string | null; precision: 'area_reference'
  purpose: 'record_area' | 'service_area'; source_kind: 'existing_area_catalog'
  source_reference: string; area_kind: 'provincial_capital' | 'popular_locality'; record_count: number
}
export type DirectoryMapSummary = {
  total: number; mapped_total: number; unmapped_total: number; complete: true
  areas: DirectoryMapArea[]
  catalog: { id: string; reference_country_code: string; source_reference: string; purpose: 'approximate_area_references' }
}

export function directoryLocationParams(filters: DirectoryLocationFilters) {
  return {
    ...(filters.map_area ? { map_area: filters.map_area } : {}),
    ...(filters.location_status && filters.location_status !== 'all' ? { location_status: filters.location_status } : {}),
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
function keys(value: Record<string, unknown>, allowed: string[]) {
  return Object.keys(value).every(key => allowed.includes(key)) && allowed.every(key => Object.prototype.hasOwnProperty.call(value, key))
}
const count = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0
const countryCode = (value: unknown): value is string => typeof value === 'string' && /^[A-Z]{2}$/.test(value)

export function readDirectoryMap(value: unknown): DirectoryMapSummary {
  const invalid = () => { throw new Error('Invalid directory map response') }
  if (!record(value) || !keys(value, ['total', 'mapped_total', 'unmapped_total', 'complete', 'areas', 'catalog'])
    || !count(value.total) || !count(value.mapped_total) || !count(value.unmapped_total)
    || value.total !== value.mapped_total + value.unmapped_total || value.complete !== true || !Array.isArray(value.areas)) return invalid()
  const catalog = value.catalog
  if (!record(catalog) || !keys(catalog, ['id', 'reference_country_code', 'source_reference', 'purpose'])
    || !text(catalog.id) || !text(catalog.source_reference) || !countryCode(catalog.reference_country_code)
    || catalog.purpose !== 'approximate_area_references') return invalid()
  const areaKeys = new Set<string>()
  for (const area of value.areas) {
    if (!record(area) || !keys(area, ['area_key', 'label', 'latitude', 'longitude', 'reference_country_code',
      'precision', 'purpose', 'source_kind', 'source_reference', 'area_kind', 'record_count'])
      || !text(area.area_key) || !text(area.label) || !text(area.source_reference)
      || typeof area.latitude !== 'number' || !Number.isFinite(area.latitude) || Math.abs(area.latitude) > 90
      || typeof area.longitude !== 'number' || !Number.isFinite(area.longitude) || Math.abs(area.longitude) > 180
      || (area.reference_country_code !== null && !countryCode(area.reference_country_code))
      || area.precision !== 'area_reference' || !['record_area', 'service_area'].includes(String(area.purpose))
      || area.source_kind !== 'existing_area_catalog' || !['provincial_capital', 'popular_locality'].includes(String(area.area_kind))
      || !count(area.record_count) || area.record_count < 1 || area.record_count > value.total) return invalid()
    if (areaKeys.has(area.area_key)) return invalid()
    areaKeys.add(area.area_key)
  }
  return value as unknown as DirectoryMapSummary
}
import client from './axios'
import type { TradeContactFilters } from './tradeContacts'


export async function getTradeContactMap(filters: TradeContactFilters, signal?: AbortSignal) {
  const params = Object.fromEntries(Object.entries(filters).filter(([key, value]) => value !== undefined && value !== '' && key !== 'map_area' && key !== 'location_status'))
  const { data } = await client.get<unknown>('/admin/trade-contacts/map', {
    params: { ...params, ...directoryLocationParams(filters) }, signal,
  })
  return readDirectoryMap(data)
}

export async function getProfessionalMap(filters: ProfessionalDirectoryFilters, signal?: AbortSignal) {
  const { data } = await client.get<unknown>('/professionals/map', {
    params: { q: filters.q || undefined, category: filters.category, area: filters.area,
      language: filters.language || undefined, ...directoryLocationParams(filters) }, paramsSerializer: { indexes: null }, signal,
  })
  return readDirectoryMap(data)
}
