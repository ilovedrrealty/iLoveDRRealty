'use client'
import { useNav } from '../hooks/useNav'
import { useState, useEffect } from 'react'
import { Search, Check, ArrowRight, MapPin } from 'lucide-react'
import { STATS_KEYS, MISTAKES, ROLES } from '../data/landingData'
import { fetchListings } from '../api/listings'
import { fmtDOP, type Listing } from '../data/listings'
import { supabaseImgUrl } from '../api/imgUrl'
import { usePlatformStats } from '../hooks/usePlatformStats'
import { useTranslation, Trans } from 'react-i18next'
import HomepagePhotoCards from '../components/HomepagePhotoCards'
import PropertyGallery from '../components/PropertyGallery'

type GoFn = (page: string, slug?: string, params?: Record<string, string>) => void

const fmtP = (n: number) =>
  n >= 1_000_000_000_000 ? `$${(n / 1_000_000_000_000).toFixed(2)}T` :
  n >= 1_000_000_000 ? `$${(n / 1_000_000_000).toFixed(2)}B` :
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${(n / 1_000).toFixed(0)}K`

function CurrencyToggle({ currency, onChange }: { currency: 'USD' | 'DOP'; onChange: (c: 'USD' | 'DOP') => void }) {
  return (
    <div className="flex rounded-lg border border-line overflow-hidden text-[11px] font-bold shrink-0">
      {(['DOP', 'USD'] as const).map(c => (
        <button key={c} type="button" onClick={() => onChange(c)}
          className="px-2.5 py-1 transition-colors cursor-pointer"
          style={{ background: currency === c ? '#00102e' : 'white', color: currency === c ? 'white' : '#64748b' }}>
          {c}
        </button>
      ))}
    </div>
  )
}

function HeroListingCard({ prop, go }: { prop: Listing; go: GoFn }) {
  const { t } = useTranslation('landing')
  return (
    <div
      onClick={() => go('detail', undefined, { id: String(prop.id) })}
      className="flex-1 rounded-3xl overflow-hidden relative shadow-[rgba(0,0,0,0.5)_0px_20px_50px_-20px] cursor-pointer"
      style={{ backgroundImage: `url(${supabaseImgUrl(prop.img, 800)})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0 bg-linear-to-t from-ink/80 via-ink/20 to-transparent" />
      {prop.is_deal ? (
        <span className="absolute top-3 right-3 bg-coral text-white text-2.75 font-bold px-2.25 py-0.75 rounded-md font-sans">{t('card.deal_badge')}</span>
      ) : prop.roi > 0 ? (
        <span className="absolute top-3 right-3 bg-amber-600 text-white text-2.75 font-bold px-2.25 py-0.75 rounded-md font-sans">{t('card.roi_badge', { roi: prop.roi })}</span>
      ) : null}
      <div className="absolute bottom-3.5 left-3.5 right-3.5">
        <div className="text-white/70 text-2.5 font-sans flex items-center gap-1 mb-0.75"><MapPin size={9} /> {prop.region}</div>
        <div className="text-white text-3.5 font-semibold font-sans leading-tight truncate mb-1.5">{prop.title}</div>
        <div className="flex items-center justify-between">
          <div className="text-white font-bold font-sans text-4">{fmtP(prop.price)}<span className="text-white/60 text-2.75 font-normal ml-1">USD</span></div>
          <div className="text-white/60 text-2.75 font-sans flex gap-2">
            {prop.bd > 0 && <span>{prop.bd} {t('card.bd')}</span>}
            {prop.ba > 0 && <span>{prop.ba} {t('card.ba')}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

function PropertyCard({ prop, go, currency, dopRate }: { prop: Listing; go: GoFn; currency: 'USD' | 'DOP'; dopRate: number }) {
  const { t } = useTranslation('landing')
  const tag = prop.tags?.[0]?.[0] ?? ''
  const discountedPrice = prop.is_deal && prop.deal_discount_value
    ? (prop.deal_discount_type === 'fixed'
        ? prop.price - prop.deal_discount_value
        : Math.round(prop.price * (1 - prop.deal_discount_value / 100)))
    : null
  const effectivePrice = discountedPrice ?? prop.price
  const displayPrice = currency === 'DOP' ? fmtDOP(Math.round(effectivePrice * dopRate)) : fmtP(effectivePrice)
  const displayOrig = discountedPrice
    ? (currency === 'DOP' ? fmtDOP(Math.round(prop.price * dopRate)) : fmtP(prop.price))
    : null
  return (
    <div
      onClick={() => go('detail', undefined, { id: String(prop.id) })}
      className="bg-paper rounded-2xl border border-line-soft overflow-hidden cursor-pointer"
    >
      <div className="h-45 relative bg-ink" style={{ backgroundImage: `url(${supabaseImgUrl(prop.img, 600)})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        {tag && (
          <span className="absolute top-3 left-3 text-2.75 font-bold tracking-[.04em] bg-black/35 text-white px-2.25 py-0.75 rounded-md font-sans">
            {tag}
          </span>
        )}
        {prop.is_deal && prop.deal_discount_value ? (
          <span className="absolute top-3 right-3 text-2.75 font-bold bg-coral text-white px-2.25 py-0.75 rounded-md font-sans">
            {prop.deal_discount_type === 'fixed'
              ? currency === 'DOP'
                ? `−${fmtDOP(Math.round(prop.deal_discount_value * dopRate))} ${t('card.off')}`
                : `−$${Number(prop.deal_discount_value).toLocaleString()} ${t('card.off')}`
              : `−${prop.deal_discount_value}% ${t('card.off')}`}
          </span>
        ) : prop.roi > 0 ? (
          <span className="absolute top-3 right-3 text-2.75 font-bold bg-amber-600 text-white px-2.25 py-0.75 rounded-md font-sans">
            {t('card.roi_badge', { roi: prop.roi })}
          </span>
        ) : null}
      </div>
      <div className="pt-4 px-4.5 pb-4.5">
        <div className="font-sans text-2.75 text-dim mb-1 flex items-center gap-1"><MapPin size={11} /> {prop.region}</div>
        <div className="font-sans text-4.25 font-semibold text-ink leading-tight mb-2.5">
          {prop.title}
        </div>
        <div className="flex gap-3.5 text-3 text-dim font-sans mb-3">
          {prop.bd > 0 && <span>{prop.bd} {t('card.bd')}</span>}
          {prop.ba > 0 && <span>{prop.ba} {t('card.ba')}</span>}
          {prop.m2 > 0 && <span>{prop.m2} m²</span>}
        </div>
        <div className="flex items-baseline gap-2">
          <div className="font-sans text-5.5 font-bold text-ink">
            {displayPrice}{currency === 'USD' && <span className="font-sans text-3 text-dim font-normal ml-1">USD</span>}
          </div>
          {displayOrig && (
            <div className="font-sans text-3.5 text-dim line-through">
              {displayOrig}{currency === 'USD' && <span className="font-normal ml-0.5">USD</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Landing() {
  const go = useNav()
  const { t } = useTranslation('landing')
  const [hLoc,    setHLoc]    = useState('')
  const [hType,   setHType]   = useState('All')
  const [hBudget, setHBudget] = useState('')
  const [featured,      setFeatured]      = useState<Listing[]>([])
  const [featuredLoaded, setFeaturedLoaded] = useState(false)
  const [currency,  setCurrency]  = useState<'USD' | 'DOP'>('DOP')
  const [dopRate,   setDopRate]   = useState(59.5)
  const platformStats = usePlatformStats()
  const statValues: Record<typeof STATS_KEYS[number], string> = {
    active_listings:     platformStats ? platformStats.active_listings.toLocaleString() : '—',
    properties_listed:   platformStats ? fmtP(platformStats.total_value) : '—',
    verified_realtors:   platformStats ? platformStats.realtors.toLocaleString() : '—',
    registered_buyers:   platformStats ? platformStats.registered_users.toLocaleString() : '—',
  }

  useEffect(() => {
    fetch('https://open.er-api.com/v6/latest/USD')
      .then(r => r.json())
      .then(d => { if (d.rates?.DOP) setDopRate(d.rates.DOP) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchListings({ pageSize: 50, includeAggregates: false }).then(res => {
      const shuffled = [...res.items]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      setFeatured(shuffled.slice(0, 4))
      setFeaturedLoaded(true)
    }).catch(() => { setFeaturedLoaded(true) })
  }, [])

  const TYPE_OPTIONS = ['All', 'Villa', 'Apartment', 'Condo', 'Land', 'Commercial'] as const

  return (
    <div className="bg-paper">

      {/* ─────────────────────── Hero ─────────────────────── */}
      <div className="relative overflow-hidden bg-ink"
        style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1920&q=80&auto=format&fit=crop)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute inset-0 bg-ink/80" />
        <div className="relative z-10 max-w-335 w-full mx-auto px-4 sm:px-7 py-16 sm:py-20 lg:py-0 lg:min-h-145 lg:flex lg:items-center">
          <div className="w-full grid gap-10 items-center grid-cols-1 lg:grid-cols-[1.15fr_0.85fr]">
            {/* Left */}
            <div>
              <div className="text-2.75 font-bold tracking-[.18em] uppercase text-gold font-sans">
                {t('hero.eyebrow')}
              </div>
              <h1 className="font-sans text-[clamp(34px,5vw,64px)] font-semibold text-white leading-[1.03] tracking-[-0.02em] mt-4 max-w-155">
                {t('hero.heading')}
              </h1>
              <p className="text-[rgba(247,244,236,0.78)] text-4.25 leading-[1.6] max-w-130 mt-4.5 font-sans">
                {t('hero.sub')}
              </p>

              {/* Search bar */}
              <div className="mt-7 bg-white rounded-2xl p-2 flex flex-wrap gap-1.5 w-full max-w-160 items-stretch shadow-[rgba(0,0,0,0.4)_0px_20px_50px_-20px]">
                <div className="flex-[1_1_150px] px-3 py-1.5 sm:border-r border-line">
                  <div className="text-2.5 font-bold tracking-widest uppercase text-dim">{t('hero.search.location_label')}</div>
                  <select value={hLoc} onChange={e => setHLoc(e.target.value)} className="border-none bg-transparent font-sans text-sm text-ink cursor-pointer w-full mt-0.5 outline-none">
                    <option value="">{t('hero.search.location_any')}</option>
                    {['Cap Cana', 'Cabarete', 'Jarabacoa', 'Las Terrenas', 'Punta Cana', 'Puerto Plata', 'Samaná', 'Santo Domingo', 'Santiago', 'Sosúa'].map(r =>
                      <option key={r} value={r}>{r}</option>
                    )}
                  </select>
                </div>
                <div className="flex-[1_1_130px] px-3 py-1.5 sm:border-r border-line">
                  <div className="text-2.5 font-bold tracking-widest uppercase text-dim">{t('hero.search.type_label')}</div>
                  <select value={hType} onChange={e => setHType(e.target.value)} className="border-none bg-transparent font-sans text-sm text-ink cursor-pointer w-full mt-0.5 outline-none">
                    {TYPE_OPTIONS.map(typeVal => (
                      <option key={typeVal} value={typeVal}>
                        {typeVal === 'All' ? t('hero.search.type_all') : t(`hero.search.type_${typeVal.toLowerCase()}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-[1_1_120px] px-3 py-1.5 sm:border-r border-line">
                  <div className="text-2.5 font-bold tracking-widest uppercase text-dim">{t('hero.search.budget_label')}</div>
                  <select value={hBudget} onChange={e => setHBudget(e.target.value)} className="border-none bg-transparent font-sans text-sm text-ink cursor-pointer w-full mt-0.5 outline-none">
                    <option value="">{t('hero.search.budget_any')}</option>
                    <option value="500000">{t('hero.search.budget_500k')}</option>
                    <option value="1000000">{t('hero.search.budget_1m')}</option>
                    <option value="3000000">{t('hero.search.budget_3m')}</option>
                  </select>
                </div>
                <button
                  onClick={() => {
                    const params: Record<string, string> = {}
                    if (hLoc) params.location = hLoc
                    if (hType && hType !== 'All') params.type = hType
                    if (hBudget) params.budget = hBudget
                    go('search', undefined, params)
                  }}
                  className="font-sans text-sm font-semibold cursor-pointer px-6 py-3 sm:py-0 rounded-full w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-2 border border-coral bg-coral text-white"
                >
                  <Search size={17} /> {t('hero.search.button')}
                </button>
              </div>

              {/* Trust badges */}
              <div className="flex gap-4.5 flex-wrap mt-5.5">
                {([
                  ['🛡', t('hero.badges.verified')],
                  ['🌐', t('hero.badges.bilingual')],
                  ['⚡', t('hero.badges.roi')],
                  ['💬', t('hero.badges.whatsapp')],
                ] as [string, string][]).map(([icon, label]) => (
                  <span key={label} className="flex items-center gap-1.75 text-[rgba(247,244,236,0.72)] text-[12.5px] font-sans">
                    {icon} {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Right — live listing cards */}
            <div className="hidden lg:flex lg:flex-col gap-3 h-100">
              {!featuredLoaded ? (
                <>
                  <div className="flex-1 rounded-3xl bg-white/10 animate-pulse" />
                  <div className="flex-1 rounded-3xl bg-white/10 animate-pulse" />
                </>
              ) : featured.length === 0 ? (
                <div className="h-100 rounded-3xl border border-white/12 bg-white/8 flex flex-col items-center justify-center text-center px-6 gap-2">
                  <div className="text-white/50 text-5xl mb-1">🏡</div>
                  <div className="text-white text-4.5 font-semibold font-sans">{t('hero.empty.title')}</div>
                  <div className="text-white/55 text-3.25 font-sans max-w-60 leading-[1.55]">{t('hero.empty.sub')}</div>
                  <button onClick={() => go('search')} className="mt-3 font-sans text-3 font-semibold cursor-pointer px-5 py-2 rounded-full border border-white/25 text-white/80">
                    {t('hero.empty.cta')}
                  </button>
                </div>
              ) : (
                <>
                  <HeroListingCard prop={featured[0]} go={go} />
                  {featured.length >= 2 ? (
                    <HeroListingCard prop={featured[1]} go={go} />
                  ) : (
                    <div
                      onClick={() => go('search')}
                      className="flex-1 rounded-3xl border border-white/12 bg-white/8 flex flex-col items-center justify-center text-center px-6 cursor-pointer gap-1"
                    >
                      <div className="text-white text-4 font-semibold font-sans">{t('hero.explore.title')}</div>
                      <div className="text-white/55 text-3 font-sans">{t('hero.explore.sub')}</div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────── Stats strip ─────────────────────── */}
      <div className="bg-ink border-t border-[rgba(246,241,231,.08)]">
        <div className="max-w-310 mx-auto px-4 sm:px-6 py-6.5 grid grid-cols-2 sm:flex sm:flex-wrap gap-6 sm:justify-between">
          {STATS_KEYS.map(key => (
            <div key={key}>
              <div className="font-sans text-7.5 font-semibold text-white">{statValues[key]}</div>
              <div className="font-sans text-3 text-[rgba(246,241,231,0.55)] tracking-[0.04em] mt-0.5">{t(`stats.${key}`)}</div>
            </div>
          ))}
        </div>
      </div>

      <PropertyGallery />
      <HomepagePhotoCards />

      {/* ─────────────────────── Founder Story ─────────────────────── */}
      <div className="bg-paper2 py-14 sm:py-20 px-4 sm:px-6 relative overflow-hidden">
        <div className="max-w-295 mx-auto relative">
          {/* 2-col: photo collage left, story right */}
          <div className="grid gap-10 lg:gap-15 items-center grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            {/* Left — photo collage */}
            <div className="relative">
              <div className="relative rounded-2xl overflow-hidden shadow-[0_30px_70px_-30px_rgba(0,16,46,.4)]">
                <div className="h-64 sm:h-80 lg:h-95 bg-ink" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&q=80&auto=format&fit=crop)', backgroundSize: 'cover', backgroundPosition: 'center' }} />
                <div className="absolute inset-0 bg-ink/40" />
                <div className="absolute bottom-4 left-4.5 text-paper text-2.75 tracking-[.12em] uppercase font-bold font-sans">
                  {t('founder.photo_caption')}
                </div>
              </div>
              <div className="hidden lg:block absolute -bottom-5 -right-5 w-50 h-37.5 rounded-xl overflow-hidden border-4 border-paper shadow-[0_20px_40px_-20px_rgba(0,16,46,.4)]">
                <div className="h-37.5 bg-ink" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80&auto=format&fit=crop)', backgroundSize: 'cover', backgroundPosition: 'center' }} />
              </div>
              <div className="absolute top-4 left-4 lg:-left-5 bg-coral text-white px-4 py-2.5 rounded-full text-3 font-bold shadow-[0_12px_30px_-12px_rgba(225,15,31,.5)] flex items-center gap-2 font-sans">
                <span className="text-3.5">🇺🇸 → 🇩🇴</span> {t('founder.badge')}
              </div>
            </div>

            {/* Right — story */}
            <div>
              <div className="font-sans text-2.75 font-bold tracking-[.18em] uppercase text-coral">{t('founder.eyebrow')}</div>
              <h2 className="font-sans text-[clamp(28px,3.4vw,42px)] font-semibold text-ink leading-[1.1] tracking-[-0.02em] mt-3 mb-5.5">
                <Trans t={t} i18nKey="founder.heading" components={{ em: <span className="text-coral italic" /> }} />
              </h2>
              <div className="font-sans text-[15.5px] text-ink2 leading-[1.7] mb-4.5">
                {t('founder.para1')}
              </div>
              <div className="font-sans text-[15.5px] text-ink2 leading-[1.7] mb-4.5">
                <Trans t={t} i18nKey="founder.para2" components={{ strong: <strong className="text-ink" /> }} />
              </div>
              <div className="font-sans text-[15.5px] text-ink2 leading-[1.7] mb-5.5">
                {t('founder.para3')}
              </div>
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={() => go('buying')}
                  className="font-sans text-3.5 font-semibold cursor-pointer px-6 py-3 rounded-full bg-coral text-white border border-coral inline-flex items-center gap-2"
                >
                  {t('founder.cta_guide')} <ArrowRight size={16} />
                </button>
                <button
                  onClick={() => go('team')}
                  className="font-sans text-3.5 font-semibold cursor-pointer px-6 py-3 rounded-full bg-transparent text-ink border border-line inline-flex items-center gap-2"
                >
                  {t('founder.cta_team')}
                </button>
              </div>
            </div>
          </div>

          {/* Lessons we learned */}
          <div className="mt-20">
            <div className="text-center max-w-160 mx-auto mb-10">
              <div className="font-sans text-2.75 font-bold tracking-[.18em] uppercase text-gold">{t('founder.mistakes_eyebrow')}</div>
              <h3 className="font-sans text-[clamp(24px,2.6vw,32px)] font-semibold text-ink leading-[1.15] tracking-[-0.01em] mt-3">
                {t('founder.mistakes_heading')}
              </h3>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4.5">
              {MISTAKES.map((it, i) => (
                <div key={i} className="bg-paper border border-line-soft rounded-2xl pt-5.5 px-5.5 pb-5 shadow-[0_6px_18px_-12px_rgba(0,16,46,.12)]">
                  <div
                    className="w-11 h-11 rounded-xl grid place-items-center text-5.5 mb-3.5"
                    style={{ background: it.color, boxShadow: `0 8px 20px -8px ${it.color}88` }}
                  >
                    {it.icon}
                  </div>
                  <div className="font-sans text-2.75 font-bold tracking-widest uppercase mb-1.5" style={{ color: it.color }}>{t('founder.mistake_label')}</div>
                  <div className="text-[14.5px] font-semibold text-ink leading-[1.35] mb-3">"{t(`founder.mistakes.${i}.mistake`)}"</div>
                  <div className="h-px bg-line-soft -mx-5.5 mb-3" />
                  <div className="font-sans text-2.75 font-bold tracking-widest uppercase text-dim mb-1.5">{t('founder.lesson_label')}</div>
                  <div className="font-sans text-[13.5px] text-ink2 leading-[1.55]">{t(`founder.mistakes.${i}.lesson`)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Pull quote */}
          <div className="mt-17.5 max-w-205 mx-auto text-center">
            <div className="font-sans text-[clamp(22px,2.4vw,30px)] font-normal italic text-ink leading-[1.35] tracking-[-0.01em]">
              {t('founder.quote')}
            </div>
            <div className="mt-4.5 font-sans text-3.25 text-dim tracking-[.08em] uppercase font-bold">
              {t('founder.quote_author')}
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────── Roles ─────────────────────── */}
      <div className="max-w-310 mx-auto pt-14 sm:pt-18 px-4 sm:px-6 pb-5">
        <div className="text-center max-w-150 mx-auto mb-11">
          <div className="font-sans text-2.75 font-bold tracking-[.18em] uppercase text-gold">{t('roles.eyebrow')}</div>
          <h2 className="font-sans text-[clamp(28px,3.6vw,42px)] font-semibold text-ink leading-[1.12] tracking-[-0.02em] mt-3">
            {t('roles.heading')}
          </h2>
          <p className="font-sans text-ink2 text-[15.5px] leading-[1.6] mt-3.5">
            {t('roles.sub')}
          </p>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(290px,1fr))] gap-5">
          {ROLES.map(role => {
            const perks = t(`roles.${role.key}.perks`, { returnObjects: true }) as string[]
            return (
              <div key={role.key} className="bg-paper border border-line-soft rounded-2xl overflow-hidden shadow-[0_1px_0_rgba(0,16,46,.03)]">
                <div className="relative">
                  <div className="h-37.5 bg-ink" style={{ backgroundImage: `url(${role.img})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                  <div className="absolute top-0 left-0 w-full h-0.75" style={{ background: role.tone }} />
                </div>
                <div className="px-7.5 pb-7.5 -mt-7 relative">
                  <div
                    className="w-13 h-13 rounded-xl text-paper grid place-items-center mb-4 shadow-[0_8px_20px_-8px_rgba(0,16,46,.45)]"
                    style={{ background: role.tone }}
                  >
                    <role.Icon />
                  </div>
                  <div className="font-sans text-5.75 font-semibold text-ink">{t(`roles.${role.key}.label`)}</div>
                  <p className="font-sans text-ink2 text-3.5 leading-[1.6] mt-2.5 mb-4.5">{t(`roles.${role.key}.sub`)}</p>
                  {Array.isArray(perks) && perks.map((perk, j) => (
                    <div key={perk} className={`flex items-center gap-2.25 py-1.75 font-sans text-[13.5px] text-ink${j ? ' border-t border-line-soft' : ''}`}>
                      <span className="shrink-0" style={{ color: role.tone }}><Check size={14} /></span>
                      {perk}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ─────────────────────── Featured Properties ─────────────────────── */}
      <div className="max-w-310 mx-auto pt-11 px-4 sm:px-6 pb-16 sm:pb-20">
        <div className="flex items-end justify-between mb-6.5 flex-wrap gap-3">
          <div>
            <div className="font-sans text-2.75 font-bold tracking-[.18em] uppercase text-sea">{t('featured.eyebrow')}</div>
            <h2 className="font-sans text-8.5 font-semibold text-ink mt-2">{t('featured.heading')}</h2>
          </div>
          <div className="flex items-center gap-3">
            <CurrencyToggle currency={currency} onChange={setCurrency} />
            <button
              onClick={() => go('search')}
              className="font-sans text-3.5 font-semibold cursor-pointer text-ink2 bg-transparent border border-line px-5 py-2.5 rounded-full inline-flex items-center gap-2"
            >
              {t('featured.view_all')} <ArrowRight size={16} />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-5">
          {featured.map(p => <PropertyCard key={p.id} prop={p} go={go} currency={currency} dopRate={dopRate} />)}
        </div>
      </div>

    </div>
  )
}
