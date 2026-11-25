const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i
const MEMBER_CODE = /^[1-9]\d{0,8}$/

export type PrivateShareTarget = 'member' | 'professional' | 'contact'

/** Fixed routes contain only identifiers. A shared link never changes access. */
export function profileSharePath(kind: PrivateShareTarget, identifier: string | number): string | null {
  const id = String(identifier)
  if (kind === 'member') return MEMBER_CODE.test(id) ? `/property-network?tab=people&member=${id}` : null
  if (!UUID.test(id)) return null
  return kind === 'professional' ? `/professional-directory?profile=${id.toLowerCase()}`
    : kind === 'contact' ? `/trade-contacts?workspace=admin&contact=${id.toLowerCase()}` : null
}

export function teamSharePath(id: string): string | null {
  return /^[a-z0-9][a-z0-9_-]{0,99}$/i.test(id) ? `/team#member-${id}` : null
}

/** Use the configured canonical origin, never the current browser/preview host. */
export function canonicalShareUrl(configured: string | undefined, path: string | null, fallback: string): string | null {
  if (!path) return null
  const member = /^\/property-network\?tab=people&member=([1-9]\d{0,8})$/.exec(path)
  const professional = /^\/professional-directory\?profile=([0-9a-f-]{36})$/.exec(path)
  const contact = /^\/trade-contacts\?workspace=admin&contact=([0-9a-f-]{36})$/.exec(path)
  const team = /^\/team#member-([a-z0-9][a-z0-9_-]{0,99})$/i.exec(path)
  if (!(member && profileSharePath('member', member[1]) === path)
    && !(professional && profileSharePath('professional', professional[1]) === path)
    && !(contact && profileSharePath('contact', contact[1]) === path)
    && !(team && teamSharePath(team[1]) === path)) return null
  let origin = fallback
  try {
    const candidate = new URL(configured || fallback)
    if (candidate.protocol === 'https:' && !candidate.username && !candidate.password
      && !candidate.search && !candidate.hash && candidate.pathname === '/') origin = candidate.origin
  } catch { /* A missing/invalid setting uses the canonical production origin. */ }
  return new URL(path, origin).toString()
}

/** Generic link text contains no profile/contact fields or private record data. */
export function linkSharePayload(url: string, title: string): { title: string; text: string } | null {
  if (!title.trim() || title.length > 160 || /[\u0000-\u001f\u007f]/.test(title) || url.length > 500) return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || /[\r\n\u0000-\u001f\u007f]/.test(url)) return null
    return { title, text: `${title}\n${parsed.href}` }
  } catch { return null }
}

export function linkComposeLinks(url: string, title: string): { email: string; whatsapp: string; preview: string } | null {
  const payload = linkSharePayload(url, title)
  return payload ? { email: `mailto:?subject=${encodeURIComponent(payload.title)}&body=${encodeURIComponent(payload.text)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(payload.text)}`, preview: payload.text } : null
}
