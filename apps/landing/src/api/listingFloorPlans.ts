import {
  floorPlanApiOrigin, floorPlanId, parseFloorPlanAsset, validNoStore, verifyFloorPlanContent, type FloorPlanAsset,
} from '../../../../packages/listing-floor-plans'

const apiOrigin = floorPlanApiOrigin(process.env.NEXT_PUBLIC_API_URL)

function pathFor(listingId: string) {
  if (!floorPlanId(listingId) || !apiOrigin) throw new Error('Invalid listing floor plan reference')
  return apiOrigin + '/listings/' + listingId + '/floor-plan'
}

async function currentRequest(url: string, signal: AbortSignal) {
  return fetch(url, { signal, cache: 'no-store', credentials: 'omit', redirect: 'error' })
}

export async function getPublishedFloorPlan(listingId: string, signal: AbortSignal): Promise<FloorPlanAsset | null> {
  const res = await currentRequest(pathFor(listingId), signal)
  if (res.status === 404) return null
  if (!res.ok || !validNoStore(res.headers.get('Cache-Control'))) throw new Error('Floor plan is unavailable')
  return parseFloorPlanAsset(await res.json())
}

export async function readPublishedFloorPlan(listingId: string, asset: FloorPlanAsset, signal: AbortSignal): Promise<Blob | null> {
  if (!floorPlanId(asset.id)) throw new Error('Invalid floor plan revision')
  const res = await currentRequest(pathFor(listingId) + '/' + asset.id + '/content', signal)
  if (res.status === 404) return null
  if (!res.ok) throw new Error('Floor plan is unavailable')
  const type = res.headers.get('Content-Type')
  const length = res.headers.get('Content-Length')
  if (type !== asset.content_type || (length !== null && Number(length) !== asset.byte_count)) {
    throw new Error('Floor plan content could not be verified')
  }
  return verifyFloorPlanContent(asset, await res.blob(), res.headers.get('Cache-Control'), signal)
}
