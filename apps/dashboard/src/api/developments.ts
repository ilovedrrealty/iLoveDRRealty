import client from './axios'

export const DEVELOPMENT_UNIT_STATUSES = ['available', 'reserved', 'sold', 'unconfirmed'] as const
export type DevelopmentUnitStatus = typeof DEVELOPMENT_UNIT_STATUSES[number]
export type DevelopmentCurrency = 'USD' | 'DOP'

export type DevelopmentUnit = {
  code: string
  floor: string | null
  area_m2: string | null
  price: string | null
  currency: DevelopmentCurrency | null
  status: DevelopmentUnitStatus
  floor_plan_url: string | null
}

export type DevelopmentDraftUnit = DevelopmentUnit & { floor_plan_approved: boolean }

export type DevelopmentPhase<Unit extends DevelopmentUnit> = {
  code: string
  name_en: string
  name_es: string
  target_delivery: string | null
  units: Unit[]
}

export type DevelopmentPaymentStage = {
  label_en: string
  label_es: string
  due_en: string
  due_es: string
  due_date: string | null
  percent: string | null
  amount: string | null
  currency: DevelopmentCurrency | null
}

export type DevelopmentUpdate = {
  date: string
  title_en: string
  title_es: string
  text_en: string
  text_es: string
}

export type DevelopmentProject<Unit extends DevelopmentUnit> = {
  name_en: string
  name_es: string
  summary_en: string
  summary_es: string
  target_delivery: string | null
  phases: DevelopmentPhase<Unit>[]
  payment_stages: DevelopmentPaymentStage[]
  updates: DevelopmentUpdate[]
}

export type DevelopmentDraft = {
  project: DevelopmentProject<DevelopmentDraftUnit>
  evidence: {
    source_reference: string
    verified_on: string | null
    availability_valid_through: string | null
    private_note: string
  }
}

export type PublishedDevelopment = {
  listing_id: string
  revision: number
  published_at: string
  verified_on: string
  availability_valid_through: string
  availability_current: boolean
  project: DevelopmentProject<DevelopmentUnit>
}

export type AdminDevelopment = {
  listing_id: string
  version: number
  draft_revision: number | null
  reviewed_revision: number | null
  published_revision: number | null
  draft: DevelopmentDraft | null
  published: PublishedDevelopment | null
}

export type DevelopmentRevision = DevelopmentDraft & { revision: number; saved_at: string }
export type DevelopmentAction =
  | { action: 'review' | 'publish'; revision: number }
  | { action: 'withdraw' }

const developmentPath = (listingId: string) => `/admin/developments/${encodeURIComponent(listingId)}`

export async function getDevelopment(listingId: string, signal: AbortSignal): Promise<AdminDevelopment> {
  return (await client.get<AdminDevelopment>(developmentPath(listingId), { signal })).data
}

export async function saveDevelopmentDraft(
  listingId: string, version: number, draft: DevelopmentDraft, signal: AbortSignal,
): Promise<AdminDevelopment> {
  return (await client.put<AdminDevelopment>(`${developmentPath(listingId)}/draft`, {
    expected_version: version, ...draft,
  }, { signal })).data
}

export async function changeDevelopmentStatus(
  listingId: string, version: number, intent: DevelopmentAction, signal: AbortSignal,
): Promise<AdminDevelopment> {
  const payload = intent.action === 'withdraw'
    ? { expected_version: version }
    : { expected_version: version, revision: intent.revision }
  return (await client.post<AdminDevelopment>(`${developmentPath(listingId)}/${intent.action}`, payload, { signal })).data
}

export async function getDevelopmentRevision(
  listingId: string, revision: number, signal: AbortSignal,
): Promise<DevelopmentRevision> {
  return (await client.get<DevelopmentRevision>(`${developmentPath(listingId)}/revisions/${revision}`, { signal })).data
}
