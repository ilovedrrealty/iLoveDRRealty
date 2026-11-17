import type { Metadata } from 'next'
import { Suspense } from 'react'
import NeighborhoodComparison from '../../../views/NeighborhoodComparison'

export const metadata: Metadata = {
  title: 'Compare neighborhoods',
  description: 'Compare dated, sourced information about neighborhoods in the Dominican Republic.',
  alternates: { canonical: '/local-guides/compare/' },
}

export default function CompareNeighborhoods() {
  return <Suspense fallback={null}><NeighborhoodComparison /></Suspense>
}
