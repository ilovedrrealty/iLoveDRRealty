import en_common from '../../../landing/src/locales/en/common.json'
import en_landing from '../../../landing/src/locales/en/landing.json'
import en_home_showcase from '../../../landing/src/locales/en/home_showcase.json'
import en_buying from '../../../landing/src/locales/en/buying.json'
import en_selling from '../../../landing/src/locales/en/selling.json'
import en_rentals from '../../../landing/src/locales/en/rentals.json'
import en_team from '../../../landing/src/locales/en/team.json'
import en_contact from '../../../landing/src/locales/en/contact.json'
import en_get_started from '../../../landing/src/locales/en/get_started.json'
import en_lead_capture from '../../../landing/src/locales/en/lead_capture.json'
import en_footer from '../../../landing/src/locales/en/footer.json'
import en_blog from '../../../landing/src/locales/en/blog.json'
import en_search from '../../../landing/src/locales/en/search.json'
import es_common from '../../../landing/src/locales/es/common.json'
import es_landing from '../../../landing/src/locales/es/landing.json'
import es_home_showcase from '../../../landing/src/locales/es/home_showcase.json'
import es_buying from '../../../landing/src/locales/es/buying.json'
import es_selling from '../../../landing/src/locales/es/selling.json'
import es_rentals from '../../../landing/src/locales/es/rentals.json'
import es_team from '../../../landing/src/locales/es/team.json'
import es_contact from '../../../landing/src/locales/es/contact.json'
import es_get_started from '../../../landing/src/locales/es/get_started.json'
import es_lead_capture from '../../../landing/src/locales/es/lead_capture.json'
import es_footer from '../../../landing/src/locales/es/footer.json'
import es_blog from '../../../landing/src/locales/es/blog.json'
import es_search from '../../../landing/src/locales/es/search.json'
import en_professionals from '../../../landing/src/locales/en/professionals.json'
import es_professionals from '../../../landing/src/locales/es/professionals.json'
import { PRINCIPALS, REALTORS } from '../../../landing/src/data/teamData'
import { HOMEPAGE_PROPERTIES, homepagePhoto } from '../../../landing/src/data/homepageHighlights'
import { LOCATION_GROUPS, groupLocations, normalizeLocation } from '../../../landing/src/data/searchLocations'
import { BUILT_IN_RESEARCH_TOOLS } from './researchTools'
import { emptyWebsiteSettings, WEBSITE_COPY_NAMESPACES, WEBSITE_IMAGE_KEYS, WEBSITE_ROUTES, type WebsiteSettings, type WebsiteNavigation, type TeamMember, type WebsiteArea, type RealtorTool } from '../../../../packages/website-settings/src'

export const COPY_DEFAULTS: Record<string, { en: Record<string, string>; es: Record<string, string> }> = {
  common: { en: flattenStrings(en_common), es: flattenStrings(es_common) },
  landing: { en: flattenStrings(en_landing), es: flattenStrings(es_landing) },
  home_showcase: { en: flattenStrings(en_home_showcase), es: flattenStrings(es_home_showcase) },
  buying: { en: flattenStrings(en_buying), es: flattenStrings(es_buying) },
  selling: { en: flattenStrings(en_selling), es: flattenStrings(es_selling) },
  rentals: { en: flattenStrings(en_rentals), es: flattenStrings(es_rentals) },
  team: { en: flattenStrings(en_team), es: flattenStrings(es_team) },
  contact: { en: flattenStrings(en_contact), es: flattenStrings(es_contact) },
  get_started: { en: flattenStrings(en_get_started), es: flattenStrings(es_get_started) },
  lead_capture: { en: flattenStrings(en_lead_capture), es: flattenStrings(es_lead_capture) },
  footer: { en: flattenStrings(en_footer), es: flattenStrings(es_footer) },
  blog: { en: flattenStrings(en_blog), es: flattenStrings(es_blog) },
  search: { en: flattenStrings(en_search), es: flattenStrings(es_search) },
  professionals: { en: flattenStrings(en_professionals), es: flattenStrings(es_professionals) },
}

export function flattenStrings(value: unknown, prefix = ''): Record<string, string> {
  if (typeof value === 'string') return { [prefix]: value }
  if (!value || typeof value !== 'object') return {}
  return Object.fromEntries(Object.entries(value).flatMap(([key, item]) =>
    Object.entries(flattenStrings(item, prefix ? `${prefix}.${key}` : key))))
}

