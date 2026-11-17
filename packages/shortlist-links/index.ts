const GRANT = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i

export function readShortlistGrant(params: URLSearchParams, key: 'grant' | 'shortlist'): string | null {
  const values = params.getAll(key)
  const value = values[0]
  return values.length === 1 && value?.length === 36 && GRANT.test(value) ? value.toLowerCase() : null
}

export function shortlistPath(grant: string): string {
  return `/shortlists?grant=${encodeURIComponent(grant)}`
}
