'use client'
import { useWebsiteImage } from '../components/WebsiteSettingsProvider'
import { useNav } from '../hooks/useNav'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Check } from 'lucide-react'
import { I, PILLARS, REACH, STEPS, TRUST_ITEMS, HERO_BG } from '../data/sellingData'

function Icon({ d, size = 22 }: { d: string | string[]; size?: number }) {
  const paths = Array.isArray(d) ? d : [d]
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths.map((p, i) => <path key={i} d={p} />)}
    </svg>
  )
}

export default function Selling() {
  const sellingHero = useWebsiteImage('selling_hero', HERO_BG)
  const sellingStory = useWebsiteImage('selling_story', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80&auto=format&fit=crop')
  const go = useNav()
  const { t } = useTranslation('selling')
  const pillarsText = t('pillars.items', { returnObjects: true }) as Array<{ title: string; desc: string }>
  const reachItems = t('reach.items', { returnObjects: true }) as Array<{ num: string; label: string; note: string }>
  const stepsText = t('process.steps', { returnObjects: true }) as Array<{ title: string; desc: string }>
  const trustItems = t('trust.items', { returnObjects: true }) as string[]
  return (
    <div className="bg-paper">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden bg-ink"
        style={{ backgroundImage: `url(${sellingHero})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(90deg, rgba(0,16,46,.95) 0%, rgba(0,16,46,.7) 50%, rgba(0,16,46,.4) 100%)' }} />
        <div className="relative z-10 max-w-310 w-full mx-auto px-4 sm:px-7 py-16 sm:py-20 lg:py-0 lg:min-h-115 lg:flex lg:items-center">
          <div>
            <div className="font-sans text-2.75 font-bold tracking-[.22em] uppercase text-gold">{t('hero.eyebrow')}</div>
            <h1 className="font-sans text-[clamp(28px,5.5vw,60px)] font-bold text-white leading-[1.04] tracking-[-.02em] mt-4 mb-4.5 max-w-190">
              {t('hero.heading')}
            </h1>
            <p className="font-sans text-4 sm:text-4.5 text-white/78 leading-[1.6] max-w-140 mb-7">
              {t('hero.sub')}
            </p>
            <div className="flex gap-3 flex-wrap">
              <button onClick={() => go('get-started', undefined, { intent: 'sell' })}
                className="font-sans text-sm font-semibold cursor-pointer py-2.75 px-5.5 rounded-full inline-flex items-center gap-2 bg-coral text-white border border-coral">
                {t('hero.list')} <ArrowRight size={16} />
              </button>
              <button onClick={() => go('get-started', undefined, { intent: 'sell' })}
                className="font-sans text-sm font-semibold cursor-pointer py-2.75 px-5.5 rounded-full inline-flex items-center gap-2 bg-white/8 text-white border border-white/25">
                {t('contact_agent')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Problem framing ── */}
      <div className="bg-paper2 py-14 px-4 sm:px-7">
        <div className="max-w-275 mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
          <div>
            <div className="font-sans text-2.75 font-bold tracking-[.22em] uppercase text-coral">{t('problem.eyebrow')}</div>
            <h2 className="font-sans text-8 font-semibold text-ink mt-2.5 leading-[1.15]">
              {t('problem.heading')}
            </h2>
          </div>
          <div className="font-sans text-[15.5px] text-ink2 leading-[1.65]">
            {t('problem.body')}
          </div>
        </div>
      </div>

      {/* ── Four pillars ── */}
      <div className="max-w-310 mx-auto pt-14 sm:pt-17.5 px-4 sm:px-7 pb-12.5">
        <div className="text-center max-w-155 mx-auto mb-8 sm:mb-11">
          <div className="font-sans text-2.75 font-bold tracking-[.22em] uppercase text-sea">{t('pillars.eyebrow')}</div>
          <h2 className="font-sans text-7 sm:text-9 font-semibold text-ink mt-2.5 tracking-[-.01em]">
            {t('pillars.heading')}
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          {PILLARS.map((p, i) => (
            <div key={i} className="bg-paper border border-line-soft rounded-2xl p-7 flex gap-4.5">
              <div className="w-13 h-13 rounded-xl text-white grid place-items-center shrink-0"
                style={{ background: p.tone }}>
                <Icon d={p.icon} size={26} />
              </div>
              <div>
                <h3 className="font-sans text-5 font-semibold text-ink mb-2">{pillarsText[i]?.title ?? p.title}</h3>
                <p className="font-sans text-sm text-ink2 leading-[1.6]">{pillarsText[i]?.desc ?? p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Platform reach ── */}
      <div className="bg-ink py-14 sm:py-17.5 px-4 sm:px-7">
        <div className="max-w-310 mx-auto">
          <div className="text-center max-w-160 mx-auto mb-8 sm:mb-12.5">
            <div className="font-sans text-2.75 font-bold tracking-[.22em] uppercase text-gold">{t('reach.eyebrow')}</div>
            <h2 className="font-sans text-7 sm:text-9 font-semibold text-white mt-2.5 tracking-[-.01em]">
              {t('reach.heading')}
            </h2>
            <p className="font-sans text-3.75 text-white/65 leading-[1.6] mt-3">
              {t('reach.sub')}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {REACH.map((r, i) => (
              <div key={i} className="bg-white/5 border border-white/10 border-l-0.75 border-l-gold rounded-2xl p-6">
                <div className="font-sans text-7 font-bold text-gold mb-2">{reachItems[i]?.num ?? r.num}</div>
                <div className="font-sans text-[14.5px] font-semibold text-white mb-1.5">{reachItems[i]?.label ?? r.label}</div>
                <div className="font-sans text-[12.5px] text-white/60 leading-normal">{reachItems[i]?.note ?? r.note}</div>
              </div>
            ))}
          </div>
          <div className="mt-8 py-4 px-5 bg-white/5 rounded-xl font-sans text-xs text-white/60 text-center leading-normal">
            <strong className="text-gold">{t('reach.disclaimer_strong')}</strong>{t('reach.disclaimer_rest')}
          </div>
        </div>
      </div>

      {/* ── Selling process ── */}
      <div className="max-w-275 mx-auto py-14 sm:py-17.5 px-4 sm:px-7">
        <div className="text-center max-w-155 mx-auto mb-11">
          <div className="font-sans text-2.75 font-bold tracking-[.22em] uppercase text-coral">{t('process.eyebrow')}</div>
          <h2 className="font-sans text-9 font-semibold text-ink mt-2.5 tracking-[-.01em]">
            {t('process.heading')}
          </h2>
          <p className="font-sans text-3.75 text-ink2 leading-[1.6] mt-3">
            {t('process.sub')}
          </p>
        </div>
        <div className="flex flex-col gap-3.5">
          {STEPS.map(([num, title, desc], i) => (
            <div key={i} className="flex gap-5.5 p-5.5 bg-paper border border-line-soft rounded-2xl">
              <div className="font-sans text-8 font-bold text-brand leading-none min-w-12.5">{num}</div>
              <div>
                <h3 className="font-sans text-4.75 font-semibold text-ink mb-1.5">{stepsText[i]?.title ?? title}</h3>
                <p className="font-sans text-sm text-ink2 leading-[1.6]">{stepsText[i]?.desc ?? desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Trust checklist ── */}
      <div className="bg-paper2 py-14 sm:py-17.5 px-4 sm:px-7">
        <div className="max-w-275 mx-auto grid grid-cols-1 lg:grid-cols-[1.1fr_.9fr] gap-10 lg:gap-14 items-center">
          <div>
            <div className="font-sans text-2.75 font-bold tracking-[.22em] uppercase text-brand">{t('trust.eyebrow')}</div>
            <h2 className="font-sans text-7 sm:text-8 font-semibold text-ink mt-2.5 tracking-[-.01em] mb-5">
              {t('trust.heading')}
            </h2>
            <ul className="list-none p-0 m-0">
              {trustItems.map((item, i) => (
                <li key={i} className="font-sans flex items-start gap-2.5 py-2.5 text-sm text-ink2 leading-normal">
                  <span className="w-5 h-5 rounded-full bg-brand text-white grid place-items-center shrink-0 mt-px">
                    <Check size={12} strokeWidth={2.5} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl overflow-hidden h-64 sm:h-80 lg:h-90 shadow-[rgba(0,16,46,.3)_0px_30px_60px_-30px]"
            style={{ backgroundImage: `url(${sellingStory})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
        </div>
      </div>

      {/* ── What we believe ── */}
      <div className="bg-ink py-14 sm:py-17.5 px-4 sm:px-7">
        <div className="max-w-200 mx-auto text-center">
          <div className="font-sans text-2.75 font-bold tracking-[.22em] uppercase text-gold">{t('quote.eyebrow')}</div>
          <p className="font-sans text-xl sm:text-2xl font-medium italic text-white leading-normal mt-4.5">
            {t('quote.text')}
          </p>
          <p className="font-sans text-3.25 text-white/55 mt-4.5 tracking-[.06em] uppercase font-bold">
            {t('quote.author')}
          </p>
        </div>
      </div>

      {/* ── Final CTA ── */}
      <div className="bg-brand py-12 sm:py-15 px-4 sm:px-7">
        <div className="max-w-240 mx-auto flex flex-col sm:flex-row sm:justify-between sm:items-center gap-6">
          <div>
            <h2 className="font-sans text-6 sm:text-7.5 font-semibold text-white mb-2">
              {t('cta.heading')}
            </h2>
            <p className="font-sans text-3.75 text-white/88 leading-normal">
              {t('cta.sub')}
            </p>
          </div>
          <div className="flex gap-2.5 flex-wrap shrink-0">
            <button onClick={() => go('get-started', undefined, { intent: 'sell' })}
              className="font-sans text-sm font-semibold cursor-pointer py-2.75 px-5.5 rounded-full inline-flex items-center gap-2 bg-white text-brand border border-white">
              {t('cta.valuation')}
            </button>
            <button onClick={() => go('get-started', undefined, { intent: 'sell' })}
              className="font-sans text-sm font-semibold cursor-pointer py-2.75 px-5.5 rounded-full inline-flex items-center gap-2 bg-transparent text-white border border-white/40">
              {t('cta.talk')}
            </button>
          </div>
        </div>
      </div>

    </div>
  )
}
