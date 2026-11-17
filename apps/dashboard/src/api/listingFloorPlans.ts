import client from './axios'
import {
  floorPlanFileType, floorPlanHash, floorPlanId, parseFloorPlanState, validNoStore, verifyFloorPlanContent,
  type FloorPlanAsset, type FloorPlanState,
} from '../../../../packages/listing-floor-plans'

function endpoint(listingId: string) {
  if (!floorPlanId(listingId)) throw new Error('Invalid listing')
  return '/admin/listings/' + listingId + '/floor-plan'
}

function readReceipt(data: unknown, cacheControl: unknown): FloorPlanState {
  if (!validNoStore(cacheControl)) throw new Error('Floor plan receipt could not be verified')
  return parseFloorPlanState(data)
}

export async function readAdminFloorPlan(listingId: string, signal: AbortSignal) {
  const res = await client.get<unknown>(endpoint(listingId), { signal })
  return readReceipt(res.data, res.headers?.['cache-control'])
}

export async function stageAdminFloorPlan(listingId: string, file: File, replaces: string | null, signal: AbortSignal) {
  const type = floorPlanFileType(file)
  if (!type || (replaces !== null && !floorPlanId(replaces))) throw new Error('Invalid floor plan upload')
  const hash = await floorPlanHash(file, signal)
  const path = endpoint(listingId) + '/draft'
  const res = await client.put<unknown>(path, file, {
    signal, params: replaces === null ? undefined : { replaces }, headers: { 'Content-Type': type },
  })
  const state = readReceipt(res.data, res.headers?.['cache-control'])
  if (state.draft?.sha256 !== hash || state.draft.content_type !== type || state.draft.byte_count !== file.size) {
    throw new Error('Staged floor plan could not be verified')
  }
  return state
}

export async function readAdminDraftContent(listingId: string, asset: FloorPlanAsset, signal: AbortSignal) {
  if (!floorPlanId(asset.id)) throw new Error('Invalid draft')
  const res = await client.get<Blob>(endpoint(listingId) + '/draft/' + asset.id + '/content', { signal, responseType: 'blob' })
  return verifyFloorPlanContent(asset, res.data, res.headers?.['cache-control'], signal)
}

export async function publishAdminFloorPlan(listingId: string, draft: string, published: string | null, signal: AbortSignal) {
  if (!floorPlanId(draft) || (published !== null && !floorPlanId(published))) throw new Error('Invalid floor plan revision')
  const res = await client.post<unknown>(endpoint(listingId) + '/publish', {
    draft_id: draft, expected_published_id: published, owner_permission_confirmed: true,
  }, { signal })
  const state = readReceipt(res.data, res.headers?.['cache-control'])
  if (state.published?.id !== draft) throw new Error('Floor plan publication could not be verified')
  return state
}

export async function withdrawAdminFloorPlan(listingId: string, assetId: string, signal: AbortSignal) {
  if (!floorPlanId(assetId)) throw new Error('Invalid floor plan revision')
  const res = await client.post<unknown>(endpoint(listingId) + '/withdraw', { published_id: assetId }, { signal })
  const state = readReceipt(res.data, res.headers?.['cache-control'])
  if (state.published !== null) throw new Error('Floor plan withdrawal could not be verified')
  return state
}
