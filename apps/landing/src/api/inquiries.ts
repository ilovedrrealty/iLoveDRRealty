import client from './axios'
import { trackFormConversion, type LeadReceipt } from '../lib/gtag'
import { getMeasurementConsent } from '../lib/measurementConsent'
import { captureTrackingParams, getTrackingParams, trackingPagePath } from '../lib/tracking'

export interface LeadSubmissionAttempt { id?: string; signature?: string }

export interface LeadCreate {
  type?: string
  listing_id?: string
  name: string
  email: string
  phone?: string
  message?: string
}

export async function submitInquiry(data: LeadCreate): Promise<void> {
  await client.post('/leads', {
    type: 'property_inquiry',
    property_id: data.listing_id,
    name: data.name,
    email: data.email,
    phone: data.phone,
    message: data.message,
  })
}

export async function submitContactLead(data: {
  tab: 'buyer' | 'seller' | 'renter'
  name: string
  email?: string
  phone?: string
  interest: string
  message?: string
  form?: 'get_started' | 'contact' | 'spanish_landing' | 'lead_popup'
  locale?: 'en' | 'es'
  conversionIntent?: 'buy' | 'sell' | 'rent' | 'general'
  contactConsent: boolean
  attempt: LeadSubmissionAttempt
}): Promise<LeadReceipt> {
  const type = data.tab === 'seller' ? 'seller_interest' : data.tab === 'renter' ? 'rental_interest' : 'buyer_interest'
  const parts = [`Interest: ${data.interest}`, data.message].filter(Boolean)
  captureTrackingParams()
  const payload = {
    type,
    name: data.name,
    email: data.email,
    phone: data.phone || undefined,
    message: parts.join('\n\n').slice(0, 2000),
    tracking: {
      form: data.form || 'contact', page_path: trackingPagePath(), locale: data.locale || 'en',
      intent: data.conversionIntent || (data.tab === 'seller' ? 'sell' : data.tab === 'renter' ? 'rent' : 'buy'),
      contact_consent: data.contactConsent, measurement_consent: getMeasurementConsent(),
      internal_test: typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('internal_test') === '1',
      attribution: getTrackingParams(),
    },
  }
  const signature = JSON.stringify(payload)
  if (data.attempt.signature !== signature || !data.attempt.id) {
    data.attempt.id = window.crypto.randomUUID()
    data.attempt.signature = signature
  }
  const response = await client.post<LeadReceipt>('/leads', { ...payload, submission_id: data.attempt.id })
  // Measurement must never turn a durably accepted inquiry into a form error.
  try { trackFormConversion(response.data) } catch { /* best-effort advertising measurement */ }
  return response.data
}
