export type ShareLocale = 'en' | 'es'
export type ShareFormat = 'post' | 'story'
export type ShareAudience = 'public' | 'member' | 'research'
export type ManualContent = { title: string; facts: string[]; url: string; audience: ShareAudience; photos?: string[] }
export type ManualTarget = { kind: 'listing'; id: string } | { kind: 'resource'; id: string } | { kind: 'calculator' | 'library' | 'area' | 'research' }
  | { kind: 'hub'; workspace: 'Buyer' | 'Owner' | 'Realtor' }

const SITE = 'https://ilovedrrealty.com', APP = 'https://app.ilovedrrealty.com'
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i
const RESOURCE = /^[a-z0-9][a-z0-9_-]{0,99}$/i
const CONTROLS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/

/** Fixed canonical entry links never carry a browser URL, financial inputs or grants. */
export function manualTargetUrl(target: ManualTarget): string | null {
  if (target.kind === 'listing') return UUID.test(target.id) ? `${SITE}/listing/${target.id.toLowerCase()}/` : null
  if (target.kind === 'resource') return RESOURCE.test(target.id) ? `${SITE}/blog/#resource-${target.id}` : null
  if (target.kind === 'calculator') return SITE + '/calculator/'
  if (target.kind === 'library') return SITE + '/blog/#website-resources-heading'
  if (target.kind === 'area') return APP + '/buyer-tools#area-converter-heading'
  if (target.kind === 'research') return APP + '/research'
  return target.kind === 'hub' && ['Buyer', 'Owner', 'Realtor'].includes(target.workspace)
    ? APP + '/' + target.workspace.toLowerCase() + '-tools' : null
}

export function approvedManualUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    if (url.search || url.username || url.password || url.protocol !== 'https:' || url.href !== value) return false
    if (url.origin === SITE) return /^\/listing\/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\/$/.test(url.pathname) && !url.hash
      || url.pathname === '/calculator/' && !url.hash
      || url.pathname === '/blog/' && (url.hash === '#website-resources-heading' || /^#resource-[a-z0-9][a-z0-9_-]{0,99}$/i.test(url.hash))
    return url.origin === APP && (url.pathname === '/research' && !url.hash
      || /^\/(buyer|owner|realtor)-tools$/.test(url.pathname) && (!url.hash || url.pathname === '/buyer-tools' && url.hash === '#area-converter-heading'))
  } catch { return false }
}

/** Public listing photos only: no credentials, signed/private URLs or local-network addresses. */
export function publicSharePhoto(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048 || /[\u0000-\u0020\u007f]/.test(value)) return false
  try {
    const url = new URL(value), host = url.hostname.toLowerCase().replace(/\.+$/, '')
    return url.protocol === 'https:' && !url.username && !url.password && !url.hash && !url.port
      && host.includes('.') && !/^\d+(?:\.\d+){3}$/.test(host) && !host.includes(':')
      && !/(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(host)
      && ![...url.searchParams.keys()].some(key => /token|secret|password|signature|authorization|session|credential|expires|(?:^|_)(?:key|sig|auth)$/i.test(key))
      && !/\/storage\/v1\/object\/(?:sign|authenticated)\//i.test(url.pathname)
  } catch { return false }
}

export function safeShareTitle(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || value.length > 240 || CONTROLS.test(value)
    || /[@<>]|https?:|www\.|\+?\d(?:[ ().-]*\d){7}/i.test(value)) return fallback
  return value.normalize('NFC').replace(/\s+/g, ' ').trim() || fallback
}

export function validateManualContent(value: ManualContent): ManualContent | null {
  if (!approvedManualUrl(value.url) || !['public', 'member', 'research'].includes(value.audience)
    || typeof value.title !== 'string' || !value.title.trim() || [...value.title].length > 180 || /[\u0000-\u001f\u007f-\u009f]/.test(value.title)
    || !Array.isArray(value.facts) || value.facts.length > 5
    || value.facts.some(item => typeof item !== 'string' || [...item].length > 180 || /[\u0000-\u001f\u007f-\u009f]/.test(item))
    || value.photos !== undefined && !Array.isArray(value.photos)) return null
  return { title: value.title, facts: [...value.facts], url: value.url, audience: value.audience,
    ...(value.photos ? { photos: [...new Set(value.photos.filter(publicSharePhoto))].slice(0, 30) } : {}) }
}

export function manualShareText(content: ManualContent, audienceNote: string): string | null {
  const safe = validateManualContent(content)
  return safe && typeof audienceNote === 'string' && audienceNote.length <= 400 && !CONTROLS.test(audienceNote)
    ? [safe.title, ...safe.facts, audienceNote, safe.url].filter(Boolean).join('\n') : null
}

/** Composers are opened only by the user's click; this does not deliver a message/post. */
export function manualComposeLinks(content: ManualContent, audienceNote: string) {
  const text = manualShareText(content, audienceNote)
  if (!text) return null
  return { preview: text, email: `mailto:?subject=${encodeURIComponent(content.title)}&body=${encodeURIComponent(text)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(text)}`, sms: `sms:?body=${encodeURIComponent(text)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(content.url)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(content.url)}`,
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}` }
}

export function shareAssetSize(format: ShareFormat) { return format === 'story' ? { width: 1080, height: 1920 } : { width: 1080, height: 1080 } }

export function containPhoto(source: { width: number; height: number }, target: { x: number; y: number; width: number; height: number }) {
  if (![source.width, source.height, target.width, target.height].every(value => Number.isFinite(value) && value > 0)) throw new Error('Invalid image dimensions')
  const scale = Math.min(target.width / source.width, target.height / source.height)
  return { x: target.x + (target.width - source.width * scale) / 2, y: target.y + (target.height - source.height * scale) / 2,
    width: source.width * scale, height: source.height * scale }
}
