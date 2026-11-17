export const FLOOR_PLAN_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const
export const FLOOR_PLAN_MAX_BYTES = 6 * 1024 * 1024
export type FloorPlanType = typeof FLOOR_PLAN_TYPES[number]

export type FloorPlanAsset = {
  id: string
  content_type: FloorPlanType
  byte_count: number
  sha256: string
  created_at: string
}
export type FloorPlanState = { draft: FloorPlanAsset | null; published: FloorPlanAsset | null }

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const sha256 = /^[0-9a-f]{64}$/
const encodedTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/
const extensions = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' } as const
const downloadExtensions: Record<FloorPlanType, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' }

export function floorPlanId(value: unknown): value is string {
  return typeof value === 'string' && uuid.test(value)
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid floor plan receipt')
  return value as Record<string, unknown>
}

function validSize(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= FLOOR_PLAN_MAX_BYTES
}

function mediaType(value: unknown): value is FloorPlanType {
  return FLOOR_PLAN_TYPES.some(type => type === value)
}

export function parseFloorPlanAsset(value: unknown): FloorPlanAsset {
  const { id, content_type, byte_count, sha256: hash, created_at } = record(value)
  if (!floorPlanId(id) || !mediaType(content_type) || !validSize(byte_count)
    || typeof hash !== 'string' || !sha256.test(hash) || typeof created_at !== 'string'
    || !encodedTime.test(created_at) || !Number.isFinite(Date.parse(created_at))) throw new Error('Invalid floor plan asset')
  return { id, content_type, byte_count, sha256: hash, created_at }
}

export function parseFloorPlanState(value: unknown): FloorPlanState {
  const row = record(value)
  const draft = row.draft === null ? null : parseFloorPlanAsset(row.draft)
  const published = row.published === null ? null : parseFloorPlanAsset(row.published)
  if (draft?.id && draft.id === published?.id) throw new Error('Invalid floor plan revision')
  return { draft, published }
}

export function floorPlanFileType(file: Pick<File, 'name' | 'type' | 'size'>): FloorPlanType | null {
  if (!validSize(file.size)) return null
  const suffix = /\.([a-z]+)$/i.exec(file.name.trim())?.[1]?.toLowerCase()
  if (!suffix || !Object.prototype.hasOwnProperty.call(extensions, suffix)) return null
  const known = extensions[suffix as keyof typeof extensions]
  return file.type === '' || file.type === known ? known : null
}

export function validNoStore(value: unknown): boolean {
  return typeof value === 'string' && value.toLowerCase().split(',').some(token => token.trim() === 'no-store')
}

export function floorPlanApiOrigin(configured: string | undefined): string | null {
  try {
    if (!configured?.trim()) return null
    const url = new URL(configured.trim())
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null
    const loopback = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    return url.protocol === 'https:' || loopback ? url.origin : null
  } catch { return null }
}

export async function floorPlanHash(blob: Blob, signal: AbortSignal): Promise<string> {
  signal.throwIfAborted()
  const bytes = await blob.arrayBuffer()
  signal.throwIfAborted()
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  signal.throwIfAborted()
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function verifyFloorPlanContent(asset: FloorPlanAsset, blob: Blob, cacheControl: unknown, signal: AbortSignal): Promise<Blob> {
  if (!(blob instanceof Blob) || blob.size !== asset.byte_count || blob.type !== asset.content_type
    || !validNoStore(cacheControl) || await floorPlanHash(blob, signal) !== asset.sha256) throw new Error('Floor plan content could not be verified')
  return blob
}

export function startFloorPlanDownload(blob: Blob, asset: FloorPlanAsset, filename: string): () => void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename + '.' + downloadExtensions[asset.content_type]
  anchor.rel = 'noopener noreferrer'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  const revoke = () => URL.revokeObjectURL(url)
  const timer = window.setTimeout(revoke, 1000)
  return () => { window.clearTimeout(timer); revoke() }
}
