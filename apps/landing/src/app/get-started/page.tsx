import { Suspense } from 'react'
import type { Metadata } from 'next'
import GetStarted from '../../views/GetStarted'

export const metadata: Metadata = {
  title: 'Buy, Sell or Rent in the Dominican Republic | Get Started',
  description: 'Contact the iLoveDR Realty team about buying, selling or renting. Share a phone number or email and your property plans.',
  alternates: { canonical: '/get-started/' },
}

export default function Page() {
  return <Suspense><GetStarted /></Suspense>
}
