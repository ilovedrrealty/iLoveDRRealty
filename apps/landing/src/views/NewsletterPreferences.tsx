'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { applyNewsletterAction, NewsletterRequestError, readNewsletterLink, type NewsletterAction } from '../api/newsletter'

export default function NewsletterPreferences() {
  const { t, i18n } = useTranslation('blog')
  const tokenRef = useRef<string | null>(null)
  const initialized = useRef(false)
  const pending = useRef(false)
  const [action, setAction] = useState<NewsletterAction | null>()
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState<'subscribed' | 'unsubscribed' | 'invalid' | 'rate_limited' | 'unavailable' | null>(null)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    const { hash, search, pathname } = window.location
    const link = readNewsletterLink(hash)
    if (hash || search) {
      try {
        window.history.replaceState(window.history.state, '', pathname)
      } catch {
        setAction(null)
        return
      }
    }
    tokenRef.current = link?.token ?? null
    setAction(link?.action ?? null)
  }, [])

  async function submit() {
    const token = tokenRef.current
    if (!action || !token || pending.current) return
    pending.current = true
    setSubmitting(true)
    setStatus(null)
    try {
      await applyNewsletterAction(action, token)
      tokenRef.current = null
      setAction(null)
      setStatus(action === 'confirm' ? 'subscribed' : 'unsubscribed')
    } catch (error) {
      const code = error instanceof NewsletterRequestError ? error.code : 'unavailable'
      if (code === 'invalid') {
        tokenRef.current = null
        setAction(null)
      }
      setStatus(code)
    } finally {
      pending.current = false
      setSubmitting(false)
    }
  }

  const language = i18n.language.startsWith('es') ? 'es' : 'en'

  return (
    <main lang={language} className="min-h-screen bg-paper2 px-4 py-10 sm:py-16 font-sans">
      <div className="mx-auto max-w-md rounded-2xl border border-line bg-paper p-5 sm:p-8">
        <div className="mb-5 flex gap-4 text-sm text-sea" role="group" aria-label={t('newsletter.manage.language')}>
          <button type="button" lang="en" aria-pressed={language === 'en'} onClick={() => { void i18n.changeLanguage('en') }}
            className="min-h-11 cursor-pointer underline underline-offset-2 aria-pressed:font-bold">English</button>
          <button type="button" lang="es" aria-pressed={language === 'es'} onClick={() => { void i18n.changeLanguage('es') }}
            className="min-h-11 cursor-pointer underline underline-offset-2 aria-pressed:font-bold">Español</button>
        </div>
        <h1 className="mb-3 text-2xl font-bold text-ink">{t('newsletter.manage.heading')}</h1>
        {action === undefined && <p role="status" className="text-ink2">{t('newsletter.manage.loading')}</p>}
        {action === null && !status && <p className="text-ink2">{t('newsletter.manage.invalid')}</p>}
        {action && (
          <>
            <p className="mb-5 leading-relaxed text-ink2">{t(`newsletter.manage.${action}_note`)}</p>
            <button
              type="button"
              onClick={() => { void submit() }}
              disabled={submitting}
              aria-busy={submitting}
              className="w-full min-h-12 rounded-xl bg-ink px-4 py-3 text-white font-semibold cursor-pointer outline-offset-2 focus-visible:outline disabled:opacity-65 disabled:cursor-not-allowed"
            >
              {t(submitting ? 'newsletter.manage.working' : `newsletter.manage.${action}_button`)}
            </button>
          </>
        )}
        {status && <p role={status === 'subscribed' || status === 'unsubscribed' ? 'status' : 'alert'} className="mt-4 text-ink">
          {t(`newsletter.manage.${status}`)}
        </p>}
        <a href="/blog/" referrerPolicy="no-referrer" className="mt-5 inline-flex min-h-11 items-center text-sm text-sea underline underline-offset-2">
          {t('newsletter.manage.back')}
        </a>
      </div>
    </main>
  )
}
