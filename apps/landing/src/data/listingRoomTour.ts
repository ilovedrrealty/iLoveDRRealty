export type ListingRoomPhoto = {
  url: string
  caption_en?: string
  caption_es?: string
}

export type ListingRoomGroup = {
  id: string
  label_en: string
  label_es: string
  photos: ListingRoomPhoto[]
}

export type ListingRoomTour = { groups: ListingRoomGroup[] }

const MAX_GROUPS = 24
const MAX_PHOTOS = 100
const GROUP_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const TEXT_CONTROLS = /[\u0000-\u001f\u007f]/
const SUPABASE_HOST = /^[a-z0-9][a-z0-9-]*\.supabase\.co$/
const LISTING_OBJECT_PATH = /^\/storage\/v1\/object\/public\/listing-images\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.(?:jpe?g|png|webp|heic)$/i

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown, limit: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= limit
    && value.trim() === value && !TEXT_CONTROLS.test(value)
}

function publicListingImage(value: string): boolean {
  try {
    const url = new URL(value)
    return url.href === value && url.protocol === 'https:' && SUPABASE_HOST.test(url.hostname)
      && !url.port && !url.username && !url.password && !url.search && !url.hash
      && LISTING_OBJECT_PATH.test(url.pathname)
  } catch {
    return false
  }
}

/** A tour can select only photos already approved in this listing's public gallery. */
export function parseListingRoomTour(value: unknown, approvedImages: readonly string[]): ListingRoomTour | null {
  if (!Array.isArray(approvedImages) || !record(value) || Object.keys(value).length !== 1 || !Array.isArray(value.groups)
    || value.groups.length === 0 || value.groups.length > MAX_GROUPS) return null

  const approved = new Set(approvedImages)
  const photoUrls = new Set<string>()
  const groupIds = new Set<string>()
  const groups: ListingRoomGroup[] = []
  for (const group of value.groups) {
    if (!record(group) || Object.keys(group).length !== 4 || !text(group.id, 64) || !GROUP_ID.test(group.id)
      || groupIds.has(group.id) || !text(group.label_en, 80) || !text(group.label_es, 80)
      || !Array.isArray(group.photos) || group.photos.length === 0 || group.photos.length > MAX_PHOTOS - photoUrls.size) return null

    const photos: ListingRoomPhoto[] = []
    for (const photo of group.photos) {
      if (!record(photo) || typeof photo.url !== 'string' || !approved.has(photo.url)
        || photoUrls.has(photo.url) || !publicListingImage(photo.url)) return null
      const hasCaptions = Object.hasOwn(photo, 'caption_en') || Object.hasOwn(photo, 'caption_es')
      if (hasCaptions) {
        if (Object.keys(photo).length !== 3 || !text(photo.caption_en, 240) || !text(photo.caption_es, 240)) return null
        photos.push({ url: photo.url, caption_en: photo.caption_en, caption_es: photo.caption_es })
      } else {
        if (Object.keys(photo).length !== 1) return null
        photos.push({ url: photo.url })
      }
      photoUrls.add(photo.url)
    }
    groups.push({ id: group.id, label_en: group.label_en, label_es: group.label_es, photos })
    groupIds.add(group.id)
  }
  return { groups }
}
