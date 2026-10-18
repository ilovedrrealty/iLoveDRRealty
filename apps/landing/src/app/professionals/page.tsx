import type { Metadata } from 'next'
import { Suspense } from 'react'
import Professionals from '../../views/Professionals'

export const metadata: Metadata = {
  title: 'DR Professionals — Property Services Directory',
  description: 'Find professionals serving Dominican Republic property buyers and owners. Browse services, areas and business contact details.',
}

export default function Page() {
  return <Suspense><Professionals /></Suspense>
}
