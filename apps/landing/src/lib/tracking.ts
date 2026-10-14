// Preserves ad click/source identifiers across the visit so they can be
// attached to a lead whenever one is submitted, even if the visitor lands on
// one page (e.g. the Spanish campaign page) and converts on another (e.g. /contact).
// See Website-Developer-Only-Instructions.md item 5.

const TRACKED_KEYS = ['gclid', 'gbraid', 'wbraid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const

const STORAGE_KEY = 'ildr_ad_tracking'
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

type TrackingParams = Partial<Record<(typeof TRACKED_KEYS)[number], string>>

// A new tagged arrival replaces the previous campaign. Untagged navigation
// keeps the current attribution for up to 30 days without mixing ad clicks.
export function captureTrackingParams(): void {
  if (typeof window === 'undefined') return
  try {
    const params = new URLSearchParams(window.location.search)
    const found: TrackingParams = {}
    for (const key of TRACKED_KEYS) {
      const value = params.get(key)
      if (value) found[key] = value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 200)
    }
    if (Object.keys(found).length === 0) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, capturedAt: Date.now(), params: found }))
  } catch {
    // Storage unavailable (private mode, etc.) — attribution is best-effort.
  }
}

export function getTrackingParams(): TrackingParams {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const stored = JSON.parse(raw)
    if (stored?.version !== 1 || typeof stored.capturedAt !== 'number' || stored.capturedAt > Date.now() || Date.now() - stored.capturedAt > MAX_AGE_MS || !stored.params || typeof stored.params !== 'object') return {}
    const params: TrackingParams = {}
    for (const key of TRACKED_KEYS) {
      if (typeof stored.params[key] === 'string') params[key] = stored.params[key].replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 200)
    }
    return params
  } catch {
    return {}
  }
}

// A human-readable line to append to a lead's message, since the lead schema
// has no dedicated ad-tracking columns — "save them with the submitted lead
// whenever possible" per the instructions.
export function getTrackingReferenceLine(): string | null {
  const params = getTrackingParams()
  const entries = Object.entries(params).filter(([, v]) => v)
  if (entries.length === 0) return null
  return `Referencia: ${entries.map(([k, v]) => `${k}=${v}`).join(' | ')}`
}
