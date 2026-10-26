/** Versioned, USD-only assumptions. No contacts, listing IDs, tokens or arbitrary URLs. */
export type RoiScenario = 'rent' | 'vacation' | 'flip'
export type RoiFinancing = 'mortgage' | 'cash' | 'hard' | 'seller'
export type RoiLocale = 'en' | 'es'
export type RoiState = {
  v: 1; locale: RoiLocale; currency: 'USD'; scenario: RoiScenario; financing: RoiFinancing
  price: number; downPct: number; closingPct: number; reno: number; rate: number; term: number
  rent: number; occupancy: number; rentGrowth: number; propTaxPct: number; mgmtPct: number
  maintPct: number; insPct: number; confoturYrs: number; appRate: number
  flipHoldingMonths: number; flipResalePct: number; flipSellingPct: number
}
export const ROI_DEFAULTS: Readonly<RoiState> = Object.freeze({
  v: 1, locale: 'en', currency: 'USD', scenario: 'rent', financing: 'mortgage',
  price: 500_000, downPct: 25, closingPct: 4, reno: 25_000, rate: 6.5, term: 25,
  rent: 3500, occupancy: 75, rentGrowth: 3, propTaxPct: 1, mgmtPct: 10,
  maintPct: 1.5, insPct: 0.5, confoturYrs: 0, appRate: 5,
  flipHoldingMonths: 8, flipResalePct: 32, flipSellingPct: 3,
})
export const ROI_NUMERIC_BOUNDS = {
  price: [50_000, 5_000_000], downPct: [0, 100], closingPct: [0, 15], reno: [0, 5_000_000],
  rate: [0, 20], term: [5, 30], rent: [0, 30_000], occupancy: [0, 100], rentGrowth: [0, 15],
  propTaxPct: [0, 3], mgmtPct: [0, 30], maintPct: [0, 30], insPct: [0, 30],
  appRate: [0, 20], flipHoldingMonths: [1, 120], flipResalePct: [-50, 200], flipSellingPct: [0, 20],
} as const
type NumericKey = keyof typeof ROI_NUMERIC_BOUNDS
const STATE_KEYS = Object.keys(ROI_DEFAULTS).sort()
export const ROI_SHARE_ORIGIN = 'https://ilovedrrealty.com'
export const ROI_SHARE_PATH = '/calculator/'
export const ROI_MAX_TOKEN_LENGTH = 1600
export const ROI_TAX_SOURCES = Object.freeze([
  { labelKey: 'expenses.dgii_law', url: 'https://dgii.gov.do/legislacion/leyesTributarias/Documents/Leyes%20de%20Incentivos%20y%20Fomentos/195-13.pdf' },
  { labelKey: 'expenses.dgii_ipi', url: 'https://dgii.gov.do/cicloContribuyente/obligacionesTributarias/principalesImpuestos/Paginas/impuestoPatrimonioInmobiliario.aspx' },
])

export function isRoiState(value: unknown): value is RoiState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const item = value as Record<string, unknown>
  if (Object.keys(item).sort().join('|') !== STATE_KEYS.join('|') || item.v !== 1 || item.currency !== 'USD'
    || !['en', 'es'].includes(String(item.locale)) || !['rent', 'vacation', 'flip'].includes(String(item.scenario))
    || !['mortgage', 'cash', 'hard', 'seller'].includes(String(item.financing))
    || typeof item.confoturYrs !== 'number' || !Number.isInteger(item.confoturYrs) || item.confoturYrs < 0 || item.confoturYrs > 15) return false
  return (Object.keys(ROI_NUMERIC_BOUNDS) as NumericKey[]).every(key => {
    const number = item[key]
    const [min, max] = ROI_NUMERIC_BOUNDS[key]
    return typeof number === 'number' && Number.isFinite(number) && number >= min && number <= max
      && Math.abs(number * 100 - Math.round(number * 100)) < 0.000001
      && (!['term', 'flipHoldingMonths'].includes(key) || Number.isInteger(number))
  })
}
export function canonicalRoiState(state: RoiState): RoiState {
  if (!isRoiState(state)) throw new Error('Invalid calculator assumptions')
  return Object.fromEntries(Object.keys(ROI_DEFAULTS).map(key => [key, state[key as keyof RoiState]])) as RoiState
}
export function encodeRoiState(state: RoiState): string {
  const token = btoa(JSON.stringify(canonicalRoiState(state))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  if (token.length > ROI_MAX_TOKEN_LENGTH) throw new Error('Calculator link is too large')
  return token
}
export function decodeRoiState(token: string): RoiState | null {
  if (!token || token.length > ROI_MAX_TOKEN_LENGTH || !/^[A-Za-z0-9_-]+$/.test(token)) return null
  try {
    const value: unknown = JSON.parse(atob(token.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - token.length % 4) % 4)))
    if (!isRoiState(value)) return null
    const state = canonicalRoiState(value)
    return encodeRoiState(state) === token ? state : null
  } catch { return null }
}
export function readRoiFragment(hash: string): { state: RoiState | null; invalid: boolean } {
  if (!hash || !hash.startsWith('#roi=')) return { state: null, invalid: false }
  const state = decodeRoiState(hash.slice(5))
  return { state, invalid: !state }
}
export function roiShareUrl(state: RoiState): string { return ROI_SHARE_ORIGIN + ROI_SHARE_PATH + '#roi=' + encodeRoiState(state) }
export async function copyRoiLink(state: RoiState, writeText?: (value: string) => Promise<void>): Promise<{ url: string; copied: boolean }> {
  const url = roiShareUrl(state)
  if (!writeText) return { url, copied: false }
  try { await writeText(url); return { url, copied: true } } catch { return { url, copied: false } }
}

