'use client'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'

export default function ProfessionalResourceCard() {
  const { t } = useTranslation('professionals')
  return <section className="max-w-310 mx-auto px-4 sm:px-7 pt-8 sm:pt-10">
    <Link href="/professionals/" className="block rounded-2xl border border-line bg-paper2 p-6 sm:p-8 hover:border-coral focus-visible:outline-coral">
      <p className="text-xs font-bold tracking-wide uppercase text-coral">{t('eyebrow')}</p>
      <h2 className="text-2xl font-bold text-ink mt-2">{t('resource_title')}</h2>
      <p className="text-sm text-ink2 mt-3 max-w-3xl">{t('resource_description')}</p>
      <span className="inline-block mt-4 text-sm font-bold text-coral">{t('learn_join')} →</span>
    </Link>
  </section>
}
