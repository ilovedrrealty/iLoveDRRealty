import type { Metadata } from 'next'
import PropertyDetail from '../../../views/PropertyDetail'
import { listingsForStaticExport } from '../../../lib/listingExport'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

interface RawListing {
  id: string
  title: string
  description: string | null
  type: string
  transaction: string
  price: number
  location: string
  images: string[]
  share_image_url: string | null
  bedrooms: number | null
  bathrooms: number | null
  area_sqft: number | null
  tag: string | null
  tags: string[]
  updated_at: string | null
}

async function getListing(id: string): Promise<RawListing | null> {
  try {
    const res = await fetch(`${API_URL}/listings/${id}`)
    if (!res.ok) return null
    return res.json() as Promise<RawListing>
  } catch {
    return null
  }
}

export async function generateStaticParams(): Promise<{ id: string }[]> {
  const listings = await listingsForStaticExport(process.env.NEXT_PUBLIC_API_URL)
  return listings.map(({ id }) => ({ id }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const listing = await getListing(id)
  if (!listing) return { title: 'Property Listing | I Love DR Realty' }

  const priceStr =
    listing.transaction === 'rent'
      ? `$${Number(listing.price).toLocaleString()}/mo`
      : `$${Number(listing.price).toLocaleString()}`

  const title = listing.bedrooms
    ? `${listing.bedrooms}BR ${listing.title} · ${priceStr}`
    : `${listing.title} · ${priceStr}`

  const highlightTag = listing.tags?.[0] ?? listing.tag ?? null
  const description = [
    listing.bedrooms ? `${listing.bedrooms} bed` : null,
    listing.bathrooms ? `${listing.bathrooms} bath` : null,
    listing.area_sqft ? `${listing.area_sqft.toLocaleString()} ft²` : null,
    highlightTag,
    listing.location,
  ]
    .filter(Boolean)
    .join(' · ')

  const rawImage =
    listing.share_image_url ?? listing.images?.[0] ?? 'https://ilovedrrealty.com/iLoveDRRealty_Dark.png'
  // Cache-bust the branded image so a re-generated version isn't stuck behind
  // a stale scrape cache at the same URL — the raw fallback photo doesn't change.
  const image =
    listing.share_image_url && listing.updated_at
      ? `${rawImage}?v=${new Date(listing.updated_at).getTime()}`
      : rawImage

  return {
    title,
    description,
    alternates: {
      canonical: `https://ilovedrrealty.com/listing/${id}/`,
    },
    openGraph: {
      title,
      description,
      images: [{ url: image, width: 1200, height: 630, alt: listing.title }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  }
}

export default async function ListingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const listing = await getListing(id)

  const jsonLd = listing
    ? {
        '@context': 'https://schema.org',
        '@type': listing.transaction === 'rent' ? 'Accommodation' : 'Product',
        name: listing.title,
        description: (listing.description ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
        image: listing.images ?? [],
        url: `https://ilovedrrealty.com/listing/${id}/`,
        offers: {
          '@type': 'Offer',
          price: listing.price,
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
        },
        address: {
          '@type': 'PostalAddress',
          addressLocality: listing.location,
          addressCountry: 'DO',
        },
      }
    : null

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd)
              .replace(/</g, '\\u003c')
              .replace(/>/g, '\\u003e')
              .replace(/&/g, '\\u0026'),
          }}
        />
      )}
      <PropertyDetail id={id} />
    </>
  )
}
