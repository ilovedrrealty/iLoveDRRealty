export type ProfessionalLabel = { en: string; es: string }
export type ProfessionalOption = { id: string; label: ProfessionalLabel }
export type ProfessionalOptions = {
  categories: ProfessionalOption[]
  areas: ProfessionalOption[]
  languages: ProfessionalOption[]
}
export type ProfessionalDraft = {
  business_name: string
  contact_name: string
  category_ids: string[]
  service_area_ids: string[]
  descriptions: ProfessionalLabel
  languages: string[]
  public_phone: string
  public_email: string
  public_whatsapp: string
  website_url: string
  photo_url: string
  public_contact_consent: boolean
}
export type PublicProfessional = Omit<ProfessionalDraft, 'public_contact_consent'> & {
  id: string
  approved_at: string | null
}
export type ProfessionalReviewStatus = 'draft' | 'pending' | 'approved' | 'rejected'
export type ProfessionalListingStatus = 'hidden' | 'published' | 'suspended'
export type ProfessionalProfile = {
  id: string
  version: number
  review_status: ProfessionalReviewStatus
  listing_status: ProfessionalListingStatus
  draft: ProfessionalDraft
  published_profile: PublicProfessional | null
  review_note: string | null
  submitted_at: string | null
  reviewed_at: string | null
  published_at: string | null
  created_at: string
  updated_at: string
}
export type ProfessionalOwner = {
  id: string
  display_name: string
  email: string
  role: string
  status: string
  email_verified: boolean
}
export type AdminProfessionalSummary = Pick<ProfessionalProfile,
  'id' | 'version' | 'review_status' | 'listing_status' | 'submitted_at' | 'reviewed_at' | 'published_at' | 'updated_at'> & {
  business_name: string
  contact_name: string
  category_ids: string[]
  service_area_ids: string[]
  owner: ProfessionalOwner
}
export type AdminProfessional = ProfessionalProfile & {
  owner: ProfessionalOwner
  history: { version: number; action: string; note: string | null; actor_id: string | null; created_at: string }[]
}
export type ProfessionalPage<T> = { items: T[]; total: number; limit: number; offset: number }
export const emptyProfessionalDraft = (): ProfessionalDraft => ({
  business_name: '', contact_name: '', category_ids: [], service_area_ids: [],
  descriptions: { en: '', es: '' }, languages: [], public_phone: '', public_email: '',
  public_whatsapp: '', website_url: '', photo_url: '', public_contact_consent: false,
})
export const emptyProfessionalOptions = (): ProfessionalOptions => ({ categories: [], areas: [], languages: [] })
export const professionalLabel = (label: ProfessionalLabel, language: string): string =>
  language.startsWith('es') ? label.es || label.en : label.en || label.es
export const professionalOptionLabels = (ids: string[], options: ProfessionalOption[], language: string): string[] =>
  ids.map(id => { const option = options.find(item => item.id === id); return option ? professionalLabel(option.label, language) : id })

export function normalizeProfessionalDraft(draft: ProfessionalDraft): ProfessionalDraft {
  return {
    ...draft, business_name: draft.business_name.trim(), contact_name: draft.contact_name.trim(),
    descriptions: { en: draft.descriptions.en.trim(), es: draft.descriptions.es.trim() },
    public_phone: draft.public_phone.replace(/[ ()-]/g, ''), public_whatsapp: draft.public_whatsapp.replace(/[ ()-]/g, ''),
    public_email: draft.public_email.trim(), website_url: draft.website_url.trim(),
  }
}

export function professionalContactHref(kind: 'phone' | 'whatsapp' | 'email' | 'website', value: string): string | undefined {
  if (!value.trim()) return undefined
  if (kind === 'phone' || kind === 'whatsapp') {
    const number = value.replace(/[ ()-]/g, '')
    if (!/^\+[1-9]\d{6,14}$/.test(number)) return undefined
    return kind === 'phone' ? `tel:${number}` : `https://wa.me/${number.slice(1)}`
  }
  if (kind === 'email') return /^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(value) ? `mailto:${encodeURIComponent(value)}` : undefined
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : undefined
  } catch { return undefined }
}

export function professionalSubmissionIssues(draft: ProfessionalDraft): string[] {
  const issues: string[] = []
  if (!draft.business_name.trim() && !draft.contact_name.trim()) issues.push('business_name')
  if (!draft.category_ids.length) issues.push('categories')
  if (!draft.service_area_ids.length) issues.push('areas')
  if (!draft.descriptions.en.trim() && !draft.descriptions.es.trim()) issues.push('description')
  if (!draft.public_phone.trim() && !draft.public_email.trim() && !draft.public_whatsapp.trim()) issues.push('contact')
  for (const [key, kind] of [['public_phone', 'phone'], ['public_whatsapp', 'whatsapp'], ['public_email', 'email'], ['website_url', 'website']] as const) {
    if (draft[key].trim() && !professionalContactHref(kind, draft[key].trim())) issues.push(key)
  }
  if (!draft.public_contact_consent) issues.push('consent')
  return issues
}
