import client from './axios'
import { isId, projectFollowUpLead, propertyDraftUrl, type FollowUpLead } from '../lib/leadFollowUp'

export class FollowUpAccessLost extends Error {}
async function read(path: string, signal: AbortSignal, anonymous = false): Promise<unknown> {
  const response = await fetch(client.getUri({ url: path }), { signal, credentials: anonymous ? 'omit' : 'include', cache: 'no-store', redirect: 'error', headers: { Accept: 'application/json' } })
  if (!response.ok) {
    if (!anonymous && [401, 403, 404].includes(response.status)) throw new FollowUpAccessLost()
    throw new Error('Follow-up details unavailable')
  }
  return response.json()
}

/** Existing server authorization decides the scope; cached parent props never authorize an action. */
export async function getFollowUpLead(id: string, signal: AbortSignal): Promise<FollowUpLead> {
  if (!isId(id)) throw new FollowUpAccessLost()
  const raw = await read('/auth/me', signal)
  if (!raw || typeof raw !== 'object') throw new FollowUpAccessLost()
  const me = raw as Record<string, unknown>
  if (!isId(me.id) || !(me.role === 'admin' || me.role === 'realtor')) throw new FollowUpAccessLost()
  const actor: { id: string; role: 'admin' | 'realtor' } = { id: me.id.toLowerCase(), role: me.role }
  const result = await read(actor.role === 'admin' ? '/admin/leads' : '/realtor/leads', signal)
  if (!Array.isArray(result)) throw new Error('Follow-up details unavailable')
  const matches = result.filter(row => row && typeof row === 'object' && typeof row.id === 'string' && row.id.toLowerCase() === id.toLowerCase())
  if (matches.length !== 1) throw new FollowUpAccessLost()
  const projected = projectFollowUpLead(matches[0], actor)
  if (!projected) throw new FollowUpAccessLost()
  return projected
}

/** An Admin cookie must never turn a private/inactive listing into a public link. */
export async function getPublicFollowUpLink(id: string, signal: AbortSignal): Promise<string | null> {
  const url = propertyDraftUrl(id)
  if (!url) return null
  try {
    const response = await fetch(client.getUri({ url: '/listings/' + id.toLowerCase() }), { signal, credentials: 'omit', cache: 'no-store', redirect: 'error', headers: { Accept: 'application/json' } })
    if (!response.ok || !(response.headers.get('cache-control') ?? '').split(',').some(part => part.trim().toLowerCase() === 'no-store')) return null
    const row: unknown = await response.json()
    return row && typeof row === 'object' && isId((row as Record<string, unknown>).id)
      && ((row as Record<string, unknown>).id as string).toLowerCase() === id.toLowerCase()
      && (row as Record<string, unknown>).status === 'active' ? url : null
  } catch (error) { if (signal.aborted) throw error; return null }
}
