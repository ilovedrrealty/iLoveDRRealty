"use client";

import { Download } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchListingById } from '../api/listings'

export function ListingBrochureDownload({ listingId }: { listingId: string }) {
  const { t, i18n } = useTranslation('property_detail', { keyPrefix: 'brochure' })
  const [working, setWorking] = useState(false)
  const [error, setError] = useState(false)
  const active = useRef<AbortController | null>(null)
  useEffect(() => () => active.current?.abort(), [])

  async function download() {
    if (active.current) return
    const controller = new AbortController()
    active.current = controller
    setWorking(true)
    setError(false)
    try {
      // Repeat the public detail read so a withdrawn or updated listing is
      // never exported from an earlier client render.
      const listing = await fetchListingById(listingId, controller.signal)
      if (controller.signal.aborted) return
      const brochure = await import('../lib/listingBrochure')
      const facts = brochure.listingBrochureFacts(listingId, listing)
      if (!facts) throw new Error('Listing brochure unavailable')
      const locale = i18n.language.startsWith('es') ? 'es' : 'en'
      const bytes = await brochure.createListingBrochure(facts, locale, t)
      if (!controller.signal.aborted) brochure.saveListingBrochure(bytes, facts.id, locale)
    } catch {
      if (!controller.signal.aborted) setError(true)
    } finally {
      active.current = null
      if (!controller.signal.aborted) setWorking(false)
    }
  }

  return <div className="mt-3">
    <button type="button" onClick={download} disabled={working} aria-busy={working}
      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-line px-3 py-2 text-sm font-semibold text-sea hover:bg-paper2 disabled:opacity-60">
      <Download size={15} aria-hidden="true" />
      {t(working ? 'preparing' : 'download')}
    </button>
    {error && <p role="alert" className="mt-2 text-sm text-ink2">{t('error')}</p>}
  </div>
}
