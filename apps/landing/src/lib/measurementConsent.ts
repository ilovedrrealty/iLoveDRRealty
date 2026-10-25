export type MeasurementConsent = 'granted' | 'denied' | 'unset'
export const MEASUREMENT_CONSENT_EVENT = 'ildr-measurement-consent'
export const MEASUREMENT_CONSENT_STORAGE_KEY = 'ildr_measurement_consent_v1'
const MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000
let sessionChoice: MeasurementConsent = 'unset'
let storageUnavailable = false

export function getMeasurementConsent(): MeasurementConsent {
  if (typeof window === 'undefined') return 'unset'
  if (storageUnavailable) return sessionChoice
  try {
    const saved = JSON.parse(window.localStorage.getItem(MEASUREMENT_CONSENT_STORAGE_KEY) || 'null')
    if (saved && (saved.choice === 'granted' || saved.choice === 'denied') && typeof saved.savedAt === 'number' &&
        saved.savedAt <= Date.now() && Date.now() - saved.savedAt < MAX_AGE_MS) return saved.choice
    return 'unset'
  } catch { return sessionChoice }
}

export function setMeasurementConsent(choice: 'granted' | 'denied'): void {
  if (typeof window === 'undefined') return
  sessionChoice = choice
  try {
    window.localStorage.setItem(MEASUREMENT_CONSENT_STORAGE_KEY, JSON.stringify({ choice, savedAt: Date.now() }))
    if (choice === 'denied') window.localStorage.removeItem('ildr_ad_tracking')
    storageUnavailable = false
  } catch { storageUnavailable = true }
  window.dispatchEvent(new Event(MEASUREMENT_CONSENT_EVENT))
}

export function subscribeToMeasurementStorage(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  function changed(event: StorageEvent) {
    if (event.key !== MEASUREMENT_CONSENT_STORAGE_KEY && event.key !== null) return
    // Another same-origin tab changed/cleared the persisted choice. Its latest
    // value takes precedence over this tab's storage-unavailable fallback.
    sessionChoice = 'unset'
    storageUnavailable = false
    onChange()
  }
  window.addEventListener('storage', changed)
  return () => window.removeEventListener('storage', changed)
}

export function isProductionMeasurementHost(): boolean {
  return typeof window !== 'undefined' && ['ilovedrrealty.com', 'www.ilovedrrealty.com'].includes(window.location.hostname)
}
