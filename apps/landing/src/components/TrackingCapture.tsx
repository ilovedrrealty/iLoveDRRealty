'use client'
import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { captureTrackingParams } from '../lib/tracking'

// Mounted once in the root layout so gclid/gbraid/wbraid/UTM params are
// captured on whichever page a visitor lands on.
export default function TrackingCapture() {
  const pathname = usePathname()
  const params = useSearchParams()
  useEffect(() => {
    captureTrackingParams()
  }, [pathname, params])
  return null
}
