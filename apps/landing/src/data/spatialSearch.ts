export type SpatialPoint = { lat: number; lng: number }

export type SpatialSearch =
  | { kind: 'radius'; center: SpatialPoint; km: number }
  | { kind: 'polygon'; vertices: SpatialPoint[] }

type ProjectedPoint = { x: number; y: number }

const MIN_VERTICES = 3
const MAX_VERTICES = 24
const MAX_WIRE_LENGTH = 600
const MICRODEGREES = 1_000_000
const RADIANS_PER_DEGREE = Math.PI / 180
const ROUNDING_ERROR = 8 * Number.EPSILON
// An end-of-input check avoids the final-newline match allowed by JavaScript's $ anchor.
const DECIMAL = /^-?[0-9]+(?:\.[0-9]{1,6})?(?![\s\S])/

function boundedDecimal(token: string, min: number, max: number): number | null {
  if (!DECIMAL.test(token)) return null
  const number = Number(token)
  return number >= min && number <= max ? number || 0 : null
}

function parsePoint(lat: string, lng: string): SpatialPoint | null {
  const latitude = boundedDecimal(lat, -85, 85)
  const longitude = boundedDecimal(lng, -180, 180)
  return latitude === null || longitude === null ? null : { lat: latitude, lng: longitude }
}

function project(point: SpatialPoint): ProjectedPoint {
  // The map draws straight edges in Web Mercator, so validate in the same projection.
  return { x: point.lng * RADIANS_PER_DEGREE, y: Math.asinh(Math.tan(point.lat * RADIANS_PER_DEGREE)) }
}

function turn(a: ProjectedPoint, b: ProjectedPoint, c: ProjectedPoint): -1 | 0 | 1 {
  const left = (b.x - a.x) * (c.y - a.y)
  const right = (b.y - a.y) * (c.x - a.x)
  const cross = left - right
  if (Math.abs(cross) <= ROUNDING_ERROR * (Math.abs(left) + Math.abs(right))) return 0
  return cross < 0 ? -1 : 1
}

function withinSegment(a: ProjectedPoint, b: ProjectedPoint, p: ProjectedPoint): boolean {
  return p.x >= Math.min(a.x, b.x) && p.x <= Math.max(a.x, b.x)
    && p.y >= Math.min(a.y, b.y) && p.y <= Math.max(a.y, b.y)
}

function edgesIntersect(a: ProjectedPoint, b: ProjectedPoint, c: ProjectedPoint, d: ProjectedPoint): boolean {
  const abc = turn(a, b, c)
  const abd = turn(a, b, d)
  const cda = turn(c, d, a)
  const cdb = turn(c, d, b)
  return (abc * abd < 0 && cda * cdb < 0)
    || (abc === 0 && withinSegment(a, b, c))
    || (abd === 0 && withinSegment(a, b, d))
    || (cda === 0 && withinSegment(c, d, a))
    || (cdb === 0 && withinSegment(c, d, b))
}

function hasArea(points: ProjectedPoint[]): boolean {
  const origin = points[0]
  let area = 0
  let correction = 0
  let magnitude = 0
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const left = (a.x - origin.x) * (b.y - origin.y)
    const right = (a.y - origin.y) * (b.x - origin.x)
    magnitude += Math.abs(left) + Math.abs(right)
    const triangle = left - right
    const sum = area + triangle
    // Compensate for cancellation between signed triangles in concave polygons.
    correction += Math.abs(area) >= Math.abs(triangle) ? (area - sum) + triangle : (triangle - sum) + area
    area = sum
  }
  return Math.abs(area + correction) > ROUNDING_ERROR * magnitude
}

function validPolygon(vertices: SpatialPoint[]): boolean {
  if (new Set(vertices.map(({ lat, lng }) => `${lat},${lng}`)).size !== vertices.length) return false
  const longitudes = vertices.map(point => Math.round(point.lng * MICRODEGREES))
  if (Math.max(...longitudes) - Math.min(...longitudes) >= 180 * MICRODEGREES) return false

  const points = vertices.map(project)
  const count = points.length
  for (let i = 0; i < count; i++) {
    const next = (i + 1) % count
    const a = points[i]
    const b = points[next]
    const c = points[(i + 2) % count]
    // Adjacent edges may share an endpoint and continue straight, but cannot double back over each other.
    if (turn(a, b, c) === 0 && (withinSegment(a, b, c) || withinSegment(b, c, a))) return false
    for (let j = i + 2; j < count; j++) {
      const following = (j + 1) % count
      if (following !== i && edgesIntersect(a, b, points[j], points[following])) return false
    }
  }
  return hasArea(points)
}

export function parseSpatialSearch(value: string): SpatialSearch | null {
  if (typeof value !== 'string' || value.length > MAX_WIRE_LENGTH) return null
  const [kind, ...coordinates] = value.split(',')
  if (kind === 'radius' && coordinates.length === 3) {
    const center = parsePoint(coordinates[0], coordinates[1])
    const km = boundedDecimal(coordinates[2], 0.1, 500)
    return center && km !== null ? { kind, center, km } : null
  }
  if (kind !== 'polygon' || coordinates.length % 2 !== 0
    || coordinates.length < MIN_VERTICES * 2 || coordinates.length > MAX_VERTICES * 2) return null

  const vertices: SpatialPoint[] = []
  for (let i = 0; i < coordinates.length; i += 2) {
    const point = parsePoint(coordinates[i], coordinates[i + 1])
    if (point === null) return null
    vertices.push(point)
  }
  return validPolygon(vertices) ? { kind, vertices } : null
}

function decimalToken(value: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(Number(value.toFixed(6))) : ''
}

export function serializeSpatialSearch(value: SpatialSearch): string | null {
  if (!value) return null
  let coordinates: number[]
  if (value.kind === 'radius' && value.center) {
    coordinates = [value.center.lat, value.center.lng, value.km]
  } else if (value.kind === 'polygon' && Array.isArray(value.vertices)
    && value.vertices.length >= MIN_VERTICES && value.vertices.length <= MAX_VERTICES) {
    coordinates = []
    for (const point of value.vertices) {
      if (!point) return null
      coordinates.push(point.lat, point.lng)
    }
  } else {
    return null
  }
  const wire = [value.kind, ...coordinates.map(decimalToken)].join(',')
  return parseSpatialSearch(wire) ? wire : null
}
