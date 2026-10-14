import type { Metadata } from 'next'
import Rentals from '../../views/Rentals'

export const metadata: Metadata = {
  title: 'Properties for Rent in the Dominican Republic',
  description: 'Explore Dominican Republic rentals and filter by location, property type, price, and bedrooms.',
}

export default function Page() {
  return <Rentals />
}
