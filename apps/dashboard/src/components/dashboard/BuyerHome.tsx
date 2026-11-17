import { useState, useEffect } from 'react'
import {
  Heart, MessageCircle, CalendarDays, MapPin,
  BookOpen, Scale, Globe, Banknote, Search, type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

const LANDING_URL = import.meta.env.VITE_LANDING_URL ?? 'https://ilovedrrealty.com'
import { Card, CardLink, StatusPill, SceneThumb, RoleKpiCard, fmtPrice } from './shared'
import { getMySavedHomes, type SavedHome } from '../../api/savedHomes'
import { getMyLeads, type Lead } from '../../api/leads'
import { currentBuyerInquiries, inquiryDate, inquiryStatus } from '../../utils/inquiryFeeds'
import { getMyBookings, type Booking } from '../../api/bookings'

function nightsBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}

export const BUYER_RESOURCES: { Icon: LucideIcon; title: string; time: string }[] = [
  { Icon: BookOpen, title: 'The Complete DR Buying Guide',  time: '12 min read' },
  { Icon: Scale,    title: 'Understanding DR Property Law', time: '8 min read'  },
  { Icon: Globe,    title: 'Residency & Visa Options 2026', time: '6 min read'  },
  { Icon: Banknote, title: 'Cost of Living Comparison',     time: '5 min read'  },
]

