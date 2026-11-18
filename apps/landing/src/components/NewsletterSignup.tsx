'use client'

import { useId, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { NewsletterRequestError, subscribeToNewsletter } from '../api/newsletter'

export default function NewsletterSignup() {
  const { t, i18n } = useTranslation('blog')
  const emailId = useId()
  const consentId = useId()
  const pending = useRef(false)
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState<'accepted' | 'invalid' | 'rate_limited' | 'unavailable' | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current || !consent) return
    pending.current = true
    setSubmitting(true)
    setStatus(null)
    try {
      await subscribeToNewsletter(email, i18n.language.startsWith('es') ? 'es' : 'en')
      setStatus('accepted')
      setEmail('')
      setConsent(false)
    } catch (error) {
      setStatus(error instanceof NewsletterRequestError ? error.code : 'unavailable')
    } finally {
      pending.current = false
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-busy={submitting} className="max-w-120 mx-auto text-left font-sans">
      <label htmlFor={emailId} className="block mb-2 text-sm font-semibold text-white">
        {t('newsletter.email_label')}
      </label>
      <input
        id={emailId}
        type="email"
        name="email"
        autoComplete="email"
        value={email}
        onChange={event => { setEmail(event.target.value); setStatus(null) }}
        placeholder={t('newsletter.placeholder')}
        maxLength={254}
        required
        disabled={submitting}
        className="w-full min-h-12 rounded-xl border border-white/65 bg-white px-4 text-base text-ink outline-offset-2 focus-visible:outline"
      />
      <div className="my-4 flex items-start gap-3">
        <input
          id={consentId}
          type="checkbox"
          checked={consent}
          onChange={event => setConsent(event.target.checked)}
          required
          disabled={submitting}
          className="mt-0.5 min-h-5 min-w-5 accent-white outline-offset-2 focus-visible:outline"
        />
        <label htmlFor={consentId} className="text-sm leading-relaxed text-white">
          {t('newsletter.consent')}
        </label>
      </div>
      <button
        type="submit"
        disabled={submitting || !consent}
        className="w-full min-h-12 rounded-xl bg-white px-4 py-3 text-sm font-bold text-coral-deep cursor-pointer outline-offset-2 focus-visible:outline disabled:opacity-65 disabled:cursor-not-allowed"
      >
        {t(submitting ? 'newsletter.sending' : 'newsletter.cta')}
      </button>
      <p className="mt-3 text-sm text-white/90">
        {t('newsletter.confirmation_note')}{' '}
        <a href="/privacy-policy/" className="underline underline-offset-2">{t('newsletter.privacy')}</a>{' '}
        <span aria-hidden="true">·</span>{' '}
        <a href="/terms-of-service/" className="underline underline-offset-2">{t('newsletter.terms')}</a>
      </p>
      {status && <p role={status === 'accepted' ? 'status' : 'alert'} className="mt-3 rounded-xl bg-white px-4 py-3 text-sm text-ink">
        {t(`newsletter.signup_status.${status}`)}
      </p>}
    </form>
  )
}
