import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isAxiosError } from 'axios'
import { downloadLocationWorksheet, getLocationQueue, getLocationReview, getLocationSummary, locationDestinationCandidate, safeLocationMapUrl, saveLocationReview } from '../../api/locationReview'
import type { LocationDetail, LocationListingStatus, LocationPage, LocationPrecision, LocationReviewFilter, LocationSource, LocationStatus, LocationSummary } from '../../api/locationReview'

const LIMIT = 25
const input = 'w-full min-w-0 rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-coral'
const button = 'rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-50'
const primary = 'rounded-xl bg-coral px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50'
const sources: LocationSource[] = ['owner_confirmation', 'partner_record', 'site_visit', 'property_document', 'map_destination']
type Draft = { latitude: string; longitude: string; maps_url: string; source_type: LocationSource | ''; source_reference: string; review_note: string; review_status: LocationStatus; public_precision: LocationPrecision; confirmed_property: boolean }
const fromDetail = (row: LocationDetail): Draft => ({ latitude: String(row.latitude ?? ''), longitude: String(row.longitude ?? ''), maps_url: row.maps_url ?? '', source_type: sources.includes(row.source_type as LocationSource) ? row.source_type as LocationSource : '', source_reference: row.source_reference, review_note: row.review_note, review_status: row.review_status, public_precision: row.public_precision, confirmed_property: false })

