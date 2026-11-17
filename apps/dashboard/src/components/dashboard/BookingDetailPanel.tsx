import { X, CalendarDays, Users, Mail, Phone, CreditCard, ExternalLink, StickyNote } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Booking } from '../../api/bookings'
import { fmtPrice } from './shared'
import { PAYPAL_ENABLED } from '../../lib/features'

function fmtDate(s: string): string {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
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

const PAYMENT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  authorized: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Payment Authorized' },
  captured:   { bg: 'bg-green-100', text: 'text-green-700', label: 'Paid'               },
  voided:     { bg: 'bg-gray-100',  text: 'text-gray-500',  label: 'Voided'             },
  refunded:   { bg: 'bg-blue-100',  text: 'text-blue-600',  label: 'Refunded'           },
}

const STATUS_LABEL: Record<string, string> = {
  pending:   'Pending',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
}

interface Props {
  booking: Booking | null
  onClose: () => void
  accentColor?: string
  showGHL?: boolean
  isAdmin?: boolean
  afterStay?: ReactNode
  onAccept?: () => Promise<void>
  onDecline?: () => Promise<void>
  onReleasePayout?: () => Promise<void>
  onRequestPayout?: () => Promise<void>
}

export function BookingDetailPanel({
  booking,
  onClose,
  accentColor = '#1f7a3d',
  showGHL,
  isAdmin,
  afterStay,
  onAccept,
  onDecline,
  onReleasePayout,
  onRequestPayout,
}: Props) {
  const { t } = useTranslation('common', { keyPrefix: 'arrival_guide' })
  const [acting, setActing] = useState(false)
  const [payoutRequested, setPayoutRequested] = useState(false)
  const [confirmRelease, setConfirmRelease] = useState(false)

  if (!booking) return null

  const name = booking.guest_name ?? 'Guest'
  const nights = nightsBetween(booking.check_in, booking.check_out)
  const payStyle = booking.payment_status ? PAYMENT_STYLES[booking.payment_status] : null
  const isPending = booking.status === 'pending'
  const showRelease = PAYPAL_ENABLED && isAdmin && booking.payment_status === 'captured' && booking.payout_status !== 'paid'
  const showRequest = PAYPAL_ENABLED && !isAdmin && booking.payment_status === 'captured' && booking.payout_status === 'failed'

  async function run(fn: () => Promise<void>) {
    setActing(true)
    try { await fn() } finally { setActing(false) }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />

      <div className="fixed right-0 top-0 h-full w-full max-w-105 z-50 bg-paper shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-line shrink-0">
          <span className="text-[14px] font-bold text-ink">Booking Details</span>
          <button
            type="button"
            aria-label={t('close_booking')}
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-line-soft text-dim cursor-pointer border-0 bg-transparent"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">

          {/* Guest avatar + name */}
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-full shrink-0 grid place-items-center font-bold text-[17px] text-white"
              style={{ background: avatarTone(name) }}
            >
              {name[0].toUpperCase()}
            </div>
            <div>
              <div className="text-[14.5px] font-bold text-ink">{name}</div>
              <div className="text-[11.5px] text-dim">{STATUS_LABEL[booking.status] ?? booking.status}</div>
            </div>
          </div>

          {/* Contact */}
          {(booking.guest_email || booking.guest_phone) && (
            <div className="bg-paper2 rounded-xl p-4 space-y-2.5">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-dim">Contact</div>
              {booking.guest_email && (
                <a
                  href={`mailto:${booking.guest_email}`}
                  className="flex items-center gap-2.5 text-[12.5px] text-ink hover:underline no-underline"
                >
                  <Mail size={13} className="text-dim shrink-0" />
                  {booking.guest_email}
                </a>
              )}
              {booking.guest_phone && (
                <a
                  href={`tel:${booking.guest_phone}`}
                  className="flex items-center gap-2.5 text-[12.5px] text-ink hover:underline no-underline"
                >
                  <Phone size={13} className="text-dim shrink-0" />
                  {booking.guest_phone}
                </a>
              )}
            </div>
          )}

          {/* Property */}
          <div className="bg-paper2 rounded-xl p-4 space-y-0.5">
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-dim mb-1">Property</div>
            <div className="text-[13px] font-semibold text-ink">{booking.listing_title ?? 'Property'}</div>
            {booking.listing_location && (
              <div className="text-[11.5px] text-dim">{booking.listing_location}</div>
            )}
          </div>

          {/* Stay */}
          <div className="bg-paper2 rounded-xl p-4 space-y-2">
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-dim">Stay</div>
            <div className="flex items-start gap-2.5 text-[12.5px] text-ink">
              <CalendarDays size={13} className="text-dim shrink-0 mt-0.5" />
              <span>{fmtDate(booking.check_in)} – {fmtDate(booking.check_out)}</span>
            </div>
            <div className="flex items-center gap-4 text-[11.5px] text-dim pl-5.25">
              <span>{nights} {nights === 1 ? 'night' : 'nights'}</span>
              <span className="flex items-center gap-1">
                <Users size={11} />
                {booking.guests} {booking.guests === 1 ? 'guest' : 'guests'}
              </span>
            </div>
          </div>

          {afterStay}

          {/* Pricing */}
          {booking.total_price != null && (
            <div className="bg-paper2 rounded-xl p-4 space-y-2">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-dim">Pricing</div>
              <div className="flex items-center justify-between text-[12.5px]">
                <span className="text-dim">Total</span>
                <span className="font-semibold text-ink">{fmtPrice(booking.total_price)}</span>
              </div>
              {booking.platform_fee != null && (
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="text-dim">Platform fee (20%)</span>
                  <span className="text-dim">−{fmtPrice(booking.platform_fee)}</span>
                </div>
              )}
              {booking.payout_amount != null && (
                <div className="flex items-center justify-between text-[13px] pt-2 border-t border-line">
                  <span className="font-semibold text-ink">Your payout</span>
                  <span className="font-bold" style={{ color: accentColor }}>{fmtPrice(booking.payout_amount)}</span>
                </div>
              )}
            </div>
          )}

          {/* Payment status */}
          {(payStyle || booking.payout_status === 'paid' || booking.payout_status === 'failed') && (
            <div className="flex items-center gap-2 flex-wrap">
              <CreditCard size={13} className="text-dim shrink-0" />
              {payStyle && (
                <span className={`text-[11.5px] font-bold px-2.5 py-0.5 rounded-full ${payStyle.bg} ${payStyle.text}`}>
                  {payStyle.label}
                </span>
              )}
              {booking.payout_status === 'paid' && (
                <span className="text-[11.5px] font-bold px-2.5 py-0.5 rounded-full bg-green-100 text-green-700">Payout sent</span>
              )}
              {booking.payout_status === 'failed' && (
                <span className="text-[11.5px] font-bold px-2.5 py-0.5 rounded-full bg-red-100 text-red-600">Payout failed</span>
              )}
            </div>
          )}

          {/* Notes */}
          {booking.notes && (
            <div className="bg-paper2 rounded-xl p-4 space-y-1.5">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-dim flex items-center gap-1.5">
                <StickyNote size={11} />
                Notes
              </div>
              <p className="text-[12.5px] text-ink2 leading-relaxed m-0">{booking.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {(showGHL || isPending || showRelease) && (
          <div className="border-t border-line px-5 py-4 flex flex-col gap-2.5 shrink-0">
            {showGHL && (() => {
              try {
                const u = new URL(booking.ghl_contact_url ?? '')
                if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
                return (
                  <a
                    href={u.toString()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-[13px] font-semibold text-white no-underline"
                    style={{ background: '#F97316' }}
                  >
                    <ExternalLink size={14} />
                    Open in GHL
                  </a>
                )
              } catch { return null }
            })()}

            {isPending && onAccept && onDecline && (
              <div className="flex gap-2">
                <button
                  onClick={() => run(onAccept)}
                  disabled={acting}
                  className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white border-0 cursor-pointer disabled:opacity-50"
                  style={{ background: accentColor }}
                >
                  {acting ? '…' : 'Accept'}
                </button>
                <button
                  onClick={() => run(onDecline)}
                  disabled={acting}
                  className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-ink2 border border-line bg-white cursor-pointer disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
            )}

            {showRelease && onReleasePayout && !confirmRelease && (
              <button
                onClick={() => setConfirmRelease(true)}
                disabled={acting}
                className="w-full py-2.5 rounded-xl text-[13px] font-semibold text-red-600 bg-red-50 border-0 cursor-pointer disabled:opacity-50"
              >
                Release Payout
              </button>
            )}
            {showRelease && onReleasePayout && confirmRelease && (
              <div className="space-y-2">
                <div className="text-[12px] text-center text-ink2">
                  Send payout to the owner via PayPal. This cannot be undone.
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setConfirmRelease(false); run(onReleasePayout) }}
                    disabled={acting}
                    className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-red-600 border-0 cursor-pointer disabled:opacity-50"
                  >
                    {acting ? '…' : 'Confirm Release'}
                  </button>
                  <button
                    onClick={() => setConfirmRelease(false)}
                    disabled={acting}
                    className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-ink2 border border-line bg-white cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {showRequest && onRequestPayout && !payoutRequested && (
              <button
                onClick={() => run(async () => { await onRequestPayout(); setPayoutRequested(true) })}
                disabled={acting}
                className="w-full py-2.5 rounded-xl text-[13px] font-semibold text-amber-700 bg-amber-50 border-0 cursor-pointer disabled:opacity-50"
              >
                {acting ? '…' : 'Request Payout'}
              </button>
            )}
            {showRequest && payoutRequested && (
              <div className="w-full py-2.5 rounded-xl text-[13px] font-semibold text-center text-green-700 bg-green-50">
                Payout request sent ✓
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
