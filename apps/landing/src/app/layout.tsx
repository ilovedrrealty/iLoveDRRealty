import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { Toaster } from 'react-hot-toast'
import GoogleAuthProvider from '../components/GoogleAuthProvider'
import LeadCaptureProvider from '../components/LeadCaptureProvider'
import I18nProvider from '../components/I18nProvider'
import WebsiteSettingsProvider from '../components/WebsiteSettingsProvider'
import TrackingCapture from '../components/TrackingCapture'
import { GTAG_ID } from '../lib/gtag'

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
        {/* Google tag (gtag.js) — installed once sitewide per Website-Developer-Only-Instructions.md */}
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${GTAG_ID}`} strategy="afterInteractive" />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GTAG_ID}');
          `}
        </Script>
        <TrackingCapture />
        <I18nProvider>
        <WebsiteSettingsProvider>
        <GoogleAuthProvider>
          <LeadCaptureProvider>
          <Navbar />
          {children}
          <Footer />
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 3500,
              style: { fontFamily: 'inherit', fontSize: '14px', borderRadius: '12px' },
            }}
          />
          </LeadCaptureProvider>
        </GoogleAuthProvider>
        </WebsiteSettingsProvider>
        </I18nProvider>
        <Script src="//code.tidio.co/31bscsjpyxzsm0q0fxc65bs1aba5dsf1.js" strategy="lazyOnload" />
      </body>
    </html>
  )
}