/** Fixed monthly amortization; annualRate is a fraction, termYears is in years. */
export function roiAmortization(principal: number, annualRate: number, termYears: number, elapsedMonths = 0) {
  if (![principal, annualRate, termYears, elapsedMonths].every(Number.isFinite) || principal < 0 || principal > 10_000_000_000 || annualRate < 0 || annualRate > 1
    || termYears < 1 || termYears > 50 || !Number.isInteger(termYears * 12) || elapsedMonths < 0 || elapsedMonths > 1200 || !Number.isInteger(elapsedMonths)) throw new Error('Invalid amortization inputs')
  const count = termYears * 12
  const r = annualRate / 12
  const payment = principal === 0 ? 0 : r === 0 ? principal / count : principal * r / -Math.expm1(-count * Math.log1p(r))
  const monthsPaid = Math.min(elapsedMonths, count)
  const remainingRaw = monthsPaid === count ? 0 : r === 0 ? principal - payment * monthsPaid
    : principal * Math.exp(monthsPaid * Math.log1p(r)) - payment * Math.expm1(monthsPaid * Math.log1p(r)) / r
  const remaining = Math.min(principal, Math.max(0, remainingRaw))
  const principalPaid = principal - remaining
  const payments = payment * monthsPaid
  const interestPaid = Math.max(0, payments - principalPaid)
  return { payment, remaining, principalPaid, payments, interestPaid, monthsPaid }
}
export type RoiYear = { y: number; rent: number; exp: number; net: number }
export type RoiComparison = { labelKey: string; roi: number | null; cf: number; be: number | null; current?: boolean }
export type RoiResult = {
  flip: boolean; initialCash: number; purchaseCash: number; closingCost: number; loan: number; effectiveRate: number; monthlyMortgage: number
  annualIncome: number; annualOperatingExpense: number; annualDebt: number; noi: number; annualCashFlow: number; monthlyCashFlow: number
  cashOnCash: number | null; grossYield: number; capRate: number; breakeven: number | null; tenYearCashAndValue: number
  resale: number; sellingCost: number; holdingTax: number; holdingInterest: number; holdingCash: number
  principalPaid: number; remainingLoan: number; flipProfit: number; flipReturnOnInitialCash: number | null; saleCashAfterPayoff: number
  years: RoiYear[]; maxBar: number; scenarios: RoiComparison[] | null
}
function ratio(numerator: number, denominator: number): number | null { return denominator > 0 ? numerator / denominator * 100 : null }
function payback(investment: number, flow: number): number | null { return investment > 0 && flow > 0 ? investment / flow : null }

export const ROI_PAYBACK_SCALE_YEARS = 30
export const ROI_PAYBACK_TICKS = Object.freeze([0, 5, 10, 15, 20, 25, 30])
export type RoiPaybackScale = { kind: 'within'; years: number; positionPct: number }
  | { kind: 'beyond'; years: number; positionPct: null }
  | { kind: 'undefined'; years: null; positionPct: null }
