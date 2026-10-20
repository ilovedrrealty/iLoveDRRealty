const JOIN_KEY = 'ildr.professional-join.v1'
const DIRECTORY_KEY = 'ildr.professional-directory.v1'
const JOIN_TTL = 60 * 60 * 1000

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
  return rememberProfessionalJoin() ? { join: 'professional' } : rememberProfessionalDirectory() ? { directory: 'professionals' } : undefined
}

/** A join hint selects a fixed screen. It never changes account permissions. */
export function dashboardAfterAuth(dashboardURL: string): string {
  const destination = rememberProfessionalJoin() ? '/professional-profile' : rememberProfessionalDirectory() ? '/professional-directory' : null
  if (!destination) return dashboardURL
  try { sessionStorage.removeItem(JOIN_KEY); sessionStorage.removeItem(DIRECTORY_KEY) } catch { /* Navigation still works without storage. */ }
  return new URL(destination, dashboardURL).toString()
}
