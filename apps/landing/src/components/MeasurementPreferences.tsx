'use client'
import { useEffect, useState } from 'react'
import Script from 'next/script'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { GTAG_ID } from '../lib/gtag'
import { getMeasurementConsent, isProductionMeasurementHost, MEASUREMENT_CONSENT_EVENT, setMeasurementConsent, subscribeToMeasurementStorage, type MeasurementConsent } from '../lib/measurementConsent'
import { captureTrackingParams, measurementPageLocation } from '../lib/tracking'

let tagConfigured = false

export default function MeasurementPreferences() {
  const { t } = useTranslation('tracking')
  const [choice, setChoice] = useState<MeasurementConsent>('unset')
  const [ready, setReady] = useState(false)
  const [editing, setEditing] = useState(false)
  const [loadTag, setLoadTag] = useState(false)
  useEffect(() => {
    function syncChoice() {
      const next = getMeasurementConsent()
      setChoice(next)
      setReady(true)
      captureTrackingParams()
      if (!isProductionMeasurementHost()) return
      if (next === 'granted') {
        window.dataLayer = window.dataLayer || []
        window.gtag = window.gtag || function (..._args: unknown[]) { window.dataLayer!.push(arguments) }
        if (!tagConfigured) window.gtag('consent', 'default', { ad_storage: 'denied', analytics_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' })
        window.gtag('consent', 'update', { ad_storage: 'granted', analytics_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'denied' })
        if (!tagConfigured) {
          window.gtag('js', new Date())
          window.gtag('config', GTAG_ID, { allow_ad_personalization_signals: false, send_page_view: false,
            page_location: measurementPageLocation(), page_referrer: '', page_title: 'I Love DR Realty' })
          tagConfigured = true
        }
        setLoadTag(true)
      } else if (typeof window.gtag === 'function') {
        window.gtag('consent', 'update', { ad_storage: 'denied', analytics_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' })
      }
    }
    syncChoice()
    window.addEventListener(MEASUREMENT_CONSENT_EVENT, syncChoice)
    const unsubscribe = subscribeToMeasurementStorage(syncChoice)
    return () => { window.removeEventListener(MEASUREMENT_CONSENT_EVENT, syncChoice); unsubscribe() }
  }, [])
  function choose(next: 'granted' | 'denied') { setMeasurementConsent(next); setEditing(false) }
  return <>
    {loadTag && <Script src={`https://www.googletagmanager.com/gtag/js?id=${GTAG_ID}`} strategy="afterInteractive" />}
    {ready && (choice === 'unset' || editing) ? <section aria-label={t('heading')} className="fixed bottom-4 left-4 right-4 z-300 max-w-lg rounded-2xl border border-line bg-white p-4 shadow-xl sm:right-auto">
      <h2 className="text-sm font-bold text-ink">{t('heading')}</h2>
      <p className="mt-2 text-xs leading-relaxed text-ink2">{t('description')} <Link href="/privacy-policy/" className="underline">{t('privacy')}</Link></p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => choose('denied')} className="min-h-11 flex-1 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink">{t('decline')}</button>
        <button type="button" onClick={() => choose('granted')} className="min-h-11 flex-1 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink">{t('allow')}</button>
        {editing && <button type="button" onClick={() => setEditing(false)} className="min-h-11 px-2 text-xs underline">{t('close')}</button>}
      </div>
    </section> : ready && <button type="button" onClick={() => setEditing(true)} className="fixed bottom-2 left-2 z-50 rounded-full border border-line bg-white px-3 py-2 text-xs text-ink shadow-sm">{t('preferences')}</button>}
  </>
}
