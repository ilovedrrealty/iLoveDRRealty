export const SELLER_VALUATION_ROUTE = { intent: 'sell', request: 'valuation' }
export const VALUATION_PROPERTY_TYPES = ['villa', 'apartment', 'condo', 'land', 'commercial'] as const
export const VALUATION_CONDITIONS = ['new', 'good', 'fair', 'needs_repairs', 'under_construction'] as const
export const VALUATION_LOCATION_LIMIT = 80
export const VALUATION_AREA_LIMIT = 99_999_999.99
export const VALUATION_ROOM_LIMIT = 1000

export type SellerValuationSubject = {
  property_type: typeof VALUATION_PROPERTY_TYPES[number]
  location: string
  area_m2?: number
  bedrooms?: number
  bathrooms?: number
  condition?: typeof VALUATION_CONDITIONS[number]
}

export type SellerValuationFields = Record<keyof SellerValuationSubject, string>
type ValuationIssue = keyof SellerValuationFields
type ValuationResult = { issue: ValuationIssue } | { subject: SellerValuationSubject }

export function blankSellerValuation(): SellerValuationFields {
  return { property_type: '', location: '', area_m2: '', bedrooms: '', bathrooms: '', condition: '' }
}

export function isSellerValuationRoute(params: Pick<URLSearchParams, 'getAll'>): boolean {
  return Object.entries(SELLER_VALUATION_ROUTE).every(([key, value]) => {
    const values = params.getAll(key)
    return values.length === 1 && values[0] === value
  })
}

function optionalNumber(value: string, decimals: number): number | undefined {
  const text = value.trim().replace(',', '.')
  if (!text) return undefined
  const format = decimals === 0 ? /^\d+$/ : new RegExp(`^(?:\\d+(?:\\.\\d{1,${decimals}})?|\\.\\d{1,${decimals}})$`)
  return format.test(text) ? Number(text) : NaN
}

export function prepareSellerValuation(fields: SellerValuationFields): ValuationResult {
  const propertyType = VALUATION_PROPERTY_TYPES.find(value => value === fields.property_type)
  if (!propertyType) return { issue: 'property_type' }
  const location = fields.location.trim()
  if (location.length < 2 || location.length > VALUATION_LOCATION_LIMIT || /[\u0000-\u001f\u007f]/.test(location)) return { issue: 'location' }
  const area = optionalNumber(fields.area_m2, 2)
  if (area !== undefined && (!Number.isFinite(area) || area <= 0 || area > VALUATION_AREA_LIMIT)) return { issue: 'area_m2' }
  const bedrooms = optionalNumber(fields.bedrooms, 0)
  if (bedrooms !== undefined && (!Number.isInteger(bedrooms) || bedrooms < 0 || bedrooms > VALUATION_ROOM_LIMIT)) return { issue: 'bedrooms' }
  const bathrooms = optionalNumber(fields.bathrooms, 1)
  if (bathrooms !== undefined && (!Number.isInteger(bathrooms * 2) || bathrooms < 0 || bathrooms > VALUATION_ROOM_LIMIT)) return { issue: 'bathrooms' }
  const condition = VALUATION_CONDITIONS.find(value => value === fields.condition)
  if (fields.condition && !condition) return { issue: 'condition' }
  return { subject: {
    property_type: propertyType, location,
    ...(area === undefined ? {} : { area_m2: area }),
    ...(bedrooms === undefined ? {} : { bedrooms }),
    ...(bathrooms === undefined ? {} : { bathrooms }),
    ...(condition ? { condition } : {}),
  } }
}
