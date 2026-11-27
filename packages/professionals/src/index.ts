export type ProfessionalLabel = { en: string; es: string }
export type ProfessionalOption = { id: string; label: ProfessionalLabel }
export type ProfessionalOptions = {
  categories: ProfessionalOption[]
  areas: ProfessionalOption[]
  languages: ProfessionalOption[]
  property_classes?: ProfessionalOption[]
  provider_kinds?: ProfessionalOption[]
  work_scopes?: ProfessionalOption[]
}
export type ProfessionalFacetFilters = { provider_kind?: string[]; property_class?: string[]; work_scope?: string[] }
export type ProfessionalDraft = {
  business_name: string
  contact_name: string
  category_ids: string[]
  provider_kind_ids?: string[]
  property_class_ids?: string[]
  work_scope_ids?: string[]
  custom_services: string[]
  service_area_ids: string[]
  descriptions: ProfessionalLabel
  languages: string[]
  public_phone: string
  public_email: string
  public_whatsapp: string
  website_url: string
  photo_url: string
  google_profile_url?: string
  google_maps_embed_url?: string
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
export type ProfessionalManagement = 'admin_managed' | 'account_owned'
export type AdminProfessionalSummary = Pick<ProfessionalProfile,
  'id' | 'version' | 'review_status' | 'listing_status' | 'submitted_at' | 'reviewed_at' | 'published_at' | 'updated_at'> & {
  business_name: string
  contact_name: string
  category_ids: string[]
  provider_kind_ids?: string[]
  property_class_ids?: string[]
  work_scope_ids?: string[]
  custom_services: string[]
  service_area_ids: string[]
  management_type: ProfessionalManagement
  owner: ProfessionalOwner | null
}
export type AdminProfessional = ProfessionalProfile & {
  management_type: ProfessionalManagement
  owner: ProfessionalOwner | null
  history: { version: number; action: string; note: string | null; actor_id: string | null; created_at: string }[]
}
export type ProfessionalPage<T> = { items: T[]; total: number; limit: number; offset: number }
export const emptyProfessionalDraft = (): ProfessionalDraft => ({
  business_name: '', contact_name: '', category_ids: [], custom_services: [], service_area_ids: [],
  provider_kind_ids: [], property_class_ids: [], work_scope_ids: [],
  descriptions: { en: '', es: '' }, languages: [], public_phone: '', public_email: '',
  public_whatsapp: '', website_url: '', photo_url: '', google_profile_url: '', google_maps_embed_url: '', public_contact_consent: false,
})
export const emptyProfessionalOptions = (): ProfessionalOptions => ({ categories: [], areas: [], languages: [], property_classes: [], provider_kinds: [], work_scopes: [] })
export const professionalLabel = (label: ProfessionalLabel, language: string): string =>
  language.startsWith('es') ? label.es || label.en : label.en || label.es
export const professionalOptionLabels = (ids: string[], options: ProfessionalOption[], language: string): string[] =>
  ids.map(id => { const option = options.find(item => item.id === id); return option ? professionalLabel(option.label, language) : id })

export function normalizeCustomServices(values: string[]): string[] {
  const seen = new Set<string>()
  return values.map(value => value.trim().replace(/\s+/g, ' ')).filter(value => {
    const key = value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}
export function professionalServiceLabels(profile: { category_ids: string[]; custom_services?: string[] }, options: ProfessionalOption[], language: string): string[] {
  return [...professionalOptionLabels(profile.category_ids, options, language),
    ...(profile.category_ids.includes('other_services') ? profile.custom_services ?? [] : [])]
}
export function professionalCustomServicesInvalid(draft: ProfessionalDraft, requireOtherLabel = false): boolean {
  const values = normalizeCustomServices(draft.custom_services ?? [])
  return values.length > 8 || values.some(value => value.length < 2 || value.length > 80 || /[\u0000-\u001f\u007f]/.test(value)) ||
    (values.length > 0 && !draft.category_ids.includes('other_services')) ||
    (requireOtherLabel && draft.category_ids.includes('other_services') && values.length === 0)
}
export function isAdminManagedProfessional(profile: Pick<AdminProfessional, 'management_type' | 'owner'>): boolean {
  return profile.management_type === 'admin_managed' && profile.owner === null
}
export function canApproveProfessional(profile: Pick<AdminProfessional, 'management_type' | 'owner' | 'review_status' | 'listing_status'>): boolean {
  return profile.review_status === 'pending' && profile.listing_status !== 'suspended' &&
    (isAdminManagedProfessional(profile) || Boolean(profile.management_type === 'account_owned' && profile.owner?.email_verified && profile.owner.status === 'active'))
}

export function normalizeProfessionalDraft(draft: ProfessionalDraft): ProfessionalDraft {
  return {
    ...draft, business_name: draft.business_name.trim(), contact_name: draft.contact_name.trim(),
    custom_services: normalizeCustomServices(draft.custom_services ?? []),
    descriptions: { en: draft.descriptions.en.trim(), es: draft.descriptions.es.trim() },
    public_phone: draft.public_phone.replace(/[ ()-]/g, ''), public_whatsapp: draft.public_whatsapp.replace(/[ ()-]/g, ''),
    public_email: draft.public_email.trim(), website_url: draft.website_url.trim(),
    google_profile_url: (draft.google_profile_url ?? '').trim(), google_maps_embed_url: (draft.google_maps_embed_url ?? '').trim(),
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
  if (draft.category_ids.includes('real_estate_agent') && !draft.business_name.trim()) issues.push('company')
  if (!draft.category_ids.length) issues.push('categories')
  if (professionalCustomServicesInvalid(draft, true)) issues.push('custom_services')
  if (!draft.service_area_ids.length) issues.push('areas')
  if (!draft.descriptions.en.trim() && !draft.descriptions.es.trim()) issues.push('description')
  if (!draft.public_phone.trim() && !draft.public_email.trim() && !draft.public_whatsapp.trim()) issues.push('contact')
  for (const [key, kind] of [['public_phone', 'phone'], ['public_whatsapp', 'whatsapp'], ['public_email', 'email'], ['website_url', 'website']] as const) {
    if (draft[key].trim() && !professionalContactHref(kind, draft[key].trim())) issues.push(key)
  }
  if (!draft.public_contact_consent) issues.push('consent')
  issues.push(...professionalGoogleIssues(draft))
  return issues
}

export const professionalGoogleProfileLimit = 2048
export const professionalGoogleEmbedLimit = 4096
const googleCredentialParameters = new Set(['key', 'api_key', 'apikey', 'client', 'signature', 'token', 'access_token',
  'callback', 'url', 'link', 'deep_link_id', 'afl', 'ifl', 'ofl', 'redirect', 'redirect_uri', 'redirect_url', 'redirecturl', 'continue', 'return', 'returnurl'])

function googleUrl(value: string | undefined, limit: number): { raw: string; url: URL } | undefined {
  if (/[\u0000-\u001f\u007f]/.test(value ?? '')) return undefined
  const raw = (value ?? '').trim()
  if (!raw || raw.length > limit || /[\s<>"\\]/.test(raw)
    || /%(?![0-9a-f]{2})/i.test(raw) || /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(raw)) return undefined
  try {
    const authority = raw.match(/^https:\/\/([^/?#]+)/i)?.[1]
    if (!authority || /[:%@]/.test(authority)) return undefined
    const rawPath = raw.match(/^https:\/\/[^/?#]+([^?#]*)/i)?.[1] ?? ''
    if (decodeURIComponent(rawPath).split('/').some(segment => segment === '.' || segment === '..')) return undefined
    const url = new URL(raw)
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) return undefined
    const pairs = [...url.searchParams.entries()], names = pairs.map(([name]) => name.toLowerCase())
    if (pairs.length > 32 || new Set(names).size !== pairs.length || names.some(name => name.includes('%') || googleCredentialParameters.has(name))) return undefined
    return { raw, url }
  } catch { return undefined }
}

export function professionalGoogleProfileHref(value?: string): string | undefined {
  const parsed = googleUrl(value, professionalGoogleProfileLimit)
  if (!parsed) return undefined
  const { raw, url } = parsed, host = url.hostname, pathname = url.pathname
  if (host === 'maps.app.goo.gl' && /^\/[A-Za-z0-9_-]{4,180}\/?$/.test(pathname)) return raw
  if (host === 'g.page' && /^\/(?:r\/)?[A-Za-z0-9_-]{2,180}\/?$/.test(pathname)) return raw
  if (host === 'www.google.com' || host === 'maps.google.com') {
    if (pathname.startsWith('/maps/place/') && pathname.slice('/maps/place/'.length).replace(/\//g, '')) return raw
    if (pathname.startsWith('/maps/search/') && pathname.slice('/maps/search/'.length).replace(/\//g, '')) return raw
    if (['/maps/search', '/maps/search/'].includes(pathname) && url.searchParams.get('api') === '1' && url.searchParams.get('query')?.trim()) return raw
    if (['', '/', '/maps', '/maps/'].includes(pathname) && /^[0-9]{1,30}$/.test(url.searchParams.get('cid') ?? '')) return raw
  }
  return undefined
}

export function professionalGoogleEmbedHref(value?: string): string | undefined {
  const parsed = googleUrl(value, professionalGoogleEmbedLimit)
  if (!parsed) return undefined
  const { raw, url } = parsed, pairs = [...url.searchParams.entries()]
  if (url.hostname !== 'www.google.com' || url.pathname !== '/maps/embed'
    || pairs.some(([name]) => !['pb', 'hl'].includes(name)) || !url.searchParams.get('pb')?.startsWith('!')
    || url.searchParams.has('hl') && !/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/.test(url.searchParams.get('hl') ?? '')) return undefined
  return raw
}

export function professionalGoogleIssues(draft: Pick<ProfessionalDraft, 'google_profile_url' | 'google_maps_embed_url'>): string[] {
  const profile = (draft.google_profile_url ?? '').trim(), embed = (draft.google_maps_embed_url ?? '').trim()
  const issues: string[] = []
  if (profile && !professionalGoogleProfileHref(profile)) issues.push('google_profile_url')
  if (embed && (!profile || !professionalGoogleEmbedHref(embed))) issues.push('google_maps_embed_url')
  return issues
}
