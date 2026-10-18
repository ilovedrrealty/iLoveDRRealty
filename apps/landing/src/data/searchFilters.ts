import { FEATURES } from './searchData'

export const PROPERTY_TYPES = ['Villa', 'Apartment', 'Condo', 'Land', 'Commercial']
export type SearchPurpose = 'sale' | 'rent' | 'investment'
export type SearchSort = 'new' | 'low' | 'high' | 'roi'
export interface SearchFilters {
  purpose: SearchPurpose
  types: string[]
  locations: string[]
  minPrice: number
  maxPrice: number
  beds: string
  minROI: number
  amenities: string[]
  rentalPeriod: 'month' | 'day'
  sort: SearchSort
  page: number
}

const nonnegative = (value: string | null, fallback: number) => {
  if (!value?.trim()) return fallback
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : fallback
}
const unique = (values: string[]) => [...new Set(values.map(value => value.trim()).filter(Boolean))]

export function readSearchFilters(params: URLSearchParams): SearchFilters {
  const purpose = params.get('purpose')
  const sort = params.get('sort')
  const types = unique(params.getAll('type')).flatMap(value => {
    const type = PROPERTY_TYPES.find(option => option.toLowerCase() === value.toLowerCase())
    return type ? [type] : []
  })
  const beds = params.get('beds') ?? 'any'
  return {
    purpose: purpose === 'rent' || purpose === 'investment' ? purpose : 'sale',
    types: unique(types),
    locations: unique(params.getAll('location')).filter(value => value.length <= 80).slice(0, 60),
    minPrice: nonnegative(params.get('minPrice'), 0),
    maxPrice: nonnegative(params.get('budget'), 0),
    beds: ['1', '2', '3', '4', '5'].includes(beds) ? beds : 'any',
    minROI: nonnegative(params.get('roi'), 0),
    amenities: unique(params.getAll('feature')).filter(value => FEATURES.includes(value)),
    rentalPeriod: params.get('rentalPeriod') === 'day' ? 'day' : 'month',
    sort: sort === 'low' || sort === 'high' || sort === 'roi' ? sort : 'new',
    page: Math.max(1, Math.min(1_000_000, Math.floor(nonnegative(params.get('page'), 1)))),
  }
}

export function writeSearchFilters(filters: SearchFilters, current = new URLSearchParams()): URLSearchParams {
  const params = new URLSearchParams(current)
  for (const key of ['purpose', 'type', 'location', 'minPrice', 'budget', 'beds', 'roi', 'feature', 'rentalPeriod', 'sort', 'page']) params.delete(key)
  if (filters.purpose !== 'sale') params.set('purpose', filters.purpose)
  filters.types.forEach(value => params.append('type', value))
  filters.locations.forEach(value => params.append('location', value))
  if (filters.minPrice > 0) params.set('minPrice', String(filters.minPrice))
  if (filters.maxPrice > 0) params.set('budget', String(filters.maxPrice))
  if (filters.beds !== 'any') params.set('beds', filters.beds)
  if (filters.minROI > 0) params.set('roi', String(filters.minROI))
  filters.amenities.forEach(value => params.append('feature', value))
  if (filters.purpose === 'rent' && filters.rentalPeriod === 'day') params.set('rentalPeriod', 'day')
  if (filters.sort !== 'new') params.set('sort', filters.sort)
  if (filters.page > 1) params.set('page', String(filters.page))
  return params
}

export const defaultSearchFilters = (): SearchFilters => readSearchFilters(new URLSearchParams())
