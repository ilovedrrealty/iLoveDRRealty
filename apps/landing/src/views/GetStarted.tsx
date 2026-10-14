'use client'

import { useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Home, KeyRound, TrendingUp } from 'lucide-react'
import { PhoneInput } from 'react-international-phone'
import { isValidPhoneNumber } from 'libphonenumber-js'
import 'react-international-phone/style.css'
import { submitContactLead } from '../api/inquiries'
import { trackFormConversion } from '../lib/gtag'
import { captureTrackingParams, getTrackingReferenceLine } from '../lib/tracking'

type Intent = 'buy' | 'sell' | 'rent'
const INTENTS = [{ value: 'buy', Icon: Home }, { value: 'sell', Icon: TrendingUp }, { value: 'rent', Icon: KeyRound }] as const

export default function GetStarted() {
  const { t } = useTranslation('get_started')
  const params = useSearchParams()
  const preset = params.get('intent')
  const [selectedIntent, setSelectedIntent] = useState<Intent | null>(null)
  const intent = selectedIntent ?? (preset === 'sell' || preset === 'rent' ? preset : 'buy')
  const [form, setForm] = useState({ name: '', phone: '', dialCode: '1', email: '', message: '' })
  const [consent, setConsent] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [followUp, setFollowUp] = useState<'phone' | 'email'>('phone')
  const [error, setError] = useState('')
  const submitting = useRef(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    if (!form.name.trim()) { setError(t('errors.name')); return }
    const email = form.email.trim() || undefined
    const phoneDigits = form.phone.replace(/\D/g, '')
    const phone = !phoneDigits || phoneDigits === form.dialCode ? undefined : form.phone
    if (!phone && !email) { setError(t('errors.contact')); return }
    if (phone && !isValidPhoneNumber(phone)) { setError(t('errors.phone')); return }
    if (!consent) { setError(t('errors.consent')); return }
    setError('')
    submitting.current = true
    setSending(true)
    try {
      captureTrackingParams()
      const notes = [
        '[Get Started inquiry]',
        `Contact consent: ${new Date().toISOString()} | /privacy-policy/ | form v2026-10-14`,
        form.message.trim(),
      ].filter(Boolean).join('\n\n')
      const tracking = getTrackingReferenceLine()?.slice(0, Math.max(0, 1900 - notes.length - 2))
      const lead = await submitContactLead({
        tab: intent === 'sell' ? 'seller' : intent === 'rent' ? 'renter' : 'buyer',
        name: form.name.trim(), email, phone,
        interest: intent === 'sell' ? 'Selling a property' : intent === 'rent' ? 'Renting a property' : 'Buying a property',
        message: [notes, tracking].filter(Boolean).join('\n\n'),
      })
      setFollowUp(phone ? 'phone' : 'email')
      setSent(true)
      // Tracking or browser storage failure must not turn an accepted lead into an error.
      try { trackFormConversion(lead.id) } catch { /* best-effort advertising measurement */ }
      try { sessionStorage.setItem('lead_modal_dismissed', '1') } catch { /* storage unavailable */ }
    } catch {
      setError(t('errors.send'))
    } finally {
      submitting.current = false
      setSending(false)
    }
  }

  const field = 'mt-2 block w-full rounded-xl border border-line bg-white px-3 py-3 text-base text-ink focus:border-sea focus:ring-2 focus:ring-sea/20'
  return (
    <main className="bg-paper2/50 font-sans">
      <div className="mx-auto grid max-w-5xl items-start gap-8 px-4 py-7 sm:px-7 sm:py-12 lg:grid-cols-[.85fr_1fr] lg:gap-14">
        <aside className="order-2 lg:order-1 lg:pt-12">
          <h2 className="text-3xl font-bold leading-tight tracking-tight text-ink">{t('about.heading')}</h2>
          <p className="mt-4 leading-relaxed text-ink2">{t('about.description')}</p>
          <ul className="mt-6 space-y-4 text-sm text-ink2">
            {(['local', 'languages', 'simple'] as const).map(key => <li key={key} className="flex items-start gap-3"><CheckCircle2 size={19} aria-hidden="true" className="shrink-0 text-green" />{t(`about.${key}`)}</li>)}
          </ul>
        </aside>
        <section className="order-1 overflow-hidden rounded-3xl border border-line bg-white shadow-sm lg:order-2" aria-label={t('form_label')}>
          <header className="bg-ink px-5 py-6 text-white sm:px-7">
            <p className="text-xs font-bold tracking-[.14em] text-coral">I LOVE DR REALTY</p>
            <h1 className="mt-3 text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{t(`headlines.${intent}`)}</h1>
            <p className="mt-3 text-sm leading-relaxed text-white/75">{t('intro')}</p>
          </header>
          {sent ? <div className="px-6 py-10 text-center" role="status" aria-live="polite">
            <CheckCircle2 size={42} aria-hidden="true" className="mx-auto text-green" />
            <h2 className="mt-5 text-2xl font-bold text-ink">{t('success.heading')}</h2>
            <p className="mt-3 text-ink2">{t(`success.${followUp}`)}</p>
            <Link href={intent === 'rent' ? '/search/?purpose=rent' : intent === 'buy' ? '/search/' : '/selling/'} className="mt-6 inline-flex rounded-full bg-coral px-6 py-3 font-semibold text-white">{t(intent === 'sell' ? 'success.selling' : 'success.browse')}</Link>
          </div> : <form onSubmit={submit} className="space-y-4 px-5 py-6 sm:px-7" aria-busy={sending}>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-ink">{t('intent_label')}</legend>
              <div className="grid grid-cols-3 gap-2">{INTENTS.map(({ value, Icon }) => <button key={value} type="button" aria-pressed={intent === value} onClick={() => setSelectedIntent(value)} className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-sm font-semibold ${intent === value ? 'border-coral bg-coral text-white' : 'border-line bg-paper2/50 text-ink2'}`}><Icon size={15} aria-hidden="true" />{t(`intents.${value}`)}</button>)}</div>
            </fieldset>
            <label className="block text-sm font-semibold text-ink">{t('name')} <span aria-hidden="true">*</span><input name="name" className={field} autoComplete="name" required maxLength={200} value={form.name} onChange={event => setForm(previous => ({ ...previous, name: event.target.value }))} /></label>
            <div>
              <label htmlFor="get-started-phone" className="mb-2 block text-sm font-semibold text-ink">{t('phone')} <span className="ml-1 text-xs font-normal text-ink2">{t('preferred')}</span></label>
              <PhoneInput defaultCountry="us" value={form.phone} onChange={(phone, metadata) => setForm(previous => ({ ...previous, phone, dialCode: metadata.country.dialCode }))} inputProps={{ id: 'get-started-phone', name: 'phone', autoComplete: 'tel', maxLength: 50, 'aria-describedby': 'get-started-contact-help' }} style={{ width: '100%' }} inputStyle={{ width: '100%', height: '46px', fontSize: '16px', borderColor: '#e4ddcf', borderRadius: '0 12px 12px 0' }} countrySelectorStyleProps={{ buttonStyle: { height: '46px', borderColor: '#e4ddcf', borderRadius: '12px 0 0 12px' } }} />
            </div>
            <label className="block text-sm font-semibold text-ink">{t('email')}<input name="email" className={field} type="email" autoComplete="email" maxLength={254} aria-describedby="get-started-contact-help" value={form.email} onChange={event => setForm(previous => ({ ...previous, email: event.target.value }))} /></label>
            <p id="get-started-contact-help" className="text-xs leading-relaxed text-ink2">{t('contact_help')}</p>
            <label className="block text-sm font-semibold text-ink">{t('comments')}<textarea name="message" className={`${field} resize-y`} rows={3} maxLength={1500} placeholder={t('comments_placeholder')} value={form.message} onChange={event => setForm(previous => ({ ...previous, message: event.target.value }))} /></label>
            <label className="flex items-start gap-2.5 text-xs leading-relaxed text-ink2"><input name="consent" className="mt-0.5 h-4 w-4 shrink-0 accent-coral" type="checkbox" required checked={consent} onChange={event => setConsent(event.target.checked)} /><span>{t('consent')} <Link className="underline" href="/privacy-policy/">{t('privacy')}</Link></span></label>
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={sending} className="min-h-12 w-full rounded-full bg-coral px-5 py-3 font-bold text-white disabled:opacity-60">{t(sending ? 'sending' : 'submit')}</button>
          </form>}
        </section>
      </div>
    </main>
  )
}
