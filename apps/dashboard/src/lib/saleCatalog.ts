export const SALE_PAGE_SIZE = 24
export const SALE_CATALOG_PATH = '/sale-properties?workspace=realtor'
export const canBrowseSales = (accountRole: string) => accountRole === 'realtor' || accountRole === 'admin'
export type SaleFilters = { region: string; type: string; beds: string; min_price: string; max_price: string; sort: string; usd_to_dop: string }
export const saleDefaults: SaleFilters = { region: '', type: '', beds: '', min_price: '', max_price: '', sort: 'new', usd_to_dop: '59.5' }
export const saleFilterKeys = Object.keys(saleDefaults) as (keyof SaleFilters)[]
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i

export function validSaleFilters(filters: SaleFilters): boolean {
  const price = (value: string) => !value || /^\d{1,15}(?:\.\d{1,2})?$/.test(value) && Number.isFinite(Number(value))
  return ['region', 'type'].every(key => filters[key as 'region' | 'type'].length <= 80
      && !/[\u0000-\u001f\u007f]/.test(filters[key as 'region' | 'type']))
    && (!filters.beds || /^(?:[0-9]|1[0-9]|20)$/.test(filters.beds))
    && price(filters.min_price) && price(filters.max_price)
    && (!filters.min_price || !filters.max_price || Number(filters.min_price) <= Number(filters.max_price))
    && ['new', 'low', 'high'].includes(filters.sort)
    && /^\d{1,4}(?:\.\d{1,4})?$/.test(filters.usd_to_dop) && Number(filters.usd_to_dop) >= 1 && Number(filters.usd_to_dop) <= 1000
}

export function readSaleQuery(params: URLSearchParams): { filters: SaleFilters; page: number } | null {
  const filters = { ...saleDefaults }
  for (const key of saleFilterKeys) {
    const values = params.getAll(key)
    if (values.length > 1) return null
    if (values.length) filters[key] = values[0].trim()
  }
  const pages = params.getAll('page'), page = pages[0] ?? '1'
  if (pages.length > 1 || !/^[1-9]\d{0,5}$/.test(page) || !validSaleFilters(filters)) return null
  return { filters, page: Number(page) }
}

export function saleQuery(filters: SaleFilters, page = 1): URLSearchParams | null {
  if (!Number.isSafeInteger(page) || page < 1 || page > 999999 || !validSaleFilters(filters)) return null
  const params = new URLSearchParams({ workspace: 'realtor' })
  for (const key of saleFilterKeys) if (filters[key] !== saleDefaults[key]) params.set(key, filters[key])
  if (page > 1) params.set('page', String(page))
  return params
}

/** The existing public detail page provides contact, inquiry and sharing tools. */
export function saleListingPath(id: string): string | null {
  return uuid.test(id) ? `/listing/${id.toLowerCase()}/` : null
}
