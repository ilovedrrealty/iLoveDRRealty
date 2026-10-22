import { getMeasurementConsent } from './measurementConsent'

// Preserves ad click/source identifiers after optional measurement consent so they can be
// attached to a lead whenever one is submitted, even if the visitor lands on
// one page (e.g. the Spanish campaign page) and converts on another (e.g. /contact).
// See Website-Developer-Only-Instructions.md item 5.

const TRACKED_KEYS = ['gclid', 'gbraid', 'wbraid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const

const STORAGE_KEY = 'ildr_ad_tracking'
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

export type TrackingParams = Partial<Record<(typeof TRACKED_KEYS)[number], string>>

function safeValue(key: string, raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const value = raw.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 200)
  let decoded = value
  try { decoded = decodeURIComponent(value) } catch { /* malformed input */ }
  if (!value || decoded.includes('@') || /\+\d[\d ()-]{8,}\d/.test(decoded)) return undefined
  if (['gclid', 'gbraid', 'wbraid'].includes(key) && !/^[A-Za-z0-9_-]{1,200}$/.test(value)) return undefined
  return value
}

// A new tagged arrival replaces the previous campaign. Untagged navigation
// keeps the current attribution for up to 30 days without mixing ad clicks.
export function captureTrackingParams(): void {
  if (typeof window === 'undefined') return
  if (getMeasurementConsent() !== 'granted') {
    try { window.localStorage.removeItem(STORAGE_KEY) } catch { /* storage unavailable */ }
    return
  }
  try {
    const params = new URLSearchParams(window.location.search)
    const found: TrackingParams = {}
    for (const key of TRACKED_KEYS) {
      const value = safeValue(key, params.get(key))
      if (value) found[key] = value
    }
    if (Object.keys(found).length === 0) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, capturedAt: Date.now(), params: found }))
  } catch {
    // Storage unavailable (private mode, etc.) — attribution is best-effort.
  }
}

export function getTrackingParams(): TrackingParams {
  if (typeof window === 'undefined' || getMeasurementConsent() !== 'granted') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const stored = JSON.parse(raw)
    if (stored?.version !== 1 || typeof stored.capturedAt !== 'number' || stored.capturedAt > Date.now() || Date.now() - stored.capturedAt > MAX_AGE_MS || !stored.params || typeof stored.params !== 'object') {
      window.localStorage.removeItem(STORAGE_KEY)
      return {}
    }
    const params: TrackingParams = {}
    for (const key of TRACKED_KEYS) {
      const value = safeValue(key, stored.params[key])
      if (value) params[key] = value
    }
    return params
  } catch {
    return {}
  }
}

export function trackingPagePath(): string {
  if (typeof window === 'undefined') return '/other/'
  const path = window.location.pathname
  return path === '/' || /^\/(get-started|contact|es|buying|selling|rentals|search|professionals|listing\/[a-fA-F0-9-]{36})\/?$/.test(path) ? path : '/other/'
}

// Explicitly override the tag URL so unknown query strings, fragments, form
// values and reset/auth tokens cannot become advertising event parameters.
export function measurementPageLocation(): string {
  const url = new URL(trackingPagePath(), 'https://ilovedrrealty.com')
  if (typeof window !== 'undefined') {
    const current = new URLSearchParams(window.location.search)
    for (const key of TRACKED_KEYS) {
      const value = safeValue(key, current.get(key))
      if (value) url.searchParams.set(key, value)
    }
  }
  return url.href
}
