'use client'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ManualShareActions } from '../../../../packages/sharing/ManualShareActions'
import { fetchPublicListingShare } from '../lib/listingShare'

export function ListingShare({ listingId }: { listingId: string }) {
  const { i18n } = useTranslation(), locale = i18n.language.startsWith('es') ? 'es' : 'en'
  const load = useCallback((signal: AbortSignal) => fetchPublicListingShare(listingId, locale, signal), [listingId, locale])
  return <ManualShareActions key={listingId + ':' + locale} locale={locale} load={load} />
}