/** Constant year-one-flow simple payback; never clamp a later result to year30. */
export function roiSimplePaybackScale(years: number | null): RoiPaybackScale {
  if (years === null || !Number.isFinite(years) || years <= 0) return { kind: 'undefined', years: null, positionPct: null }
  return years > ROI_PAYBACK_SCALE_YEARS ? { kind: 'beyond', years, positionPct: null }
    : { kind: 'within', years, positionPct: years / ROI_PAYBACK_SCALE_YEARS * 100 }
}
/** Net bars show magnitude/sign; an exact zero has no positive-height bar. */
export function roiNetBar(net: number, maximum: number): { kind: 'gain' | 'loss' | 'zero'; heightPx: number } {
  if (!Number.isFinite(net) || !Number.isFinite(maximum) || maximum <= 0) throw new Error('Invalid cash flow chart values')
  return { kind: net === 0 ? 'zero' : net < 0 ? 'loss' : 'gain', heightPx: net === 0 ? 0 : Math.min(140, Math.abs(net) / maximum * 140) }
}

/** One source for screen, report and restored links. No external prices or FX. */
export function calculateRoi(input: RoiState): RoiResult {
  const state = canonicalRoiState(input)
  const { price, downPct, closingPct, reno, financing, rate, term } = state
  const purchaseCash = financing === 'cash' ? price : price * downPct / 100
  const loan = financing === 'cash' ? 0 : price - purchaseCash
  const closingCost = price * closingPct / 100
  const initialCash = purchaseCash + closingCost + reno
  const effectiveRate = rate / 100 + (financing === 'hard' ? 0.04 : 0)
  const amortization = roiAmortization(loan, effectiveRate, term, state.flipHoldingMonths)
  const monthlyMortgage = amortization.payment
  const annualIncome = state.rent * state.occupancy / 100 * 12
  const annualTax = price * state.propTaxPct / 100
  const operatingFor = (year: number, income: number) => (year > state.confoturYrs ? annualTax : 0)
    + income * state.mgmtPct / 100 + price * (state.maintPct + state.insPct) / 100
  const annualOperatingExpense = operatingFor(1, annualIncome)
  const annualDebt = monthlyMortgage * 12
  const noi = annualIncome - annualOperatingExpense
  const annualCashFlow = noi - annualDebt
  const years: RoiYear[] = []
  let tenYearCash = 0
  for (let y = 1; y <= 10; y++) {
    const income = annualIncome * (1 + state.rentGrowth / 100) ** (y - 1)
    const expense = operatingFor(y, income) + (y <= term ? annualDebt : 0)
    const net = income - expense
    if (y <= 5) years.push({ y, rent: income, exp: expense, net })
    tenYearCash += net
  }
  const tenYearCashAndValue = tenYearCash + price * (1 + state.appRate / 100) ** 10 - price
  const fullCash = price + closingCost + reno
  const leveragedCash = price * 0.2 + closingCost + reno
  const leveragedDebt = roiAmortization(price * 0.8, effectiveRate, term).payment * 12
  const exemptCashFlow = annualCashFlow + (state.confoturYrs > 0 ? 0 : annualTax)
  const resale = price * (1 + state.flipResalePct / 100)
  const sellingCost = resale * state.flipSellingPct / 100
  const taxableMonths = Math.max(0, state.flipHoldingMonths - state.confoturYrs * 12)
  const holdingTax = annualTax * taxableMonths / 12
  const holdingInterest = amortization.interestPaid
  const holdingCash = amortization.payments + holdingTax
  const remainingLoan = amortization.remaining
  const saleCashAfterPayoff = resale - sellingCost - remainingLoan
  const flipProfit = resale - price - closingCost - reno - holdingInterest - holdingTax - sellingCost
  return {
    flip: state.scenario === 'flip', initialCash, purchaseCash, closingCost, loan, effectiveRate, monthlyMortgage,
    annualIncome, annualOperatingExpense, annualDebt, noi, annualCashFlow, monthlyCashFlow: annualCashFlow / 12,
    cashOnCash: ratio(annualCashFlow, initialCash), grossYield: annualIncome / price * 100, capRate: noi / price * 100,
    breakeven: payback(initialCash, annualCashFlow), tenYearCashAndValue,
    resale, sellingCost, holdingTax, holdingInterest, holdingCash, principalPaid: amortization.principalPaid,
    remainingLoan, saleCashAfterPayoff, flipProfit, flipReturnOnInitialCash: ratio(flipProfit, initialCash),
    years: state.scenario === 'flip' ? [] : years,
    maxBar: Math.max(1, ...years.flatMap(row => [row.rent, row.exp])) * 1.15,
    scenarios: state.scenario === 'flip' ? null : [
      { labelKey: 'comparison.current_label', roi: ratio(annualCashFlow, initialCash), cf: annualCashFlow / 12, be: payback(initialCash, annualCashFlow), current: true },
      { labelKey: 'comparison.all_cash_label', roi: ratio(noi, fullCash), cf: noi / 12, be: payback(fullCash, noi) },
      { labelKey: 'comparison.leverage_label', roi: ratio(noi - leveragedDebt, leveragedCash), cf: (noi - leveragedDebt) / 12, be: payback(leveragedCash, noi - leveragedDebt) },
      { labelKey: 'comparison.confotur_label', roi: ratio(exemptCashFlow, initialCash), cf: exemptCashFlow / 12, be: payback(initialCash, exemptCashFlow) },
    ],
  }
}

