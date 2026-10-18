import { WEBSITE_COPY_NAMESPACES, WEBSITE_IMAGE_KEYS, WEBSITE_ROUTES, hydrateEditorSettings, isPublicHttps, validateWebsiteSettings } from './websiteEditorDefaults'
import type { WebsiteSettings } from '../../../../packages/website-settings/src'

export interface WebsiteDraftCache { expectedVersion: number; settings: WebsiteSettings; savedAt: string }
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const onlyKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).every(key => keys.includes(key))
const text = (value: unknown, max: number): value is string => typeof value === 'string' && value.length <= max
const pair = (value: unknown, max: number) => record(value) && onlyKeys(value, ['en', 'es']) && text(value.en, max) && text(value.es, max)
const url = (value: unknown) => text(value, 2048) && (!value || isPublicHttps(value))
const slug = (value: unknown) => text(value, 64) && /^[a-z0-9][a-z0-9_-]*$/.test(value)
const uuid = (value: unknown) => text(value, 36) && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value)
const list = (value: unknown, max: number, check: (item: unknown) => boolean) => Array.isArray(value) && value.length <= max && value.every(check)

/** Accept incomplete form fields, but never restore malformed structures or unsafe links. */
export function parseWebsiteDraft(raw: string): WebsiteDraftCache | null {
  if (new TextEncoder().encode(raw).length > 270_000) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (!record(value) || !onlyKeys(value, ['expectedVersion', 'settings', 'savedAt']) || !Number.isInteger(value.expectedVersion) || Number(value.expectedVersion) < 0 || !text(value.savedAt, 80) || !record(value.settings)) return null
    const settings = value.settings
    const allowed = ['translations', 'navigation', 'gallery', 'images', 'searchAreas', 'resources', 'realtorTools', 'teamMembers']
    if (Object.keys(settings).some(key => !allowed.includes(key))) return null
    if (!record(settings.translations) || Object.entries(settings.translations).some(([language, namespaces]) =>
      !['en', 'es'].includes(language) || !record(namespaces) || Object.entries(namespaces).some(([namespace, entries]) =>
        !WEBSITE_COPY_NAMESPACES.includes(namespace as typeof WEBSITE_COPY_NAMESPACES[number]) || !record(entries) || Object.entries(entries).some(([key, content]) =>
          key.length > 150 || key.split('.').some(part => ['__proto__', 'constructor', 'prototype'].includes(part)) || !text(content, 6000))))) return null
    if (!list(settings.navigation, 10, item => record(item) && onlyKeys(item, ['route', 'label', 'enabled']) && WEBSITE_ROUTES.includes(item.route as typeof WEBSITE_ROUTES[number]) && pair(item.label, 160) && typeof item.enabled === 'boolean')) return null
    const gallery = settings.gallery
    if (!record(gallery) || !onlyKeys(gallery, ['mode', 'ids', 'photos']) || !['auto', 'featured'].includes(String(gallery.mode)) || !list(gallery.ids, 5, uuid) || !record(gallery.photos)
      || Object.keys(gallery.photos).length > 50 || Object.entries(gallery.photos).some(([id, photo]) => !uuid(id) || !url(photo))) return null
    if (!record(settings.images) || Object.entries(settings.images).some(([key, photo]) => !WEBSITE_IMAGE_KEYS.includes(key as typeof WEBSITE_IMAGE_KEYS[number]) || !url(photo))) return null
    if (!list(settings.searchAreas, 12, item => record(item) && onlyKeys(item, ['key', 'label', 'locations']) && slug(item.key) && pair(item.label, 160) && list(item.locations, 60, place => text(place, 80)))) return null
    const resource = (item: unknown, isTool = false) => record(item) && onlyKeys(item, ['id', 'title', 'description', 'category', 'url', 'enabled', ...(isTool ? ['access', 'mode'] : [])]) && slug(item.id) && pair(item.title, 160) && pair(item.description, 4000) && pair(item.category, 160) && url(item.url) && typeof item.enabled === 'boolean'
    if (!list(settings.resources, 100, item => resource(item)) || !list(settings.realtorTools, 100, item => resource(item, true) && record(item) && ['public', 'realtor'].includes(String(item.access)) && item.mode === 'link')) return null
    if (!list(settings.teamMembers, 100, item => record(item) && onlyKeys(item, ['id', 'name', 'role', 'description', 'photo', 'section', 'enabled']) && slug(item.id) && text(item.name, 120) && pair(item.role, 160) && pair(item.description, 4000)
      && url(item.photo) && ['leadership', 'realtor'].includes(String(item.section)) && typeof item.enabled === 'boolean')) return null
    const hydrated = hydrateEditorSettings(settings as unknown as WebsiteSettings)
    validateWebsiteSettings(hydrated)
    return { expectedVersion: Number(value.expectedVersion), settings: hydrated, savedAt: value.savedAt }
  } catch { return null }
}

export function encodeWebsiteDraft(expectedVersion: number, settings: WebsiteSettings): string | null {
  const raw = JSON.stringify({ expectedVersion, settings, savedAt: new Date().toISOString() })
  return parseWebsiteDraft(raw) ? raw : null
}
