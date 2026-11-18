import type { Metadata } from 'next'
import ArticleDetail from '../../../views/ArticleDetail'
import EsLangSync from '../../../components/EsLangSync'
import { ARTICLES } from '../../../data/blogData'
import { ARTICLES_ES } from '../../../data/blogData.es'

export function generateStaticParams() {
  return Object.keys(ARTICLES).map(slug => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const a = ARTICLES[slug]
  if (!a) return { title: 'Article Not Found' }
  const title = a.metaTitle ?? a.title
  const description = a.metaDescription ?? a.lede
  const hasEs = !!ARTICLES_ES[slug]
  return {
    title,
    description,
    keywords: a.keywords,
    alternates: {
      canonical: `/article/${slug}/`,
      languages: {
        en: `/article/${slug}/`,
        ...(hasEs ? { es: `/es/article/${slug}/` } : {}),
        'x-default': `/article/${slug}/`,
      },
    },
    openGraph: { title, description, images: [a.img], type: 'article' },
    twitter: { card: 'summary_large_image', title, description, images: [a.img] },
  }
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const a = ARTICLES[slug]

  const jsonLd = a
    ? [
        {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: a.title,
          description: a.metaDescription ?? a.lede,
          image: a.img,
          author: { '@type': 'Organization', name: 'I Love DR Realty' },
          publisher: { '@type': 'Organization', name: 'I Love DR Realty' },
          inLanguage: 'en',
        },
        ...(a.faqs && a.faqs.length > 0
          ? [
              {
                '@context': 'https://schema.org',
                '@type': 'FAQPage',
                mainEntity: a.faqs.map(f => ({
                  '@type': 'Question',
                  name: f.q,
                  acceptedAnswer: { '@type': 'Answer', text: f.a },
                })),
              },
            ]
          : []),
      ]
    : []

  return (
    <>
      {jsonLd.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      <EsLangSync lang="en" />
      <ArticleDetail slug={slug} lang="en" />
    </>
  )
}