export const DEFAULT_NAVIGATION: WebsiteNavigation[] = ['landing', 'buying', 'selling', 'team', 'contact', 'get-started', 'blog'].map(route => ({
  route, enabled: true,
  label: { en: en_common.nav[route as keyof typeof en_common.nav], es: es_common.nav[route as keyof typeof es_common.nav] },
}))
export const DEFAULT_GALLERY_IDS = HOMEPAGE_PROPERTIES.map(property => property.id) as string[]
export const DEFAULT_GALLERY_PHOTOS: Record<string, string> = Object.fromEntries(HOMEPAGE_PROPERTIES.map(property => [property.id, homepagePhoto(property.photo)]))
export const DEFAULT_AREAS: WebsiteArea[] = LOCATION_GROUPS.map(group => ({
  key: group.key, locations: [...group.values],
  label: { en: en_search.locations.areas[group.key], es: es_search.locations.areas[group.key] },
}))
export const DEFAULT_TEAM: TeamMember[] = [
  ...PRINCIPALS.map((person, index) => ({
    id: person.id, name: person.name, section: 'leadership' as const, enabled: true,
    photo: `https://ilovedrrealty.com${person.img}`,
    role: { en: en_team.principals.bios[index].role, es: es_team.principals.bios[index].role },
    description: { en: en_team.principals.bios[index].bio, es: es_team.principals.bios[index].bio },
  })),
  ...REALTORS.map((person, index) => ({
    id: person.id, name: person.name, section: 'realtor' as const, enabled: true,
    photo: `https://ilovedrrealty.com${person.img}`,
    role: { en: en_team.realtors.bios[index].role, es: es_team.realtors.bios[index].role },
    description: { en: en_team.realtors.bios[index].bio, es: es_team.realtors.bios[index].bio },
  })),
]
export const DEFAULT_REALTOR_TOOLS: RealtorTool[] = BUILT_IN_RESEARCH_TOOLS.map(tool => ({
  id: tool.id, title: tool.title, description: tool.description, category: tool.category,
  url: tool.url, enabled: tool.enabled, access: 'realtor', mode: 'link',
}))
export { WEBSITE_COPY_NAMESPACES, WEBSITE_IMAGE_KEYS, WEBSITE_ROUTES, groupLocations, normalizeLocation }
export const cloneSettings = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export function hydrateEditorSettings(value: Partial<WebsiteSettings>): WebsiteSettings {
  return cloneSettings({
    ...emptyWebsiteSettings(), ...value,
    navigation: value.navigation?.length ? value.navigation : DEFAULT_NAVIGATION,
    gallery: {
      mode: value.gallery?.mode ?? 'auto',
      ids: value.gallery?.ids?.length ? value.gallery.ids : DEFAULT_GALLERY_IDS,
      photos: value.gallery?.photos ?? {},
    },
    searchAreas: value.searchAreas?.length ? value.searchAreas : DEFAULT_AREAS,
    teamMembers: value.teamMembers?.length ? value.teamMembers : DEFAULT_TEAM,
    realtorTools: value.realtorTools?.length
      ? [...value.realtorTools, ...DEFAULT_REALTOR_TOOLS.filter(tool => !value.realtorTools?.some(item => item.id === tool.id))]
      : DEFAULT_REALTOR_TOOLS,
  })
}

/** Preserve built-in fallbacks rather than saving a second copy of unchanged content. */
export function prepareWebsiteSettings(value: WebsiteSettings): WebsiteSettings {
  const result = cloneSettings(value)
  if (same(result.navigation, DEFAULT_NAVIGATION)) result.navigation = []
  if (same(result.searchAreas, DEFAULT_AREAS)) result.searchAreas = []
  if (same(result.teamMembers, DEFAULT_TEAM)) result.teamMembers = []
  if (same(result.realtorTools, DEFAULT_REALTOR_TOOLS)) result.realtorTools = []
  if (same(result.gallery.ids, DEFAULT_GALLERY_IDS)) result.gallery.ids = []
  for (const [id, photo] of Object.entries(result.gallery.photos)) {
    if (!photo || photo === DEFAULT_GALLERY_PHOTOS[id]) delete result.gallery.photos[id]
  }
  for (const key of Object.keys(result.images)) if (!result.images[key].trim()) delete result.images[key]
  for (const language of ['en', 'es'] as const) {
    for (const [namespace, entries] of Object.entries(result.translations[language] ?? {})) {
      for (const [key, text] of Object.entries(entries)) {
        if (text === COPY_DEFAULTS[namespace]?.[language]?.[key]) delete entries[key]
      }
      if (!Object.keys(entries).length) delete result.translations[language]![namespace]
    }
    if (!Object.keys(result.translations[language] ?? {}).length) delete result.translations[language]
  }
  return result
}

