import type { MetadataRoute } from 'next'
import { ARTICLES, FEATURED, EDITOR_PICKS, GUIDES } from '../data/blogData'
import { ARTICLES_ES } from '../data/blogData.es'
import { listingsForStaticExport } from '../lib/listingExport'

export const dynamic = 'force-static'

const BASE = 'https://ilovedrrealty.com'
const API_URL = process.env.NEXT_PUBLIC_API_URL

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE}/rentals/`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/`, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE}/search/`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/buying/`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/selling/`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/calculator/`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/team/`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/contact/`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/get-started/`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/blog/`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE}/professionals/`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE}/privacy-policy/`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/terms-of-service/`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    {
      url: `${BASE}/es/bienes-raices-republica-dominicana/`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
      alternates: {
        languages: {
          en: `${BASE}/buying/`,
          es: `${BASE}/es/bienes-raices-republica-dominicana/`,
        },
      },
    },
  ]

  // Only published (navigable) articles — featured + editor picks + visible guides.
  // Staged posts in HIDDEN_GUIDES are intentionally excluded until they go live.
  const publishedSlugs = Array.from(
    new Set([FEATURED.slug, ...EDITOR_PICKS.map(p => p.slug), ...GUIDES.map(g => g.slug)]),
  ).filter(slug => ARTICLES[slug])

  const articlePages: MetadataRoute.Sitemap = publishedSlugs.map(slug => {
    const parsed = ARTICLES[slug].date ? new Date(ARTICLES[slug].date) : null
    const lastModified = parsed && !isNaN(parsed.getTime()) ? parsed : new Date()
    const hasEs = !!ARTICLES_ES[slug]
    return {
      url: `${BASE}/article/${slug}/`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
      ...(hasEs
        ? { alternates: { languages: { en: `${BASE}/article/${slug}/`, es: `${BASE}/es/article/${slug}/` } } }
        : {}),
    }
  })

  // Spanish article URLs — only for published posts that actually have a translation.
  const esArticlePages: MetadataRoute.Sitemap = publishedSlugs
    .filter(slug => ARTICLES_ES[slug])
    .map(slug => {
      const parsed = ARTICLES[slug].date ? new Date(ARTICLES[slug].date) : null
      return {
        url: `${BASE}/es/article/${slug}/`,
        lastModified: parsed && !isNaN(parsed.getTime()) ? parsed : new Date(),
        changeFrequency: 'monthly' as const,
        priority: 0.6,
        alternates: { languages: { en: `${BASE}/article/${slug}/`, es: `${BASE}/es/article/${slug}/` } },
      }
    })

  const listingPages: MetadataRoute.Sitemap = (await listingsForStaticExport(API_URL)).map(l => ({
    url: `${BASE}/listing/${l.id}/`,
    lastModified: l.created_at ? new Date(l.created_at) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  return [...staticPages, ...articlePages, ...esArticlePages, ...listingPages]
}
