const LINK_ID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i

function readLinkId(params: URLSearchParams, key: string): string | null {
  const values = params.getAll(key)
  const value = values[0]
  return values.length === 1 && value?.length === 36 && LINK_ID.test(value) ? value.toLowerCase() : null
}

const SIGN_IN_LINKS = {
  shortlists: { appKey: 'grant', loginKey: 'shortlist' },
  viewings: { appKey: 'listing', loginKey: 'viewing' },
} as const

const VIEWING_SHORTLIST_KEY = 'viewing_shortlist'
const PROFILE_HINTS = ['member_profile', 'professional_profile', 'trade_contact'] as const
const SIGN_IN_INTENTS = ['shortlist', 'viewing', VIEWING_SHORTLIST_KEY, 'shortlist_scope', ...PROFILE_HINTS] as const
export type ViewingShortlistSource = { id: string; scope: 'owned' | 'received' }

function readMemberCode(params: URLSearchParams, key: string): string | null {
  const values = params.getAll(key)
  return values.length === 1 && /^[1-9]\d{0,8}$/.test(values[0]) ? values[0] : null
}

/** Only these fixed profile/contact intents survive the authentication screens. */
export function profileAuthParams(params: URLSearchParams): Record<string, string> | null {
  if (params.has('join') || params.has('directory')) return null
  const present = SIGN_IN_INTENTS.filter(key => params.has(key))
  if (present.length !== 1 || !PROFILE_HINTS.some(key => key === present[0])) return null
  const key = present[0]
  const id = key === 'member_profile' ? readMemberCode(params, key) : readLinkId(params, key)
  return id ? { [key]: id } : null
}

function readViewingShortlistSource(params: URLSearchParams, idKey: string): ViewingShortlistSource | null {
  const id = readLinkId(params, idKey)
  const scopes = params.getAll('shortlist_scope')
  const scope = scopes[0]
  return id && scopes.length === 1 && (scope === 'owned' || scope === 'received') ? { id, scope } : null
}

export function viewingShortlistSource(params: URLSearchParams): ViewingShortlistSource | null {
  return params.has('listing') ? null : readViewingShortlistSource(params, 'shortlist')
}

export function viewingShortlistLink({ id, scope }: ViewingShortlistSource): string {
  if (id.length !== 36 || !LINK_ID.test(id)) throw new Error('Invalid shortlist')
  return `/viewings?workspace=buyer&shortlist=${id.toLowerCase()}&shortlist_scope=${scope}`
}

export function dashboardLoginHint(view: string, params: URLSearchParams): string | null {
  if (view === 'property-network') {
    const tabs = params.getAll('tab'), code = readMemberCode(params, 'member')
    return tabs.length === 1 && tabs[0] === 'people' && code ? `?member_profile=${code}` : null
  }
  if (view === 'professional-directory' || view === 'trade-contacts') {
    const id = readLinkId(params, view === 'professional-directory' ? 'profile' : 'contact')
    return id ? `?${view === 'professional-directory' ? 'professional_profile' : 'trade_contact'}=${id}` : null
  }
  if (view !== 'shortlists' && view !== 'viewings') return null
  if (view === 'viewings' && (params.has('shortlist') || params.has('shortlist_scope'))) {
    const source = viewingShortlistSource(params)
    return source ? `?${VIEWING_SHORTLIST_KEY}=${source.id}&shortlist_scope=${source.scope}` : null
  }
  const { appKey, loginKey } = SIGN_IN_LINKS[view]
  const id = readLinkId(params, appKey)
  return id ? `?${loginKey}=${id}` : null
}

export function dashboardDestination(params: URLSearchParams): string | null {
  if (PROFILE_HINTS.some(key => params.has(key))) {
    const hint = profileAuthParams(params)
    if (!hint) return null
    if (hint.member_profile) return `/property-network?tab=people&member=${hint.member_profile}`
    if (hint.professional_profile) return `/professional-directory?profile=${hint.professional_profile}`
    return `/trade-contacts?workspace=admin&contact=${hint.trade_contact}`
  }
  if (params.has(VIEWING_SHORTLIST_KEY) || params.has('shortlist_scope')) {
    if (params.has(SIGN_IN_LINKS.shortlists.loginKey) || params.has(SIGN_IN_LINKS.viewings.loginKey)) return null
    const source = readViewingShortlistSource(params, VIEWING_SHORTLIST_KEY)
    return source ? viewingShortlistLink(source) : null
  }
  const shortlist = readLinkId(params, SIGN_IN_LINKS.shortlists.loginKey)
  const viewing = readLinkId(params, SIGN_IN_LINKS.viewings.loginKey)
  if (shortlist && !params.has(SIGN_IN_LINKS.viewings.loginKey)) return `/shortlists?grant=${shortlist}`
  if (viewing && !params.has(SIGN_IN_LINKS.shortlists.loginKey)) return `/viewings?listing=${viewing}`
  return null
}
