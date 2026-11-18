import type { Metadata } from 'next'
import NewsletterPreferences from '../../views/NewsletterPreferences'

export const metadata: Metadata = {
  title: 'Newsletter preferences',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export default function NewsletterPage() {
  return <NewsletterPreferences />
}
