import client from './axios'
import { isAxiosError } from 'axios'

export const VALUATION_PROPERTY_TYPES = ['villa', 'apartment', 'condo', 'land', 'commercial'] as const
export const VALUATION_CONDITIONS = ['new', 'good', 'fair', 'needs_repairs', 'under_construction'] as const
export type ValuationPropertyType = typeof VALUATION_PROPERTY_TYPES[number]
export type ValuationCondition = typeof VALUATION_CONDITIONS[number]
export type ValuationCurrency = 'USD' | 'DOP'
export type ValuationSoldDecision = 'verified' | 'rejected'

export type ValuationPropertyFacts = {
  property_type: ValuationPropertyType | null
  location: string | null
  area_m2: string | null
  bedrooms: number | null
  bathrooms: string | null
}

export type ValuationSubject = ValuationPropertyFacts & { condition: ValuationCondition | null }
export type ValuationCandidate = ValuationPropertyFacts & {
  listing_id: string
  title: string
  price: string
  currency: ValuationCurrency
}

export type ValuationSoldInput = ValuationPropertyFacts & {
  property_type: ValuationPropertyType
  location: string
  price: string
  currency: ValuationCurrency
  closed_on: string
  source_label: string
  source_reference: string
}

export type ValuationComparable = ValuationPropertyFacts & {
  id: string
  kind: 'asking' | 'sold'
  price: string
  currency: ValuationCurrency
  captured_at: string
  listing_id: string | null
  title: string | null
  closed_on: string | null
  source_label: string | null
  source_reference: string | null
  sold_review: { decision: ValuationSoldDecision; review_note: string; reviewed_at: string; reviewed_by: string } | null
}

export type ValuationReportInput = {
  outcome: 'range' | 'insufficient_evidence'
  notes: string
  price_low?: string
  price_high?: string
  currency?: ValuationCurrency
}

export type ValuationReport = Omit<ValuationReportInput, 'price_low' | 'price_high' | 'currency'> & {
  status: 'current' | 'expired'
  price_low: string | null
  price_high: string | null
  currency: ValuationCurrency | null
  reviewed_at: string
  reviewed_by: string
}

export type ValuationFollowUp = {
  id: string
  follow_up_on: string
  note: string
  created_at: string
  completed_at: string | null
}

export type ValuationWorkspace = {
  lead_id: string
  version: number
  started: boolean
  intake_subject: ValuationSubject | null
  subject: ValuationSubject
  comparables: ValuationComparable[]
  review: ValuationReport | null
  follow_ups: ValuationFollowUp[]
}

const workspacePath = (id: string) => `/staff/leads/${encodeURIComponent(id)}/valuation`
const entryPath = (id: string) => `/comparables/${encodeURIComponent(id)}`

export function valuationErrorStatus(error: unknown): number | undefined {
  return isAxiosError(error) ? error.response?.status : undefined
}

export function valuationAccessDenied(error: unknown): boolean {
  const status = valuationErrorStatus(error)
  return status === 401 || status === 403 || status === 404
}

export async function getSellerValuation(id: string, signal: AbortSignal): Promise<ValuationWorkspace> {
  const { data } = await client.get<ValuationWorkspace>(workspacePath(id), { signal })
  return data
}

export async function saveSellerValuation(id: string, version: number, subject: ValuationSubject, signal: AbortSignal): Promise<ValuationWorkspace> {
  const { data } = await client.put<ValuationWorkspace>(`${workspacePath(id)}/draft`, { expected_version: version, subject }, { signal })
  return data
}

export async function getValuationCandidates(id: string, query: { property_type?: ValuationPropertyType; q?: string }, signal: AbortSignal): Promise<ValuationCandidate[]> {
  const { data } = await client.get<{ items: ValuationCandidate[] }>(`${workspacePath(id)}/asking-candidates`, {
    signal, params: { ...query, limit: 20 },
  })
  return data.items
}

async function postValuation(id: string, path: string, version: number, input: object, signal: AbortSignal): Promise<ValuationWorkspace> {
  const { data } = await client.post<ValuationWorkspace>(`${workspacePath(id)}${path}`, { expected_version: version, ...input }, { signal })
  return data
}

export function addValuationAsking(id: string, version: number, listingId: string, signal: AbortSignal) {
  return postValuation(id, '/comparables/asking', version, { listing_id: listingId }, signal)
}

export function addValuationSold(id: string, version: number, value: ValuationSoldInput, signal: AbortSignal) {
  return postValuation(id, '/comparables/sold', version, value, signal)
}

export async function reviewValuationSold(id: string, version: number, comparableId: string, decision: ValuationSoldDecision, note: string, signal: AbortSignal) {
  const { data } = await client.put<ValuationWorkspace>(`${workspacePath(id)}${entryPath(comparableId)}/sold-review`, {
    expected_version: version, decision, review_note: note,
  }, { signal })
  return data
}

export async function removeValuationComparable(id: string, version: number, comparableId: string, signal: AbortSignal) {
  const { data } = await client.delete<ValuationWorkspace>(`${workspacePath(id)}${entryPath(comparableId)}`, {
    params: { expected_version: version }, signal,
  })
  return data
}

export function reviewSellerValuation(id: string, version: number, report: ValuationReportInput, signal: AbortSignal) {
  return postValuation(id, '/review', version, report, signal)
}

export function scheduleValuationFollowUp(id: string, version: number, date: string, note: string, signal: AbortSignal) {
  return postValuation(id, '/follow-ups', version, { follow_up_on: date, note }, signal)
}

export function completeValuationFollowUp(id: string, version: number, followUpId: string, signal: AbortSignal) {
  return postValuation(id, `/follow-ups/${encodeURIComponent(followUpId)}/complete`, version, {}, signal)
}

export function valuationEvidenceCounts(items: ValuationComparable[]) {
  return {
    asking: items.filter(item => item.kind === 'asking').length,
    sold: items.filter(item => item.kind === 'sold' && item.sold_review?.decision === 'verified').length,
  }
}
