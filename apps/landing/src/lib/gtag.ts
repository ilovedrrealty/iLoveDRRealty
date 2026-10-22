import { getMeasurementConsent, isProductionMeasurementHost } from './measurementConsent'
import { measurementPageLocation } from './tracking'

export const GTAG_ID = 'AW-18380940284'

const FORM_CONVERSION_SEND_TO = `${GTAG_ID}/dUepCMyoq-ccEPzH27xE`
const WHATSAPP_CONVERSION_SEND_TO = `${GTAG_ID}/7yWWCM-oq-ccEPzH27xE`

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

// Fire only once the website/server has actually accepted a submitted lead —
// never on a mere click of the submit button.
const measuredLeadIds = new Set<string>()
const DEDUP_KEY = 'ildr_measured_leads_v1'
export interface LeadReceipt { id: string; status: string; measurement?: { eligible: boolean; reason: string; lead_type?: string; intake_source?: string } }

export function trackFormConversion(receipt: LeadReceipt): boolean {
  if (!isProductionMeasurementHost() || getMeasurementConsent() !== 'granted' ||
      !receipt.measurement?.eligible || !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(receipt.id) ||
      typeof window.gtag !== 'function' || measuredLeadIds.has(receipt.id)) return false
  let stored: string[] = []
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(DEDUP_KEY) || '[]')
    if (Array.isArray(parsed)) stored = parsed.filter((id): id is string => typeof id === 'string').slice(-100)
  } catch { /* In-memory deduplication still works when browser storage does not. */ }
  if (stored.includes(receipt.id)) return false
  window.gtag('event', 'conversion', { send_to: FORM_CONVERSION_SEND_TO, transaction_id: receipt.id,
    page_location: measurementPageLocation(), page_title: 'I Love DR Realty — inquiry received',
    lead_type: ['buyer_interest', 'seller_interest', 'rental_interest'].includes(receipt.measurement.lead_type || '') ? receipt.measurement.lead_type : 'other',
    intake_source: ['get_started', 'contact', 'spanish_landing', 'lead_popup'].includes(receipt.measurement.intake_source || '') ? receipt.measurement.intake_source : 'other' })
  measuredLeadIds.add(receipt.id)
  try { window.sessionStorage.setItem(DEDUP_KEY, JSON.stringify([...stored, receipt.id].slice(-100))) } catch { /* best effort */ }
  return true
}

// Fire when someone clicks a WhatsApp button or wa.me link.
export function trackWhatsAppConversion(): void {
  if (isProductionMeasurementHost() && getMeasurementConsent() === 'granted' && typeof window.gtag === 'function') {
    window.gtag('event', 'conversion', { send_to: WHATSAPP_CONVERSION_SEND_TO, page_location: measurementPageLocation(), page_title: 'I Love DR Realty — contact' })
  }
}
