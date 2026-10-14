// Google Ads tag (gtag.js) — installed sitewide in the root layout.
// See Website-Developer-Only-Instructions.md items 2-4.

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
export function trackFormConversion(leadId?: string): void {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', 'conversion', { send_to: FORM_CONVERSION_SEND_TO, ...(leadId ? { transaction_id: leadId } : {}) })
  }
}

// Fire when someone clicks a WhatsApp button or wa.me link.
export function trackWhatsAppConversion(): void {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', 'conversion', { send_to: WHATSAPP_CONVERSION_SEND_TO })
  }
}
