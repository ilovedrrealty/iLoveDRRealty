'use client'
import { useWebsiteImage } from '../components/WebsiteSettingsProvider'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { ArrowRight, MapPin, KeyRound, MessageCircle, Check } from 'lucide-react'
import { HERO_BG } from '../data/buyingData'

export default function Rentals() {
  const rentalHero = useWebsiteImage('rentals_hero', HERO_BG)
  const { t } = useTranslation('rentals')
  const browse = '/search/?purpose=rent'
  const button = 'inline-flex items-center justify-center gap-2 rounded-full bg-coral px-6 py-3 text-sm font-semibold text-white'
  const steps = [
    { Icon: MapPin, title: t('copy_1'), text: t('copy_2') },
    { Icon: MessageCircle, title: t('copy_3'), text: t('copy_4') },
    { Icon: KeyRound, title: t('copy_5'), text: t('copy_6') },
  ]
  return <main className="bg-paper">
    <section className="relative overflow-hidden bg-ink" style={{ backgroundImage: `url(${rentalHero})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(0,16,46,.95), rgba(0,16,46,.65))' }} />
      <div className="relative mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-gold">{t('copy_7')}</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight tracking-tight text-white sm:text-6xl">{t('copy_8')}</h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/80">{t('copy_9')}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={browse} className={button}>{t('copy_10')}<ArrowRight size={17} /></Link>
          <Link href="/get-started/?intent=rent" className="inline-flex items-center rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white">{t('contact_agent')}</Link>
        </div>
      </div>
    </section>
    <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
      <h2 className="text-3xl font-semibold text-ink">{t('copy_12')}</h2>
      <div className="mt-8 grid gap-5 md:grid-cols-3">{steps.map(({ Icon, title, text }) => <article key={title} className="rounded-2xl border border-line bg-white p-7"><Icon size={26} className="text-sea" /><h3 className="mt-5 text-xl font-semibold text-ink">{title}</h3><p className="mt-3 leading-relaxed text-ink2">{text}</p></article>)}</div>
    </section>
    <section className="bg-paper2 px-5 py-14 sm:px-8">
      <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-2">
        <h2 className="text-3xl font-semibold text-ink">{t('copy_13')}</h2>
        <div className="space-y-4 text-ink2">{[t('copy_14'), t('copy_15'), t('copy_16')].map(item => <p key={item} className="flex items-start gap-3"><Check size={18} className="mt-1 shrink-0 text-sea" />{item}</p>)}</div>
      </div>
    </section>
    <section className="mx-auto max-w-4xl px-5 py-16 text-center sm:px-8">
      <h2 className="text-3xl font-semibold text-ink">{t('copy_17')}</h2>
      <p className="mt-4 text-ink2">{t('copy_18')}</p>
      <Link href={browse} className={`${button} mt-7`}>{t('copy_10')}<ArrowRight size={17} /></Link>
    </section>
  </main>
}
