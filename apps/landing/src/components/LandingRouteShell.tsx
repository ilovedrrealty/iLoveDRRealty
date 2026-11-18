'use client'

import { Suspense } from 'react'
import { usePathname } from 'next/navigation'
import Script from 'next/script'
import { Toaster } from 'react-hot-toast'
import Navbar from './Navbar'
import Footer from './Footer'
import GoogleAuthProvider from './GoogleAuthProvider'
import LeadCaptureProvider from './LeadCaptureProvider'
import I18nProvider from './I18nProvider'
import WebsiteSettingsProvider from './WebsiteSettingsProvider'
import TrackingCapture from './TrackingCapture'
import MeasurementPreferences from './MeasurementPreferences'

export default function LandingRouteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (!pathname || pathname.replace(/\/+$/, '') === '/newsletter') {
    // Keep action links outside measurement, chat, lead capture and OAuth.
    return <I18nProvider>{children}</I18nProvider>
  }
  return (
    <>
      <Suspense fallback={null}><TrackingCapture /></Suspense>
      <I18nProvider>
        <MeasurementPreferences />
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
    </>
  )
}