export function AdminLocationReview() {
  const { t, i18n } = useTranslation('location_review')
  const fieldId = useId()
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [listingStatus, setListingStatus] = useState<LocationListingStatus>('active')
  const [filter, setFilter] = useState<LocationReviewFilter>('missing')
  const [offset, setOffset] = useState(0)
  const [refresh, setRefresh] = useState(0)
  const [summary, setSummary] = useState<LocationSummary | null>(null)
  const [page, setPage] = useState<LocationPage>({ items: [], total: 0, offset: 0, limit: LIMIT })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [reloadDetail, setReloadDetail] = useState(0)
  const [detail, setDetail] = useState<LocationDetail | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [stale, setStale] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const date = (value: string) => new Date(value).toLocaleString(i18n.language.startsWith('es') ? 'es-DO' : 'en-US')

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setLoadError(false)
    const params = { listing_status: listingStatus, q: search || undefined }
    Promise.all([getLocationSummary(params, controller.signal), getLocationQueue({ ...params, review_filter: filter, offset, limit: LIMIT }, controller.signal)])
      .then(([nextSummary, nextPage]) => { if (!controller.signal.aborted) { setSummary(nextSummary); setPage(nextPage) } })
      .catch(() => { if (!controller.signal.aborted) setLoadError(true) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [listingStatus, search, filter, offset, refresh])

  useEffect(() => {
    setDetail(null); setDraft(null); setSaved(false); setStale(false); setDetailError('')
    if (!selected) return
    const controller = new AbortController()
    setDetailLoading(true)
    getLocationReview(selected, controller.signal).then(next => {
      if (!controller.signal.aborted) { setDetail(next); setDraft(fromDetail(next)) }
    }).catch(() => { if (!controller.signal.aborted) setDetailError(t('load_error')) })
      .finally(() => { if (!controller.signal.aborted) setDetailLoading(false) })
    return () => controller.abort()
  }, [selected, reloadDetail, t])
  useEffect(() => { if (detail) heading.current?.focus() }, [detail?.listing_id])

  function change<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft(previous => previous ? { ...previous, [key]: value, ...(key === 'confirmed_property' ? {} : { confirmed_property: false }) } : previous)
    setSaved(false)
  }
  async function save() {
    if (!detail || !draft || saving || stale) return
    const latitude = draft.latitude.trim(), longitude = draft.longitude.trim()
    if (!!latitude !== !!longitude || (latitude && (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude)) || Math.abs(Number(latitude)) > 90 || Math.abs(Number(longitude)) > 180)) || (draft.maps_url.trim() && !safeLocationMapUrl(draft.maps_url.trim()))) {
      setDetailError(t('invalid')); return
    }
    if (draft.review_status === 'verified' && (!latitude || !draft.confirmed_property || !draft.source_type || draft.source_reference.trim().length < 3)) {
      setDetailError(t('verification_required')); return
    }
    setSaving(true); setDetailError(''); setSaved(false)
    try {
      const next = await saveLocationReview(detail.listing_id, { ...draft, expected_version: detail.version, expected_listing_updated_at: detail.listing_updated_at,
        latitude: latitude || null, longitude: longitude || null, maps_url: draft.maps_url.trim() || null, source_type: draft.source_type || null })
      setDetail(next); setDraft(fromDetail(next)); setSaved(true); setRefresh(value => value + 1)
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 422) setDetailError(t('invalid'))
      else { setStale(true); setDetailError(t(isAxiosError(error) && error.response?.status === 409 ? 'conflict' : 'save_unknown')) }
    } finally { setSaving(false) }
  }
  async function download() {
    setExporting(true); setExportError(false)
    try { await downloadLocationWorksheet({ listing_status: listingStatus, q: search || undefined }) }
    catch { setExportError(true) }
    finally { setExporting(false) }
  }
  const cards: (keyof LocationSummary)[] = ['total', 'public_mapped', 'verified', 'unreviewed', 'needs_review', 'missing_coordinates', 'private_positions', 'with_source_reference']
  const destinationCandidate = draft ? locationDestinationCandidate(draft.maps_url) : null
  const formField = (key: 'latitude' | 'longitude' | 'maps_url' | 'source_reference') => <div className="min-w-0"><label className="mb-1.5 block text-sm font-semibold" htmlFor={`${fieldId}-${key}`}>{t(key)}</label><input id={`${fieldId}-${key}`} className={input} value={draft?.[key] ?? ''} inputMode={key === 'latitude' || key === 'longitude' ? 'decimal' : undefined} maxLength={key === 'maps_url' ? 2048 : key === 'source_reference' ? 500 : 30} onChange={event => change(key, event.target.value)} /></div>
  return <div className="min-w-0 space-y-6">
    <div><h2 className="text-xl font-bold text-ink">{t('title')}</h2><p className="mt-2 max-w-4xl text-sm leading-relaxed text-ink2">{t('intro')}</p></div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{cards.map(key => <div key={key} className="rounded-xl border border-line bg-white p-4"><p className="text-xs text-dim">{t(`summary.${key}`)}</p><p className="mt-2 text-2xl font-bold text-ink">{loading || loadError || !summary ? '—' : summary[key].toLocaleString()}</p></div>)}</div>
    <p className="text-xs leading-relaxed text-dim">{t('summary_help')}</p>
    <form className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_180px_200px_auto]" onSubmit={event => { event.preventDefault(); setSearch(query.trim()); setOffset(0) }}>
      <div><label htmlFor={`${fieldId}-search`} className="mb-1.5 block text-sm font-semibold">{t('search')}</label><input id={`${fieldId}-search`} className={input} type="search" maxLength={100} value={query} onChange={event => setQuery(event.target.value)} /></div>
      <div><label htmlFor={`${fieldId}-listing-status`} className="mb-1.5 block text-sm font-semibold">{t('listing_status')}</label><select id={`${fieldId}-listing-status`} className={input} value={listingStatus} onChange={event => { setListingStatus(event.target.value as LocationListingStatus); setOffset(0) }}>{['active', 'pending_approval', 'draft', 'rejected', 'archived', 'all'].map(value => <option key={value} value={value}>{t(`listing.${value}`)}</option>)}</select></div>
      <div><label htmlFor={`${fieldId}-review-filter`} className="mb-1.5 block text-sm font-semibold">{t('review_filter')}</label><select id={`${fieldId}-review-filter`} className={input} value={filter} onChange={event => { setFilter(event.target.value as LocationReviewFilter); setOffset(0) }}>{['missing', 'unreviewed', 'needs_review', 'verified', 'private', 'all'].map(value => <option key={value} value={value}>{t(`filter.${value}`)}</option>)}</select></div>
      <button type="submit" className={`${button} self-end`}>{t('apply')}</button>
    </form>
    <div className="rounded-xl border border-line bg-white p-4"><button type="button" className={button} disabled={exporting || loading || loadError} onClick={() => void download()}>{t(exporting ? 'preparing' : 'worksheet')}</button><p className="mt-2 text-xs leading-relaxed text-dim">{t('worksheet_help')}</p>{exportError && <p role="alert" className="mt-2 text-sm text-red-800">{t('export_error')}</p>}</div>
    {loading ? <p role="status">{t('loading')}</p> : loadError ? <div role="alert"><p>{t('load_error')}</p><button type="button" className={`${button} mt-3`} onClick={() => setRefresh(value => value + 1)}>{t('retry')}</button></div> : <>
      <p role="status" className="text-sm text-dim">{t('results', { count: page.total })}</p>
      {!page.items.length && <p className="rounded-xl border border-line bg-white p-5 text-sm text-ink2">{t('empty')}</p>}
      <div className="grid gap-4 lg:grid-cols-2">{page.items.map(row => <article key={row.listing_id} className="min-w-0 rounded-xl border border-line bg-white p-5"><h3 className="break-words text-base font-bold text-ink">{row.title}</h3><p className="mt-1 text-sm text-ink2">{row.location}</p><p className="mt-1 break-all text-xs text-dim">{t('reference')}: {row.source_ref || row.listing_id}</p><div className="my-3 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-paper px-2 py-1">{t(`status.${row.review_status}`)}</span><span className="rounded-full bg-paper px-2 py-1">{t(row.public_mapped ? 'public_pin' : row.has_coordinates ? 'private_candidate' : 'no_coordinates')}</span><span className="rounded-full bg-paper px-2 py-1">{t(`precision.${row.public_precision}`)}</span></div><button type="button" className={button} disabled={saving} onClick={() => { setSelected(row.listing_id); if (selected === row.listing_id) setReloadDetail(value => value + 1) }}>{t('review')}</button></article>)}</div>
      {page.total > LIMIT && <div className="flex flex-wrap items-center gap-3"><button type="button" className={button} disabled={offset === 0} onClick={() => setOffset(value => Math.max(0, value - LIMIT))}>{t('previous')}</button><span className="text-sm">{t('page', { page: Math.floor(offset / LIMIT) + 1, pages: Math.ceil(page.total / LIMIT) })}</span><button type="button" className={button} disabled={offset + LIMIT >= page.total || offset + LIMIT > 10000} onClick={() => setOffset(value => value + LIMIT)}>{t('next')}</button></div>}
    </>}
    {selected && <section aria-label={t('review_panel')} className="min-w-0 rounded-2xl border border-line bg-white p-5 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3"><h2 ref={heading} tabIndex={-1} className="min-w-0 break-words text-lg font-bold text-ink">{detail?.title || t('review_panel')}</h2><button type="button" className={button} disabled={saving} onClick={() => setSelected(null)}>{t('close')}</button></div>
      {detailLoading ? <p role="status">{t('loading')}</p> : <>
        {detailError && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{detailError}</p>}
        {saved && <p role="status" className="mb-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm">{t('saved')}</p>}
        {(stale || !detail) && <button type="button" className={button} disabled={saving} onClick={() => setReloadDetail(value => value + 1)}>{t('reload')}</button>}
        {detail && draft && <form onSubmit={event => { event.preventDefault(); void save() }} className="space-y-5">
          <div className="rounded-xl bg-paper p-4 text-sm"><p>{t('reference')}: <span className="break-all font-semibold">{detail.source_ref || detail.listing_id}</span></p><p>{t('recorded_area')}: {detail.location}</p><p className="mt-1 text-xs text-dim">{t('listing_updated')}: {date(detail.listing_updated_at)} · {t('version', { version: detail.version })}</p></div>
          {detail.projection_mismatch && <p className="text-sm text-amber-900">{t('projection_mismatch')}</p>}
          <fieldset disabled={saving || stale} className="min-w-0 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">{formField('latitude')}{formField('longitude')}</div><p className="text-xs leading-relaxed text-dim">{t('coordinate_help')}</p>
            {formField('maps_url')}{draft.maps_url && safeLocationMapUrl(draft.maps_url) && <a href={draft.maps_url} target="_blank" rel="noreferrer noopener" referrerPolicy="no-referrer" className="inline-block text-sm font-semibold text-coral underline">{t('open_source')}</a>}
            <div><button type="button" className={button} disabled={!destinationCandidate} onClick={() => {
              if (destinationCandidate) { setDraft(previous => previous ? { ...previous, ...destinationCandidate, source_type: 'map_destination', review_status: 'unreviewed', confirmed_property: false } : previous); setSaved(false) }
            }}>{t('use_destination')}</button><p className="mt-2 text-xs leading-relaxed text-dim">{t('destination_help')}</p></div>
            <div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor={`${fieldId}-source-type`} className="mb-1.5 block text-sm font-semibold">{t('source_type')}</label><select id={`${fieldId}-source-type`} className={input} value={draft.source_type} onChange={event => change('source_type', event.target.value as LocationSource | '')}><option value="">{t('choose_source')}</option>{sources.map(value => <option key={value} value={value}>{t(`source.${value}`)}</option>)}</select></div>{formField('source_reference')}</div>
            <p className="text-xs leading-relaxed text-dim">{t('source_help')}</p>
            <div><label htmlFor={`${fieldId}-note`} className="mb-1.5 block text-sm font-semibold">{t('review_note')}</label><textarea id={`${fieldId}-note`} className={input} rows={3} maxLength={1000} value={draft.review_note} onChange={event => change('review_note', event.target.value)} /></div>
            <div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor={`${fieldId}-status`} className="mb-1.5 block text-sm font-semibold">{t('review_status')}</label><select id={`${fieldId}-status`} className={input} value={draft.review_status} onChange={event => change('review_status', event.target.value as LocationStatus)}>{['unreviewed', 'needs_review', 'verified'].map(value => <option key={value} value={value}>{t(`status.${value}`)}</option>)}</select></div><div><label htmlFor={`${fieldId}-precision`} className="mb-1.5 block text-sm font-semibold">{t('public_precision')}</label><select id={`${fieldId}-precision`} className={input} value={draft.public_precision} onChange={event => change('public_precision', event.target.value as LocationPrecision)}>{['exact', 'area', 'hidden'].map(value => <option key={value} value={value}>{t(`precision.${value}`)}</option>)}</select></div></div>
            <p className="text-xs leading-relaxed text-dim">{t('precision_help')}</p>
            <label className="flex items-start gap-3 text-sm font-medium leading-relaxed"><input type="checkbox" checked={draft.confirmed_property} onChange={event => change('confirmed_property', event.target.checked)} className="mt-1" />{t('confirmation')}</label>
            <button type="submit" className={primary}>{t(saving ? 'saving' : 'save')}</button>
          </fieldset>
          {detail.history.length > 0 && <details className="rounded-xl border border-line p-4"><summary className="cursor-pointer text-sm font-semibold">{t('history')}</summary><ol className="mt-3 space-y-2">{detail.history.map(row => <li key={row.version} className="text-xs text-ink2">{t('version', { version: row.version })} · {t(`action.${row.action}`, { defaultValue: row.action })} · {date(row.created_at)}</li>)}</ol></details>}
        </form>}
      </>}
    </section>}
  </div>
}
