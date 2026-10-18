import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'

export function ProfessionalDialog({ title, closeLabel, onClose, children }: { title: string; closeLabel: string; onClose: () => void; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); return }
      if (event.key !== 'Tab') return
      const controls = [...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]') ?? [])].filter(element => element.getClientRects().length > 0)
      const first = controls[0], last = controls[controls.length - 1]
      if (!first) { event.preventDefault(); panel.current?.focus() }
      else if (!panel.current?.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first).focus() }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', keydown)
    return () => { document.removeEventListener('keydown', keydown); document.body.style.overflow = overflow; previous?.focus() }
  }, [])
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget) close.current() }}>
    <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="max-h-[94dvh] min-w-0 w-full max-w-5xl overflow-y-auto rounded-2xl bg-paper2 p-4 sm:p-6 outline-none">
      <div className="flex items-start justify-between gap-4 mb-5"><h2 className="text-xl font-bold text-ink">{title}</h2><button type="button" className="shrink-0 rounded-lg border border-line bg-white p-2" aria-label={closeLabel} onClick={onClose}><X size={20} /></button></div>
      {children}
    </div>
  </div>
}
