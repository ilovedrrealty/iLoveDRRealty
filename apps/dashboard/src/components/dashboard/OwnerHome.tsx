import { useState, useEffect } from 'react'
import { Home, Calendar, Bell, MessageCircle, Clock, Star, Pencil, UserCircle, CalendarCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Card, StatusPill, RoleKpiCard, fmtPrice } from './shared'
import { getMyListings, type Listing } from '../../api/listings'
import { getOwnerBookings, type Booking } from '../../api/bookings'
import { getOwnerLeads, type OwnerLead, type OwnerLeadPage } from '../../api/ownerLeads'
import { inquiryDate } from '../../utils/inquiryFeeds'
import { buildOwnerArrivalActivity, isBookingCalendarDate } from '../../utils/ownerArrivalActivity'
import { getMyAgent } from '../../api/auth'
import type { UserInfo } from '../../lib/auth'
import { SetupBanners, useListingSetup } from './SetupBanners'

export const OWNER_KPIS: { label: string; value: string; sub: string; accent?: string }[] = [
  { label: 'Active Listings',    value: '—', sub: '' },
  { label: 'Upcoming Bookings',  value: '—', sub: '' },
  { label: 'Open Leads',         value: '—', sub: '' },
  { label: 'Confirmed Bookings This Month', value: '—', sub: '', accent: '#f0a800' },
]

const STATUS_TONE_MAP: Record<string, string> = {
  active: '#1f7a3d', pending_approval: '#f0a800', rejected: '#e10f1f', archived: '#9ca3af',
}

interface BookingFeed {
  identity: string
  status: 'loading' | 'ready' | 'error'
  items: Booking[]
}

function avatarTone(name: string): string {
  const tones = ['#e10f1f', '#0b63ab', '#f0a800', '#7884a0', '#1f7a3d', '#9333ea']
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return tones[h % tones.length]
}

