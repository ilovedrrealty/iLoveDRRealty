import client from './axios'
import { equalPurchaseCosts, isPurchaseCosts, type PurchaseCost } from '../data/purchaseCosts'

export type ResearchLink = { title: string; url: string }
export type ResearchData = {
  title: string; reference: string; notes: string
  checks: Record<string, boolean>; item_notes: Record<string, string>; links: ResearchLink[]
  purchase_costs?: PurchaseCost[]
}
export type ResearchSummary = { id: string; title: string; version: number; updated_at: string }
export type ResearchWorkspace = ResearchSummary & { data: ResearchData }
export class PurchaseCostsUnconfirmed extends Error {
  constructor(public readonly workspace: ResearchWorkspace) {
    super('Purchase cost save could not be verified')
    this.name = 'PurchaseCostsUnconfirmed'
  }
}
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
  const workspace = (await client.get<ResearchWorkspace>(`/research-workspaces/${encodeURIComponent(id)}`, { signal })).data
  return checkedWorkspace(workspace)
}
export async function saveResearchWorkspace(data: ResearchData, current: ResearchSummary | null) {
  const workspace = current
    ? (await client.put<ResearchWorkspace>(`/research-workspaces/${encodeURIComponent(current.id)}`, { ...data, expected_version: current.version })).data
    : (await client.post<ResearchWorkspace>('/research-workspaces', data)).data
  const saved = checkedWorkspace(workspace)
  if (data.purchase_costs !== undefined && !equalPurchaseCosts(data.purchase_costs, saved.data.purchase_costs)) {
    throw new PurchaseCostsUnconfirmed(saved)
  }
  return saved
}

function checkedWorkspace(workspace: ResearchWorkspace): ResearchWorkspace {
  const costs = workspace.data.purchase_costs
  if (costs !== undefined && !isPurchaseCosts(costs)) throw new Error('Invalid saved purchase costs')
  return workspace
}
