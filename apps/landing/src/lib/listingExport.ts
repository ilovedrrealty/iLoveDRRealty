// Shared server-side build input; any incomplete scan must fail the export.
export type StaticListing = { id: string; created_at: string | null }

const PAGE_SIZE = 60
const MAX_LISTINGS = 50_000 // Explicit build safety limit; never truncate.
const REQUEST_MS = 15_000
const EXPORT_MS = 120_000
const ID = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function count(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}
function fail(page: number, reason: string): never {
  // Do not log response bodies or untrusted field values into build logs.
  throw new Error(`Listing static export stopped at page ${page}: ${reason}`)
}

export async function listingsForStaticExport(
  apiUrl: string | undefined,
  fetcher: typeof fetch = fetch,
): Promise<StaticListing[]> {
  if (!apiUrl?.trim()) throw new Error('Listing static export requires NEXT_PUBLIC_API_URL')
  const base = new URL(apiUrl)
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)
  if (base.username || base.password || base.search || base.hash
      || (base.protocol !== 'https:' && !(base.protocol === 'http:' && loopback))) {
    throw new Error('Listing static export requires an HTTPS API base or local rehearsal API')
  }
  const apiBase = base.toString().replace(/\/$/, '')
  const rows: StaticListing[] = []
  const seen = new Set<string>()
  const deadline = Date.now() + EXPORT_MS
  let total: number | undefined
  for (let page = 1; total === undefined || rows.length < total; page++) {
    const remaining = deadline - Date.now()
    if (remaining <= 0) fail(page, 'enumeration deadline reached')
    const res = await fetcher(`${apiBase}/listings?page=${page}&page_size=${PAGE_SIZE}&include_aggregates=false`, {
      credentials: 'omit', signal: AbortSignal.timeout(Math.min(REQUEST_MS, remaining)),
    })
    if (!res.ok) fail(page, `API returned HTTP ${res.status}`)
    const data: unknown = await res.json() // Parse/transport errors propagate; no partial return.
    if (Date.now() >= deadline) fail(page, 'enumeration deadline reached')
    if (!record(data) || !Array.isArray(data.items) || !count(data.total)
        || data.page !== page || data.page_size !== PAGE_SIZE) fail(page, 'invalid pagination contract')
    if (data.total > MAX_LISTINGS) fail(page, 'inventory exceeds reviewed build capacity; split sitemap before increasing it')
    if (data.total === 0) fail(page, 'API reports zero listings; current static-export dynamic route requires deliberate empty-inventory handling')
    if (total === undefined) total = data.total
    else if (data.total !== total) fail(page, 'inventory total changed during enumeration')
    const expected = Math.min(PAGE_SIZE, total - rows.length)
    if (data.items.length !== expected) fail(page, 'missing, extra or premature final-page items')
    for (const item of data.items) {
      if (!record(item) || typeof item.id !== 'string' || !ID.test(item.id)) fail(page, 'invalid listing identifier')
      const id = item.id.toLowerCase()
      if (seen.has(id)) fail(page, 'duplicate listing identifier')
      if (!(item.created_at === null || typeof item.created_at === 'string'
          && Number.isFinite(Date.parse(item.created_at)))) fail(page, 'invalid listing creation date')
      seen.add(id)
      rows.push({ id, created_at: item.created_at })
    }
  }
  if (Date.now() >= deadline) fail(0, 'enumeration deadline reached')
  if (rows.length !== total || seen.size !== total) fail(0, 'final inventory count mismatch')
  return rows
}
