const JOIN_KEY = 'ildr.professional-join.v1'
const JOIN_TTL = 60 * 60 * 1000

export function isProfessionalJoin(search: string): boolean {
  return new URLSearchParams(search).get('join') === 'professional'
}

export function rememberProfessionalJoin(): boolean {
  if (typeof window === 'undefined') return false
  const explicit = isProfessionalJoin(window.location.search)
  try {
    if (explicit) sessionStorage.setItem(JOIN_KEY, String(Date.now()))
    const saved = Number(sessionStorage.getItem(JOIN_KEY) ?? 0)
    return explicit || (saved > 0 && Date.now() - saved < JOIN_TTL)
  } catch { return explicit }
}

export function professionalAuthParams(): Record<string, string> | undefined {
  return rememberProfessionalJoin() ? { join: 'professional' } : undefined
}

/** A join hint selects a fixed screen. It never changes account permissions. */
export function dashboardAfterAuth(dashboardURL: string): string {
  if (!rememberProfessionalJoin()) return dashboardURL
  try { sessionStorage.removeItem(JOIN_KEY) } catch { /* Navigation still works without storage. */ }
  return new URL('/professional-profile', dashboardURL).toString()
}
