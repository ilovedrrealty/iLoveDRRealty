/** Invitation secrets stay in this document's memory, never browser storage. */
export type GroupInviteMemory = { token: string | null; generation: number; invalid: boolean }
let snapshot: GroupInviteMemory = { token: null, generation: 0, invalid: false }
const listeners = new Set<() => void>()
export function isGroupInvitePath(path: string) {
  try { return /^\/group-invite\/*$/i.test(decodeURI(path)) }
  catch { return false }
}
export function validGroupInviteToken(value: string): boolean {
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) return false
  try {
    const bytes = atob(value.replace(/-/g, '+').replace(/_/g, '/') + '=')
    return bytes.length === 32 && btoa(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') === value
  } catch { return false }
}
export function createGroupInviteToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
export function groupInviteSnapshot() { return snapshot }
export function subscribeGroupInvite(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export function clearGroupInvite() {
  snapshot = { token: null, generation: snapshot.generation + 1, invalid: false }
  listeners.forEach(listener => listener())
}
function consumeFragment() {
  if (!isGroupInvitePath(location.pathname) || !location.hash && !location.search) return false
  const fragment = location.hash.slice(1)
  // Scrub synchronously before notifying React or another URL observer.
  history.replaceState(history.state, '', location.pathname)
  const parameters = new URLSearchParams(fragment)
  const token = parameters.get('token') ?? ''
  const valid = [...parameters.keys()].length === 1 && parameters.getAll('token').length === 1 && validGroupInviteToken(token)
  snapshot = { token: valid ? token : null, generation: snapshot.generation + 1, invalid: !valid }
  listeners.forEach(listener => listener())
  return true
}
if (typeof window !== 'undefined') {
  if (isGroupInvitePath(location.pathname)) {
    consumeFragment()
    for (const [name, content] of [['robots', 'noindex,nofollow'], ['referrer', 'no-referrer']]) {
      const meta = document.createElement('meta'); meta.name = name; meta.content = content; document.head.append(meta)
    }
  }
  window.addEventListener('hashchange', event => {
    if (consumeFragment()) event.stopImmediatePropagation()
  })
}
