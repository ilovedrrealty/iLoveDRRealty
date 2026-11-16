import { useEffect, useState } from 'react'
import { Bell, CalendarDays, Users, CreditCard, Mail, Phone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { StatusPill, fmtPrice } from '../../components/dashboard/shared'
import { getOwnerBookings, acceptBooking, declineBooking, requestPayout, type Booking } from '../../api/bookings'
import { BookingDetailPanel } from '../../components/dashboard/BookingDetailPanel'
import { OwnerArrivalGuideEditor } from '../../components/dashboard/ArrivalGuide'
import { allowNetworkNavigation } from '../../components/network/NetworkShared'
import { PAYPAL_ENABLED } from '../../lib/features'

function fmtDate(s: string): string {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function nightsBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}

function avatarTone(name: string): string {
  const tones = ['#e10f1f', '#0b63ab', '#f0a800', '#7884a0', '#1f7a3d', '#9333ea']
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return tones[h % tones.length]
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-2 px-5 py-2.5 bg-paper2 border-b border-line">
      <span className="text-[11.5px] font-bold uppercase tracking-[.07em] text-dim">{label}</span>
      <span className="text-[11px] font-bold px-1.75 py-px rounded-full bg-line text-dim">{count}</span>
    </div>
  )
}

const PAYMENT_STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  authorized:  { bg: 'bg-amber-100',  text: 'text-amber-700',  label: 'Authorized' },
  captured:    { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Paid' },
  voided:      { bg: 'bg-gray-100',   text: 'text-gray-500',   label: 'Voided' },
  refunded:    { bg: 'bg-blue-100',   text: 'text-blue-600',   label: 'Refunded' },
}

