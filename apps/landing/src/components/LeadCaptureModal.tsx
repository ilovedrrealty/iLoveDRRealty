'use client'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { X, Home, TrendingUp, KeyRound, CheckCircle2 } from 'lucide-react'
import { PhoneInput } from 'react-international-phone'
import { isValidPhoneNumber } from 'libphonenumber-js'
import 'react-international-phone/style.css'
import { submitContactLead, type LeadSubmissionAttempt } from '../api/inquiries'

const STORAGE_KEY = 'lead_modal_dismissed'

interface LeadCaptureModalProps {
  open: boolean
  onClose: () => void
  initialTab?: 'buyer' | 'seller' | 'renter'
}

export default function LeadCaptureModal({ open, onClose, initialTab = 'buyer' }: LeadCaptureModalProps) {
  const { t, i18n } = useTranslation('lead_capture')
  const [tab, setTab] = useState<'buyer' | 'seller' | 'renter'>('buyer')
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [dialCode, setDialCode] = useState('1')
  const [consent, setConsent] = useState(false)
  const submitting = useRef(false)
  const attempt = useRef<LeadSubmissionAttempt>({})
  useEffect(() => { if (open) setTab(initialTab) }, [open, initialTab])

  function handleClose() {
    setSent(false)
    onClose()
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting.current) return
    setError('')
    if (!form.name.trim()) { setError(t('error_name')); return }
    const digits = form.phone.replace(/\D/g, '')
    const phone = digits && digits !== dialCode ? form.phone : undefined
    if (!phone && !form.email.trim()) { setError(t('error_contact')); return }
    if (phone && !isValidPhoneNumber(phone)) { setError(t('error_phone')); return }
    if (!consent) { setError(t('error_consent')); return }
    submitting.current = true
    setSending(true)
    try {
      await submitContactLead({
        tab, interest: tab === 'buyer' ? 'Buying a property' : tab === 'renter' ? 'Renting a property' : 'Selling a property',
        name: form.name.trim(),
        email: form.email.trim(),
        phone,
        message: form.message || undefined,
        form: 'lead_popup', locale: i18n.language.startsWith('es') ? 'es' : 'en',
        contactConsent: consent, attempt: attempt.current,
      })
      setSent(true)
      setForm({ name: '', email: '', phone: '', message: '' })
      try { sessionStorage.setItem(STORAGE_KEY, '1') } catch { /* accepted inquiry stays successful */ }
    } catch {
      setError(t('error_submit'))
    } finally {
      submitting.current = false
      setSending(false)
    }
  }

  if (!open) return null

  return (
    // Tidio uses z-index 999999999; the inquiry must remain clickable above it.
    <div className="fixed inset-0 flex items-end sm:items-center justify-center p-4" style={{ zIndex: 1000000000 }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-capture-title"
        className="relative max-h-[calc(100dvh-2rem)] w-full max-w-md rounded-2xl shadow-2xl overflow-y-auto"
        style={{ background: '#fff' }}
      >
        {/* Close */}
        <button
          onClick={handleClose}
          aria-label={t('close')}
          className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center border-0 cursor-pointer transition-colors z-10"
          style={{ background: '#f1f5f9', color: '#64748b' }}
        >
          <X size={14} />
        </button>

        {/* Header */}
        <div className="px-6 pt-6 pb-4" style={{ background: '#00102e' }}>
          <div className="text-[11px] font-bold tracking-[.12em] uppercase mb-2" style={{ color: '#e10f1f' }}>
            I Love DR Realty
          </div>
          <h2 id="lead-capture-title" className="text-[20px] font-extrabold text-white tracking-tight leading-snug mb-1">
            {t('heading')}
          </h2>
          <p className="text-[13px]" style={{ color: 'rgba(255,255,255,.6)' }}>
            {t('subheading')}
          </p>

          {/* Tabs */}
          <div className="flex flex-wrap gap-2 mt-4">
            {(['buyer', 'seller', 'renter'] as const).map(tab_key => (
              <button
                key={tab_key}
                onClick={() => setTab(tab_key)}
                aria-pressed={tab === tab_key}
                className="flex items-center gap-1.5 px-3.5 py-1.75 rounded-full text-[12.5px] font-bold border-0 cursor-pointer transition-all"
                style={{
                  background: tab === tab_key ? '#e10f1f' : 'rgba(255,255,255,.1)',
                  color: tab === tab_key ? 'white' : 'rgba(255,255,255,.6)',
                }}
              >
                {tab_key === 'buyer' ? <Home size={13} /> : tab_key === 'renter' ? <KeyRound size={13} /> : <TrendingUp size={13} />}
                {tab_key === 'buyer' ? t('tab_buying') : tab_key === 'renter' ? t('tab_renting') : t('tab_selling')}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {sent ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: '#1f7a3d18' }}
              >
                <CheckCircle2 size={24} style={{ color: '#1f7a3d' }} />
              </div>
              <div>
                <div className="text-[15px] font-bold text-ink mb-1">{t('success_heading')}</div>
                <div className="text-[13px] text-dim">{t('success_sub')}</div>
              </div>
              <button
                onClick={handleClose}
                className="mt-2 px-5 py-2 rounded-full text-[13px] font-bold text-white border-0 cursor-pointer"
                style={{ background: '#e10f1f' }}
              >
                {t('close')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  required
                  maxLength={200}
                  aria-label={t('ph_name')}
                  placeholder={t('ph_name')}
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full text-[13px] border border-line rounded-xl px-3 py-2.5 font-sans outline-none focus:border-current"
                  style={{ '--tw-border-opacity': 1 } as React.CSSProperties}
                />
                <input
                  type="email"
                  maxLength={254}
                  aria-label={t('ph_email')}
                  placeholder={t('ph_email')}
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full text-[13px] border border-line rounded-xl px-3 py-2.5 font-sans outline-none"
                />
              </div>
              <PhoneInput
                defaultCountry="us"
                placeholder={t('ph_phone')}
                value={form.phone}
                onChange={(phone, meta) => { setDialCode(meta.country.dialCode); setForm(f => ({ ...f, phone })) }}
                inputStyle={{ flex: 1, width: '100%', padding: '0.625rem 0.75rem', border: '1px solid #e4ddcf', borderLeft: 'none', borderRadius: '0 0.75rem 0.75rem 0', backgroundColor: '#ffffff', fontFamily: 'inherit', fontSize: '0.8125rem', color: '#00102e', outline: 'none' }}
                countrySelectorStyleProps={{ buttonStyle: { border: '1px solid #e4ddcf', borderRight: 'none', borderRadius: '0.75rem 0 0 0.75rem', backgroundColor: '#f8f8f8', padding: '0 0.5rem', cursor: 'pointer', height: '100%' } }}
              />
              <textarea
                rows={3}
                maxLength={1500}
                aria-label={t('comments_label')}
                placeholder={tab === 'buyer' ? t('ph_buyer_msg') : tab === 'renter' ? t('ph_renter_msg') : t('ph_seller_msg')}
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                className="w-full text-[13px] border border-line rounded-xl px-3 py-2.5 font-sans outline-none resize-none"
              />
              <p className="text-xs text-dim">{t('contact_help')}</p>
              <label className="flex items-start gap-2 text-xs leading-relaxed text-ink2"><input type="checkbox" required checked={consent} onChange={event => setConsent(event.target.checked)} className="mt-0.5 shrink-0 accent-coral" /><span>{t('consent')} <Link className="underline" href="/privacy-policy/">{t('privacy_link')}</Link></span></label>
              {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
              <button
                type="submit"
                disabled={sending}
                className="w-full py-2.5 rounded-full text-[13.5px] font-bold text-white border-0 cursor-pointer disabled:opacity-60 transition-opacity"
                style={{ background: '#e10f1f' }}
              >
                {sending ? t('sending') : t('submit')}
              </button>
              <p className="text-[11px] text-center text-dim">
                {t('privacy')}
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
