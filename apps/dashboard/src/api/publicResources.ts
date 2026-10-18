import type { WebsiteResource, WebsiteSettings } from '../../../../packages/website-settings/src'
import { publicWebsiteResources } from '../../../../packages/website-settings/src/drResources'

const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/+$/, '')

/** Public settings only: no account cookie, token or privileged tool endpoint. */
export async function getPublicResources(signal?: AbortSignal): Promise<WebsiteResource[]> {
  const response = await fetch(`${API_URL}/site/settings`, {
    signal, credentials: 'omit', cache: 'no-store', headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw new Error('Public resource library could not load')
  const body: unknown = await response.json()
  if (!body || typeof body !== 'object' || !('settings' in body) || !body.settings
    || typeof body.settings !== 'object' || Array.isArray(body.settings)) {
    throw new Error('Public resource library response is invalid')
  }
  return publicWebsiteResources(body.settings as Partial<WebsiteSettings>)
}
