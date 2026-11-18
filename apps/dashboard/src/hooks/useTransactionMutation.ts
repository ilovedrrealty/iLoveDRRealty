import { useEffect, useRef, useState } from 'react'
import { transactionHttpStatus } from '../api/transactions'

export function useTransactionMutation(onDenied: () => void, refresh: () => void) {
  const request = useRef<AbortController | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => () => request.current?.abort(), [])

  async function run<T>(operation: (signal: AbortSignal) => Promise<T>, onSaved: (value: T) => void) {
    if (request.current) return
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    setError(null)
    try {
      const result = await operation(controller.signal)
      if (!controller.signal.aborted) onSaved(result)
    } catch (failure) {
      if (controller.signal.aborted) return
      switch (transactionHttpStatus(failure)) {
        case 401:
        case 403:
          onDenied()
          break
        case 404:
          setError('error_access')
          onDenied()
          break
        case 409:
          setError('error_conflict')
          refresh()
          break
        case 400:
        case 422:
          setError('error_fields')
          break
        default:
          setError('error_retry')
      }
    } finally {
      if (request.current === controller) request.current = null
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  return { busy, error, clearError: () => setError(null), run }
}
