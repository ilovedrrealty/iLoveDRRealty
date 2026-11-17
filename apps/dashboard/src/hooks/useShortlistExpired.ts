import { useEffect, useState } from 'react'
import { shortlistExpiryAt } from '../api/shortlists'

/** Expired data stays hidden when a throttled tab becomes visible again. */
export function useShortlistExpired(value?: string) {
  const [, setTick] = useState(0)
  const expiry = value === undefined ? Infinity : shortlistExpiryAt(value)
  useEffect(() => {
    if (!Number.isFinite(expiry)) return
    let timer: number
    function update() {
      window.clearTimeout(timer)
      const delay = expiry - Date.now()
      if (delay > 0) timer = window.setTimeout(update, Math.min(delay, 2_147_483_647))
      setTick(tick => tick + 1)
    }
    update()
    document.addEventListener('visibilitychange', update)
    window.addEventListener('pageshow', update)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', update)
      window.removeEventListener('pageshow', update)
    }
  }, [expiry])
  return !(Date.now() < expiry)
}
