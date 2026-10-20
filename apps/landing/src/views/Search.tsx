'use client'
import { useNav } from '../hooks/useNav'
import { useSearchParams, usePathname } from 'next/navigation'
import { useState, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { BedDouble, Bath, Maximize2, MapPin, Heart, TrendingUp, SlidersHorizontal } from 'lucide-react'
import { fmt, fmtDOP, type Listing } from '../data/listings'
import { fetchListings, fetchListingFilterOptions, fetchListingMap, type ListingFilterOptions } from '../api/listings'
import { EMPTY_LISTING_MAP, type ListingMapData, type MapBounds } from '../data/searchMap'
import { supabaseImgUrl } from '../api/imgUrl'
import { getMySavedIds, saveHome, unsaveHome } from '../api/savedHomes'
import { SearchFilterSidebar } from '../components/SearchFilterSidebar'
import { SearchMapSidebar } from '../components/SearchMapSidebar'
import { FEATURES } from '../data/searchData'
import { defaultSearchFilters, readSearchFilters, writeSearchFilters, type SearchFilters } from '../data/searchFilters'
import { useTranslation } from 'react-i18next'

type TagTone = 'sand' | 'coral' | 'sea' | 'gold' | 'green'
const TONE_CLASSES: Record<TagTone, string> = {
  sand:  'bg-ink/80 text-white border border-white/20',
  coral: 'bg-coral text-white border border-coral',
  sea:   'bg-sea text-white border border-sea',
  gold:  'bg-gold text-[#3d2800] border border-gold',
  green: 'bg-[#1f7a3d] text-white border border-[#1f7a3d]',
}

function pageWindow(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = new Set([1, total, current - 1, current, current + 1])
  const sorted = [...pages].filter(p => p >= 1 && p <= total).sort((a, b) => a - b)
  const out: (number | '…')[] = []
  let prev = 0
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push('…')
    out.push(p)
    prev = p
  }
  return out
}

