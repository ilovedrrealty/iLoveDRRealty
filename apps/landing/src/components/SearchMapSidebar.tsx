'use client'
import { useRef, useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, Maximize2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { fmt, fmtDOP, type Listing } from '../data/listings'
import { areaSummaryPoints, type ListingMapData, type MapBounds } from '../data/searchMap'
import { SearchInventoryMap } from './SearchInventoryMap'
import { supabaseImgUrl } from '../api/imgUrl'

const titleCase = (s: string) =>
  s === s.toUpperCase() ? s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : s

function fmtPill(l: { price: number; purpose: string }, currency: 'USD' | 'DOP', dopRate: number, unit: string): string {
  if (currency === 'DOP') {
    const dp = Math.round(l.price * dopRate)
    return l.purpose === 'rent' ? `RD$${dp.toLocaleString()}${unit}` : fmtDOP(dp)
  }
  const p = l.price
  const short =
    p >= 1_000_000_000_000 ? `$${(p / 1_000_000_000_000).toFixed(2)}T USD` :
    p >= 1_000_000_000 ? `$${(p / 1_000_000_000).toFixed(2)}B USD` :
    p >= 1_000_000 ? `$${(p / 1_000_000).toFixed(1)}M USD` : `$${Math.round(p / 1_000)}K USD`
  return l.purpose === 'rent' ? `$${Math.round(p).toLocaleString()} USD${unit}` : short
}

function Insight({ label, value, tone }: { label: string; value: string | number; tone?: 'brand' }) {
  return (
    <div className="py-2.5 border-b border-line-soft">
      <div className="text-[10.5px] font-bold tracking-[.08em] uppercase text-dim mb-1">{label}</div>
      <div className={`font-sans text-5.5 font-bold leading-none ${tone === 'brand' ? 'text-brand' : 'text-ink'}`}>{value}</div>
    </div>
  )
}

function DRMap({ hovered, listings, onSelect, currency, dopRate, onCurrencyChange, locations, inventory, expanded = false, onExpand }: {
  hovered: Listing | null
  listings: Listing[]
  onSelect: (l: Pick<Listing, 'id'>) => void
  currency: 'USD' | 'DOP'
  dopRate: number
  onCurrencyChange: (c: 'USD' | 'DOP') => void
  locations: string[]
  inventory: MapInventoryState
  expanded?: boolean
  onExpand?: () => void
}) {
  const { t } = useTranslation('search')
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''
  const hasKey = Boolean(apiKey && apiKey !== 'YOUR_KEY_HERE')
  const { data, loading, error, scope, retry, onAreaSelect, onViewportChange } = inventory
  const unplaced = data.ungrouped_total + data.areas.reduce((sum, area) => sum + (areaSummaryPoints([area]).length ? 0 : area.count), 0)

  return (
    <div className={`bg-paper overflow-hidden ${expanded ? 'h-full flex flex-col' : 'rounded-2xl border border-line'}`}>
      <div className="p-4 flex flex-wrap items-start justify-between gap-3 shrink-0">
        <div>
          <div className="font-sans text-4.25 font-semibold text-ink">{t('map.country')}</div>
          <div className="text-xs text-dim mt-0.5 font-sans">
            {t('map.inventory_count', { count: data.total })}
          </div>
        </div>
        <div className="flex rounded-lg border border-line overflow-hidden text-[11px] font-bold shrink-0">
          {(['DOP', 'USD'] as const).map(c => (
            <button key={c} type="button" onClick={() => onCurrencyChange(c)} aria-pressed={currency === c}
              className="px-2.5 py-1 transition-colors cursor-pointer"
              style={{ background: currency === c ? '#00102e' : 'white', color: currency === c ? 'white' : '#64748b' }}>
              {c}
            </button>
          ))}
        </div>
      </div>
      <div className={expanded ? 'min-h-0 flex-1' : 'h-[420px]'}>
        {hasKey ? (
          <SearchInventoryMap apiKey={apiKey} data={data} scope={scope} hoveredId={hovered?.id} locations={locations} expanded={expanded}
            onSelect={id => onSelect({ id })} onAreaSelect={onAreaSelect} onViewportChange={onViewportChange} />
        ) : (
          <div role="status" className="h-full flex items-center justify-center bg-ink text-white/80 p-6 text-center text-sm">
            {t('map.unavailable')}
          </div>
        )}
      </div>
      <div className="p-4 border-t border-line-soft shrink-0">
        {loading ? <p className="text-xs text-dim m-0" role="status">{t('map.inventory_loading')}</p> : null}
        {error ? <div role="alert" className="text-xs text-red-800"><p>{t('map.inventory_error')}</p><button type="button" onClick={retry} className="underline font-semibold">{t('retry')}</button></div> : <>
          <p className="text-xs text-dim leading-relaxed m-0">{t('map.coverage', { total: data.total, exact: data.mapped_total, approximate: data.unmapped_total })}</p>
          <p className="text-xs leading-relaxed text-[#5b21b6] mt-2 mb-0">{t('map.area_legend')}</p>
          {unplaced > 0 && <p className="text-xs text-dim leading-relaxed mt-1 mb-0">{t('map.unplaced', { count: unplaced })}</p>}
          {data.mapped_total > data.limit && <p className="text-xs text-dim leading-relaxed mt-2 mb-0">{t('map.point_limit', { count: data.returned, total: data.mapped_total })}</p>}
        </>}
        {onExpand && <button type="button" onClick={onExpand} aria-haspopup="dialog" className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-ink text-paper px-4 py-2.5 text-sm font-semibold focus-visible:outline-coral cursor-pointer"><Maximize2 size={16} aria-hidden="true" />{t('map.expand')}</button>}
      </div>
    </div>
  )
}

export interface MapInventoryState {
  data: ListingMapData; loading: boolean; error: boolean; scope: string; retry: () => void
  onAreaSelect: (locations: string[]) => void; onViewportChange: (bounds: MapBounds) => void
}

export interface MapSidebarProps {
  hovered: Listing | null
  results: Listing[]
  alsoLike: Listing[]
  inventory: MapInventoryState
  insights: { count: number; median: number; avgYield: number } | null
  currency: 'USD' | 'DOP'
  dopRate: number
  locations: string[]
  locationLabel: string | null
  expanded: boolean
  onExpand: () => void
  onClose: () => void
  onCurrencyChange: (c: 'USD' | 'DOP') => void
  onSelect: (l: Pick<Listing, 'id'>) => void
  go: (path: string) => void
}

function ExpandedSearchMap({ hovered, results, inventory, currency, dopRate, locations, locationLabel, onCurrencyChange, onSelect, onClose }: Pick<MapSidebarProps,
  'hovered' | 'results' | 'inventory' | 'currency' | 'dopRate' | 'locations' | 'locationLabel' | 'onCurrencyChange' | 'onSelect' | 'onClose'>) {
  const { t } = useTranslation('search')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  const titleId = useId()
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    closeRef.current?.focus()
    return () => {
      dialog.close()
      document.body.style.overflow = overflow
      if (previous?.isConnected) previous.focus()
    }
  }, [])

  return createPortal(
    <dialog ref={dialogRef} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); close.current() }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-paper p-0 text-ink font-sans backdrop:bg-black/50">
      <div className="h-full flex flex-col overflow-hidden">
        <header className="border-b border-line px-4 py-3 sm:px-6 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="min-w-0"><h2 id={titleId} className="text-lg font-bold m-0">{t('map.title')}</h2><p className="text-xs text-dim mt-1 mb-0">{locationLabel || t('location_across')}</p></div>
          <button ref={closeRef} type="button" onClick={onClose} className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2.5 text-sm font-semibold focus-visible:outline-coral cursor-pointer"><ArrowLeft size={17} aria-hidden="true" />{t('map.return_to_results')}</button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto md:grid md:grid-cols-[minmax(0,1fr)_300px] md:overflow-hidden">
          <section aria-label={t('map.title')} className="h-[75dvh] min-h-[520px] md:h-full md:min-h-0">
            <DRMap inventory={inventory} hovered={hovered} listings={results} onSelect={onSelect} currency={currency} dopRate={dopRate} onCurrencyChange={onCurrencyChange} locations={locations} expanded />
          </section>
          <section aria-label={t('map.page_results')} className="min-w-0 border-t md:border-t-0 md:border-l border-line p-4 md:overflow-y-auto">
            <h3 className="font-bold text-sm m-0">{t('map.page_results')}</h3>
            <p className="text-xs text-dim mt-1 mb-3">{t('results_count', { count: results.length })}</p>
            {!results.length && <p className="text-sm text-dim">{t('empty')}</p>}
            <div className="space-y-3">
              {results.map(listing => <button key={listing.id} type="button" onClick={() => onSelect(listing)} className="w-full overflow-hidden rounded-xl border border-line bg-white text-left text-ink focus-visible:outline-coral cursor-pointer">
                <img src={supabaseImgUrl(listing.img, 400)} alt="" loading="lazy" className="h-28 w-full object-cover bg-paper2" />
                <span className="block p-3"><span className="block text-sm font-semibold">{titleCase(listing.title)}</span><span className="block text-xs text-dim mt-1">{listing.region}</span><span className="block text-sm font-bold text-coral mt-2">{listing.price > 0 ? fmtPill(listing, currency, dopRate, t(listing.pricePeriod === 'day' ? 'per_day' : 'per_month')) : t('request_price')}</span></span>
              </button>)}
            </div>
          </section>
        </div>
      </div>
    </dialog>, document.body,
  )
}