export function BuyerHome({ go }: { go: (v: string) => void }) {
  const { t } = useTranslation('buyer')
  const { t: tFeed, i18n } = useTranslation('inquiry_feeds')
  const [savedHomes,   setSavedHomes]   = useState<SavedHome[]>([])
  const [inquiries,    setInquiries]    = useState<Lead[]>([])
  const [inquiryError, setInquiryError] = useState(false)
  const [inquiryRefresh, setInquiryRefresh] = useState(0)
  const [bookings,     setBookings]     = useState<Booking[]>([])
  const [loadingSaved,     setLoadingSaved]     = useState(true)
  const [loadingInquiries, setLoadingInquiries] = useState(true)
  const [loadingBookings,  setLoadingBookings]  = useState(true)

  useEffect(() => {
    getMySavedHomes().then(setSavedHomes).catch(() => {}).finally(() => setLoadingSaved(false))
    getMyBookings().then(setBookings).catch(() => {}).finally(() => setLoadingBookings(false))
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setInquiries([]); setLoadingInquiries(true); setInquiryError(false)
    getMyLeads(controller.signal).then(rows => { if (!controller.signal.aborted) setInquiries(currentBuyerInquiries(rows)) })
      .catch(() => { if (!controller.signal.aborted) setInquiryError(true) })
      .finally(() => { if (!controller.signal.aborted) setLoadingInquiries(false) })
    return () => controller.abort()
  }, [inquiryRefresh])

  const today = new Date().toISOString().slice(0, 10)
  const upcomingBookings = bookings
    .filter(b => b.check_in >= today && b.status !== 'cancelled')
    .sort((a, b) => a.check_in.localeCompare(b.check_in))
  const nextTrip = upcomingBookings[0] ?? null

  const kpis = [
    {
      label: t('kpis.saved_homes'),
      value: loadingSaved ? '…' : String(savedHomes.length),
      sub: savedHomes.length === 1 ? t('kpis.saved_one') : t('kpis.saved_many', { count: savedHomes.length }),
    },
    {
      label: t('kpis.inquiries_sent'),
      value: loadingInquiries ? '…' : inquiryError ? '—' : String(inquiries.length),
      sub: inquiryError ? tFeed('home_error') : inquiries.length ? t('kpis.inquiries_count', { count: inquiries.length }) : t('kpis.inquiries_none'),
    },
    {
      label: t('kpis.upcoming_trips'),
      value: loadingBookings ? '…' : String(upcomingBookings.length),
      sub: nextTrip ? t('kpis.trips_next', { date: nextTrip.check_in }) : t('kpis.trips_none'),
    },
    {
      label: t('kpis.wishlist_match'),
      value: '—',
      sub: t('kpis.wishlist_soon'),
    },
  ]

  const nights = nextTrip ? nightsBetween(nextTrip.check_in, nextTrip.check_out) : 0
  const guestWord = nextTrip ? (nextTrip.guests !== 1 ? t('upcoming_trip.guests') : t('upcoming_trip.guest')) : ''

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {kpis.map((k, i) => <RoleKpiCard key={i} {...k} />)}
      </div>

      <div className="grid grid-cols-1 gap-5 mt-5 xl:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-5">
          <Card title={<><Heart size={14} />{t('saved_homes.title')}</>} action={<CardLink onClick={() => go('saved')} color="#e10f1f">{t('saved_homes.view_all')}</CardLink>} padded={false}>
            {loadingSaved ? (
              <div className="px-3 sm:px-5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className={`flex items-center gap-3 py-3 animate-pulse ${i < 3 ? 'border-b border-line' : ''}`}>
                    <div className="w-13 h-10 rounded-lg bg-line-soft shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 bg-line-soft rounded w-3/4" />
                      <div className="h-3 bg-line-soft rounded w-2/5" />
                    </div>
                    <div className="h-5 w-16 bg-line-soft rounded-full" />
                  </div>
                ))}
              </div>
            ) : savedHomes.length === 0 ? (
              <div className="py-10 flex flex-col items-center gap-3">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: '#e10f1f18' }}>
                  <Heart size={20} style={{ color: '#e10f1f' }} />
                </div>
                <div className="text-center">
                  <div className="text-[13.5px] font-semibold text-ink mb-0.5">{t('saved_homes.empty_heading')}</div>
                  <div className="text-[11.5px] text-dim">{t('saved_homes.empty_sub')}</div>
                </div>
                <a
                  href={`${LANDING_URL}/search`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 py-1.75 px-4 rounded-full text-[12.5px] font-bold cursor-pointer border-0 text-white"
                  style={{ background: '#e10f1f' }}
                >
                  <Search size={13} strokeWidth={2.5} /> {t('saved_homes.browse')}
                </a>
              </div>
            ) : (
              <div className="px-3 sm:px-5">
                {savedHomes.slice(0, 5).map((l, i) => (
                  <div key={l.id} className={`flex items-center gap-3 py-3 ${i < Math.min(4, savedHomes.length - 1) ? 'border-b border-line' : ''}`}>
                    {l.listing_images[0] ? (
                      <div className="w-13 h-10 rounded-lg shrink-0 overflow-hidden">
                        <img src={l.listing_images[0]} className="w-full h-full object-cover" alt="" />
                      </div>
                    ) : (
                      <SceneThumb v={0} />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-ink truncate">{l.listing_title}</div>
                      <div className="text-[11px] text-dim mt-0.5 flex items-center gap-1"><MapPin size={10} className="shrink-0" />{l.listing_location}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <div className="text-[13px] font-bold text-ink">{fmtPrice(l.listing_price)}</div>
                      <StatusPill label={t('saved_homes.saved_label')} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title={<><MessageCircle size={14} />{t('inquiries.title')}</>} action={<CardLink onClick={() => go('inquiries')} color="#e10f1f">{t('inquiries.all')}</CardLink>} padded={false}>
            {loadingInquiries ? (
              <div className="px-5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className={`flex items-center gap-3 py-3 animate-pulse ${i < 2 ? 'border-b border-line' : ''}`}>
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 bg-line-soft rounded w-3/4" />
                      <div className="h-3 bg-line-soft rounded w-2/5" />
                    </div>
                    <div className="h-5 w-12 bg-line-soft rounded-full" />
                  </div>
                ))}
              </div>
            ) : inquiryError ? (
              <div role="alert" className="px-5 py-6"><p className="text-sm text-red-800">{tFeed('current_error')}</p><button type="button" onClick={() => setInquiryRefresh(value => value + 1)} className="mt-2 min-h-10 text-sm font-semibold text-sea underline">{tFeed('retry')}</button></div>
            ) : inquiries.length === 0 ? (
              <div className="py-10 flex flex-col items-center gap-3">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: '#e10f1f18' }}>
                  <MessageCircle size={20} style={{ color: '#e10f1f' }} />
                </div>
                <div className="text-center">
                  <div className="text-[13.5px] font-semibold text-ink mb-0.5">{t('inquiries.empty_heading')}</div>
                  <div className="text-[11.5px] text-dim">{t('inquiries.empty_sub')}</div>
                </div>
                <a
                  href={`${LANDING_URL}/search`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 py-1.75 px-4 rounded-full text-[12.5px] font-bold cursor-pointer border-0 text-white"
                  style={{ background: '#e10f1f' }}
                >
                  <Search size={13} strokeWidth={2.5} /> {t('inquiries.browse')}
                </a>
              </div>
            ) : (
              <div className="px-5">
                {inquiries.slice(0, 3).map((inq, i) => (
                  <div key={inq.id} className={`flex items-center gap-3 py-3 ${i < Math.min(2, inquiries.length - 1) ? 'border-b border-line' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-ink truncate">{inq.property_title ?? t('inquiries.general_inquiry')}</div>
                      <div className="text-[11px] text-dim">{inquiryDate(inq.created_at, i18n.language)}</div>
                    </div>
                    <StatusPill label={tFeed(`statuses.${inquiryStatus(inq.status)}`)} tone="#0b63ab" />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card title={<><CalendarDays size={14} />{t('upcoming_trip.title')}</>}>
            {loadingBookings ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-5 bg-line-soft rounded w-2/3" />
                <div className="h-3.5 bg-line-soft rounded w-1/2" />
                <div className="h-2 bg-line-soft rounded-full mt-4" />
              </div>
            ) : !nextTrip ? (
              <div className="py-4 text-center text-dim text-sm">{t('upcoming_trip.none')}</div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="font-sans text-xl font-bold text-ink">{nextTrip.listing_title ?? 'Booking'}</div>
                <div className="text-xs text-dim">
                  {nextTrip.check_in} – {nextTrip.check_out} · {t('upcoming_trip.nights', { n: nights })} · {nextTrip.guests} {guestWord}
                </div>
                <div className="h-2 bg-line rounded-full overflow-hidden mt-2">
                  <div className="h-full w-full rounded-full" style={{ background: 'linear-gradient(90deg,#0b63ab,#f0a800)' }} />
                </div>
                <div className="flex justify-between text-xs text-dim mt-1">
                  <StatusPill label={nextTrip.status.charAt(0).toUpperCase() + nextTrip.status.slice(1)} />
                  {nextTrip.total_price != null && (
                    <span className="font-bold text-ink">${nextTrip.total_price.toLocaleString()}</span>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}
