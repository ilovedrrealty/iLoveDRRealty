import type { Listing } from './listings'
import { coordsForRegion } from './searchData'

export interface MapPoint { lat: number; lng: number }
export interface MapBounds { south: number; west: number; north: number; east: number }
export interface MapListing {
  id: string; title: string; location: string; latitude: number; longitude: number
  price: number | null; currency: string; transaction: string; price_period: 'month' | 'day' | null
}
export interface ListingMapData {
  items: MapListing[]; total: number; mapped_total: number; unmapped_total: number
  areas: { location: string; count: number }[]; ungrouped_total: number
  viewport_total: number; returned: number; limit: number; truncated: boolean; bounds: MapBounds | null
}
export const EMPTY_LISTING_MAP: ListingMapData = { items: [], total: 0, mapped_total: 0, unmapped_total: 0, areas: [], ungrouped_total: 0, viewport_total: 0, returned: 0, limit: 5000, truncated: false, bounds: null }

export function areaSummaryPoints(areas: ListingMapData['areas']) {
  const groups = new Map<string, { location: string; locations: string[]; count: number; point: MapPoint }>()
  for (const area of areas) {
    const point = coordsForRegion(area.location)
    if (!point || area.count <= 0) continue
    const key = `${point.lat}:${point.lng}`
    const group = groups.get(key)
    if (group) { group.locations.push(area.location); group.location = group.locations.join(' / '); group.count += area.count }
    else groups.set(key, { ...area, locations: [area.location], point })
  }
  return [...groups.values()]
}

export interface AreaMapCluster {
  key: string
  point: MapPoint
  primaryLocation: string
  locations: string[]
  count: number
  bounds: MapBounds
  distinctCentres: boolean
}

function worldPixel(point: MapPoint, zoom: number) {
  const scale = 256 * 2 ** (Number.isFinite(zoom) ? Math.max(0, Math.min(22, zoom)) : 8)
  const latitude = Math.max(-85.051128, Math.min(85.051128, point.lat)) * Math.PI / 180
  return { x: (point.lng + 180) / 360 * scale, y: (1 - Math.log(Math.tan(Math.PI / 4 + latitude / 2)) / Math.PI) / 2 * scale }
}

/** Approximate area counts are independent of exact property markers.
 * Largest areas anchor first at their existing centre. Neighbour-cell distance
 * checks avoid overlapping bubbles even across a grid boundary; anchors never
 * move to an invented centroid or jittered property position.
 */
export function clusterAreaSummaries(areas: ListingMapData['areas'], zoom: number, minimumPixels = 66): AreaMapCluster[] {
  const distance = Number.isFinite(minimumPixels) ? Math.max(56, minimumPixels) : 66
  const known = areas.flatMap(area => {
    const point = coordsForRegion(area.location)
    return point && Number.isFinite(area.count) && area.count > 0 ? [{ ...area, point }] : []
  }).sort((a, b) => b.count - a.count || a.location.localeCompare(b.location))
  const groups: (AreaMapCluster & { pixel: { x: number; y: number } })[] = []
  const grid = new Map<string, number[]>()
  for (const area of known) {
    const pixel = worldPixel(area.point, zoom)
    const cellX = Math.floor(pixel.x / distance), cellY = Math.floor(pixel.y / distance)
    let nearest = -1, nearestDistance = distance
    for (let x = cellX - 1; x <= cellX + 1; x++) for (let y = cellY - 1; y <= cellY + 1; y++) {
      for (const index of grid.get(`${x}:${y}`) ?? []) {
        const anchor = groups[index].pixel
        const separation = Math.hypot(pixel.x - anchor.x, pixel.y - anchor.y)
        if (separation < nearestDistance) { nearest = index; nearestDistance = separation }
      }
    }
    if (nearest >= 0) {
      const group = groups[nearest]
      group.count += area.count
      if (!group.locations.includes(area.location)) group.locations.push(area.location)
      group.bounds.south = Math.min(group.bounds.south, area.point.lat)
      group.bounds.north = Math.max(group.bounds.north, area.point.lat)
      group.bounds.west = Math.min(group.bounds.west, area.point.lng)
      group.bounds.east = Math.max(group.bounds.east, area.point.lng)
      group.distinctCentres ||= area.point.lat !== group.point.lat || area.point.lng !== group.point.lng
    } else {
      const index = groups.length
      groups.push({ key: area.location, primaryLocation: area.location, locations: [area.location], count: area.count, point: area.point, pixel,
        bounds: { south: area.point.lat, north: area.point.lat, west: area.point.lng, east: area.point.lng }, distinctCentres: false })
      const key = `${cellX}:${cellY}`
      grid.set(key, [...(grid.get(key) ?? []), index])
    }
  }
  return groups.map(({ pixel: _pixel, ...group }) => group)
}

export interface MapCluster { key: string; point: MapPoint; items: MapListing[] }

/** Bounded geographic grid: at most 160 native markers, never 5,000 DOM price pills. */
export function clusterMapListings(items: MapListing[], zoom: number, bounds?: MapBounds | null, maxMarkers = 160): MapCluster[] {
  const markerLimit = Math.max(1, Math.floor(maxMarkers))
  const valid = items.filter(item => {
    if (!listingMapPoint(item)) return false
    return !bounds || (item.latitude >= bounds.south && item.latitude <= bounds.north
      && (bounds.west <= bounds.east ? item.longitude >= bounds.west && item.longitude <= bounds.east : item.longitude >= bounds.west || item.longitude <= bounds.east))
  })
  const scale = 256 * 2 ** Math.max(0, Math.min(22, zoom))
  let size = 64
  let cells: Map<string, MapListing[]>
  do {
    cells = new Map()
    for (const item of valid) {
      const latitude = Math.max(-85.051128, Math.min(85.051128, item.latitude)) * Math.PI / 180
      const x = (item.longitude + 180) / 360 * scale
      const y = (1 - Math.log(Math.tan(Math.PI / 4 + latitude / 2)) / Math.PI) / 2 * scale
      const key = `${Math.floor(x / size)}:${Math.floor(y / size)}`
      const group = cells.get(key) ?? []
      group.push(item); cells.set(key, group)
    }
    size *= 2
  } while (cells.size > markerLimit)
  return [...cells].map(([key, grouped]) => ({ key, items: grouped, point: {
    lat: grouped.reduce((sum, item) => sum + item.latitude, 0) / grouped.length,
    lng: grouped.reduce((sum, item) => sum + item.longitude, 0) / grouped.length,
  } }))
}

/** Use saved coordinates only: a region name does not locate a property. */
export function listingMapPoint(listing: Pick<Listing, 'latitude' | 'longitude'>): MapPoint | null {
  const lat = listing.latitude
  const lng = listing.longitude
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

export function mappedListings(listings: Listing[]): { listing: Listing; point: MapPoint }[] {
  return listings.flatMap(listing => {
    const point = listingMapPoint(listing)
    return point ? [{ listing, point }] : []
  })
}
