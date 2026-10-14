'use client'
import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import LeadCaptureModal from './LeadCaptureModal'

const STORAGE_KEY = 'lead_modal_dismissed'
const AUTO_DELAY_MS = 8000
const EXCLUDED_PATHS = new Set(['/login', '/signup', '/forgot-password', '/reset-password'])

/**
 * next.config sets `trailingSlash: true`, so usePathname() yields "/login/" —
 * strip it before matching, or the auth pages never hit EXCLUDED_PATHS and the
 * modal opens on top of the login form.
 */
const normalizePath = (p: string) => (p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p)

export default function LeadCaptureProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [initialTab, setInitialTab] = useState<'buyer' | 'seller' | 'renter'>('buyer')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pathname = usePathname()
  useEffect(() => {
    const show = (event: Event) => {
      const intent = (event as CustomEvent<{ intent?: string }>).detail?.intent
      if (intent !== 'buyer' && intent !== 'seller' && intent !== 'renter') return
      if (timerRef.current) clearTimeout(timerRef.current)
      setInitialTab(intent)
      setOpen(true)
    }
    window.addEventListener('ildr:open-lead-capture', show)
    return () => window.removeEventListener('ildr:open-lead-capture', show)
  }, [])

  useEffect(() => {
    if (EXCLUDED_PATHS.has(normalizePath(pathname))) { setOpen(false); return }
    if (sessionStorage.getItem(STORAGE_KEY)) return
    timerRef.current = setTimeout(() => setOpen(true), AUTO_DELAY_MS)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [pathname])

  function handleClose() {
    sessionStorage.setItem(STORAGE_KEY, '1')
    setOpen(false)
  }

  return (
    <>
      {children}
      <LeadCaptureModal open={open} onClose={handleClose} initialTab={initialTab} />

    </>
  )
}
