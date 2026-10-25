import client from './axios'

export type ResearchLink = { title: string; url: string }
export type ResearchData = {
  title: string; reference: string; notes: string
  checks: Record<string, boolean>; item_notes: Record<string, string>; links: ResearchLink[]
}
export type ResearchSummary = { id: string; title: string; version: number; updated_at: string }
export type ResearchWorkspace = ResearchSummary & { data: ResearchData }
export const emptyResearchData = (): ResearchData => ({ title: '', reference: '', notes: '', checks: {}, item_notes: {}, links: [] })
export function safeResearchUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password && !/[\u0000-\u0020]/.test(value)
  } catch { return false }
}
export async function listResearchWorkspaces(signal?: AbortSignal) {
  return (await client.get<ResearchSummary[]>('/research-workspaces', { signal })).data
}
export async function getResearchWorkspace(id: string, signal?: AbortSignal) {
  return (await client.get<ResearchWorkspace>(`/research-workspaces/${encodeURIComponent(id)}`, { signal })).data
}
export async function saveResearchWorkspace(data: ResearchData, current: ResearchSummary | null) {
  return current
    ? (await client.put<ResearchWorkspace>(`/research-workspaces/${encodeURIComponent(current.id)}`, { ...data, expected_version: current.version })).data
    : (await client.post<ResearchWorkspace>('/research-workspaces', data)).data
}
