import client from './axios'
import type { RealtorTool } from '../../../../packages/website-settings/src'

export async function getResearchTools(signal?: AbortSignal): Promise<RealtorTool[]> {
  const response = await client.get<RealtorTool[]>('/site/realtor-tools', { signal })
  if (!Array.isArray(response.data)) throw new Error('Invalid tools response')
  return response.data
}
