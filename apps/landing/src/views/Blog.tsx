'use client'
import WebsiteResources from '../components/WebsiteResources'
import { useWebsiteImage } from '../components/WebsiteSettingsProvider'
import { useNav } from '../hooks/useNav'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CATS, type CatKey, catInfo,
  STATS, STAT_COLORS, FEATURED, EDITOR_PICKS, GUIDES,
  STEPS, STEP_COLORS, FAQ_COLORS,
} from '../data/blogData'
import { CARDS_ES } from '../data/blogData.es'

export default function Blog() {
  const resourcesHero = useWebsiteImage('resources_hero', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80&auto=format&fit=crop')
  const go = useNav()
  const { t, i18n } = useTranslation('blog')
  const isEs = i18n.language.startsWith('es')
  const statsLabels = t('stats', { returnObjects: true }) as string[]
  const processSteps = t('process.steps', { returnObjects: true }) as Array<{ title: string; desc: string }>
  const faqItems = t('faq.items', { returnObjects: true }) as Array<{ q: string; a: string }>
  const [cat, setCat] = useState<CatKey>('All')
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [email, setEmail] = useState('')

  // Apply Spanish card text where available; fall back to English.
  const trCard = <T extends { slug: string }>(c: T): T => (isEs && CARDS_ES[c.slug]) ? { ...c, ...CARDS_ES[c.slug] } : c
  const feat = trCard(FEATURED)
  const picks = EDITOR_PICKS.map(trCard)
  const guidesAll = GUIDES.map(trCard)
  const shownGuides = cat === 'All' ? guidesAll : guidesAll.filter(g => g.cat === cat)

  return (
    <div className="bg-paper">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden bg-ink"
        style={{ backgroundImage: `url(${resourcesHero})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(90deg, rgba(0,16,46,.95) 0%, rgba(0,16,46,.75) 55%, rgba(0,16,46,.5) 100%)' }} />
        <div className="relative max-w-310 mx-auto pt-14 sm:pt-17.5 px-4 sm:px-7 pb-12 sm:pb-15">
          <div className="max-w-180">
            <span className="inline-block py-1.5 px-3.5 rounded-full bg-gold text-ink text-2.75 font-extrabold tracking-[.14em] uppercase font-sans">
              {t('hero.tag')}
            </span>
            <h1 className="font-sans text-[clamp(28px,5.5vw,60px)] font-bold text-white mt-5 mb-4 tracking-[-.02em] leading-[1.02]">
              {t('hero.heading_pre')}{' '}
              <span style={{ background: 'linear-gradient(135deg, #f0a800, #e10f1f)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', fontStyle: 'italic' }}>
                {t('hero.heading_em')}
              </span>
              {' '}{t('hero.heading_post')}
            </h1>
            <p className="text-white/78 text-4 sm:text-4.25 leading-[1.65] max-w-145 font-sans">
              {t('hero.sub')}
            </p>
            {/* Stats strip */}
            <div className="flex flex-wrap gap-7 sm:gap-9 mt-9.5">
              {STATS.map(([n, l], i) => (
                <div key={i}>
                  <div className="font-sans text-7 font-bold" style={{ color: STAT_COLORS[i] }}>{n}</div>
                  <div className="text-[11.5px] text-white/65 mt-0.5 tracking-[.02em] font-sans">{statsLabels[i] ?? l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <WebsiteResources />

      {/* ── Featured article ── */}
      <div className="bg-paper pt-12 sm:pt-15 px-4 sm:px-7 pb-7.5">
        <div className="max-w-310 mx-auto">
          <div className="text-2.75 font-bold tracking-[.22em] uppercase text-coral font-sans">{t('featured.eyebrow')}</div>
          <h2 className="font-sans text-6 sm:text-7 font-semibold text-ink mt-2 mb-5 sm:mb-6.5">
            {t('featured.heading')}
          </h2>
          <div className="relative rounded-3xl overflow-hidden cursor-pointer shadow-[0_30px_80px_-30px_rgba(0,16,46,.35)] flex flex-col lg:grid lg:grid-cols-[1.1fr_1fr] lg:min-h-95">
            <div className="relative">
              <div className="h-56 sm:h-72 lg:h-full lg:min-h-95" style={{ backgroundImage: `url(${feat.img})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
              <div className="absolute inset-0"
                style={{ background: 'linear-gradient(135deg, rgba(31,122,61,.4), rgba(0,16,46,.1))' }} />
              <div className="absolute top-5.5 left-5.5">
                <span className="bg-gold text-ink text-2.5 font-extrabold py-1.25 px-3 rounded-full tracking-[.12em] font-sans">
                  {feat.tag}
                </span>
              </div>
            </div>
            {/* Content */}
            <div className="pt-8 sm:pt-12 px-7 sm:px-11 pb-8 sm:pb-12 flex flex-col justify-center text-white"
              style={{ background: 'linear-gradient(135deg, #00102e 0%, #1a3a6e 100%)' }}>
              <h3 className="font-sans text-6 sm:text-8 font-semibold text-white leading-[1.12] mb-4 tracking-[-.01em]">
                {feat.title}
              </h3>
              <p className="text-3.75 text-white/78 leading-[1.65] mb-6 font-sans">
                {feat.desc}
              </p>
              <div className="flex items-center gap-3 mb-5">
                <img
                  src="/iLoveDRRealty_Icon.png"
                  alt="I Love DR Realty"
                  className="w-9.5 h-9.5 rounded-full object-contain bg-white shrink-0 p-0.5"
                />
                <div>
                  <div className="text-3.25 font-semibold text-white font-sans">{feat.author}</div>
                  <div className="text-[11.5px] text-white/55 font-sans">{feat.role} · {feat.read}</div>
                </div>
              </div>
              <button
                onClick={() => go('article', feat.slug)}
                className="inline-flex items-center gap-1.75 bg-coral text-white border-none py-2.75 px-5.5 rounded-full font-sans font-bold text-[13.5px] cursor-pointer self-start"
              >
                {t('featured.read_cta')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Editor's picks ── */}
      <div className="max-w-310 mx-auto pt-5 px-4 sm:px-7 pb-12.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5.5">
          {picks.map((p, i) => {
            const info = catInfo(p.cat)
            return (
              <div key={i} onClick={() => go('article', p.slug)}
                className="relative rounded-2xl overflow-hidden cursor-pointer bg-paper border border-line-soft shadow-[0_12px_30px_-20px_rgba(0,16,46,.15)] flex flex-col sm:flex-row">
                <div className="relative h-48 sm:h-auto sm:w-44 sm:shrink-0">
                  <div className="h-full" style={{ backgroundImage: `url(${p.img})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                  <div className="absolute top-3 left-3 bg-white/95 rounded-lg py-1.25 px-2.25 text-4">
                    {p.icon}
                  </div>
                </div>
                <div className="py-5 px-5.5">
                  <div className="text-2.5 font-extrabold tracking-[.14em] uppercase font-sans"
                    style={{ color: info.a }}>{t('cats.' + p.cat)}</div>
                  <h3 className="font-sans text-4.75 font-semibold text-ink mt-2 mb-1.5 leading-[1.2]">{p.title}</h3>
                  <p className="text-3.25 text-ink2 leading-[1.55] font-sans">{p.desc}</p>
                  <div className="text-[11.5px] text-dim mt-2.5 font-sans">{p.author} · {p.read} {t('guides.read_suffix')}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Category navigator ── */}
      <div className="bg-paper2 py-12 sm:py-15 px-4 sm:px-7">
        <div className="max-w-310 mx-auto">
          <div className="text-2.75 font-bold tracking-[.22em] uppercase text-sea font-sans">{t('browse.eyebrow')}</div>
          <h2 className="font-sans text-6 sm:text-7 font-semibold text-ink mt-2 mb-5 sm:mb-6.5">
            {t('browse.heading')}
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
            {CATS.map(({ key, label, icon, a, b }) => {
              const active = cat === key
              return (
                <button
                  key={key}
                  onClick={() => setCat(key as CatKey)}
                  className={`rounded-2xl py-4 sm:py-5 px-2 sm:px-3.5 cursor-pointer font-sans flex flex-col items-center gap-2 transition-all duration-200 ${active ? '-translate-y-0.5' : ''}`}
                  style={{
                    background: active ? `linear-gradient(135deg, ${a}, ${b})` : '#ffffff',
                    color: active ? '#fff' : '#00102e',
                    border: `1px solid ${active ? a : '#eee9dd'}`,
                    boxShadow: active ? `0 12px 30px -10px ${a}66` : '0 1px 0 rgba(0,16,46,.03)',
                  }}
                >
                  <span className="text-6 sm:text-7">{icon}</span>
                  <span className="text-[11px] sm:text-[12.5px] font-bold text-center leading-[1.2]">{t('cats.' + key)}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Guides grid ── */}
      <div id="guides-section" className="max-w-310 mx-auto py-12 sm:py-15 px-4 sm:px-7">
        <div className="flex justify-between items-end mb-5 sm:mb-6.5 flex-wrap gap-3">
          <div>
            <div className="text-2.75 font-bold tracking-[.22em] uppercase font-sans"
              style={{ color: catInfo(cat).a }}>{cat === 'All' ? t('guides.all_label') : t('cats.' + cat)}</div>
            <h2 className="font-sans text-6 sm:text-7 font-semibold text-ink mt-2">{shownGuides.length} {t('guides.count_suffix')}</h2>
          </div>
          <span className="text-3.25 text-dim font-sans">{t('guides.sorted')}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {shownGuides.map((g, i) => {
            const info = catInfo(g.cat)
            return (
              <div key={i} onClick={() => go('article', g.slug)}
                className="bg-paper rounded-2xl overflow-hidden cursor-pointer shadow-[0_6px_20px_-12px_rgba(0,16,46,.15)] border border-line-soft">
                <div className="relative">
                  <div className="h-37.5" style={{ backgroundImage: `url(${g.img})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                  <div className="absolute inset-0"
                    style={{ background: 'linear-gradient(180deg, transparent 40%, rgba(0,16,46,.5))' }} />
                  <div className="absolute top-3 left-3 text-white rounded-full py-1 px-2.5 text-2.5 font-extrabold tracking-widest uppercase font-sans"
                    style={{ background: `linear-gradient(135deg, ${info.a}, ${info.b})` }}>
                    {t('cats.' + g.cat)}
                  </div>
                  <div className="absolute bottom-3 right-3 bg-white/95 rounded-lg py-1.5 px-2.5 text-5.5">
                    {g.icon}
                  </div>
                </div>
                <div className="p-5" style={{ borderTop: `3px solid ${info.a}` }}>
                  <h3 className="font-sans text-4.5 font-semibold text-ink leading-tight mb-2">{g.title}</h3>
                  <p className="text-3.25 text-ink2 leading-[1.55] mb-3.5 font-sans">{g.desc}</p>
                  <div className="flex justify-between items-center text-xs text-dim pt-3 border-t border-line-soft font-sans">
                    <span>{`📖 ${g.read} ${t('guides.read_suffix')}`}</span>
                    <span className="font-bold" style={{ color: info.a }}>{t('guides.read_cta')}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Buying process timeline ── */}
      <div className="text-white py-14 sm:py-17.5 px-4 sm:px-7 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #00102e 0%, #1a3a6e 50%, #0b3a6e 100%)' }}>
        <div className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at 80% 20%, rgba(240,168,0,.2) 0%, transparent 50%), radial-gradient(ellipse at 20% 80%, rgba(225,15,31,.18) 0%, transparent 50%)' }} />
        <div className="max-w-310 mx-auto relative">
          <div className="text-2.75 font-bold tracking-[.22em] uppercase text-gold font-sans">{t('process.eyebrow')}</div>
          <h2 className="font-sans text-7 sm:text-8 font-semibold text-white mt-2.5 mb-2">
            {t('process.heading')}
          </h2>
          <p className="text-[15.5px] text-white/70 mb-9 max-w-150 font-sans">
            {t('process.sub')}
          </p>
          <div className="relative grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {/* Connecting line — only meaningful at 6-col layout */}
            <div className="hidden lg:block absolute top-10 left-[8%] right-[8%] h-0.5"
              style={{ background: 'linear-gradient(90deg, rgba(247,244,236,.1), rgba(240,168,0,.5), rgba(225,15,31,.5), rgba(11,99,171,.5), rgba(31,122,61,.5), rgba(247,244,236,.1))' }} />
            {STEPS.map(([n, icon, title, desc], i) => (
              <div key={i} onClick={() => go('blog')} className="relative cursor-pointer">
                <div className="w-16 sm:w-20 h-16 sm:h-20 mx-auto mb-4 rounded-full grid place-items-center text-7 sm:text-8 border-0.75 border-white/15 relative z-2"
                  style={{ background: `linear-gradient(135deg, ${STEP_COLORS[i]}, ${STEP_COLORS[i]}99)`, boxShadow: `0 12px 32px -8px ${STEP_COLORS[i]}99` }}>
                  {icon}
                </div>
                <div className="text-center">
                  <div className="font-sans text-3.25 font-bold tracking-widest"
                    style={{ color: STEP_COLORS[i] }}>{`${t('process.step_label')} ${n}`}</div>
                  <h3 className="font-sans text-4 font-semibold text-white mt-1.5 mb-2 leading-[1.2]">{processSteps[i]?.title ?? title}</h3>
                  <p className="text-xs text-white/65 leading-normal font-sans">{processSteps[i]?.desc ?? desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── FAQ ── */}
      <div className="bg-paper py-14 sm:py-17.5 px-4 sm:px-7">
        <div className="max-w-230 mx-auto">
          <div className="text-center mb-9">
            <div className="text-2.75 font-bold tracking-[.22em] uppercase text-coral font-sans">{t('faq.eyebrow')}</div>
            <h2 className="font-sans text-7 sm:text-8 font-semibold text-ink mt-2.5 mb-2">
              {t('faq.heading')}
            </h2>
            <p className="text-3.75 text-ink2 max-w-135 mx-auto font-sans">
              {t('faq.sub')}
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {faqItems.map(({ q, a }, i) => {
              const open = openFaq === i
              const accent = FAQ_COLORS[i]
              return (
                <div key={i} className="bg-paper rounded-xl overflow-hidden transition-[border-color] duration-200"
                  style={{ border: `2px solid ${open ? accent : '#eee9dd'}`, boxShadow: open ? `0 10px 28px -16px ${accent}66` : 'none' }}>
                  <button
                    onClick={() => setOpenFaq(open ? null : i)}
                    className="w-full flex justify-between items-center gap-3 py-4.5 px-4 sm:px-5.5 bg-transparent border-none cursor-pointer text-left font-sans text-sm sm:text-[15.5px] font-semibold text-ink"
                  >
                    <span className="flex items-center gap-3">
                      <span className="w-7.5 h-7.5 rounded-full text-white grid place-items-center text-3.25 font-extrabold shrink-0"
                        style={{ background: accent }}>
                        {i + 1}
                      </span>
                      {q}
                    </span>
                    <span className={`text-5.5 transition-transform duration-200 leading-none shrink-0 ${open ? 'rotate-45' : ''}`}
                      style={{ color: accent }}>
                      +
                    </span>
                  </button>
                  {open && (
                    <div className="pt-0 pr-4 sm:pr-5.5 pb-5 pl-14 sm:pl-16 text-sm text-ink2 leading-[1.65] font-sans">
                      {a}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Newsletter CTA ── */}
      <div className="py-14 sm:py-17.5 px-4 sm:px-7 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #e10f1f 0%, #b80a17 60%, #8a0a18 100%)' }}>
        <div className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at 80% 20%, rgba(240,168,0,.3) 0%, transparent 50%), radial-gradient(ellipse at 20% 100%, rgba(255,255,255,.1) 0%, transparent 50%)' }} />
        <div className="relative max-w-230 mx-auto text-center">
          <span className="inline-block py-1.5 px-3.5 rounded-full bg-white/18 text-white text-2.75 font-extrabold tracking-[.14em] uppercase backdrop-blur-2.5 border border-white/25 font-sans">
            {t('newsletter.tag')}
          </span>
          <h2 className="font-sans text-7 sm:text-9 font-semibold text-white mt-4.5 mb-3 leading-[1.1] tracking-[-.01em]">
            {t('newsletter.heading')}
          </h2>
          <p className="text-4 text-white/88 leading-[1.6] max-w-135 mx-auto mb-7 font-sans">
            {t('newsletter.sub')}
          </p>
          <div className="flex gap-2.5 max-w-120 mx-auto bg-white/18 p-1.5 rounded-full backdrop-blur-2.5 border border-white/30">
            <input
              placeholder={t('newsletter.placeholder')}
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="flex-1 min-w-0 py-3.25 px-4.5 rounded-full border-none font-sans text-sm bg-transparent text-white outline-none"
            />
            <button className="bg-white text-coral-deep border-none py-2.75 px-4 sm:px-5.5 rounded-full font-sans text-[13.5px] font-bold cursor-pointer shrink-0">
              {t('newsletter.cta')}
            </button>
          </div>
          <div className="mt-4.5 text-xs text-white/65 font-sans">
            {t('newsletter.disclaimer')}
          </div>
        </div>
      </div>

    </div>
  )
}
