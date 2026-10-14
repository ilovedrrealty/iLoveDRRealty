'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useNav } from '../hooks/useNav'
import { useTranslation } from 'react-i18next'
import { isStandalonePage } from '../lib/constants'
import { trackWhatsAppConversion } from '../lib/gtag'

const NAV_GROUPS = [
  {
    groupKey: 'discover',
    links: ['search', 'buying', 'selling', 'calculator'] as const,
  },
  {
    groupKey: 'company',
    links: ['team', 'blog', 'contact', 'get-started'] as const,
  },
]

export default function Footer() {
  const go = useNav()
  const pathname = usePathname()
  const { t } = useTranslation('footer')
  const year = new Date().getFullYear()

  if (isStandalonePage(pathname)) return null

  return (
    <footer className="bg-ink text-paper2/60 font-sans">

      {/* ── Main footer body ── */}
      <div className="max-w-310 mx-auto pt-12 sm:pt-14 px-4 sm:px-6 pb-10 grid grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr] gap-8 lg:gap-10 items-start">

        {/* Brand — full width on mobile */}
        <div className="col-span-2 lg:col-span-1">
          <div className="mb-4.5">
            <Link href="/" className="p-0 leading-none block">
              <img src="/iLoveDRRealty_White.png" alt="I Love DR Realty" className="block w-auto h-11" width={87} height={36} />
            </Link>
          </div>
          <p className="text-[13.5px] leading-[1.7] text-paper2/55 max-w-65 mb-5">
            {t('brand_desc')}
          </p>
          <div className="flex gap-2.5">
            <a
              href="https://wa.me/18096108094"
              target="_blank"
              rel="noopener"
              onClick={trackWhatsAppConversion}
              className="inline-flex items-center gap-1.75 text-[12.5px] text-paper2/70 no-underline py-1.75 px-3.5 rounded-full border border-paper2/15"
            >
              💬 WhatsApp
            </a>
          </div>
        </div>

        {/* Nav columns */}
        {NAV_GROUPS.map(group => (
          <div key={group.groupKey}>
            <div className="text-2.5 font-bold tracking-[.18em] uppercase text-paper2/35 mb-4">
              {t(`groups.${group.groupKey}`)}
            </div>
            <ul className="list-none p-0 m-0 flex flex-col gap-2.5">
              {group.links.map(key => (
                <li key={key}>
                  <button
                    onClick={() => go(key)}
                    className="bg-transparent border-none cursor-pointer p-0 text-3.5 text-paper2/65 font-sans text-left transition-colors duration-150"
                  >
                    {t(`links.${key}`)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* Contact — full width on mobile */}
        <div className="col-span-2 lg:col-span-1">
          <div className="text-2.5 font-bold tracking-[.18em] uppercase text-paper2/35 mb-4">
            {t('contact.heading')}
          </div>
          <div className="flex flex-col gap-2.5 text-3.5 text-paper2/65">
            <span>📍 Dominican Republic</span>
            <span>📞 (809) 610-8094</span>
            <span>✉️ ilovedrrealty@gmail.com</span>
          </div>
          <button
            onClick={() => go('contact')}
            className="mt-5 font-sans text-3.25 font-semibold cursor-pointer py-2.25 px-4.5 rounded-full bg-transparent text-paper2/80 border border-paper2/20"
          >
            {t('contact.cta')}
          </button>
        </div>
      </div>

      {/* ── Bottom strip ── */}
      <div className="border-t border-paper2/8">
        <div className="max-w-310 mx-auto px-4 sm:px-6 py-4.5 flex flex-col sm:flex-row gap-3 sm:gap-3.5 items-center sm:justify-between text-center sm:text-left">
          <span className="text-3 text-paper2/35">
            {t('copyright', { year })}
          </span>
          <div className="flex flex-wrap gap-4 sm:gap-5 text-3 items-center justify-center">
            <span className="font-sans italic text-paper2/25 tracking-[.04em]">{t('tagline')}</span>
            <Link href="/privacy-policy/" className="text-3 text-paper2/35 font-sans no-underline">{t('privacy')}</Link>
            <Link href="/terms-of-service/" className="text-3 text-paper2/35 font-sans no-underline">{t('terms')}</Link>
          </div>
        </div>
      </div>

    </footer>
  )
}
