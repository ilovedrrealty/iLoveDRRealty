import { useEffect, useRef, useState } from 'react'
import { isAxiosError } from 'axios'
import { InboxContractError } from '../api/inbox'
import { createNetworkReadLoop, type NetworkReadLoop, type NetworkReadState } from '../lib/networkFreshness'

export const inboxStatus = (error: unknown) => isAxiosError(error) ? error.response?.status ?? 0 : 0
export const inboxAccessLost = (error: unknown) => [401, 403, 404].includes(inboxStatus(error)) || error instanceof InboxContractError
export type InboxRead<T> = NetworkReadState & { data: T | null; error: unknown; refresh: () => void }
type Snapshot<T> = Omit<InboxRead<T>, 'refresh'> & { key: string }
const empty = <T,>(key: string): Snapshot<T> => ({ key, data: null, error: null, checking: false, checkedAt: null, stale: true })

/** Same bounded read loop as project history; expired reviews additionally clear private results. */
export function useInboxRead<T>(key: string, load: (signal: AbortSignal) => Promise<T>, enabled = true): InboxRead<T> {
  const [reload, setReload] = useState(0), currentKey = JSON.stringify([key, reload])
  const [snapshot, setSnapshot] = useState<Snapshot<T>>(() => empty(currentKey)), active = useRef<NetworkReadLoop | null>(null)
  useEffect(() => {
    setSnapshot(empty(currentKey))
    if (!enabled) return
    const update = (change: Partial<Snapshot<T>>) => setSnapshot(old => old.key === currentKey ? { ...old, ...change } : old)
    const loop = createNetworkReadLoop({ load, visible: () => document.visibilityState !== 'hidden', online: () => navigator.onLine !== false,
      now: Date.now, setTimer: (fn, delay) => window.setTimeout(fn, delay), clearTimer: timer => window.clearTimeout(timer as number),
      onData: data => update({ data, error: null }), onState: update,
      onError: error => { const clear = inboxAccessLost(error) || inboxStatus(error) === 410; update({ error, ...(clear ? { data: null } : {}) }); return clear },
    })
    active.current = loop
    const visibility = () => document.visibilityState === 'hidden' ? loop.pause() : loop.refresh()
    const wake = () => loop.refresh(), pause = () => loop.pause()
    document.addEventListener('visibilitychange', visibility); window.addEventListener('online', wake)
    window.addEventListener('offline', pause); window.addEventListener('focus', wake); window.addEventListener('ildr:inbox-changed', wake)
    return () => {
      loop.dispose(); if (active.current === loop) active.current = null
      document.removeEventListener('visibilitychange', visibility); window.removeEventListener('online', wake)
      window.removeEventListener('offline', pause); window.removeEventListener('focus', wake); window.removeEventListener('ildr:inbox-changed', wake)
    }
    // The key contains actor, source, cursor, review and explicit reload context.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentKey, enabled])
  return { ...(snapshot.key === currentKey && enabled ? snapshot : empty<T>(currentKey)), refresh: () => setReload(value => value + 1) }
}
