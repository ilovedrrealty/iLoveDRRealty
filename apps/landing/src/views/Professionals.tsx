'use client'
import Link from 'next/link'
import { BriefcaseBusiness, House, ShieldCheck, Wrench } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const benefits = [
  { key: 'buy', Icon: House },
  { key: 'maintain', Icon: Wrench },
  { key: 'professionals', Icon: BriefcaseBusiness },
] as const

export default function Professionals() {
  const { t } = useTranslation('professionals')
  return <div className="bg-paper min-h-screen">
    <header className="bg-ink text-white"><div className="max-w-310 mx-auto px-4 sm:px-7 py-12 sm:py-16">
      <p className="text-xs font-extrabold uppercase tracking-[.15em] text-gold">{t('eyebrow')}</p>
      <h1 className="mt-4 max-w-4xl text-3xl sm:text-5xl font-extrabold leading-tight">{t('title')}</h1>
      <p className="mt-5 max-w-3xl text-white/75 leading-relaxed">{t('intro')}</p>
      <div className="flex flex-wrap gap-3 mt-7">
        <Link href="/signup/?join=professional" className="inline-flex rounded-full bg-coral text-white px-6 py-3 text-sm font-bold focus-visible:outline-gold">{t('join')}</Link>
        <Link href="/login/?directory=professionals" className="inline-flex rounded-full border border-white/40 px-6 py-3 text-sm font-bold focus-visible:outline-gold">{t('member_login')}</Link>
      </div>
      <p className="mt-4 max-w-2xl text-sm text-white/65">{t('join_intro')}</p>
    </div></header>
    <main className="max-w-310 mx-auto px-4 sm:px-7 py-10 sm:py-14 space-y-10 min-w-0">
      <section aria-labelledby="professional-benefits-heading">
        <h2 id="professional-benefits-heading" className="text-2xl font-bold text-ink">{t('help_heading')}</h2>
        <div className="grid md:grid-cols-3 gap-5 mt-5">{benefits.map(({ key, Icon }) => <article key={key} className="rounded-2xl border border-line bg-white p-6">
          <Icon aria-hidden="true" size={28} className="text-coral" />
          <h3 className="text-lg font-bold text-ink mt-4">{t(`benefits.${key}.title`)}</h3>
          <p className="text-sm leading-relaxed text-ink2 mt-3">{t(`benefits.${key}.description`)}</p>
        </article>)}</div>
      </section>
      <section className="rounded-2xl border border-line bg-paper2 p-6 sm:p-8" aria-labelledby="professional-join-heading">
        <h2 id="professional-join-heading" className="text-2xl font-bold text-ink">{t('how_heading')}</h2>
        <ol className="grid md:grid-cols-3 gap-6 mt-6">{(['profile', 'services', 'review'] as const).map((key, index) => <li key={key}>
          <span aria-hidden="true" className="inline-grid h-9 w-9 place-items-center rounded-full bg-ink text-white font-bold">{index + 1}</span>
          <h3 className="mt-3 font-bold text-ink">{t(`steps.${key}.title`)}</h3>
          <p className="text-sm leading-relaxed text-ink2 mt-2">{t(`steps.${key}.description`)}</p>
        </li>)}</ol>
        <Link href="/signup/?join=professional" className="inline-block mt-7 rounded-full bg-coral text-white px-6 py-3 text-sm font-bold focus-visible:outline-coral">{t('join')}</Link>
        <Link href="/login/?join=professional" className="inline-block mt-4 sm:ml-5 text-sm font-semibold text-coral underline">{t('manage_profile')}</Link>
      </section>
      <section className="rounded-2xl border border-line bg-white p-6 sm:p-8 flex items-start gap-4" aria-labelledby="professional-login-heading">
        <ShieldCheck aria-hidden="true" className="shrink-0 text-coral mt-1" size={30} />
        <div><h2 id="professional-login-heading" className="text-xl font-bold text-ink">{t('directory_private_heading')}</h2>
          <p className="mt-3 max-w-3xl text-sm text-ink2 leading-relaxed">{t('directory_private_description')}</p>
          <div className="flex flex-wrap gap-5 mt-5"><Link href="/login/?directory=professionals" className="font-bold text-sm text-coral underline">{t('member_login')}</Link><Link href="/signup/?directory=professionals" className="font-bold text-sm text-coral underline">{t('member_signup')}</Link></div>
        </div>
      </section>
      <p className="text-xs leading-relaxed text-dim">{t('review_note')}</p>
    </main>
  </div>
}