export type RoiTranslate = (key: string, options?: Record<string, unknown>) => string
export type RoiReportRow = { key: string; label: string; value: string; raw: number | string | null; unit: string }
export type RoiReport = { title: string; language: RoiLocale; currency: 'USD'; state: RoiState; url: string; assumptions: RoiReportRow[]; summary: RoiReportRow[]; years: RoiYear[]; comparisons: { label: string; roi: string; cf: string; be: string }[]; notes: string[]; references: { label: string; url: string }[]; result: RoiResult }

export function roiNumber(value: number | null, locale: RoiLocale, unit: 'money' | 'percent' | 'number' = 'number'): string {
  if (value === null || !Number.isFinite(value)) return '—'
  const options: Intl.NumberFormatOptions = unit === 'money' ? { style: 'currency', currency: 'USD', currencyDisplay: 'code', minimumFractionDigits: 2, maximumFractionDigits: 2 }
    : { minimumFractionDigits: unit === 'percent' ? 2 : 0, maximumFractionDigits: 2 }
  return new Intl.NumberFormat(locale === 'es' ? 'es-DO' : 'en-US', options).format(value) + (unit === 'percent' ? '%' : '')
}

export function buildRoiReport(input: RoiState, t: RoiTranslate): RoiReport {
  const state = canonicalRoiState(input), result = calculateRoi(state)
  const assumptionLabels: Record<NumericKey | 'confoturYrs', string> = {
    price: 'property.purchase_price', downPct: 'property.down_payment', closingPct: 'property.closing_costs', reno: state.scenario === 'flip' ? 'property.reno_flip' : 'property.reno_rent',
    rate: 'financing.interest_rate', term: 'financing.loan_term', rent: 'income.monthly_rent', occupancy: 'income.occupancy', rentGrowth: 'income.rent_growth',
    propTaxPct: 'expenses.prop_tax', mgmtPct: 'expenses.mgmt', maintPct: 'expenses.maint', insPct: 'expenses.insurance', confoturYrs: 'expenses.confotur_label', appRate: 'expenses.appreciation',
    flipHoldingMonths: 'flip.holding_months', flipResalePct: 'flip.resale_change', flipSellingPct: 'flip.selling_cost',
  }
  const percentKeys = new Set(['downPct', 'closingPct', 'rate', 'occupancy', 'rentGrowth', 'propTaxPct', 'mgmtPct', 'maintPct', 'insPct', 'appRate', 'flipResalePct', 'flipSellingPct'])
  const moneyKeys = new Set(['price', 'reno', 'rent'])
  const assumptions: RoiReportRow[] = [
    { key: 'scenario', label: t('scenario.title'), value: t(`scenario.${state.scenario}`), raw: state.scenario, unit: '' },
    { key: 'financing', label: t('financing.type_label'), value: t(`financing.${state.financing}`), raw: state.financing, unit: '' },
    { key: 'currency', label: t('report.currency'), value: 'USD', raw: 'USD', unit: 'USD' },
  ]
  for (const key of Object.keys(assumptionLabels) as (NumericKey | 'confoturYrs')[]) {
    const unit = moneyKeys.has(key) ? 'money' : percentKeys.has(key) ? 'percent' : 'number'
    const suffix = key === 'term' || key === 'confoturYrs' ? t('report.years') : key === 'flipHoldingMonths' ? t('report.months') : ''
    assumptions.push({ key, label: t(assumptionLabels[key]), value: roiNumber(state[key], state.locale, unit) + (suffix ? ' ' + suffix : ''), raw: state[key], unit: unit === 'money' ? 'USD' : unit === 'percent' ? '%' : suffix })
  }
  const definitions: [keyof RoiResult, string, 'money' | 'percent' | 'number'][] = state.scenario === 'flip' ? [
    ['flipProfit', 'kpis.flip_profit_label', 'money'], ['flipReturnOnInitialCash', 'kpis.roc_label', 'percent'], ['initialCash', 'kpis.invest_label', 'money'],
    ['resale', 'kpis.resale_label', 'money'], ['closingCost', 'report.closing_amount', 'money'], ['sellingCost', 'kpis.sell_cost_label', 'money'],
    ['monthlyMortgage', 'kpis.mort_label', 'money'], ['effectiveRate', 'report.effective_rate', 'percent'], ['holdingInterest', 'report.holding_interest', 'money'], ['holdingTax', 'report.holding_tax', 'money'],
    ['holdingCash', 'report.holding_cash', 'money'], ['principalPaid', 'report.principal_paid', 'money'], ['remainingLoan', 'report.remaining_loan', 'money'], ['saleCashAfterPayoff', 'report.sale_cash', 'money'],
  ] : [
    ['cashOnCash', 'kpis.roi_label', 'percent'], ['monthlyCashFlow', 'kpis.cf_label', 'money'], ['breakeven', 'kpis.be_label', 'number'],
    ['grossYield', 'kpis.yield_label', 'percent'], ['capRate', 'kpis.cap_label', 'percent'], ['initialCash', 'kpis.invest_label', 'money'],
    ['closingCost', 'report.closing_amount', 'money'], ['loan', 'report.loan_amount', 'money'], ['monthlyMortgage', 'kpis.mort_label', 'money'], ['effectiveRate', 'report.effective_rate', 'percent'],
    ['annualIncome', 'report.annual_income', 'money'], ['annualOperatingExpense', 'report.operating_expense', 'money'], ['noi', 'report.noi', 'money'], ['annualCashFlow', 'report.annual_cash', 'money'],
    ['tenYearCashAndValue', 'kpis.return10_label', 'money'],
  ]
  const summary = definitions.map(([key, label, unit]) => {
    const value = result[key] as number | null
    return { key, label: t(label), value: roiNumber(key === 'effectiveRate' && value !== null ? value * 100 : value, state.locale, unit) + (key === 'breakeven' && value !== null ? ' ' + t('report.years') : ''), raw: value, unit: unit === 'money' ? 'USD' : unit === 'percent' ? '%' : t('report.years') }
  })
  return { title: t('report.title'), language: state.locale, currency: 'USD', state, result, url: roiShareUrl(state), assumptions, summary,
    years: result.years.map(row => ({ ...row })), comparisons: (result.scenarios || []).map(row => ({ label: t(row.labelKey), roi: roiNumber(row.roi, state.locale, 'percent'), cf: roiNumber(row.cf, state.locale, 'money'), be: roiNumber(row.be, state.locale) + (row.be === null ? '' : ' ' + t('report.years')) })),
    notes: ['report.illustrative', 'report.currency_note', 'report.costs', state.scenario === 'flip' ? 'report.flip_definition' : 'report.rental_definition', 'report.exemption_note', 'report.unmodeled', 'report.link_note'].map(key => t(key)),
    references: ROI_TAX_SOURCES.map(source => ({ label: t(source.labelKey), url: source.url })),
  }
}
export function roiWhatsAppUrl(state: RoiState, t: RoiTranslate): string {
  const report = buildRoiReport(state, t)
  const text = [t('report.share_intro'), t(`scenario.${report.state.scenario}`), ...report.summary.slice(0, 2).map(row => `${row.label}: ${row.value}`), t('report.illustrative'), report.url].join('\n')
  // No destination phone number: this opens the user's recipient picker only.
  return 'https://wa.me/?text=' + encodeURIComponent(text)
}
