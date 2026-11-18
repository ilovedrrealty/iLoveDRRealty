export const PURCHASE_COST_CATEGORIES = ['transfer_tax', 'legal', 'notary_registry', 'survey', 'inspection', 'financing', 'other'] as const
export const PURCHASE_COST_CURRENCIES = ['USD', 'DOP'] as const
export const PURCHASE_COST_BASES = ['estimate', 'quote', 'paid'] as const
export const PURCHASE_COST_ROW_LIMIT = 20
export const PURCHASE_COST_LABEL_LIMIT = 80
export const PURCHASE_COST_AMOUNT_MINOR_LIMIT = 9_999_999_999_999

export type PurchaseCostCurrency = typeof PURCHASE_COST_CURRENCIES[number]
export type PurchaseCost = {
  category: typeof PURCHASE_COST_CATEGORIES[number]
  currency: PurchaseCostCurrency
  basis: typeof PURCHASE_COST_BASES[number]
  amount_minor: number
  label?: string
}
export type PurchaseCostRow = Omit<PurchaseCost, 'amount_minor' | 'label'> & { amount: string; label: string }
type Amount = { state: 'blank' | 'invalid' } | { state: 'valid'; minor: number }

export function blankPurchaseCostRow(): PurchaseCostRow {
  return { category: 'other', currency: 'USD', basis: 'estimate', amount: '', label: '' }
}

export function purchaseCostAmount(value: string): Amount {
  const input = value.trim()
  if (!input) return { state: 'blank' }
  if (!/^(?:\d{1,11}(?:[.,]\d{1,2})?|[.,]\d{1,2})$/.test(input)) return { state: 'invalid' }
  const [whole, fraction = ''] = input.split(/[.,]/)
  const minor = Number(whole + fraction.padEnd(2, '0'))
  return Number.isSafeInteger(minor) && minor <= PURCHASE_COST_AMOUNT_MINOR_LIMIT
    ? { state: 'valid', minor } : { state: 'invalid' }
}

function precision(minor: number): [string, string] {
  const digits = String(minor).padStart(3, '0')
  return [digits.slice(0, -2), digits.slice(-2)]
}

export function purchaseCostRows(entries: PurchaseCost[] | undefined): PurchaseCostRow[] {
  return (entries ?? []).map(({ category, currency, basis, amount_minor, label }) => ({
    category, currency, basis, amount: precision(amount_minor).join('.'), label: label ?? '',
  }))
}

export function isPurchaseCosts(value: unknown): value is PurchaseCost[] {
  return Array.isArray(value) && value.length <= PURCHASE_COST_ROW_LIMIT && value.every(entry => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)
      || Object.keys(entry).some(key => !['category', 'currency', 'basis', 'amount_minor', 'label'].includes(key))) return false
    return PURCHASE_COST_CATEGORIES.includes(entry.category) && PURCHASE_COST_CURRENCIES.includes(entry.currency)
      && PURCHASE_COST_BASES.includes(entry.basis) && Number.isSafeInteger(entry.amount_minor)
      && entry.amount_minor >= 0 && entry.amount_minor <= PURCHASE_COST_AMOUNT_MINOR_LIMIT
      && (entry.label === undefined || typeof entry.label === 'string' && [...entry.label].length <= PURCHASE_COST_LABEL_LIMIT)
  })
}

export function preparePurchaseCosts(rows: PurchaseCostRow[]): PurchaseCost[] | null {
  if (rows.length > PURCHASE_COST_ROW_LIMIT) return null
  const costs: PurchaseCost[] = []
  for (const row of rows) {
    const { amount, ...fields } = row
    const value = purchaseCostAmount(amount)
    if (value.state === 'blank') continue
    if (value.state !== 'valid') return null
    costs.push({ ...fields, label: fields.label.trim(), amount_minor: value.minor })
  }
  return isPurchaseCosts(costs) ? costs : null
}

export function equalPurchaseCosts(requested: PurchaseCost[], saved: PurchaseCost[] | undefined): boolean {
  return Boolean(saved && requested.length === saved.length && requested.every((entry, index) => {
    const actual = saved[index]
    return entry.category === actual.category && entry.currency === actual.currency && entry.basis === actual.basis
      && entry.amount_minor === actual.amount_minor && (entry.label ?? '').trim() === (actual.label ?? '')
  }))
}

export function purchaseCostTotals(rows: PurchaseCost[]): Record<PurchaseCostCurrency, number | null> {
  const totals: Record<PurchaseCostCurrency, number | null> = { USD: null, DOP: null }
  for (const row of rows) totals[row.currency] = (totals[row.currency] ?? 0) + row.amount_minor
  return totals
}

export function purchaseCostMoney(minor: number, currency: PurchaseCostCurrency, spanish: boolean): string {
  const [whole, fraction] = precision(minor)
  return new Intl.NumberFormat(spanish ? 'es-DO' : 'en-US', {
    style: 'currency', currency, currencyDisplay: 'code', minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).formatToParts(Number(whole)).map(part => part.type === 'fraction' ? fraction : part.value).join('')
}
