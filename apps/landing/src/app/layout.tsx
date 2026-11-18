import type { Metadata } from 'next'
import './globals.css'
import LandingRouteShell from '../components/LandingRouteShell'

export const metadata: Metadata = {
  title: {
    default: 'I Love DR Realty — Dominican Republic Real Estate',
    template: '%s | I Love DR Realty',
  },
  description: "The Dominican Republic's real estate marketplace — verified listings, ROI tools, and a bilingual team that's lived the process.",
  metadataBase: new URL('https://ilovedrrealty.com'),
  verification: {
    google: 'a-IQl9jyqfB7NS0m3pHHdnlGBQdf5vxX0Kd_md7dq10',
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
  },
  openGraph: {
    siteName: 'I Love DR Realty',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@ilovedrrealty',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <LandingRouteShell>{children}</LandingRouteShell>
      </body>
    </html>
  )
}