function PaginationBar({
  page, totalPages, border, onPrev, onNext, onSetPage,
}: {
  page: number; totalPages: number; border: 'border-b' | 'border-t'
  onPrev: () => void; onNext: () => void; onSetPage: (p: number) => void
}) {
  const { t } = useTranslation('search')
  if (totalPages <= 1) return null
  return (
    <div className={`flex items-center justify-center gap-1.5 py-4 flex-wrap ${border} border-line-soft`}>
      <button
        disabled={page <= 1}
        onClick={() => { onPrev(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
        className="py-2 px-3.5 rounded-full border border-line bg-paper text-ink text-3.25 font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {t('pagination.prev')}
      </button>
      {pageWindow(page, totalPages).map((p, i) =>
        p === '…' ? (
          <span key={`e${i}`} className="px-1 text-dim text-3.25">…</span>
        ) : (
          <button
            key={p}
            onClick={() => { onSetPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
            className={`w-9 h-9 rounded-full text-3.25 font-semibold cursor-pointer ${p === page ? 'bg-ink text-paper' : 'bg-paper border border-line text-ink'}`}
          >
            {p}
          </button>
        )
      )}
      <button
        disabled={page >= totalPages}
        onClick={() => { onNext(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
        className="py-2 px-3.5 rounded-full border border-line bg-paper text-ink text-3.25 font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {t('pagination.next')}
      </button>
    </div>
  )
}

const titleCase = (s: string) =>
  s === s.toUpperCase() ? s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : s

function Tag({ children, tone = 'sand' }: { children: ReactNode; tone?: string }) {
  const cls = TONE_CLASSES[(tone as TagTone)] ?? TONE_CLASSES.sand
  return (
    <span className={`text-[10.5px] font-bold tracking-widest uppercase py-1 px-2.5 rounded-full ${cls}`}>
      {children}
    </span>
  )
}

function PropertyCard({ l, go, onHover, currency, dopRate, savedIds, onToggleSave }: {
  l: Listing
  go: (p: string) => void
  onHover?: (l: Listing | null) => void
  currency: 'USD' | 'DOP'
  dopRate: number
  savedIds: Set<string>
  onToggleSave: (id: string) => void
}) {
  const { t } = useTranslation('search')
  const [hot, setHot] = useState(false)
  const isSaved = savedIds.has(l.id)
  const discountedPrice = l.purpose !== 'rent' && l.is_deal && l.deal_discount_value
    ? (l.deal_discount_type === 'fixed'
        ? l.price - l.deal_discount_value
        : Math.round(l.price * (1 - l.deal_discount_value / 100)))
    : null
  const effectivePrice = discountedPrice ?? l.price
  const dp = currency === 'DOP' ? Math.round(effectivePrice * dopRate) : null
  const displayPrice = l.purpose === 'rent'
    ? `${dp != null ? 'RD$' : '$'}${(dp ?? effectivePrice).toLocaleString()} ${currency}`
    : dp != null ? fmtDOP(dp) : `${fmt(effectivePrice)} USD`
  const origDp = currency === 'DOP' && discountedPrice ? Math.round(l.price * dopRate) : null
  const displayOrig = origDp != null ? fmtDOP(origDp) : discountedPrice ? `${fmt(l.price)} USD` : null
  return (
    <div
      onMouseEnter={() => { setHot(true); onHover?.(l) }}
      onMouseLeave={() => { setHot(false); onHover?.(null) }}
      onClick={() => go(`detail?id=${l.id}`)}
      className={`bg-paper rounded-xl overflow-hidden cursor-pointer transition-all duration-250 border ${hot ? 'border-line -translate-y-1 shadow-[0_22px_50px_-28px_rgba(0,16,46,.4)]' : 'border-line-soft shadow-[0_1px_0_rgba(0,16,46,.03)]'}`}
    >
      <div className="relative h-46" style={{ backgroundImage: `url(${supabaseImgUrl(l.img, 600)})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute top-3 left-3 flex gap-1.5">
          {l.tags.map(([tag, tone], i) => <Tag key={i} tone={tone}>{tag}</Tag>)}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onToggleSave(l.id) }}
          className={`absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/90 grid place-items-center border-none cursor-pointer transition-colors ${isSaved ? 'text-coral' : 'text-ink/30 hover:text-coral'}`}
        >
          <Heart size={16} fill={isSaved ? 'currentColor' : 'none'} />
        </button>
        {l.purpose !== 'rent' && l.is_deal && l.deal_discount_value ? (
          <div className="absolute bottom-3 right-3 flex items-center gap-1.25 bg-coral text-white py-1.25 px-2.5 rounded-md text-xs font-semibold font-sans">
            {l.deal_discount_type === 'fixed'
              ? t('discount.fixed', { amount: Number(l.deal_discount_value).toLocaleString() })
              : t('discount.percent', { amount: l.deal_discount_value })}
          </div>
        ) : l.roi > 0 ? (
          <div className="absolute bottom-3 right-3 flex items-center gap-1.25 bg-ink/90 text-paper py-1.25 px-2.5 rounded-md text-xs font-semibold">
            <TrendingUp size={13} />{l.roi}{t('yield')}
          </div>
        ) : null}
      </div>
      <div className="pt-4 px-4.5 pb-4.5 font-sans">
        <div className="flex items-baseline gap-2">
          <div className="font-sans text-5.25 font-semibold text-ink">
            {effectivePrice > 0 ? displayPrice : t('request_price')}
            {effectivePrice > 0 && l.purpose === 'rent' && <span className="text-3.25 text-dim font-sans">{t(l.pricePeriod === 'day' ? 'per_day' : 'per_month')}</span>}
          </div>
          {displayOrig && (
            <div className="font-sans text-3.25 text-dim line-through">{displayOrig}</div>
          )}
        </div>
        <div className="text-3.75 font-semibold text-ink mt-1.5 mb-1 leading-[1.3]">{titleCase(l.title)}</div>
        <div className="flex items-center gap-1.25 text-dim text-[12.5px]">
          <MapPin size={13} />{l.region}
        </div>
        <div className="flex gap-4 mt-3.5 pt-3.25 border-t border-line-soft text-ink2 text-[12.5px]">
          {l.bd > 0 && <span className="flex items-center gap-1.25"><BedDouble size={15} />{l.bd} {t('card.bd')}</span>}
          {l.ba > 0 && <span className="flex items-center gap-1.25"><Bath size={15} />{l.ba} {t('card.ba')}</span>}
          {l.m2 > 0 && <span className="flex items-center gap-1.25"><Maximize2 size={15} />{l.m2} m²</span>}
        </div>
      </div>
    </div>
  )
}

export default function Search() {
  const go = useNav()
  const { t } = useTranslation('search')
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const PAGE_SIZE = 24
  const queryString = searchParams.toString()
  const [filters, setFilters] = useState(() => readSearchFilters(new URLSearchParams(queryString)))
  const filtersRef = useRef(filters)
  const { page, purpose, types, locations, minPrice, maxPrice, beds, minROI, rentalPeriod, sort } = filters
  const amenities = useMemo(() => new Set(filters.amenities), [filters.amenities])
  const [listings, setListings] = useState<Listing[]>([])
  const [total, setTotal] = useState(0)
  const [medianPrice, setMedianPrice] = useState<number | null>(null)
  const [avgRoi, setAvgRoi] = useState<number | null>(null)
  const [alsoLike, setAlsoLike] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [options, setOptions] = useState<ListingFilterOptions>({ locations: [], types: [] })
  const [hovered, setHovered] = useState<Listing | null>(null)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [mapExpanded, setMapExpanded] = useState(false)
  const [mapResult, setMapResult] = useState<{ scope: string; data: ListingMapData }>({ scope: '', data: EMPTY_LISTING_MAP })
  const [mapLoading, setMapLoading] = useState(true)
  const [mapError, setMapError] = useState(false)
  const [mapRetry, setMapRetry] = useState(0)
  const [mapViewport, setMapViewport] = useState<{ scope: string; bounds: MapBounds } | null>(null)
  const [currency, setCurrency] = useState<'USD' | 'DOP'>('USD')
  const [dopRate, setDopRate] = useState(59.5)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  // Native history updates keep Next's search params and browser navigation in
  // sync without racing asynchronous route replacements after quick selections.
  function changeFilters(patch: Partial<SearchFilters>, resetPage = true) {
    const next = { ...filtersRef.current, ...patch, ...(resetPage ? { page: 1 } : {}) }
    filtersRef.current = next
    setFilters(next)
    const params = writeSearchFilters(next, new URLSearchParams(window.location.search))
    const query = params.toString()
    window.history.replaceState(null, '', query ? `${pathname}?${query}` : pathname)
  }
  useEffect(() => {
    const incoming = readSearchFilters(new URLSearchParams(queryString))
    filtersRef.current = incoming
    setFilters(incoming)
  }, [queryString])

  const setPurpose = (value: SearchFilters['purpose']) => changeFilters({ purpose: value })
  const setTypes = (value: string[]) => changeFilters({ types: value })
  const setLocations = (value: string[]) => changeFilters({ locations: value })
  const setMinPrice = (value: number) => changeFilters({ minPrice: value })
  const setMaxPrice = (value: number) => changeFilters({ maxPrice: value })
  const setBeds = (value: string) => changeFilters({ beds: value })
  const setMinROI = (value: number) => changeFilters({ minROI: value })
  const setAmenities = (value: Set<string>) => changeFilters({ amenities: [...value] })
  const setSort = (value: SearchFilters['sort']) => changeFilters({ sort: value })
  const setPage = (value: number | ((previous: number) => number)) =>
    changeFilters({ page: typeof value === 'function' ? value(filtersRef.current.page) : value }, false)

  const [priceFilters, setPriceFilters] = useState({ minPrice, maxPrice, minROI })
  useEffect(() => {
    const timer = window.setTimeout(() => setPriceFilters({ minPrice, maxPrice, minROI }), 350)
    return () => window.clearTimeout(timer)
  }, [minPrice, maxPrice, minROI])

  useEffect(() => {
    let cancelled = false
    fetchListingFilterOptions().then(result => { if (!cancelled) setOptions(result) }).catch(() => {})
    fetch('https://open.er-api.com/v6/latest/USD')
      .then(response => response.json())
      .then(data => {
        const rate = Number(data.rates?.DOP)
        if (!cancelled && Number.isFinite(rate) && rate >= 1 && rate <= 1000) setDopRate(rate)
      }).catch(() => {})
    getMySavedIds().then(ids => {
      if (!cancelled) { setSavedIds(new Set(ids)); setIsLoggedIn(true) }
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  const handleToggleSave = async (id: string) => {
    if (!isLoggedIn) { go('login'); return }
    const wasSaved = savedIds.has(id)
    setSavedIds(previous => { const next = new Set(previous); wasSaved ? next.delete(id) : next.add(id); return next })
    try { await (wasSaved ? unsaveHome(id) : saveHome(id)) }
    catch {
      setSavedIds(previous => { const next = new Set(previous); wasSaved ? next.add(id) : next.delete(id); return next })
    }
  }

  useEffect(() => {
    if (!filtersOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [filtersOpen])

  const requestQuery = JSON.stringify({
    page, pageSize: PAGE_SIZE, purpose,
    types: types.length ? types : undefined,
    locations: locations.length ? locations : undefined,
    minPrice: priceFilters.minPrice > 0 ? priceFilters.minPrice : undefined,
    maxPrice: priceFilters.maxPrice > 0 ? priceFilters.maxPrice : undefined,
    beds: beds === 'any' ? undefined : Number(beds),
    minRoi: priceFilters.minROI > 0 ? priceFilters.minROI : undefined,
    features: filters.amenities.length ? filters.amenities : undefined,
    sort, priceCurrency: 'USD', usdToDop: dopRate, rentalPeriod,
  })
  const mapScope = JSON.stringify({ ...JSON.parse(requestQuery), page: undefined, pageSize: undefined, sort: undefined })
  const mapData = mapResult.scope === mapScope ? mapResult.data : EMPTY_LISTING_MAP
  const mapRequest = JSON.stringify({ scope: mapScope, bounds: mapViewport?.scope === mapScope ? mapViewport.bounds : null })
  useEffect(() => {
    const controller = new AbortController()
    const requested = JSON.parse(mapRequest)
    setMapLoading(true); setMapError(false)
    fetchListingMap({ ...JSON.parse(requested.scope), signal: controller.signal }, requested.bounds)
      .then(data => { if (!controller.signal.aborted) setMapResult({ scope: requested.scope, data }) })
      .catch(() => { if (!controller.signal.aborted) { setMapError(true); setMapResult({ scope: requested.scope, data: EMPTY_LISTING_MAP }) } })
      .finally(() => { if (!controller.signal.aborted) setMapLoading(false) })
    return () => controller.abort()
  }, [mapRequest, mapRetry])
  function onMapViewportChange(bounds: MapBounds) {
    if (mapData.mapped_total <= mapData.limit) return
    const rounded = Object.fromEntries(Object.entries(bounds).map(([key, value]) => [key, Math.round(value * 10000) / 10000])) as unknown as MapBounds
    setMapViewport(previous => previous?.scope === mapScope && JSON.stringify(previous.bounds) === JSON.stringify(rounded) ? previous : { scope: mapScope, bounds: rounded })
  }
  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false
    setLoading(true)
    setError(false)
    fetchListings({ ...JSON.parse(requestQuery), signal: controller.signal })
      .then(result => {
        if (cancelled) return
        setListings(result.items)
        setTotal(result.total)
        setMedianPrice(result.medianPrice)
        setAvgRoi(result.avgRoi)
      })
      .catch(() => {
        if (cancelled) return
        setListings([])
        setTotal(0)
        setError(true)
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true; controller.abort() }
  }, [requestQuery, retry])

  const suggestionLocations = JSON.stringify(locations)
  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false
    const ids = listings.map(listing => listing.id)
    if (!ids.length) { setAlsoLike([]); return }
    const selectedLocations: string[] = JSON.parse(suggestionLocations)
    const getSuggestions = (nearby: boolean) => fetchListings({
      locations: nearby && selectedLocations.length ? selectedLocations : undefined,
      excludeIds: ids, pageSize: 3, includeAggregates: false,
      priceCurrency: 'USD', usdToDop: dopRate, rentalPeriod,
      purpose, signal: controller.signal,
    })
    getSuggestions(selectedLocations.length > 0)
      .then(result => selectedLocations.length && !result.items.length ? getSuggestions(false) : result)
      .then(result => { if (!cancelled) setAlsoLike(result.items) })
      .catch(() => { if (!cancelled) setAlsoLike([]) })
    return () => { cancelled = true; controller.abort() }
  }, [listings, suggestionLocations, dopRate, rentalPeriod, purpose])

  const insights = !error && total > 0 ? { count: total, median: medianPrice ?? 0, avgYield: avgRoi ?? 0 } : null
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const locationLabel = locations.length > 2 ? t('selected_locations', { count: locations.length }) : locations.length ? locations.join(', ') : null
  const chips: { label: string; clear: () => void }[] = []
  if (purpose !== 'sale') chips.push({ label: purpose === 'rent' ? t('chips.rent') : t('chips.investment'), clear: () => setPurpose('sale') })
  types.forEach(type => chips.push({ label: t(`sidebar.type_${type.toLowerCase()}`), clear: () => setTypes(types.filter(value => value !== type)) }))
  if (beds !== 'any') chips.push({ label: t('chip_beds', { beds }), clear: () => setBeds('any') })
  locations.forEach(location => chips.push({ label: location, clear: () => setLocations(locations.filter(value => value !== location)) }))
  if (minROI > 0) chips.push({ label: t('chip_roi', { roi: minROI }), clear: () => setMinROI(0) })
  amenities.forEach(amenity => chips.push({ label: t(`amenities.${amenity}`, { defaultValue: amenity }), clear: () => {
    const next = new Set(amenities); next.delete(amenity); setAmenities(next)
  } }))
  if (minPrice > 0 || maxPrice > 0) chips.push({
    label: maxPrice === 0 ? `${fmt(minPrice)}+ USD` : `${fmt(minPrice)} – ${fmt(maxPrice)} USD`,
    clear: () => changeFilters({ minPrice: 0, maxPrice: 0 }),
  })
  const clearAll = () => changeFilters(defaultSearchFilters())
  const filterProps = {
    types, purpose, minPrice, maxPrice, beds, locations, minROI, amenities, rentalPeriod,
    setTypes, setPurpose, setMinPrice, setMaxPrice, setBeds, setLocations, setMinROI, setAmenities,
    setRentalPeriod: (value: 'month' | 'day') => changeFilters({ rentalPeriod: value }),
    locationOptions: options.locations, allAmenities: FEATURES,
    chips, resultsCount: total, clearAll,
  }

  return (
    <>
    <div className="max-w-380 mx-auto pt-4 sm:pt-6 px-4 sm:px-6 pb-17.5 grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_320px] gap-5.5 font-sans items-start">

      <SearchFilterSidebar {...filterProps} />

      {/* ===== CENTER: RESULTS ===== */}
      <main className="min-w-0">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-3.5">
          <h1 className="font-sans text-5 sm:text-6.5 font-semibold text-ink leading-[1.1] m-0">
            {t('results_count', { count: total })}{' '}
            <span className="text-dim text-3.25 sm:text-3.75 font-sans font-normal">
              {locationLabel ? t('location_in', { region: locationLabel }) : t('location_across')}
            </span>
          </h1>
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={() => setMapExpanded(true)} aria-haspopup="dialog"
              className="inline-flex items-center gap-1.5 font-sans text-3.25 font-semibold cursor-pointer py-2 px-3.5 rounded-full border border-line bg-paper text-ink focus-visible:outline-coral">
              <MapPin size={15} aria-hidden="true" />{t('map.open')}
            </button>
            <button
              onClick={() => setFiltersOpen(true)}
              className="lg:hidden flex items-center gap-1.5 font-sans text-3.25 font-semibold cursor-pointer py-2 px-3.5 rounded-full border border-line bg-paper text-ink"
            >
              <SlidersHorizontal size={14} />
              {t('filters')}
              {chips.length > 0 && (
                <span className="w-4.5 h-4.5 rounded-full bg-coral text-white text-[10px] font-bold grid place-items-center">{chips.length}</span>
              )}
            </button>
            <span className="hidden sm:inline text-[12.5px] text-dim">{t('sort_label')}</span>
            <select aria-label={t('sort_label')} value={sort} onChange={e => setSort(e.target.value as typeof sort)}
              className="font-sans text-3.25 py-2 px-3 rounded-full border border-line bg-paper text-ink cursor-pointer">
              <option value="new">{t('sort.new')}</option>
              <option value="low">{t('sort.low')}</option>
              <option value="high">{t('sort.high')}</option>
              <option value="roi">{t('sort.roi')}</option>
            </select>
            <div className="hidden sm:inline-flex border border-line rounded-md overflow-hidden bg-paper">
              {(['grid', 'list'] as const).map(v => (
                <button key={v} onClick={() => setView(v)}
                  className={`py-1.75 px-2.5 border-none cursor-pointer text-3.25 ${view === v ? 'bg-ink text-paper' : 'bg-transparent text-dim'}`}>
                  {v === 'grid' ? '▦' : '≡'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {chips.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mb-4">
            {chips.map((chip, i) => (
              <div key={i} className="inline-flex items-center gap-1.75 py-1.25 pr-2.5 pl-3 rounded-full bg-ink text-paper text-xs font-semibold">
                {chip.label}
                <button onClick={chip.clear} aria-label={t('remove_filter', { label: chip.label })}
                  className="bg-white/20 text-paper border-none rounded-full w-4.5 h-4.5 grid place-items-center cursor-pointer text-xs leading-none">×</button>
              </div>
            ))}
            <button onClick={clearAll}
              className="bg-transparent border-none text-coral font-sans text-xs font-bold cursor-pointer py-1.25 px-2">
              {t('clear_all')}
            </button>
          </div>
        )}

        {error ? (
          <div role="alert" className="p-8 text-center border border-line rounded-2xl">
            <p>{t('load_error')}</p>
            <button onClick={() => setRetry(value => value + 1)} className="mt-3 rounded-full bg-coral text-white px-5 py-2">{t('retry')}</button>
          </div>
        ) : loading ? (
          <div className={`grid gap-4.5 ${view === 'grid' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-paper rounded-xl overflow-hidden border border-line-soft animate-pulse">
                <div className="h-46 bg-line-soft" />
                <div className="p-4.5 space-y-3">
                  <div className="h-5 bg-line-soft rounded w-2/5" />
                  <div className="h-4 bg-line-soft rounded w-3/4" />
                  <div className="h-3.5 bg-line-soft rounded w-1/3" />
                  <div className="h-px bg-line-soft" />
                  <div className="flex gap-4">
                    <div className="h-3.5 bg-line-soft rounded w-12" />
                    <div className="h-3.5 bg-line-soft rounded w-12" />
                    <div className="h-3.5 bg-line-soft rounded w-14" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="p-15 text-center text-dim border border-dashed border-line rounded-2xl">
            {t('empty')}
          </div>
        ) : (
          <>
            <PaginationBar
              page={page} totalPages={totalPages} border="border-b"
              onPrev={() => setPage(p => p - 1)} onNext={() => setPage(p => p + 1)} onSetPage={setPage}
            />
            <div className={`grid gap-4.5 ${view === 'grid' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
              {listings.map(l => <PropertyCard key={l.id} l={l} go={go} onHover={setHovered} currency={currency} dopRate={dopRate} savedIds={savedIds} onToggleSave={handleToggleSave} />)}
            </div>
            <PaginationBar
              page={page} totalPages={totalPages} border="border-t"
              onPrev={() => setPage(p => p - 1)} onNext={() => setPage(p => p + 1)} onSetPage={setPage}
            />
          </>
        )}
      </main>

      <SearchMapSidebar
        inventory={{ data: mapData, loading: mapLoading, error: mapError, scope: mapScope, retry: () => setMapRetry(value => value + 1), onAreaSelect: setLocations, onViewportChange: onMapViewportChange }}
        hovered={hovered}
        results={listings}
        alsoLike={alsoLike}
        insights={insights}
        currency={currency}
        dopRate={dopRate}
        locations={locations}
        locationLabel={locationLabel}
        expanded={mapExpanded}
        onExpand={() => setMapExpanded(true)}
        onClose={() => setMapExpanded(false)}
        onCurrencyChange={setCurrency}
        onSelect={l => go(`detail?id=${l.id}`)}
        go={go}
      />

    </div>

    {filtersOpen && (
      <SearchFilterSidebar {...filterProps} mobile onClose={() => setFiltersOpen(false)} />
    )}
    </>
  )
}