export function OwnerHome({ go, tone, user }: { go: (v: string) => void; tone: string; user: UserInfo }) {
  const { t } = useTranslation('owner')
  const { t: tCommon } = useTranslation('common')
  const { t: tFeed, i18n } = useTranslation('inquiry_feeds')

  const [myListings, setMyListings]   = useState<Listing[]>([])
  const bookingIdentity = `${user.id}:${user.role}`
  const [bookingFeed, setBookingFeed] = useState<BookingFeed>({ identity: bookingIdentity, status: 'loading', items: [] })
  const [bookingRefresh, setBookingRefresh] = useState(0)
  const [inquiries, setInquiries]     = useState<OwnerLead[]>([])
  const [inquiryPage, setInquiryPage] = useState<OwnerLeadPage | null>(null)
  const [inquiryError, setInquiryError] = useState(false)
  const [inquiryRefresh, setInquiryRefresh] = useState(0)
  const [agent, setAgent] = useState<{ name: string; email: string; phone: string | null; calendly_url: string | null } | null>(null)
  const [loadingListings, setLoadingListings] = useState(true)
  const [loadingInquiries, setLoadingInquiries] = useState(true)
  const [loadingAgent, setLoadingAgent] = useState(true)

  useEffect(() => {
    getMyListings().then(setMyListings).catch(() => {}).finally(() => setLoadingListings(false))
    getMyAgent().then(d => {
      if (d.realtor_name) setAgent({ name: d.realtor_name, email: d.realtor_email ?? '', phone: d.realtor_phone ?? null, calendly_url: d.realtor_calendly_url ?? null })
    }).catch(() => {}).finally(() => setLoadingAgent(false))
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setBookingFeed({ identity: bookingIdentity, status: 'loading', items: [] })
    getOwnerBookings(controller.signal).then(items => {
      if (!Array.isArray(items) || items.some(item => !item || typeof item.id !== 'string' || typeof item.status !== 'string' || typeof item.check_in !== 'string' || typeof item.check_out !== 'string')) {
        throw new Error('Booking activity is unavailable')
      }
      if (!controller.signal.aborted) setBookingFeed({ identity: bookingIdentity, status: 'ready', items })
    }).catch(() => {
      if (!controller.signal.aborted) setBookingFeed({ identity: bookingIdentity, status: 'error', items: [] })
    })
    return () => controller.abort()
  }, [bookingIdentity, bookingRefresh])

  useEffect(() => {
    const controller = new AbortController()
    setInquiries([]); setInquiryPage(null); setInquiryError(false); setLoadingInquiries(true)
    getOwnerLeads(1, 'all', controller.signal).then(result => {
      if (!controller.signal.aborted) { setInquiries(result.items); setInquiryPage(result) }
    }).catch(() => { if (!controller.signal.aborted) setInquiryError(true) })
      .finally(() => { if (!controller.signal.aborted) setLoadingInquiries(false) })
    return () => controller.abort()
  }, [user.id, user.role, inquiryRefresh])

  const activeCount = myListings.filter(l => l.status === 'active').length
  // Identity gating also hides the old account's data before the new effect runs.
  const currentBookingFeed = bookingFeed.identity === bookingIdentity
  const loadingBookings = !currentBookingFeed || bookingFeed.status === 'loading'
  const bookingError = currentBookingFeed && bookingFeed.status === 'error'
  const bookings = currentBookingFeed && bookingFeed.status === 'ready' ? bookingFeed.items : []
  const arrivalActivity = buildOwnerArrivalActivity(bookings, new Date(), i18n.language)
  const upcomingBookings = bookings.filter(b => isBookingCalendarDate(b.check_in) && b.check_in >= arrivalActivity.today && (b.status === 'confirmed' || b.status === 'pending'))
    .sort((a, b) => a.check_in.localeCompare(b.check_in))
  const maxArrivals = Math.max(...arrivalActivity.months.map(month => month.count), 1)
  const kpis = [
    {
      label: t('kpis.active_listings'),
      value: loadingListings ? '…' : String(activeCount),
      sub:   loadingListings ? '' : activeCount === 1 ? t('kpis.active_one') : t('kpis.active_many', { count: activeCount }),
    },
    {
      label: t('kpis.upcoming_bookings'),
      value: loadingBookings ? '…' : bookingError ? '—' : String(upcomingBookings.length),
      sub:   loadingBookings ? t('bookings.loading') : bookingError ? t('bookings.load_error') : upcomingBookings.length ? t('kpis.bookings_next', { date: upcomingBookings[0].check_in }) : t('kpis.bookings_none'),
    },
    {
      label: t('kpis.open_leads'),
      value: loadingInquiries ? '…' : inquiryError || !inquiryPage ? '—' : String(inquiryPage.summary.open_total),
      sub: loadingInquiries ? '' : inquiryError ? tFeed('home_error') : tFeed('open_definition'),
    },
    {
      label: t('kpis.arrivals_month'),
      value: loadingBookings ? '…' : bookingError ? '—' : String(arrivalActivity.thisMonthCount),
      sub:   loadingBookings ? t('bookings.loading') : bookingError ? t('bookings.load_error') : t('kpis.arrivals_sub', { date: arrivalActivity.today }),
      accent: '#f0a800',
    },
  ]

  // Same rule as the banners and every other "add listing" button (see SetupBanners).
  const { canAddListings, blockedReason } = useListingSetup(user, 'owner')

  return (
    <>
      <SetupBanners kind="owner" user={user} go={go} />
      <div className="grid grid-cols-2 gap-3 mb-5 lg:grid-cols-4 lg:gap-4 lg:mb-6">
        {kpis.map((k, i) => <RoleKpiCard key={i} {...k} />)}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-5">
          <Card title={<><Home size={14} /> {t('listings.title')}</>} padded={false}
            action={
              <div className="flex items-center gap-3">
                <button
                  onClick={() => canAddListings && go('submit-listing')}
                  disabled={!canAddListings}
                  title={blockedReason}
                  className="text-xs font-bold bg-transparent border-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ color: tone }}
                >
                  {t('listings.list_property')}
                </button>
                <button onClick={() => go('listings')} className="text-xs font-bold bg-transparent border-none cursor-pointer" style={{ color: tone }}>{t('listings.manage')}</button>
              </div>
            }>
            {loadingListings ? (
              <div>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className={`flex items-center gap-3.5 py-3 px-5.5 animate-pulse ${i < 2 ? 'border-b border-line' : ''}`}>
                    <div className="w-11 h-11 rounded-lg bg-line-soft shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 bg-line-soft rounded w-3/4" />
                      <div className="h-3 bg-line-soft rounded w-1/2" />
                    </div>
                    <div className="h-5 w-14 bg-line-soft rounded-full" />
                  </div>
                ))}
              </div>
            ) : myListings.length === 0 ? (
              <div className="py-10 flex flex-col items-center gap-3">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: `${tone}18` }}>
                  <Home size={20} style={{ color: tone }} />
                </div>
                <div className="text-center">
                  <div className="text-[13.5px] font-semibold text-ink mb-0.5">{t('listings.empty_heading')}</div>
                  <div className="text-[11.5px] text-dim">{t('listings.empty_sub')}</div>
                </div>
                <button
                  onClick={() => canAddListings && go('submit-listing')}
                  disabled={!canAddListings}
                  title={blockedReason}
                  className="mt-1 px-5 py-2 rounded-full text-[12.5px] font-bold text-white border-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: tone }}
                >
                  {t('listings.list_property_btn')}
                </button>
              </div>
            ) : (
              <div>
                {myListings.map((l, i) => (
                  <div key={l.id} className={`flex items-center gap-3.5 py-3 px-5.5 ${i < myListings.length - 1 ? 'border-b border-line' : ''}`}>
                    <div className="w-11 h-11 rounded-lg shrink-0 flex items-center justify-center" style={{ background: `${tone}25` }}>
                      <Home size={18} style={{ color: tone }} />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="text-[13.5px] font-semibold text-ink truncate">{l.title}</div>
                      <div className="text-[11.5px] text-dim mt-0.5">
                        {fmtPrice(l.price)} · {l.view_count.toLocaleString()} {t('listings.views')} · {l.leads_count} {t('listings.leads')}
                        {l.submitted_by_name && <span className="ml-1" style={{ color: tone }}>· {l.submitted_by_name}</span>}
                      </div>
                    </div>
                    <StatusPill label={tCommon(`status_labels.${l.status}`, { defaultValue: l.status })} tone={STATUS_TONE_MAP[l.status]} />
                  </div>
                ))}
                <div className="py-3 px-5.5">
                  <button onClick={() => go('listings')} className="text-[12.5px] font-bold bg-transparent border-none cursor-pointer p-0" style={{ color: tone }}>{t('listings.view_all')}</button>
                </div>
              </div>
            )}
          </Card>

          <Card title={<><CalendarCheck size={14} /> {t('arrival_activity.title')}</>} sub={t('arrival_activity.sub', { date: arrivalActivity.today })}>
            {loadingBookings ? (
              <div role="status" className="py-6 text-[12px] text-dim">{t('bookings.loading')}</div>
            ) : bookingError ? (
              <div role="alert" className="py-3 text-[12px] text-ink">
                <p>{t('bookings.load_error')}</p>
                <button type="button" onClick={() => setBookingRefresh(value => value + 1)} className="mt-2 font-semibold underline" style={{ color: tone }}>{t('bookings.retry')}</button>
              </div>
            ) : (
              <ul className="flex items-end gap-2 min-h-27.5" aria-label={t('arrival_activity.title')}>
                {arrivalActivity.months.map((month, index) => {
                  const height = Math.max((month.count / maxArrivals) * 80, month.count > 0 ? 4 : 2)
                  const isLast = index === arrivalActivity.months.length - 1
                  return (
                    <li key={month.key} className="flex-1 min-w-0 flex flex-col items-center gap-1.5" aria-label={t('arrival_activity.month_count', { month: month.label, count: month.count })}>
                      <div className={`text-[10px] ${isLast ? 'text-ink font-bold' : 'text-dim'}`}>{month.count}</div>
                      <div aria-hidden="true" className="w-full rounded-t-lg" style={{ height, background: isLast ? tone : `${tone}50` }} />
                      <div className="text-[10px] text-dim text-center">{month.label}</div>
                    </li>
                  )
                })}
              </ul>
            )}
            <p className="mt-3 text-[11.5px] text-dim">{t('arrival_activity.definition')}</p>
            <button onClick={() => go('owner-bookings')} className="mt-3 text-[12.5px] font-semibold bg-transparent border-none cursor-pointer p-0" style={{ color: tone }}>
              {t('arrival_activity.view_bookings')}
            </button>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card title={<><UserCircle size={14} /> {t('agent.title')}</>}>
            {loadingAgent ? (
              <div className="flex items-center gap-3 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-line-soft shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-line-soft rounded w-1/2" />
                  <div className="h-3 bg-line-soft rounded w-1/3" />
                </div>
              </div>
            ) : agent ? (
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full shrink-0 grid place-items-center font-bold text-[15px] text-white"
                    style={{ background: tone }}
                  >
                    {agent.name[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="text-[13.5px] font-bold text-ink">{agent.name}</div>
                    <div className="text-[11.5px] text-dim">{agent.email}</div>
                    {agent.phone && <div className="text-[11.5px] text-dim">{agent.phone}</div>}
                  </div>
                </div>
                {agent.calendly_url && /^https?:\/\//i.test(agent.calendly_url) && (
                  <a
                    href={agent.calendly_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white no-underline"
                    style={{ background: tone }}
                  >
                    <CalendarCheck size={13} /> {t('agent.schedule')}
                  </a>
                )}
              </div>
            ) : (
              <div className="py-2 text-center">
                <UserCircle size={28} className="mx-auto mb-1.5 text-dim" />
                <div className="text-[13px] font-semibold text-ink mb-0.5">{t('agent.none_heading')}</div>
                <div className="text-[11.5px] text-dim">{t('agent.none_sub')}</div>
              </div>
            )}
          </Card>

          {!loadingListings && myListings.some(l => l.has_pending_deal_request || l.has_pending_edit) && (
            <Card title={<><Clock size={14} /> {t('pending_reviews.title')}</>} padded={false}
              action={<button onClick={() => go('listings')} className="text-xs font-bold bg-transparent border-none cursor-pointer" style={{ color: tone }}>{t('pending_reviews.all_listings')}</button>}>
              {myListings.filter(l => l.has_pending_deal_request || l.has_pending_edit).map((l, i, arr) => (
                <div key={l.id} className={`flex items-center gap-3 py-3 px-5.5 ${i < arr.length - 1 ? 'border-b border-line' : ''}`}>
                  <div className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center" style={{ background: `${tone}18` }}>
                    <Home size={16} style={{ color: tone }} />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div className="text-[13px] font-semibold text-ink truncate">{l.title}</div>
                    <div className="flex gap-1.5 mt-0.75 flex-wrap">
                      {l.has_pending_deal_request && (
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-1.75 py-0.5 rounded-full" style={{ background: '#f0a80018', color: '#c07800' }}>
                          <Star size={9} fill="#f0a800" style={{ color: '#f0a800' }} /> {t('pending_reviews.deal_request')}
                        </span>
                      )}
                      {l.has_pending_edit && (
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-1.75 py-0.5 rounded-full" style={{ background: '#7c3aed18', color: '#7c3aed' }}>
                          <Pencil size={9} /> {t('pending_reviews.edit')}
                        </span>
                      )}
                    </div>
                  </div>
                  <Clock size={13} className="text-dim shrink-0" />
                </div>
              ))}
            </Card>
          )}

          <Card title={<><Bell size={14} /> {t('bookings.title')}</>} sub={t('bookings.sub')}
            action={<button onClick={() => go('owner-bookings')} className="text-xs font-bold bg-transparent border-none cursor-pointer" style={{ color: tone }}>{t('bookings.all')}</button>}>
            {loadingBookings ? (
              <div className="flex flex-col gap-2.5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="py-3 px-3.5 rounded-[10px] bg-[#F8F9FC] border border-line animate-pulse">
                    <div className="h-3.5 bg-line-soft rounded w-2/3 mb-2" />
                    <div className="h-3 bg-line-soft rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : bookingError ? (
              <div role="alert" className="py-3 text-[12px] text-ink">
                <p>{t('bookings.load_error')}</p>
                <button type="button" onClick={() => setBookingRefresh(value => value + 1)} className="mt-2 font-semibold underline" style={{ color: tone }}>{t('bookings.retry')}</button>
              </div>
            ) : upcomingBookings.length === 0 ? (
              <div className="py-8 flex flex-col items-center gap-2 text-center">
                <Calendar size={22} className="text-dim" />
                <div className="text-[13px] font-semibold text-ink">{t('bookings.empty_heading')}</div>
                <div className="text-[11.5px] text-dim">{t('bookings.empty_sub')}</div>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {upcomingBookings.slice(0, 3).map((b, i) => (
                  <div key={i} className="py-3 px-3.5 rounded-[10px] bg-[#F8F9FC] border border-line">
                    <div className="flex justify-between items-center mb-1">
                      <div className="text-[13px] font-bold text-ink">{b.guest_name ?? t('bookings.guest_fallback')}</div>
                      <StatusPill label={t(`bookings_page.status_${b.status}`, { defaultValue: b.status.charAt(0).toUpperCase() + b.status.slice(1) })} />
                    </div>
                    <div className="text-[11.5px] text-dim truncate">{b.listing_title} · {b.check_in} → {b.check_out}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title={<><MessageCircle size={14} /> {t('leads_card.title')}</>}
            action={inquiryPage && inquiryPage.summary.all_total > 0 ? <span className="text-[11.5px] font-bold px-2.5 py-0.75 rounded-full" style={{ color: tone, background: `${tone}18` }}>{t('leads_card.total', { count: inquiryPage.summary.all_total })}</span> : undefined}>
            {user.role === 'admin' ? <p className="mb-3 text-xs text-dim">{tFeed('admin_scope')}</p> : null}
            {loadingInquiries ? (
              <div className="flex flex-col gap-2.5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className={`flex items-start gap-2.5 pb-2.5 ${i < 2 ? 'border-b border-line' : ''} animate-pulse`}>
                    <div className="w-8.5 h-8.5 rounded-full bg-line-soft shrink-0" />
                    <div className="flex-1 space-y-2 pt-1">
                      <div className="h-3 bg-line-soft rounded w-1/2" />
                      <div className="h-3 bg-line-soft rounded w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : inquiryError ? (
              <div role="alert" className="py-5"><p className="text-sm text-red-800">{tFeed('current_error')}</p><button type="button" onClick={() => setInquiryRefresh(value => value + 1)} className="mt-2 min-h-10 text-sm font-semibold text-sea underline">{tFeed('retry')}</button></div>
            ) : inquiries.length === 0 ? (
              <div className="py-8 flex flex-col items-center gap-2 text-center">
                <MessageCircle size={22} className="text-dim" />
                <div className="text-[13px] font-semibold text-ink">{t('leads_card.empty_heading')}</div>
                <div className="text-[11.5px] text-dim">{t('leads_card.empty_sub')}</div>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {inquiries.slice(0, 4).map((l, i) => (
                  <div key={l.id} className={`flex items-start gap-2.5 pb-2.5 ${i < Math.min(inquiries.length, 4) - 1 ? 'border-b border-line' : ''}`}>
                    <div className="w-8.5 h-8.5 rounded-full shrink-0 grid place-items-center font-bold text-[13px] text-white" style={{ background: avatarTone(l.name) }}>{l.name[0]}</div>
                    <div className="flex-1 overflow-hidden">
                      <div className="text-[13px] font-bold text-ink">{l.name}</div>
                      <div className="text-xs text-ink2 leading-[1.35] mt-0.5 mb-0.75 line-clamp-2">{l.message || tFeed('no_message')}</div>
                      <div className="text-[11px] text-dim">{inquiryDate(l.created_at, i18n.language)} · {tFeed(`statuses.${l.status}`)}</div>
                    </div>
                  </div>
                ))}
                <button onClick={() => go('leads')} className="text-[12.5px] font-semibold bg-transparent border-none cursor-pointer p-0 text-left" style={{ color: tone }}>
                  {tFeed('view_all', { count: inquiryPage?.summary.all_total ?? inquiries.length })}
                </button>
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}
