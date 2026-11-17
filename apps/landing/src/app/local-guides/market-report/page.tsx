import type { Metadata } from 'next'
import { Suspense } from 'react'
import LocalMarketReport from '../../../views/LocalMarketReport'

export const metadata: Metadata = {
  title: 'Local market report',
  description: 'Current asking prices and sample counts for properties listed for sale with I Love DR Realty.',
  alternates: { canonical: '/local-guides/market-report/' },
}

export default function MarketReportPage() {
  return <Suspense fallback={null}><LocalMarketReport /></Suspense>
}
