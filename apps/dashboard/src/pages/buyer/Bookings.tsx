import { useEffect, useState } from 'react'
import { CalendarDays, MapPin, Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { StatusPill, fmtPrice } from '../../components/dashboard/shared'
import { getMyBookings, cancelBooking, type Booking } from '../../api/bookings'
import { ConfirmModal } from '../../components/shared/ConfirmModal'
import { GuestArrivalGuidePanel } from '../../components/dashboard/ArrivalGuide'

const TONE = '#e10f1f'
const LANDING_URL = import.meta.env.VITE_LANDING_URL ?? 'https://ilovedrrealty.com'

type Tab = 'all' | 'upcoming' | 'past' | 'cancelled'

function fmtDate(s: string): string {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function nightsBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}

function filterBookings(bookings: Booking[], tab: Tab): Booking[] {
  const today = new Date().toISOString().slice(0, 10)
  if (tab === 'upcoming')  return bookings.filter(b => b.check_in >= today && b.status !== 'cancelled')
  if (tab === 'past')      return bookings.filter(b => b.check_out < today && b.status !== 'cancelled')
  if (tab === 'cancelled') return bookings.filter(b => b.status === 'cancelled')
  return bookings
}

export function BuyerBookings() {
  const { t } = useTranslation('buyer')
  const { t: guideText } = useTranslation('common', { keyPrefix: 'arrival_guide' })

  const TABS: { key: Tab; label: string }[] = [
    { key: 'all',       label: t('bookings_page.tab_all')       },
    { key: 'upcoming',  label: t('bookings_page.tab_upcoming')  },
    { key: 'past',      label: t('bookings_page.tab_past')      },
    { key: 'cancelled', label: t('bookings_page.tab_cancelled') },
  ]

  const [bookings,         setBookings]         = useState<Booking[]>([])
  const [loading,          setLoading]          = useState(true)
  const [tab,              setTab]              = useState<Tab>('all')
  const [cancelling,       setCancelling]       = useState<string | null>(null)
  const [confirmCancelId,  setConfirmCancelId]  = useState<string | null>(null)
  const [openGuideId, setOpenGuideId] = useState<string | null>(null)

  useEffect(() => {
    getMyBookings()
      .then(data => setBookings(data.sort((a, b) => b.check_in.localeCompare(a.check_in))))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleCancel(id: string) {
    setCancelling(id)
    setOpenGuideId(current => current === id ? null : current)
    try {
      await cancelBooking(id)
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'cancelled' } : b))
    } catch {
    } finally {
      setCancelling(null)
    }
  }

  const visible = filterBookings(bookings, tab)

  const tabCounts: Record<Tab, number> = {
    all:       bookings.length,
    upcoming:  filterBookings(bookings, 'upcoming').length,
    past:      filterBookings(bookings, 'past').length,
    cancelled: filterBookings(bookings, 'cancelled').length,
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Tab bar */}
      <div className="flex items-center gap-1 bg-paper border border-line rounded-xl px-2 py-1.5 w-fit">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => {
              if (tab !== t.key) setOpenGuideId(null)
              setTab(t.key)
            }}
            className={`px-3.5 py-1.5 rounded-lg text-[13px] font-semibold border-0 cursor-pointer transition-colors ${
              tab === t.key ? 'text-white' : 'bg-transparent text-dim hover:text-ink'
            }`}
            style={tab === t.key ? { background: TONE } : undefined}
          >
            {t.label}
            {tabCounts[t.key] > 0 && (
              <span className={`ml-1.5 text-[11px] font-bold ${tab === t.key ? 'opacity-80' : 'text-dim'}`}>
                {tabCounts[t.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Booking list */}
      <div className="bg-paper border border-line rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex flex-col divide-y divide-line">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
                <div className="w-16 h-12 rounded-lg bg-line-soft shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-line-soft rounded w-2/3" />
                  <div className="h-3 bg-line-soft rounded w-1/2" />
                </div>
                <div className="h-6 w-20 bg-line-soft rounded-full" />
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: `${TONE}18` }}>
              <CalendarDays size={20} style={{ color: TONE }} />
            </div>
            <div className="text-center">
              <div className="text-[13.5px] font-semibold text-ink mb-0.5">
                {tab === 'all' ? t('bookings_page.empty_all') : tab === 'upcoming' ? t('bookings_page.empty_upcoming') : tab === 'past' ? t('bookings_page.empty_past') : t('bookings_page.empty_cancelled')}
              </div>
              <div className="text-[11.5px] text-dim">
                {tab === 'upcoming' ? t('bookings_page.empty_upcoming_sub')
                  : tab === 'past' ? t('bookings_page.empty_past_sub')
                  : tab === 'cancelled' ? t('bookings_page.empty_cancelled_sub')
                  : t('bookings_page.empty_all_sub')}
              </div>
            </div>
            {(tab === 'all' || tab === 'upcoming') && (
              <a
                href={`${LANDING_URL}/search`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 py-1.75 px-4 rounded-full text-[12.5px] font-bold cursor-pointer border-0 text-white"
                style={{ background: TONE }}
              >
                <Search size={13} strokeWidth={2.5} /> {t('bookings_page.browse_rentals')}
              </a>
            )}
          </div>
        ) : (
          <div className="divide-y divide-line">
            {visible.map(b => {
              const thumb = b.listing_images?.[0]
              const nights = nightsBetween(b.check_in, b.check_out)
              const isCancellable = b.status === 'pending' || b.status === 'confirmed'
              const today = new Date().toISOString().slice(0, 10)
              const isFuture = b.check_in >= today
              const guideOpen = b.status === 'confirmed' && openGuideId === b.id
              const guideId = `arrival-guide-${b.id}`

              return (
                <div key={b.id}>
                  <div className="flex items-start gap-4 px-5 py-4">
                    {/* Thumbnail */}
                    {thumb ? (
                      <div
                        className="w-16 h-12 rounded-lg shrink-0 bg-cover bg-center"
                        style={{ backgroundImage: `url(${thumb})` }}
                      />
                    ) : (
                      <div className="w-16 h-12 rounded-lg shrink-0 bg-paper2 border border-line flex items-center justify-center">
                        <CalendarDays size={18} className="text-dim" />
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-semibold text-ink truncate">
                        {b.listing_title ?? 'Rental Property'}
                      </div>
                      <div className="flex items-center gap-1 text-[11.5px] text-dim mt-0.5 flex-wrap">
                        {b.listing_location && (
                          <><MapPin size={10} className="shrink-0" /><span>{b.listing_location} ·</span></>
                        )}
                        <span>{fmtDate(b.check_in)} – {fmtDate(b.check_out)}</span>
                        <span>· {nights} {nights !== 1 ? t('bookings_page.nights') : t('bookings_page.night')}</span>
                        <span>· {b.guests} {b.guests !== 1 ? t('bookings_page.guests') : t('bookings_page.guest')}</span>
                      </div>
                    </div>

                    {/* Right side */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <div className="flex items-center gap-2">
                        {b.total_price != null && (
                          <span className="text-[13px] font-bold text-ink">{fmtPrice(b.total_price)}</span>
                        )}
                        <StatusPill label={b.status.charAt(0).toUpperCase() + b.status.slice(1)} />
                      </div>
                      {isCancellable && isFuture && (
                        <button
                          onClick={() => setConfirmCancelId(b.id)}
                          disabled={cancelling === b.id}
                          className="flex items-center gap-1 text-[11.5px] font-semibold text-red-500 bg-transparent border border-red-200 rounded-lg px-2.5 py-1 cursor-pointer hover:bg-red-50 disabled:opacity-50"
                        >
                          <X size={11} strokeWidth={2.5} />
                          {cancelling === b.id ? t('bookings_page.cancelling') : t('bookings_page.cancel')}
                        </button>
                      )}
                    </div>
                  </div>
                  {b.status === 'confirmed' && <div className="px-5 pb-4">
                    <button type="button"
                      className="min-h-11 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink disabled:opacity-50"
                      disabled={cancelling === b.id}
                      aria-expanded={guideOpen} aria-controls={guideId}
                      onClick={() => setOpenGuideId(current => current === b.id ? null : b.id)}>
                      {guideText(guideOpen ? 'close' : 'view')}
                    </button>
                  </div>}
                  {b.status === 'confirmed' && (guideOpen
                    ? <GuestArrivalGuidePanel key={b.id} bookingId={b.id} id={guideId} />
                    : <div id={guideId} hidden />)}
                </div>
              )
            })}
          </div>
        )}
      </div>
      {confirmCancelId && (
        <ConfirmModal
          title={t('bookings_page.cancel_modal_title')}
          description={t('bookings_page.cancel_modal_desc')}
          confirmLabel={t('bookings_page.cancel_modal_confirm')}
          variant="danger"
          loading={cancelling === confirmCancelId}
          onConfirm={async () => {
            await handleCancel(confirmCancelId)
            setConfirmCancelId(null)
          }}
          onCancel={() => setConfirmCancelId(null)}
        />
      )}
    </div>
  )
}
