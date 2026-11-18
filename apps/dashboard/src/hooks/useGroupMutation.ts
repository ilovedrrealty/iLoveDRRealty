import { useEffect, useRef, useState } from 'react'
import { isAxiosError } from 'axios'
import { getGroupSubmission, type GroupReceipt } from '../api/socialGroups'
import { networkError } from '../components/network/NetworkShared'

type Action = {
  id: string; perform: (id: string) => Promise<GroupReceipt>; applied: (receipt: GroupReceipt) => void
  retryAllowed: boolean
}
export function useGroupMutation(context: string, refresh?: () => void) {
  const [busy, setBusy] = useState(false), [pending, setPending] = useState(false), [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)
  const action = useRef<Action | null>(null), locked = useRef(false), generation = useRef(0)
  const currentContext = useRef(context); currentContext.current = context
  useEffect(() => {
    generation.current++
    locked.current = false; action.current = null
    setBusy(false); setPending(false); setError(''); setNotFound(false)
    return () => { generation.current++ }
  }, [context])
  function complete(request: Action, receipt: GroupReceipt) {
    if (receipt.submission_id !== request.id) throw new Error('Group action context changed')
    request.applied(receipt)
    action.current = null; setPending(false); setNotFound(false); setError(''); refresh?.()
  }
  async function execute(request: Action, checkFirst = false, allowResend = true) {
    if (locked.current) return
    locked.current = true; setBusy(true); setError('')
    const epoch = generation.current, actorContext = context
    const active = () => generation.current === epoch && currentContext.current === actorContext
    try {
      let receipt: GroupReceipt | null = null
      if (checkFirst) {
        try { receipt = await getGroupSubmission(request.id) }
        catch (cause) {
          if (!isAxiosError(cause) || cause.response?.status !== 404) throw cause
          if (!active()) return
          setNotFound(true); refresh?.()
          if (!request.retryAllowed || !allowResend) return
        }
      }
      if (!receipt) receipt = await request.perform(request.id)
      if (active()) complete(request, receipt)
    } catch (cause) {
      if (!active()) return
      setError(networkError(cause))
      const rejected = isAxiosError(cause) && !!cause.response && cause.response.status >= 400 && cause.response.status < 500
      if (!checkFirst && rejected) { action.current = null; setPending(false); refresh?.() }
      else { action.current = request; setPending(true) }
      if (checkFirst && isAxiosError(cause) && [401, 403, 404].includes(cause.response?.status ?? 0)) refresh?.()
    } finally {
      if (active()) { locked.current = false; setBusy(false) }
    }
  }
  function run(perform: Action['perform'], applied: Action['applied'], retryAllowed = true) {
    if (locked.current || action.current) return
    const request = { id: crypto.randomUUID(), perform, applied, retryAllowed }
    action.current = request
    void execute(request)
  }
  async function check() {
    if (!action.current || locked.current) return
    const request = action.current
    // Read status only. Uploads are never automatically re-sent.
    await execute(request, true, false)
  }
  function retry() {
    const request = action.current
    if (request?.retryAllowed && !locked.current) void execute(request, true)
  }
  function discard() {
    if (locked.current) return
    action.current = null; setPending(false); setNotFound(false); setError(''); refresh?.()
  }
  return { busy, pending, blocked: busy || pending, error, notFound, retryAllowed: action.current?.retryAllowed ?? false,
    run, check, retry, discard }
}
export type GroupMutation = ReturnType<typeof useGroupMutation>
