import { dashboardDestination, profileAuthParams } from '../../../../packages/dashboard-links'

const JOIN_KEY = 'ildr.professional-join.v1'
const DIRECTORY_KEY = 'ildr.professional-directory.v1'
const PROFILE_KEY = 'ildr.shared-profile.v1'
const JOIN_TTL = 60 * 60 * 1000

function sharedProfileParams(): Record<string, string> | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const explicit = profileAuthParams(params)
  try {
    if (explicit) {
      sessionStorage.setItem(PROFILE_KEY, JSON.stringify({ at: Date.now(), hint: explicit }))
      sessionStorage.removeItem(JOIN_KEY); sessionStorage.removeItem(DIRECTORY_KEY)
      return explicit
    }
    if (['member_profile', 'professional_profile', 'trade_contact', 'shortlist', 'viewing', 'viewing_shortlist', 'shortlist_scope', 'join', 'directory'].some(key => params.has(key))) {
      sessionStorage.removeItem(PROFILE_KEY)
      return null
    }
    const saved = JSON.parse(sessionStorage.getItem(PROFILE_KEY) ?? 'null') as unknown
    if (typeof saved === 'object' && saved !== null && 'at' in saved && 'hint' in saved
      && typeof saved.at === 'number' && saved.at > 0 && Date.now() >= saved.at && Date.now() - saved.at < JOIN_TTL
      && typeof saved.hint === 'object' && saved.hint !== null && !Array.isArray(saved.hint)) {
      const values = Object.entries(saved.hint)
      if (values.length === 1 && values.every(([, value]) => typeof value === 'string'))
        return profileAuthParams(new URLSearchParams(values as [string, string][]))
    }
    sessionStorage.removeItem(PROFILE_KEY)
  } catch { return explicit }
  return null
}

export function isProfessionalJoin(search: string): boolean {
  return new URLSearchParams(search).get('join') === 'professional'
}

export function rememberProfessionalJoin(): boolean {
  if (typeof window === 'undefined') return false
  const explicit = isProfessionalJoin(window.location.search)
  try {
    if (new URLSearchParams(window.location.search).get('directory') === 'professionals' && !explicit) {
      sessionStorage.setItem(DIRECTORY_KEY, String(Date.now()))
      sessionStorage.removeItem(JOIN_KEY)
      return false
    }
    if (explicit) { sessionStorage.setItem(JOIN_KEY, String(Date.now())); sessionStorage.removeItem(DIRECTORY_KEY) }
    const saved = Number(sessionStorage.getItem(JOIN_KEY) ?? 0)
    return explicit || (saved > 0 && Date.now() - saved < JOIN_TTL)
  } catch { return explicit }
}

export function rememberProfessionalDirectory(): boolean {
  if (typeof window === 'undefined') return false
  const explicit = new URLSearchParams(window.location.search).get('directory') === 'professionals'
  if (isProfessionalJoin(window.location.search)) return false
  try {
    if (explicit) { sessionStorage.setItem(DIRECTORY_KEY, String(Date.now())); sessionStorage.removeItem(JOIN_KEY) }
    const saved = Number(sessionStorage.getItem(DIRECTORY_KEY) ?? 0)
    return explicit || (saved > 0 && Date.now() - saved < JOIN_TTL)
  } catch { return explicit }
}

export function professionalAuthParams(): Record<string, string> | undefined {
  const shared = sharedProfileParams()
  if (shared) return shared
  return rememberProfessionalJoin() ? { join: 'professional' } : rememberProfessionalDirectory() ? { directory: 'professionals' } : undefined
}

/** A join hint selects a fixed screen. It never changes account permissions. */
export function dashboardAfterAuth(dashboardURL: string): string {
  if (typeof window !== 'undefined') {
    const destination = dashboardDestination(new URLSearchParams(window.location.search))
    if (destination) {
      try { sessionStorage.removeItem(PROFILE_KEY); sessionStorage.removeItem(JOIN_KEY); sessionStorage.removeItem(DIRECTORY_KEY) } catch { /* Fixed navigation does not need storage. */ }
      return new URL(destination, dashboardURL).toString()
    }
    const shared = sharedProfileParams()
    const savedDestination = shared ? dashboardDestination(new URLSearchParams(shared)) : null
    if (savedDestination) {
      try { sessionStorage.removeItem(PROFILE_KEY) } catch { /* Fixed navigation does not need storage. */ }
      return new URL(savedDestination, dashboardURL).toString()
    }
  }
  const destination = rememberProfessionalJoin() ? '/professional-profile' : rememberProfessionalDirectory() ? '/professional-directory' : null
  if (!destination) return dashboardURL
  try { sessionStorage.removeItem(JOIN_KEY); sessionStorage.removeItem(DIRECTORY_KEY) } catch { /* Navigation still works without storage. */ }
  return new URL(destination, dashboardURL).toString()
}
