import type { Metadata } from 'next'
import { Suspense } from 'react'
import Professionals from '../../views/Professionals'

export const metadata: Metadata = {
  title: 'DR Professionals — Property Services Directory',
  description: 'Join the DR Professionals network for Dominican Republic property services. Learn how to create a profile and sign in to search approved professionals.',
}

export default function Page() {
  return <Suspense><Professionals /></Suspense>
}
