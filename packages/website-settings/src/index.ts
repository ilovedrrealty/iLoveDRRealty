export type LocalizedText = { en: string; es: string }
export type WebsiteNavigation = { route: string; label: LocalizedText; enabled: boolean }
export type WebsiteArea = { key: string; label: LocalizedText; locations: string[] }
export type WebsiteResource = {
  id: string
  title: LocalizedText
  description: LocalizedText
  category: LocalizedText
  url: string
  enabled: boolean
}
export type RealtorTool = WebsiteResource & { access: 'public' | 'realtor'; mode: 'link' }
export type TeamMember = {
  id: string
  name: string
  role: LocalizedText
  description: LocalizedText
  photo: string
  section: 'leadership' | 'realtor'
  enabled: boolean
}
export interface WebsiteSettings {
  translations: Partial<Record<'en' | 'es', Record<string, Record<string, string>>>>
  navigation: WebsiteNavigation[]
  gallery: { mode: 'auto' | 'featured'; ids: string[]; photos: Record<string, string> }
  images: Record<string, string>
  searchAreas: WebsiteArea[]
  resources: WebsiteResource[]
  realtorTools: RealtorTool[]
  teamMembers: TeamMember[]
}
export interface WebsiteSettingsResponse {
  version: number
  settings: WebsiteSettings
  updated_at?: string | null
}
export interface WebsiteRevision {
  version: number
  created_at: string
  updated_by_name: string | null
}
export const emptyWebsiteSettings = (): WebsiteSettings => ({
  translations: {}, navigation: [], gallery: { mode: 'auto', ids: [], photos: {} },
  images: {}, searchAreas: [], resources: [], realtorTools: [], teamMembers: [],
})
export const WEBSITE_IMAGE_KEYS = [
  'home_hero', 'founders', 'founders_secondary', 'buying_hero', 'selling_hero',
  'rentals_hero', 'contact_hero', 'resources_hero', 'buying_story', 'selling_story',
  'contact_story', 'category_new', 'category_rent', 'category_villa', 'category_apartment',
  'category_condo', 'category_land', 'category_commercial', 'category_punta_cana', 'category_sosua',
] as const
export const WEBSITE_COPY_NAMESPACES = [
  'common', 'landing', 'home_showcase', 'buying', 'selling', 'rentals', 'team',
  'contact', 'get_started', 'lead_capture', 'footer', 'blog', 'search',
] as const
export const WEBSITE_ROUTES = [
  'landing', 'buying', 'selling', 'team', 'contact', 'get-started', 'blog', 'rentals', 'search', 'calculator',
] as const
export const localizedValue = (value: LocalizedText, language: string) =>
  language.startsWith('es') ? value.es || value.en : value.en || value.es
