const DEFAULT_DASHBOARD = 'https://app.ilovedrrealty.com'

export function viewingRequestUrl(configured: string | undefined, listingId: string): string | null {
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(listingId)) return null
  const setting = configured?.trim()
  let origin = DEFAULT_DASHBOARD
  if (setting) {
    try {
      const url = new URL(setting.includes('://') ? setting : `https://${setting}`)
      if ((url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))
        && !url.username && !url.password) origin = url.origin
    } catch { /* Use the canonical dashboard for malformed configuration. */ }
  }
  const url = new URL('/viewings', origin)
  url.searchParams.set('listing', listingId.toLowerCase())
  return url.href
}