export function SearchMapSidebar({
  hovered, results, alsoLike, insights, inventory, currency, dopRate, locations, locationLabel,
  expanded, onExpand, onClose, onCurrencyChange, onSelect, go,
}: MapSidebarProps) {
  const { t } = useTranslation('search')
  const rentalPeriod = results[0]?.pricePeriod
  const rentalUnit = rentalPeriod && results.every(listing => listing.purpose === 'rent' && listing.pricePeriod === rentalPeriod)
    ? t(rentalPeriod === 'day' ? 'per_day' : 'per_month') : ''
  const fmtMedian = (v: number) => {
    if (currency === 'DOP') {
      if (rentalUnit) return `RD$${Math.round(v * dopRate).toLocaleString()}${rentalUnit}`
      return fmtDOP(Math.round(v * dopRate))
    }
    if (rentalUnit) return `$${v.toLocaleString()} USD${rentalUnit}`
    return v >= 1_000_000_000_000 ? `$${(v / 1_000_000_000_000).toFixed(2)}T USD` :
      v >= 1_000_000_000 ? `$${(v / 1_000_000_000).toFixed(2)}B USD` :
      v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2)}M USD` : v >= 1_000 ? `$${Math.round(v / 1_000)}K USD` : `$${v.toLocaleString()} USD`
  }

  return (
    <>
    <aside className="hidden lg:block self-start sticky top-22.5 max-h-[calc(100vh-110px)] overflow-y-auto space-y-3.5">

      <DRMap
        inventory={inventory}
        hovered={hovered}
        listings={results}
        onSelect={onSelect}
        currency={currency}
        dopRate={dopRate}
        onCurrencyChange={onCurrencyChange}
        locations={locations}
        onExpand={onExpand}
      />

      {insights && (
        <div className="bg-paper border border-line-soft rounded-2xl py-4 px-4.5">
          <div className="text-2.75 font-bold tracking-[.12em] uppercase text-dim mb-1">{t('map.snapshot')}</div>
          <div className="text-[11.5px] text-dim mb-2.5 leading-[1.45]">
            {locationLabel ? t('map.snapshot_in', { region: locationLabel }) : t('map.snapshot_across')}
          </div>
          <Insight label={t('map.insight_count')} value={insights.count} />
          {insights.median   > 0 && <Insight label={t('map.insight_median')} value={fmtMedian(insights.median)} />}
          {insights.avgYield > 0 && <Insight label={t('map.insight_yield')}  value={`${insights.avgYield.toFixed(1)}%`} tone="brand" />}
        </div>
      )}

      {alsoLike.length > 0 && (
        <div className="bg-paper border border-line-soft rounded-2xl py-4 px-4.5">
          <div className="text-2.75 font-bold tracking-[.12em] uppercase text-dim mb-1">{t('map.also_like')}</div>
          <div className="text-[11.5px] text-dim mb-3 leading-[1.45]">{t('map.also_like_sub')}</div>
          {alsoLike.map((l, i) => (
            <button key={l.id} onClick={() => go(`detail?id=${l.id}`)}
              className={`flex w-full gap-2.5 py-2.5 bg-transparent border-x-0 border-t-0 cursor-pointer text-left font-sans ${i < alsoLike.length - 1 ? 'border-b border-line-soft' : 'border-b-0'}`}>
              <div className="w-14 h-11 rounded-md shrink-0 overflow-hidden"
                style={{ backgroundImage: `url(${supabaseImgUrl(l.img, 400)})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-ink truncate">{titleCase(l.title)}</div>
                <div className="text-[10.5px] text-dim mt-px truncate">{l.region}</div>
                <div className="text-[11.5px] font-bold text-coral mt-0.5">
                  {l.price > 0 ? l.purpose === 'rent'
                    ? `${currency === 'DOP' ? 'RD$' : '$'}${(currency === 'DOP' ? Math.round(l.price * dopRate) : l.price).toLocaleString()} ${currency}`
                    : currency === 'DOP' ? fmtDOP(Math.round(l.price * dopRate))
                    : `${fmt(l.price)} USD` : t('request_price')}
                  {l.price > 0 && l.purpose === 'rent' && t(l.pricePeriod === 'day' ? 'per_day' : 'per_month')}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="bg-ink text-paper rounded-2xl p-4.5 font-sans">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="w-2 h-2 rounded-full bg-[#4ade80] shrink-0" />
          <span className="text-2.75 text-white/65 tracking-[.08em] uppercase font-bold">
            {t('map.team_badge')}
          </span>
        </div>
        <div className="font-sans text-4.25 font-semibold leading-tight mb-1.5">
          {t('map.team_heading')}
        </div>
        <div className="text-[12.5px] text-white/70 leading-normal mb-3">
          {t('map.team_body')}
        </div>
        <button onClick={() => go('contact')}
          className="w-full py-2.5 px-3.5 rounded-lg bg-coral text-white border-none font-sans text-3.25 font-semibold cursor-pointer">
          {t('map.team_cta')}
        </button>
      </div>

    </aside>
    {expanded && <ExpandedSearchMap inventory={inventory} hovered={hovered} results={results} currency={currency} dopRate={dopRate} locations={locations} locationLabel={locationLabel} onCurrencyChange={onCurrencyChange} onSelect={onSelect} onClose={onClose} />}
    </>
  )
}
