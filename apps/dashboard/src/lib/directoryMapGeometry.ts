export type MapBounds = { west: number; east: number; south: number; north: number }
export const directoryMapViews: Record<'dominican_republic' | 'caribbean', MapBounds> = {
  dominican_republic: { west: -72.3, east: -68, south: 17.35, north: 20.3 },
  caribbean: { west: -75, east: -65, south: 16, north: 23 },
}
export type CountryGeometry = { type: string; coordinates: number[][][] | number[][][][] }

export function countryPath(geometry: CountryGeometry) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates as number[][][]]
    : geometry.type === 'MultiPolygon' ? geometry.coordinates as number[][][][] : []
  return polygons.map(polygon => polygon.map(ring => ring.map(([longitude, latitude], index) =>
    `${index ? 'L' : 'M'}${longitude},${-latitude}`).join(' ') + 'Z').join(' ')).join(' ')
}

export function mapPoint(latitude: number, longitude: number, bounds: MapBounds) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
    || latitude < bounds.south || latitude > bounds.north || longitude < bounds.west || longitude > bounds.east) return null
  return { left: (longitude - bounds.west) / (bounds.east - bounds.west) * 100,
    top: (bounds.north - latitude) / (bounds.north - bounds.south) * 100 }
}
