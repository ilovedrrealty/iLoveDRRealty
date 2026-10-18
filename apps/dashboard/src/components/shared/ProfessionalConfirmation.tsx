import { useEffect, useRef } from 'react'

export function ProfessionalConfirmation({ message, confirmLabel, cancelLabel, busy, onConfirm, onCancel }: { message: string; confirmLabel: string; cancelLabel: string; busy: boolean; onConfirm: () => void; onCancel: () => void }) {
  const cancel = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = cancel.current?.closest<HTMLElement>('[role="dialog"]')
    const frame = requestAnimationFrame(() => cancel.current?.focus())
    return () => {
      cancelAnimationFrame(frame)
      if (previous?.isConnected && dialog?.contains(previous) && !(previous instanceof HTMLButtonElement && previous.disabled)) previous.focus()
      else if (dialog?.isConnected) dialog.focus()
    }
  }, [])
  return <div className="space-y-5">
    <p className="text-sm leading-relaxed text-ink2">{message}</p>
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={busy} onClick={onConfirm} className="rounded-xl bg-coral px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-coral">{confirmLabel}</button>
      <button ref={cancel} type="button" disabled={busy} onClick={onCancel} className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-coral">{cancelLabel}</button>
    </div>
  </div>
}