function PaymentBadge({ status }: { status: string | null }) {
  if (!status || status === 'unpaid') return null
  const style = PAYMENT_STATUS_STYLES[status]
  if (!style) return null
  return (
    <span className={`inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
      <CreditCard size={9} />
      {style.label}
    </span>
  )
}

function BookingRow({
  booking,
  actionable,
  onAccept,
  onDecline,
  onRequestPayout,
  acting,
  onClick,
}: {
  booking: Booking
  actionable: boolean
  onAccept?: () => void
  onDecline?: () => void
  onRequestPayout?: () => void
  acting: boolean
  onClick?: () => void
}) {
  const { t } = useTranslation('owner')
  const [payoutRequested, setPayoutRequested] = useState(false)
  const name = booking.guest_name ?? t('bookings_page.guest_fallback')
  const nights = nightsBetween(booking.check_in, booking.check_out)

  const showRequest = PAYPAL_ENABLED && booking.payment_status === 'captured' && booking.payout_status === 'failed'

  return (
    <div
      className={`flex items-start gap-4 px-5 py-4 cursor-pointer hover:bg-paper2 transition-colors ${actionable ? 'bg-amber-50/40' : ''}`}
      onClick={onClick}
    >
      {/* Avatar */}
      <div
        className="w-9 h-9 rounded-full shrink-0 grid place-items-center font-bold text-[14px] text-white mt-0.5"
        style={{ background: avatarTone(name) }}
      >
        {name[0].toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13.5px] font-semibold text-ink">{name}</span>
          <StatusPill label={t(`bookings_page.status_${booking.status}`, { defaultValue: booking.status.charAt(0).toUpperCase() + booking.status.slice(1) })} />
          <PaymentBadge status={booking.payment_status} />
          {actionable && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{t('bookings_page.action_required')}</span>
          )}
          {booking.payout_status === 'paid' && (
            <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">{t('bookings_page.payout_sent')}</span>
          )}
          {booking.payout_status === 'failed' && (
            <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">{t('bookings_page.payout_failed')}</span>
          )}
        </div>
        <div className="text-[12px] text-ink2 mt-0.5 truncate font-medium">{booking.listing_title ?? t('bookings_page.property_fallback')}</div>
        <div className="flex items-center gap-3 mt-1 text-[11.5px] text-dim flex-wrap">
          <span className="flex items-center gap-1">
            <CalendarDays size={10} className="shrink-0" />
            {fmtDate(booking.check_in)} – {fmtDate(booking.check_out)} · {t('bookings_page.night', { count: nights })}
          </span>
          <span className="flex items-center gap-1">
            <Users size={10} className="shrink-0" />
            {t('bookings_page.guest_count', { count: booking.guests })}
          </span>
        </div>
        {(booking.guest_email || booking.guest_phone) && (
          <div className="flex items-center gap-3 mt-0.5 text-[11.5px] text-dim flex-wrap">
            {booking.guest_email && (
              <a href={`mailto:${booking.guest_email}`} className="flex items-center gap-1 hover:text-ink transition-colors">
                <Mail size={10} className="shrink-0" />
                {booking.guest_email}
              </a>
            )}
            {booking.guest_phone && (
              <a href={`tel:${booking.guest_phone}`} className="flex items-center gap-1 hover:text-ink transition-colors">
                <Phone size={10} className="shrink-0" />
                {booking.guest_phone}
              </a>
            )}
          </div>
        )}
      </div>

      {/* Right side */}
      <div className="flex flex-col items-end gap-2 shrink-0">
        {booking.payout_amount != null ? (
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[13.5px] font-bold text-ink">{fmtPrice(booking.payout_amount)}</span>
            {booking.platform_fee != null && (
              <span className="text-[10.5px] text-dim">of {fmtPrice(booking.total_price ?? 0)} · {fmtPrice(booking.platform_fee)} fee</span>
            )}
          </div>
        ) : booking.total_price != null && (
          <span className="text-[13.5px] font-bold text-ink">{fmtPrice(booking.total_price)}</span>
        )}
        {actionable && (
          <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
            <button
              onClick={onAccept}
              disabled={acting}
              className="text-[12px] font-bold py-1.5 px-3.5 rounded-lg border-0 bg-brand text-white cursor-pointer disabled:opacity-50"
            >
              {acting ? '…' : t('bookings_page.accept')}
            </button>
            <button
              onClick={onDecline}
              disabled={acting}
              className="text-[12px] font-bold py-1.5 px-3.5 rounded-lg border border-line bg-white text-ink2 cursor-pointer disabled:opacity-50"
            >
              {t('bookings_page.decline')}
            </button>
          </div>
        )}
        {showRequest && !payoutRequested && (
          <button
            onClick={e => { e.stopPropagation(); onRequestPayout?.(); setPayoutRequested(true) }}
            disabled={acting}
            className="text-[11.5px] font-bold py-1.5 px-3 rounded-lg border-0 bg-amber-50 text-amber-700 cursor-pointer disabled:opacity-50"
          >
            {acting ? '…' : t('bookings_page.request_payout')}
          </button>
        )}
        {showRequest && payoutRequested && (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
            {t('bookings_page.payout_requested')}
          </span>
        )}
      </div>
    </div>
  )
}

const TONE = '#f0a800'

export function OwnerBookings({ go, isAdmin, canManageArrivalGuide }: {
  go?: (v: string) => void
  isAdmin?: boolean
  canManageArrivalGuide?: boolean
}) {
  const { t } = useTranslation('owner')
  const [bookings, setBookings]   = useState<Booking[]>([])
  const [loading, setLoading]     = useState(true)
  const [acting, setActing]       = useState<string | null>(null)
  const [actionError, setActionError] = useState('')
  const actionErrorFor = (err: any) =>
    err?.response?.status === 409 ? t('bookings_page.dates_conflict') : t('bookings_page.action_failed')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const panelBooking = selectedId ? (bookings.find(b => b.id === selectedId) ?? null) : null

  useEffect(() => {
    getOwnerBookings()
      .then(setBookings)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleAccept(id: string) {
    setActing(id)
    setActionError('')
    try {
      await acceptBooking(id)
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'confirmed', payment_status: b.payment_status === 'authorized' ? 'captured' : b.payment_status } : b))
    } catch (err: any) {
      setActionError(actionErrorFor(err))
    } finally {
      setActing(null)
    }
  }

  async function handleDecline(id: string) {
    setActing(id)
    setActionError('')
    try {
      await declineBooking(id)
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'cancelled', payment_status: b.payment_status === 'authorized' ? 'voided' : b.payment_status } : b))
    } catch (err: any) {
      setActionError(actionErrorFor(err))
    } finally {
      setActing(null)
    }
  }

  async function handleRequestPayout(id: string) {
    setActing(id)
    try {
      await requestPayout(id)
    } catch {
    } finally {
      setActing(null)
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const pending   = bookings.filter(b => b.status === 'pending')
  const upcoming  = bookings.filter(b => b.status === 'confirmed' && b.check_in >= today)
  const past      = bookings.filter(b => b.status === 'confirmed' && b.check_out < today)
  const cancelled = bookings.filter(b => b.status === 'cancelled')

  if (loading) {
    return (
      <div className="bg-paper border border-line rounded-xl overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-line last:border-0 animate-pulse">
            <div className="w-9 h-9 rounded-full bg-line-soft shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 bg-line-soft rounded w-1/2" />
              <div className="h-3 bg-line-soft rounded w-2/3" />
              <div className="h-3 bg-line-soft rounded w-1/3" />
            </div>
            <div className="h-7 w-24 bg-line-soft rounded-lg" />
          </div>
        ))}
      </div>
    )
  }

  if (bookings.length === 0) {
    return (
      <div className="bg-paper border border-line rounded-xl py-16 flex flex-col items-center gap-3 text-center px-6">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: `${TONE}18` }}>
          <Bell size={20} style={{ color: TONE }} />
        </div>
        <div>
          <div className="text-[13.5px] font-semibold text-ink mb-0.5">{t('bookings_page.empty_title')}</div>
          <div className="text-[11.5px] text-dim">{t('bookings_page.empty_sub')}</div>
        </div>
      </div>
    )
  }

  return (
    <>
      {actionError && (
        <div role="alert" data-testid="booking-action-error"
          className="mb-3 flex items-start justify-between gap-3 rounded-xl border border-coral/30 bg-coral/10 px-4 py-2.5 text-[12.5px] font-semibold text-coral">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError('')} aria-label="Dismiss" className="cursor-pointer border-0 bg-transparent text-coral">×</button>
        </div>
      )}
      <div className="bg-paper border border-line rounded-xl overflow-hidden divide-y divide-line">
        {pending.length > 0 && (
          <div>
            <SectionHeader label={t('bookings_page.section_pending')} count={pending.length} />
            <div className="divide-y divide-line">
              {pending.map(b => (
                <BookingRow
                  key={b.id}
                  booking={b}
                  actionable
                  onAccept={() => handleAccept(b.id)}
                  onDecline={() => handleDecline(b.id)}
                  acting={acting === b.id}
                  onClick={() => setSelectedId(b.id)}
                />
              ))}
            </div>
          </div>
        )}

        {upcoming.length > 0 && (
          <div>
            <SectionHeader label={t('bookings_page.section_upcoming')} count={upcoming.length} />
            <div className="divide-y divide-line">
              {upcoming.map(b => (
                <BookingRow key={b.id} booking={b} actionable={false} acting={false}
                  onRequestPayout={() => handleRequestPayout(b.id)}
                  onClick={() => setSelectedId(b.id)} />
              ))}
            </div>
          </div>
        )}

        {past.length > 0 && (
          <div>
            <SectionHeader label={t('bookings_page.section_past')} count={past.length} />
            <div className="divide-y divide-line">
              {past.map(b => (
                <BookingRow key={b.id} booking={b} actionable={false} acting={false}
                  onRequestPayout={() => handleRequestPayout(b.id)}
                  onClick={() => setSelectedId(b.id)} />
              ))}
            </div>
          </div>
        )}

        {cancelled.length > 0 && (
          <div>
            <SectionHeader label={t('bookings_page.section_cancelled')} count={cancelled.length} />
            <div className="divide-y divide-line">
              {cancelled.map(b => (
                <BookingRow key={b.id} booking={b} actionable={false} acting={false}
                  onClick={() => setSelectedId(b.id)} />
              ))}
            </div>
          </div>
        )}
      </div>

      <BookingDetailPanel
        booking={panelBooking}
        onClose={() => {
          if (!canManageArrivalGuide || allowNetworkNavigation()) setSelectedId(null)
        }}
        accentColor={TONE}
        isAdmin={isAdmin}
        afterStay={canManageArrivalGuide && panelBooking
          ? <OwnerArrivalGuideEditor key={panelBooking.id} listingId={panelBooking.listing_id} />
          : undefined}
        onAccept={panelBooking?.status === 'pending' ? () => handleAccept(panelBooking.id) : undefined}
        onDecline={panelBooking?.status === 'pending' ? () => handleDecline(panelBooking.id) : undefined}
        onRequestPayout={
          panelBooking?.payment_status === 'captured' && panelBooking?.payout_status === 'failed'
            ? () => handleRequestPayout(panelBooking.id)
            : undefined
        }
      />
    </>
  )
}
