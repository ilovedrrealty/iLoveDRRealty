import client from './axios'
import type { WebsiteRevision, WebsiteSettings, WebsiteSettingsResponse } from '../../../../packages/website-settings/src'

export async function getWebsiteSettings(): Promise<WebsiteSettingsResponse> {
  return (await client.get<WebsiteSettingsResponse>('/admin/site-settings')).data
}

export async function publishWebsiteSettings(expectedVersion: number, settings: WebsiteSettings): Promise<WebsiteSettingsResponse> {
  return (await client.put<WebsiteSettingsResponse>('/admin/site-settings', { expected_version: expectedVersion, settings })).data
}

export async function getWebsiteHistory(): Promise<WebsiteRevision[]> {
  return (await client.get<{ items: WebsiteRevision[] }>('/admin/site-settings/history')).data.items
}

export async function restoreWebsiteRevision(version: number, expectedVersion: number): Promise<WebsiteSettingsResponse> {
  return (await client.post<WebsiteSettingsResponse>(`/admin/site-settings/restore/${version}`, { expected_version: expectedVersion })).data
}

export async function getWebsiteLocationOptions(): Promise<{ value: string; count: number }[]> {
  return (await client.get<{ locations: { value: string; count: number }[] }>('/listings/filter-options')).data.locations
}
