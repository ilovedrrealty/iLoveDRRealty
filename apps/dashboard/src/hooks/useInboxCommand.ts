import { useRef, useState } from 'react'
import { executeInboxCommand, prepareInboxCommand, resolveInboxCommand, type Command, type PreparedCommand, type Receipt } from '../api/inbox'
import { useServiceAttempt } from '../components/network/ServiceWorkflowShared'

/** Reuse the reviewed single-attempt state machine; a receipt completes only after a fresh authorized read. */
export function useInboxCommand<T>(tools: {
  load: (receipt: Receipt, command: PreparedCommand, signal: AbortSignal) => Promise<T>
  authorize: (command: PreparedCommand, signal: AbortSignal) => Promise<T>
  canRetry: (command: PreparedCommand, current: T) => boolean
  applied: (current: T, receipt: Receipt) => void
  reviewed?: (current: T) => void
}, blocked = false) {
  const config = useRef(tools), pending = useRef<PreparedCommand | null>(null), [invalid, setInvalid] = useState(false)
  config.current = tools
  const mutation = useServiceAttempt<PreparedCommand, { receipt: Receipt; current: T }, T>({
    prepare: command => { if (!Object.isFrozen(command) || !Object.isFrozen(command.body)) throw new Error('Unprepared inbox command') },
    execute: async (command, signal) => { const receipt = await executeInboxCommand(command, signal); return { receipt, current: await config.current.load(receipt, command, signal) } },
    resolve: async (command, signal) => { const receipt = await resolveInboxCommand(command, signal); return { receipt, current: await config.current.load(receipt, command, signal) } },
    canRetry: (command, current) => config.current.canRetry(command, current),
  }, signal => { if (!pending.current) throw new Error('No inbox attempt'); return config.current.authorize(pending.current, signal) },
  result => { pending.current = null; config.current.applied(result.current, result.receipt); window.dispatchEvent(new Event('ildr:inbox-changed')) },
  current => { pending.current = null; config.current.reviewed?.(current) }, blocked)
  return { ...mutation, invalid, send: (command: Command) => {
    if (pending.current || mutation.pending || mutation.busy || mutation.denied || blocked) return
    let prepared: PreparedCommand
    try { prepared = prepareInboxCommand(command) } catch { setInvalid(true); return }
    setInvalid(false); pending.current = prepared; mutation.send(prepared)
  } }
}
