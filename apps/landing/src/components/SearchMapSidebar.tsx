'use client'
import { GoogleMap, OverlayView, useJsApiLoader } from '@react-google-maps/api'
import { useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { fmt, fmtDOP, type Listing } from '../data/listings'
import { DR_REGIONS, coordsForRegion, isLocality } from '../data/searchData'
import { supabaseImgUrl } from '../api/imgUrl'

const titleCase = (s: string) =>
  s === s.toUpperCase() ? s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : s

function strHash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) >>> 0
  return h
}

function coordsForListing(l: Listing): { lat: number; lng: number } {
  if (l.latitude != null && l.longitude != null) {
    return { lat: l.latitude, lng: l.longitude }
  }
  // No exact coordinates — pin on the region the listing was filed under, with a
  // deterministic offset so the address stays approximate and stacked listings
  // in one region fan out instead of overlapping.
  const base = coordsForRegion(l.region) ?? DR_REGIONS[0]
  const seed = (strHash(l.id) * 9301 + 49297) % 233280
  const rand = (i: number) => (((seed * (i + 1)) % 233280) / 233280) * 2 - 1
  return { lat: base.lat + rand(1) * 0.055, lng: base.lng + rand(2) * 0.075 }
}

const MAP_CENTER = { lat: 18.73, lng: -70.16 }
const MAP_STYLES: google.maps.MapTypeStyle[] = [
  { featureType: 'poi',            elementType: 'labels.icon',        stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',        elementType: 'labels.icon',        stylers: [{ visibility: 'off' }] },
  { featureType: 'road',           elementType: 'geometry.fill',      stylers: [{ color: '#f0ede8' }] },
  { featureType: 'road.highway',   elementType: 'geometry.fill',      stylers: [{ color: '#e4dfd8' }] },
  { featureType: 'water',          elementType: 'geometry',           stylers: [{ color: '#cfe0f0' }] },
  { featureType: 'landscape',      elementType: 'geometry',           stylers: [{ color: '#f7f5f2' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke',    stylers: [{ color: '#d8d3cc' }] },
]
const MAP_OPTIONS: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  styles: MAP_STYLES,
  gestureHandling: 'cooperative',
  minZoom: 7,
  maxZoom: 14,
}

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

function LiveMap({ apiKey, hovered, listings, onSelect, currency, dopRate, region, locations }: {
  apiKey: string
  hovered: Listing | null
  listings: Listing[]
  onSelect: (l: Listing) => void
  currency: 'USD' | 'DOP'
  dopRate: number
  region: string | null
  locations: string[]
}) {
  const { t } = useTranslation('search')
  const { isLoaded } = useJsApiLoader({ id: 'google-map-script', googleMapsApiKey: apiKey })
  const mapRef = useRef<google.maps.Map | null>(null)

  const selectedLocations = JSON.stringify(locations)
  function positionMap(map: google.maps.Map) {
    const points = locations.map(coordsForRegion).filter((point): point is { lat: number; lng: number } => point !== null)
    if (points.length > 1) {
      const bounds = new google.maps.LatLngBounds()
      points.forEach(point => bounds.extend(point))
      map.fitBounds(bounds, 24)
    } else if (points.length === 1) {
      map.panTo(points[0])
      map.setZoom(isLocality(locations[0]) ? 12 : 10)
    } else {
      map.panTo(MAP_CENTER)
      map.setZoom(8)
    }
  }
  useEffect(() => { if (mapRef.current) positionMap(mapRef.current) }, [selectedLocations])


  if (!isLoaded) {
    return (
      <div style={{ width: '100%', height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#00102e', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
        {t('map.loading')}
      </div>
    )
  }

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '260px' }}
      center={MAP_CENTER}
      zoom={8}
      options={MAP_OPTIONS}
      onLoad={map => { mapRef.current = map; positionMap(map) }}
    >
      {listings.map(l => {
        const pos   = coordsForListing(l)
        const isHot = hovered?.id === l.id
        return (
          <OverlayView
            key={l.id}
            position={pos}
            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            getPixelPositionOffset={(w, h) => ({ x: -w / 2, y: -h / 2 })}
          >
            <div style={{ overflow: 'visible', whiteSpace: 'nowrap' }}>
              <div
                onClick={() => onSelect(l)}
                style={{
                  display: 'inline-block',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  overflow: 'visible',
                  fontSize: '13px',
                  fontWeight: '700',
                  fontFamily: '"Mona Sans","Inter",system-ui,sans-serif',
                  padding: '7px 13px',
                  borderRadius: '9999px',
                  background: isHot ? '#00102e' : 'white',
                  color: isHot ? 'white' : '#00102e',
                  border: `1.5px solid ${isHot ? '#00102e' : 'rgba(0,0,0,0.18)'}`,
                  userSelect: 'none',
                  boxShadow: isHot ? '0 2px 10px rgba(0,0,0,0.35)' : '0 2px 6px rgba(0,0,0,0.14)',
                  zIndex: isHot ? 10 : 1,
                  position: 'relative',
                  transform: isHot ? 'scale(1.08)' : 'scale(1)',
                  transition: 'all 0.15s ease',
                }}
              >
                {l.price > 0 ? fmtPill(l, currency, dopRate, t(l.pricePeriod === 'day' ? 'per_day' : 'per_month')) : t('request_price')}
              </div>
            </div>
          </OverlayView>
        )
      })}
    </GoogleMap>
  )
}

function DRMap({ hovered, listings, onSelect, currency, dopRate, onCurrencyChange, region, locations }: {
  hovered: Listing | null
  listings: Listing[]
  onSelect: (l: Listing) => void
  currency: 'USD' | 'DOP'
  dopRate: number
  onCurrencyChange: (c: 'USD' | 'DOP') => void
  region: string | null
  locations: string[]
}) {
  const { t } = useTranslation('search')
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''
  const hasKey = Boolean(apiKey && apiKey !== 'YOUR_KEY_HERE')

  return (
    <div className="bg-paper rounded-2xl overflow-hidden border border-line">
      <div className="pt-3.5 px-4.5 pb-3.5 flex items-start justify-between gap-2">
        <div>
          <div className="font-sans text-4.25 font-semibold text-ink">Dominican Republic</div>
          <div className="text-xs text-dim mt-0.5 font-sans">
            {listings.length > 0
              ? t('map.mapped', { count: listings.length })
              : t('map.tap_region')}
          </div>
        </div>
        <div className="flex rounded-lg border border-line overflow-hidden text-[11px] font-bold shrink-0">
          {(['DOP', 'USD'] as const).map(c => (
            <button key={c} type="button" onClick={() => onCurrencyChange(c)}
              className="px-2.5 py-1 transition-colors cursor-pointer"
              style={{ background: currency === c ? '#00102e' : 'white', color: currency === c ? 'white' : '#64748b' }}>
              {c}
            </button>
          ))}
        </div>
      </div>
      <div>
        {hasKey ? (
          <LiveMap
            apiKey={apiKey}
            hovered={hovered}
            listings={listings}
            onSelect={onSelect}
            currency={currency}
            dopRate={dopRate}
            region={region}
            locations={locations}
          />
        ) : (
          <div style={{ width: '100%', height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#00102e', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
            {t('map.unavailable')}
          </div>
        )}
      </div>
    </div>
  )
}

export interface MapSidebarProps {
  hovered: Listing | null
  results: Listing[]
  alsoLike: Listing[]
  insights: { count: number; median: number; avgYield: number } | null
  currency: 'USD' | 'DOP'
  dopRate: number
  region: string | null
  locations: string[]
  locationLabel: string | null
  onCurrencyChange: (c: 'USD' | 'DOP') => void
  onSelect: (l: Listing) => void
  go: (path: string) => void
}

export function SearchMapSidebar({
  hovered, results, alsoLike, insights, currency, dopRate, region, locations, locationLabel,
  onCurrencyChange, onSelect, go,
}: MapSidebarProps) {
  const { t } = useTranslation('search')
  const fmtMedian = (v: number) => {
    if (currency === 'DOP') {
      return fmtDOP(Math.round(v * dopRate))
    }
    return v >= 1_000_000_000_000 ? `$${(v / 1_000_000_000_000).toFixed(2)}T USD` :
      v >= 1_000_000_000 ? `$${(v / 1_000_000_000).toFixed(2)}B USD` :
      v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2)}M USD` : `$${Math.round(v / 1_000)}K USD`
  }

  return (
    <aside className="hidden lg:block self-start sticky top-22.5 max-h-[calc(100vh-110px)] overflow-y-auto space-y-3.5">

      <DRMap
        hovered={hovered}
        listings={results}
        onSelect={onSelect}
        currency={currency}
        dopRate={dopRate}
        onCurrencyChange={onCurrencyChange}
        region={region}
        locations={locations}
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
  )
}
