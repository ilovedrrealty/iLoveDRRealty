'use client'
import { GoogleMap, MarkerF, OverlayView, useJsApiLoader } from '@react-google-maps/api'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { areaSummaryPoints, clusterAreaSummaries, clusterMapListings, type AreaMapCluster, type ListingMapData, type MapBounds, type MapCluster } from '../data/searchMap'
import { coordsForRegion } from '../data/searchData'

const CENTER = { lat: 18.73, lng: -70.16 }
const OPTIONS: google.maps.MapOptions = { disableDefaultUI: true, zoomControl: true, minZoom: 6, maxZoom: 20, gestureHandling: 'cooperative' }
const EXPANDED_OPTIONS: google.maps.MapOptions = { ...OPTIONS, gestureHandling: 'greedy' }

export function SearchInventoryMap({ apiKey, data, scope, locations, expanded, hoveredId, onSelect, onAreaSelect, onViewportChange }: {
  apiKey: string; data: ListingMapData; scope: string; locations: string[]; expanded: boolean; hoveredId?: string
  onSelect: (id: string) => void; onAreaSelect: (locations: string[]) => void; onViewportChange: (bounds: MapBounds) => void
}) {
  const { t, i18n } = useTranslation('search')
  const { isLoaded, loadError } = useJsApiLoader({ id: 'google-map-script', googleMapsApiKey: apiKey })
  const mapRef = useRef<google.maps.Map | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(8)
  const [bounds, setBounds] = useState<MapBounds | null>(null)
  const [selected, setSelected] = useState<MapCluster | null>(null)
  const areas = useMemo(() => areaSummaryPoints(data.areas), [data.areas])
  const areaClusters = useMemo(() => clusterAreaSummaries(data.areas, zoom), [data.areas, zoom])
  const clusters = useMemo(() => clusterMapListings(data.items, zoom, bounds), [data.items, zoom, bounds])
  const fitRef = useRef<() => void>(() => {})
  fitRef.current = () => {
    const map = mapRef.current
    if (!map) return
    const points = areas.map(area => area.point)
    if (data.bounds) points.push({ lat: data.bounds.south, lng: data.bounds.west }, { lat: data.bounds.north, lng: data.bounds.east })
    if (!points.length) points.push(...locations.flatMap(location => { const point = coordsForRegion(location); return point ? [point] : [] }))
    if (points.length > 1) { const box = new google.maps.LatLngBounds(); points.forEach(point => box.extend(point)); map.fitBounds(box, 44) }
    else if (points.length) { map.panTo(points[0]); map.setZoom(12) }
    else { map.panTo(CENTER); map.setZoom(8) }
  }
  // Pagination and viewport-only responses never recenter a user's map.
  const fitSignature = `${scope}:${data.total}:${data.mapped_total}:${data.areas.length}`
  useEffect(() => { setSelected(null); fitRef.current() }, [fitSignature, isLoaded])
  useEffect(() => {
    if (!isLoaded || !containerRef.current) return
    const container = containerRef.current
    let frame = 0
    let visible = false
    const resize = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const map = mapRef.current
        if (!map || !container.clientWidth || !container.clientHeight) { visible = false; return }
        const center = map.getCenter()
        google.maps.event.trigger(map, 'resize')
        if (!visible) fitRef.current()
        else if (center) map.setCenter(center)
        visible = true
      })
    }
    const observer = new ResizeObserver(resize)
    observer.observe(container); resize()
    return () => { observer.disconnect(); cancelAnimationFrame(frame) }
  }, [isLoaded])
  function idle() {
    const map = mapRef.current
    const box = map?.getBounds()
    if (!map || !box) return
    const ne = box.getNorthEast(), sw = box.getSouthWest()
    const next = { south: sw.lat(), west: sw.lng(), north: ne.lat(), east: ne.lng() }
    setZoom(map.getZoom() ?? 8); setBounds(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next)
    onViewportChange(next)
  }
  function selectCluster(cluster: MapCluster) {
    if (cluster.items.length === 1) { onSelect(cluster.items[0].id); return }
    setSelected(cluster)
    const map = mapRef.current
    if (map) { const box = new google.maps.LatLngBounds(); cluster.items.forEach(item => box.extend({ lat: item.latitude, lng: item.longitude })); map.fitBounds(box, 64) }
  }
  function selectArea(cluster: AreaMapCluster) {
    const map = mapRef.current
    if (cluster.distinctCentres && map && zoom < 20) {
      map.fitBounds(cluster.bounds, 72)
    } else onAreaSelect(cluster.locations)
  }
  if (!isLoaded || loadError) return <div role="status" className="h-full min-h-64 flex items-center justify-center bg-ink text-white/80 p-6 text-center text-sm">{t(loadError ? 'map.unavailable' : 'map.loading')}</div>
  return <div ref={containerRef} className="relative h-full w-full">
    <GoogleMap mapContainerStyle={{ width: '100%', height: '100%' }} center={CENTER} zoom={8} options={expanded ? EXPANDED_OPTIONS : OPTIONS}
      onLoad={map => { mapRef.current = map; fitRef.current() }} onUnmount={() => { mapRef.current = null }} onIdle={idle}>
      {clusters.map(cluster => <MarkerF key={cluster.key} position={cluster.point} onClick={() => selectCluster(cluster)}
        title={cluster.items.length === 1 ? `${t('map.exact_pin')}: ${cluster.items[0].title}` : t('map.exact_cluster', { count: cluster.items.length })}
        label={cluster.items.length > 1 ? { text: String(cluster.items.length), color: '#fff', fontWeight: '700' } : undefined}
        zIndex={cluster.items.some(item => item.id === hoveredId) ? 500 : 100}
        options={{ optimized: false }} />)}
      {areaClusters.map(area => {
        const label = t(area.distinctCentres && zoom < 20 ? 'map.area_cluster_zoom' : 'map.area_cluster_filter', {
          area: area.locations.join(', '), count: area.count, areas: area.locations.length,
        })
        const count = new Intl.NumberFormat(i18n.language, area.count > 9999 ? { notation: 'compact', maximumFractionDigits: 1 } : {}).format(area.count)
        return <OverlayView key={area.key} position={area.point} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET} getPixelPositionOffset={(width, height) => ({ x: -width / 2, y: -height / 2 })}>
          <div className="group relative z-10 hover:z-[2000] focus-within:z-[2000]">
            <button type="button" onClick={() => selectArea(area)} title={label} aria-label={label}
              className="grid h-[50px] w-[50px] place-items-center rounded-full border-2 border-dashed border-[#5b21b6] bg-white text-[13px] font-bold text-[#5b21b6] shadow-md cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral">
              {count}
            </button>
            <span aria-hidden="true" className="pointer-events-none absolute bottom-full left-1/2 z-[1100] mb-2 w-52 -translate-x-1/2 rounded-lg bg-ink px-3 py-2 text-xs font-semibold leading-relaxed text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">{label}</span>
          </div>
        </OverlayView>
      })}
    </GoogleMap>
    {selected && <div className="absolute bottom-3 left-3 right-3 max-h-52 overflow-y-auto rounded-xl bg-white border border-line p-3 shadow-lg">
      <div className="flex justify-between gap-3"><p className="text-xs font-bold">{t('map.exact_cluster', { count: selected.items.length })}</p><button type="button" onClick={() => setSelected(null)} className="text-xs underline">{t('map.close_cluster')}</button></div>
      {selected.items.slice(0, 20).map(item => <button key={item.id} type="button" onClick={() => onSelect(item.id)} className="block w-full py-2 border-b border-line text-left text-xs text-sea underline">{item.title}</button>)}
      {selected.items.length > 20 && <p className="text-xs text-dim mt-2">{t('map.cluster_refine')}</p>}
    </div>}
  </div>
}
