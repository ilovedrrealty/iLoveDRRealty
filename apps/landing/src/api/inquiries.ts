import client from './axios'
import { trackFormConversion, type LeadReceipt } from '../lib/gtag'
import { getMeasurementConsent } from '../lib/measurementConsent'
import { captureTrackingParams, getTrackingParams, trackingPagePath } from '../lib/tracking'

export interface LeadSubmissionAttempt { id?: string; signature?: string }
const activeSubmissions = new WeakMap<LeadSubmissionAttempt, { signature: string; promise: Promise<LeadReceipt> }>()

export interface LeadCreate {
  listing_id: string
  name: string
  email?: string
  phone?: string
  message?: string
  contactConsent: boolean
  locale?: 'en' | 'es'
  conversionIntent?: 'buy' | 'rent' | 'general'
  attempt: LeadSubmissionAttempt
}

export type PropertyInquiryIssue = 'name' | 'contact' | 'phone' | 'email' | 'message' | 'consent'
export function isInquiryPropertyContext(requestedId: string, loadedId: string): boolean {
  const uuid = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i
  return uuid.test(requestedId) && uuid.test(loadedId) && requestedId.toLowerCase() === loadedId.toLowerCase()
}

/** Ignore obsolete property loads and their view/error side effects. */
export function observeInquiryProperty<T extends { id: string }>(requestedId: string,
  fetchProperty: (id: string) => Promise<T>, accept: (property: T) => void,
  reject: () => void, recordView: (id: string) => Promise<unknown>): () => void {
  let active = true
  if (!isInquiryPropertyContext(requestedId, requestedId)) {
    reject()
    return () => { active = false }
  }
  void Promise.resolve().then(() => active ? fetchProperty(requestedId) : undefined).then(property => {
    if (!active || !property) return
    if (!isInquiryPropertyContext(requestedId, property.id)) { reject(); return }
    accept(property)
    if (active) void recordView(property.id).catch(() => {})
  }).catch(() => { if (active) reject() })
  return () => { active = false }
}

export function preparePropertyInquiry(data: {
  name: string; email: string; phone: string; message: string; contactConsent: boolean
}, dialCode: string, validPhone: (phone: string) => boolean) {
  const name = data.name.trim(), email = data.email.trim() || undefined
  const digits = data.phone.replace(/\D/g, '')
  const phone = !digits || digits === dialCode ? undefined : data.phone.trim()
  const message = data.message.trim() || undefined
  let issue: PropertyInquiryIssue | null = null
  if (!name || name.length > 200) issue = 'name'
  else if (!phone && !email) issue = 'contact'
  else if (phone && (phone.length > 50 || !validPhone(phone))) issue = 'phone'
  else if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) issue = 'email'
  else if (data.message.length > 2000) issue = 'message'
  else if (!data.contactConsent) issue = 'consent'
  return { name, email, phone, message, issue }
}

function inquiryTracking(form: 'get_started' | 'contact' | 'spanish_landing' | 'lead_popup' | 'property_inquiry',
  locale: 'en' | 'es', intent: 'buy' | 'sell' | 'rent' | 'general', contactConsent: boolean) {
  captureTrackingParams()
  return {
    form, page_path: trackingPagePath(), locale, intent,
    contact_consent: contactConsent, measurement_consent: getMeasurementConsent(),
    internal_test: typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('internal_test') === '1',
    attribution: getTrackingParams(),
  }
}

async function submitTrackedLead(payload: Record<string, unknown>, attempt: LeadSubmissionAttempt, measure = true): Promise<LeadReceipt> {
  const signature = JSON.stringify(payload)
  const active = activeSubmissions.get(attempt)
  if (active) {
    if (active.signature === signature) return active.promise
    throw new Error('An inquiry is already being submitted')
  }
  if (attempt.signature !== signature || !attempt.id) {
    attempt.id = window.crypto.randomUUID()
    attempt.signature = signature
  }
  const pending = (async () => {
    const response = await client.post<LeadReceipt>('/leads', { ...payload, submission_id: attempt.id })
    // Measurement must never turn a durably accepted inquiry into a form error.
    if (measure) { try { trackFormConversion(response.data) } catch { /* best-effort advertising measurement */ } }
    return response.data
  })()
  activeSubmissions.set(attempt, { signature, promise: pending })
  try { return await pending }
  finally { if (activeSubmissions.get(attempt)?.promise === pending) activeSubmissions.delete(attempt) }
}

export async function submitInquiry(data: LeadCreate): Promise<LeadReceipt> {
  if (!data.contactConsent) throw new Error('Contact consent is required')
  const receipt = await submitTrackedLead({
    type: 'property_inquiry',
    property_id: data.listing_id,
    name: data.name.trim(),
    email: data.email?.trim() || undefined,
    phone: data.phone || undefined,
    message: data.message?.trim() || undefined,
    tracking: inquiryTracking('property_inquiry', data.locale || 'en', data.conversionIntent || 'general', data.contactConsent),
  }, data.attempt, false)
  if (!receipt || !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(receipt.id) || typeof receipt.status !== 'string') {
    throw new Error('Inquiry receipt could not be confirmed')
  }
  // Property inquiries remain conversion-ineligible on the server pending F11.
  return receipt
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
  const payload = {
    type,
    name: data.name,
    email: data.email,
    phone: data.phone || undefined,
    message: parts.join('\n\n').slice(0, 2000),
    tracking: inquiryTracking(data.form || 'contact', data.locale || 'en',
      data.conversionIntent || (data.tab === 'seller' ? 'sell' : data.tab === 'renter' ? 'rent' : 'buy'), data.contactConsent),
  }
  return submitTrackedLead(payload, data.attempt)
}
