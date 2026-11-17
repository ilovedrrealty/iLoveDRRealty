import type { Metadata } from 'next'
import { Suspense } from 'react'
import Editorial from '../../views/Editorial'

export const metadata: Metadata = {
  title: 'Articles and local guides',
  description: 'Articles, neighborhood profiles, and guides for buyers and residents in the Dominican Republic.',
  alternates: { canonical: '/local-guides/' },
}

export default function LocalGuides() {
  return <Suspense fallback={null}><Editorial /></Suspense>
}
