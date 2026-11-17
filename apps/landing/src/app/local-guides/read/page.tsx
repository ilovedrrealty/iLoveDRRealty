import type { Metadata } from 'next'
import { Suspense } from 'react'
import Editorial from '../../../views/Editorial'

export const metadata: Metadata = {
  title: 'Read a local guide',
  robots: { index: false, follow: true },
}

export default function ReadLocalGuide() {
  return <Suspense fallback={null}><Editorial reader /></Suspense>
}