export function copyTokens(value: string): string[] {
  return (value.match(/\{\{[\s\S]*?\}\}|<\/?(?:\d+|[A-Za-z][\w-]*)(?:\s[^>]*?)?\s*\/?>/g) ?? []).sort()
}

export function isPublicHttps(value: string): boolean {
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || value.length > 2048 || /[\u0000-\u0020]/.test(value)) return false
    if (!host.includes('.') || host.endsWith('.local') || host.endsWith('.internal') || host.includes(':') || /^(localhost|127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return false
    return ![...url.searchParams.keys()].some(key => /^(?:access_token|api_?key|token|password|secret|authorization|signature)$/i.test(key))
  } catch { return false }
}

export interface EditorIssue { key: string; field: string }
export function validateWebsiteSettings(value: WebsiteSettings): EditorIssue[] {
  const issues: EditorIssue[] = []
  const requiredPair = (pair: { en: string; es: string }, field: string) => {
    if (!pair.en.trim() || !pair.es.trim() || pair.en.length > 160 || pair.es.length > 160) issues.push({ key: 'validation.bilingual', field })
  }
  for (const language of ['en', 'es'] as const) for (const [namespace, entries] of Object.entries(value.translations[language] ?? {})) {
    for (const [path, text] of Object.entries(entries)) {
      const base = COPY_DEFAULTS[namespace]?.[language]?.[path]
      if (text.length > 6000 || (base !== undefined && !same(copyTokens(text), copyTokens(base)))) issues.push({ key: 'validation.placeholders', field: `${namespace} / ${path} (${language.toUpperCase()})` })
    }
  }
  for (const item of value.navigation) {
    requiredPair(item.label, item.route)
    if (!WEBSITE_ROUTES.includes(item.route as typeof WEBSITE_ROUTES[number])) issues.push({ key: 'validation.route', field: item.route })
  }
  if (new Set(value.navigation.map(item => item.route)).size !== value.navigation.length) issues.push({ key: 'validation.duplicate', field: 'navigation' })
  if (value.gallery.ids.length > 5 || new Set(value.gallery.ids).size !== value.gallery.ids.length) issues.push({ key: 'validation.gallery', field: 'gallery' })
  const photoUrls = [...Object.entries(value.images), ...Object.entries(value.gallery.photos)]
  for (const [field, url] of photoUrls) if (url && !isPublicHttps(url)) issues.push({ key: 'validation.url', field })
  const areaLocations = new Set<string>()
  for (const area of value.searchAreas) {
    requiredPair(area.label, area.key)
    if (!area.locations.length) issues.push({ key: 'validation.area', field: area.label.en })
    for (const location of area.locations) {
      const normalized = normalizeLocation(location)
      if (areaLocations.has(normalized)) issues.push({ key: 'validation.duplicate_location', field: location })
      areaLocations.add(normalized)
    }
  }
  for (const item of [...value.resources, ...value.realtorTools]) {
    requiredPair(item.title, item.id); requiredPair(item.category, item.id)
    if (!isPublicHttps(item.url)) issues.push({ key: 'validation.url', field: item.title.en || item.id })
    if (item.description.en.length > 4000 || item.description.es.length > 4000) issues.push({ key: 'validation.description', field: item.id })
  }
  for (const item of value.teamMembers) {
    requiredPair(item.role, item.name || item.id)
    if (!item.name.trim() || item.name.length > 120 || !isPublicHttps(item.photo)) issues.push({ key: 'validation.team', field: item.name || item.id })
    if (item.description.en.length > 4000 || item.description.es.length > 4000) issues.push({ key: 'validation.description', field: item.id })
  }
  for (const [section, items, maximum] of [
    ['navigation', value.navigation, 10], ['searchAreas', value.searchAreas, 12], ['resources', value.resources, 100], ['realtorTools', value.realtorTools, 100], ['teamMembers', value.teamMembers, 100],
  ] as const) if (items.length > maximum) issues.push({ key: 'validation.too_many', field: section })
  if (new TextEncoder().encode(JSON.stringify(prepareWebsiteSettings(value))).length > 250_000) issues.push({ key: 'validation.size', field: '' })
  return issues
}

export function websiteChangeCount(a: WebsiteSettings, b: WebsiteSettings): number {
  const leaves = (value: unknown, prefix = ''): Record<string, unknown> => {
    if (!value || typeof value !== 'object') return { [prefix]: value }
    return Object.fromEntries(Object.entries(value).flatMap(([key, item]) => Object.entries(leaves(item, `${prefix}.${key}`))))
  }
  const left = leaves(prepareWebsiteSettings(a)); const right = leaves(prepareWebsiteSettings(b))
  return [...new Set([...Object.keys(left), ...Object.keys(right)])].filter(key => left[key] !== right[key]).length
}
