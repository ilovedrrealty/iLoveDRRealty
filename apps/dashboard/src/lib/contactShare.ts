import { parsePhoneNumberFromString } from 'libphonenumber-js'

/** The caller supplies only contact fields from an already authorized projection. */
export type ShareContact = { name: string; email?: string | null; phone?: string | null }
export type ContactSelection = { name: boolean; email: boolean; phone: boolean }
export type ContactLabels = { name: string; email: string; phone: string }
export const minimalContactSelection = (): ContactSelection => ({ name: true, email: false, phone: false })

export function shareableContact(value: ShareContact): { name: string; email: string; phone: string } {
  const name = typeof value.name === 'string' && !/[\r\n\u0000-\u001f\u007f]/.test(value.name) ? value.name.trim().slice(0, 160) : ''
  const email = typeof value.email === 'string' && value.email.length <= 254
    && /^[^<>()\[\]\\,;:\s@?&#"\u0000-\u001f\u007f]+@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/i.test(value.email) ? value.email : ''
  let phone = ''
  if (typeof value.phone === 'string' && value.phone.trim().startsWith('+') && !/[\r\n\u0000-\u001f\u007f]/.test(value.phone)) {
    const parsed = parsePhoneNumberFromString(value.phone)
    if (parsed?.isValid()) phone = parsed.number
  }
  return { name, email, phone }
}

export function contactPreview(value: ShareContact, selected: ContactSelection, labels: ContactLabels): string {
  const contact = shareableContact(value)
  return ([
    selected.name && contact.name ? `${labels.name}: ${contact.name}` : '',
    selected.email && contact.email ? `${labels.email}: ${contact.email}` : '',
    selected.phone && contact.phone ? `${labels.phone}: ${contact.phone}` : '',
  ]).filter(Boolean).join('\n')
}

/** Opens the user's composer. These links cannot establish that anything was sent. */
export function contactComposeLinks(preview: string, subject: string): { email: string; whatsapp: string } | null {
  if (!preview.trim() || preview.length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(preview)
    || /[\r\n\u0000-\u001f\u007f]/.test(subject) || subject.length > 160) return null
  return { email: `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(preview)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(preview)}` }
}
