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

export function dashboardLoginHint(view: string, params: URLSearchParams): string | null {
  if (view !== 'shortlists' && view !== 'viewings') return null
  const { appKey, loginKey } = SIGN_IN_LINKS[view]
  const id = readLinkId(params, appKey)
  return id ? `?${loginKey}=${id}` : null
}

export function dashboardDestination(params: URLSearchParams): string | null {
  const shortlist = readLinkId(params, SIGN_IN_LINKS.shortlists.loginKey)
  const viewing = readLinkId(params, SIGN_IN_LINKS.viewings.loginKey)
  if (shortlist && !params.has(SIGN_IN_LINKS.viewings.loginKey)) return `/shortlists?grant=${shortlist}`
  if (viewing && !params.has(SIGN_IN_LINKS.shortlists.loginKey)) return `/viewings?listing=${viewing}`
  return null
}
