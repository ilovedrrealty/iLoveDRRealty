import { parsePhoneNumber } from 'libphonenumber-js'
import type { Lead } from '../api/leads'

export function currentBuyerInquiries(leads: Lead[]): Lead[] {
  return leads.filter(lead => lead.type === 'property_inquiry').slice().sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id))
}
export function inquiryStatus(value: string): string {
  return ['new', 'assigned', 'schedule', 'contacted', 'closed'].includes(value) ? value : 'unknown'
}
export function inquiryDate(value: string, language: string): string {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(language.startsWith('es') ? 'es-DO' : 'en-US', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Santo_Domingo',
  }).format(date) : '—'
}
export function inquiryContacts(phone: string | null | undefined, email: string | null | undefined): { phone: string | null; email: string | null } {
  let phoneAction: string | null = null
  try {
    const raw = phone?.trim() ?? ''
    const parsed = raw.startsWith('+') ? parsePhoneNumber(raw) : parsePhoneNumber(raw, 'US')
    if (parsed?.isValid()) phoneAction = `tel:${parsed.number}`
  } catch { /* A malformed saved number is displayed, never turned into a link. */ }
  const address = email?.trim() ?? ''
  const emailAction = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) && !/[\r\n]/.test(address) ? `mailto:${encodeURIComponent(address)}` : null
  return { phone: phoneAction, email: emailAction }
}
