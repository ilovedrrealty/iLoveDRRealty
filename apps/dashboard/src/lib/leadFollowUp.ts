import { parsePhoneNumberFromString } from 'libphonenumber-js'
import { manualTargetUrl } from '../../../../packages/sharing/manual'
import { shareableContact } from './contactShare'

export type DraftLanguage = 'en' | 'es'
export type DraftKind = 'welcome' | 'buyer' | 'seller' | 'renter' | 'inquiry' | 'booking'
export type FollowUpLead = {
  id: string; type: string; name: string; email: string; phone: string; propertyId: string | null
  actorId: string; actorRole: 'admin' | 'realtor'; assigneeId: string | null
}
export type FollowUpDraft = { subject: string; body: string; publicUrl: string | null }
export type FollowUpAction = 'copy' | 'email' | 'whatsapp' | 'call' | 'property'
export const draftKinds: readonly DraftKind[] = ['welcome', 'buyer', 'seller', 'renter', 'inquiry', 'booking']
export const isId = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value)
const line = (value: unknown, max: number): value is string => typeof value === 'string' && value.length <= max && !/[\u0000-\u001f\u007f-\u009f]/.test(value)
function uriText(value: string): boolean { try { encodeURIComponent(value); return true } catch { return false } }

export function recipientName(value: unknown): string {
  return line(value, 240) ? value.trim().slice(0, 160) : ''
}

/** Never apply the national/default-country display fallback to a destination. */
export function internationalDestination(value: unknown): string | null {
  if (!line(value, 50) || !/^\+[0-9][0-9 ().-]{5,48}$/.test(value.trim())) return null
  const parsed = parsePhoneNumberFromString(value.trim())
  return parsed?.isValid() && !parsed.ext ? parsed.number : null
}

export function projectFollowUpLead(value: unknown, actor: { id: string; role: 'admin' | 'realtor' }): FollowUpLead | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (!isId(row.id) || !['property_inquiry', 'booking', 'buyer_interest', 'seller_interest', 'rental_interest'].includes(String(row.type))
    || !(row.assigned_realtor_id === null || isId(row.assigned_realtor_id))
    || !(row.property_id === null || isId(row.property_id))
    || !(row.email === null || typeof row.email === 'string') || !(row.phone === null || typeof row.phone === 'string')
    || typeof row.name !== 'string' || actor.role === 'realtor' && row.assigned_realtor_id !== actor.id) return null
  const safe = shareableContact({ name: row.name, email: row.email as string | null, phone: row.phone as string | null })
  return { id: row.id.toLowerCase(), type: String(row.type), name: recipientName(safe.name), email: safe.email, phone: safe.phone,
    propertyId: typeof row.property_id === 'string' ? row.property_id.toLowerCase() : null,
    actorId: actor.id, actorRole: actor.role, assigneeId: row.assigned_realtor_id as string | null }
}

export function defaultDraftKind(type: string): DraftKind {
  return ({ buyer_interest: 'buyer', seller_interest: 'seller', rental_interest: 'renter', property_inquiry: 'inquiry', booking: 'booking' } as Record<string, DraftKind>)[type] ?? 'welcome'
}

export function welcomeDraft(language: DraftLanguage, kind: DraftKind, name: string): { subject: string; body: string } {
  const who = recipientName(name)
  const questions = language === 'es' ? {
    welcome: '¿Qué necesita y cuál es el mejor momento y medio para darle seguimiento?',
    buyer: '¿Qué zonas, tipo de propiedad y presupuesto aproximado considera? ¿Cuándo le gustaría comprar y, si le interesa una visita, qué horario le conviene?',
    seller: '¿En qué zona está la propiedad y cuáles son sus características principales? ¿Busca ayuda para venderla o le gustaría conversar sobre una valoración?',
    renter: '¿Qué zona, fechas o duración de estadía, presupuesto aproximado y número de ocupantes considera?',
    inquiry: '¿Qué le gustaría saber sobre la propiedad? Si desea conversar sobre una visita, indíquenos sus fechas y horarios preferidos.',
    booking: '¿Qué fechas y número de huéspedes considera? Antes de una reserva habrá que confirmar disponibilidad y condiciones.'
  } : {
    welcome: 'What can we help with, and what time and contact method would suit you for a follow-up?',
    buyer: 'Which areas, property type and approximate budget are you considering? When would you like to buy, and, if you would like to discuss a viewing, what times suit you?',
    seller: 'Where is the property and what are its main features? Are you looking for help selling it, or would you like to discuss a valuation?',
    renter: 'Which area, dates or length of stay, approximate budget and number of occupants are you considering?',
    inquiry: 'What would you like to know about the property? If you would like to discuss a viewing, please share your preferred dates and times.',
    booking: 'Which dates and number of guests are you considering? Availability and terms need to be confirmed before any booking.'
  }
  return language === 'es'
    ? { subject: 'Gracias por contactar a I Love DR Realty', body: [`Hola${who ? ' ' + who : ''},`, 'Gracias por contactar a I Love DR Realty. Nos alegra saber de usted.', questions[kind], 'Saludos,\nI Love DR Realty'].join('\n\n') }
    : { subject: 'Thank you for contacting I Love DR Realty', body: [`Hello${who ? ' ' + who : ''},`, 'Thank you for contacting I Love DR Realty. We are glad to hear from you.', questions[kind], 'Kind regards,\nI Love DR Realty'].join('\n\n') }
}

export function validFollowUpDraft(value: FollowUpDraft): boolean {
  return line(value.subject, 160) && !!value.subject.trim() && typeof value.body === 'string' && !!value.body.trim()
    && value.body.length <= 4000 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(value.body)
    && (value.publicUrl === null || /^https:\/\/ilovedrrealty\.com\/listing\/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\/$/.test(value.publicUrl))
    && messagePreview(value).length <= 4000
    && uriText(value.subject) && uriText(messagePreview(value))
}

export function messagePreview(value: FollowUpDraft): string {
  return value.publicUrl ? value.body + '\n\n' + value.publicUrl : value.body
}

/** Recipient-targeted manual handoffs only; these functions do not send or record contact. */
export function followUpDestination(action: 'email' | 'whatsapp' | 'call', lead: FollowUpLead, draft: FollowUpDraft): string | null {
  const number = internationalDestination(lead.phone)
  if (action === 'call') return number ? 'tel:' + number : null
  if (!validFollowUpDraft(draft)) return null
  if (action === 'email') {
    const email = shareableContact({ name: '', email: lead.email }).email
    return email && uriText(email) ? 'mailto:' + encodeURIComponent(email) + '?subject=' + encodeURIComponent(draft.subject) + '&body=' + encodeURIComponent(messagePreview(draft)) : null
  }
  return number ? 'https://wa.me/' + number.slice(1) + '?text=' + encodeURIComponent(messagePreview(draft)) : null
}

export function propertyDraftUrl(id: string): string | null { return manualTargetUrl({ kind: 'listing', id }) }
export function followUpIdentity(lead: FollowUpLead): string { return JSON.stringify(lead) }
