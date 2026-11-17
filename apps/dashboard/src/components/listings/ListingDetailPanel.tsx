import { useState, useEffect } from 'react'
import {
  X, MapPin, Tag, Link2, Eye, Users, Home, Pencil,
  ChevronLeft, ChevronRight, CircleDollarSign, ArrowLeftRight,
  Calendar, BedDouble, Bath, Ruler, Maximize2, TrendingUp,
  Wallet, CheckCircle2, Star, Clock, Building2, Video, Box, FileText, Mail, Phone, CalendarCheck, UserCircle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import DOMPurify from 'dompurify'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import type { Listing } from '../../api/listings'
import { submitDealRequest } from '../../api/listings'
import { PAYPAL_ENABLED } from '../../lib/features'
import { ListingPerformanceAction } from './ListingPerformanceDialog'

const STATUS_CHIP_DARK: Record<string, { bg: string; color: string; label: string }> = {
  active:           { bg: '#16a34a', color: 'white',   label: 'Active'   },
  pending_approval: { bg: '#fef08a', color: '#854d0e', label: 'Pending'  },
  rejected:         { bg: '#dc2626', color: 'white',   label: 'Rejected' },
  archived:         { bg: '#6b7280', color: 'white',   label: 'Archived' },
}

const titleCase = (s: string) =>
  s === s.toUpperCase() ? s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : s

function fmtType(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

function safeUrl(u: string): string | null {
  try {
    const p = new URL(u)
    return p.protocol === 'https:' || p.protocol === 'http:' ? p.href : null
  } catch { return null }
}

function youtubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url)
    let vid: string | null = null
    if (u.hostname === 'youtu.be') {
      vid = u.pathname.slice(1).split('/')[0]
    } else if (u.hostname === 'www.youtube.com' || u.hostname === 'youtube.com') {
      if (u.pathname === '/watch') vid = u.searchParams.get('v')
      else if (u.pathname.startsWith('/embed/')) vid = u.pathname.slice(7).split('/')[0]
      else if (u.pathname.startsWith('/shorts/')) vid = u.pathname.slice(8).split('/')[0]
    }
    return vid ? `https://www.youtube.com/embed/${vid}` : null
  } catch { return null }
}

interface Props {
  listing: Listing
  tone: string
  role?: string
  openDeal?: boolean
  realtorCalendlyUrl?: string | null
  onClose: () => void
  onEdit?: () => void
  selfManaged?: boolean
  canOpenPerformance?: boolean
}

export function ListingDetailPanel({ listing, tone, role, openDeal, realtorCalendlyUrl, onClose, onEdit, selfManaged, canOpenPerformance }: Props) {
  const { t } = useTranslation('common')
  const [imgIdx,        setImgIdx]        = useState(0)
  const [dealOpen,      setDealOpen]      = useState(false)
  const [discountType,  setDiscountType]  = useState<'pct' | 'fixed'>('pct')
  const [discountValue, setDiscountValue] = useState('')
  const [dealMessage,   setDealMessage]   = useState('')
  const [submitting,    setSubmitting]    = useState(false)

  useEffect(() => { if (openDeal) setDealOpen(true) }, [openDeal])

  const isOwnerOrRealtor = role === 'owner' || role === 'realtor'
  const realtorManaged = role === 'owner' && selfManaged === false
  const canRequestDeal = listing.status === 'active' && !listing.is_deal && !listing.has_pending_deal_request && isOwnerOrRealtor && !realtorManaged

  const DEPOSIT_LABELS: Record<string, string> = {
    first:      t('listing_panel.deposit_first'),
    last:       t('listing_panel.deposit_last'),
    first_last: t('listing_panel.deposit_first_last'),
    none:       t('listing_panel.deposit_none'),
  }

  async function handleDealSubmit() {
    const val = parseFloat(discountValue)
    if (!val || val <= 0) return
    if (discountType === 'pct' && val >= 100) return
    setSubmitting(true)
    try {
      await submitDealRequest(listing.id, { discount_value: val, discount_type: discountType, message: dealMessage || undefined })
      toast.success(t('listing_panel.toast_deal_ok'))
      setDealOpen(false)
      setDiscountValue('')
      setDealMessage('')
    } catch {
      toast.error(t('listing_panel.toast_deal_fail'))
    } finally {
      setSubmitting(false)
    }
  }
  const imgs = listing.images ?? []
  const chip = STATUS_CHIP_DARK[listing.status] ?? { bg: '#6b7280', color: 'white', label: listing.status }

  type PropField = { Icon: LucideIcon; label: string; value: string | number }
  const propFields: PropField[] = ([
    { Icon: CircleDollarSign, label: t('listing_panel.label_price'),       value: `$${Number(listing.price).toLocaleString('en-US')}` },
    { Icon: Home,             label: t('listing_panel.label_type'),        value: fmtType(listing.type) },
    { Icon: ArrowLeftRight,   label: t('listing_panel.label_transaction'), value: fmtType(listing.transaction) },
    { Icon: Calendar,         label: t('listing_panel.label_year_built'),  value: listing.year_built },
    { Icon: BedDouble,        label: t('listing_panel.label_bedrooms'),    value: listing.bedrooms || null },
    { Icon: Bath,             label: t('listing_panel.label_bathrooms'),   value: listing.bathrooms || null },
    { Icon: Ruler,            label: t('listing_panel.label_area'),        value: listing.area_sqft     != null ? Number(listing.area_sqft).toLocaleString('en-US')     : null },
    { Icon: Maximize2,        label: t('listing_panel.label_lot'),         value: listing.lot_size_sqft != null ? Number(listing.lot_size_sqft).toLocaleString('en-US') : null },
    { Icon: TrendingUp,       label: t('listing_panel.label_roi'),         value: listing.roi || null },
    { Icon: Wallet,           label: t('listing_panel.label_hoa_fee'),     value: listing.hoa_fee != null ? `$${Number(listing.hoa_fee).toLocaleString('en-US')}` : null },
    { Icon: Building2,        label: t('listing_panel.label_assoc_fee'),   value: listing.association_fee != null ? `$${Number(listing.association_fee).toLocaleString('en-US')}` : null },
    { Icon: CircleDollarSign, label: 'Daily Rate',   value: listing.price_per_day   != null ? `$${Number(listing.price_per_day).toLocaleString('en-US')}/night`  : null },
    { Icon: CircleDollarSign, label: 'Monthly Rate', value: listing.price_per_month != null ? `$${Number(listing.price_per_month).toLocaleString('en-US')}/mo`    : null },
  ] as (PropField & { value: string | number | null | undefined })[]).filter(
    f => f.value != null && f.value !== ''
  ) as PropField[]

  const propRows: PropField[][] = []
  for (let i = 0; i < propFields.length; i += 3) propRows.push(propFields.slice(i, i + 3))

  const boolBadges = [
    { label: t('listing_panel.badge_seller_fin'), on: listing.seller_financing },
    { label: t('listing_panel.badge_hoa'),        on: listing.hoa              },
    { label: t('listing_panel.badge_tax'),        on: listing.tax_exempt       },
    { label: t('listing_panel.badge_gated'),      on: listing.gated_community  },
  ].filter(b => b.on)

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      <div className="fixed right-0 top-0 h-full w-140 max-w-full z-50 flex flex-col shadow-2xl overflow-hidden">

        {/* ── Image carousel ───────────────────────────────────────────── */}
        <div className="relative bg-black shrink-0" style={{ height: 240 }}>
          {imgs.length > 0 ? (
            <img src={imgs[imgIdx]} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ background: `${tone}33` }}>
              <Home size={48} style={{ color: tone }} className="opacity-50" />
            </div>
          )}

          {imgs.length > 1 && (
            <>
              <button
                onClick={() => setImgIdx(i => (i - 1 + imgs.length) % imgs.length)}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/55 text-white flex items-center justify-center hover:bg-black/75 cursor-pointer"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => setImgIdx(i => (i + 1) % imgs.length)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/55 text-white flex items-center justify-center hover:bg-black/75 cursor-pointer"
              >
                <ChevronRight size={18} />
              </button>
              <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-black/55 text-white text-[11px] font-semibold">
                {imgIdx + 1} / {imgs.length}
              </div>
            </>
          )}

          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/55 text-white flex items-center justify-center hover:bg-black/75 cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* ── Scrollable body ───────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto bg-nav">

          {/* Navy header content */}
          <div className="px-5 pt-5 pb-8">

            {/* Title + status chip */}
            <div className="flex items-start justify-between gap-3 mb-1.5">
              <h2 className="text-[20px] font-extrabold text-white leading-snug flex-1">
                {titleCase(listing.title)}
              </h2>
              <span
                className="inline-flex items-center px-3 py-1 rounded-full text-[12px] font-bold shrink-0 mt-0.5"
                style={{ background: chip.bg, color: chip.color }}
              >
                {chip.label}
              </span>
            </div>

            {/* Location */}
            <div className="flex items-center gap-1.5 text-[12px] mb-5" style={{ color: 'rgba(255,255,255,0.55)' }}>
              <MapPin size={12} />
              {listing.location}
            </div>

            {/* Rejection reason */}
            {listing.status === 'rejected' && (
              <div className="mb-3 rounded-xl px-4 py-3 text-[12.5px]" style={{ background: 'rgba(220,38,38,0.18)', color: '#fca5a5' }}>
                <span className="font-semibold">{t('listing_panel.rejected_label')} </span>
                {listing.rejection_reason ?? t('listing_panel.no_reason')}
                <div className="mt-1 text-[11.5px] opacity-80">
                  {t('listing_panel.edit_resubmit')}
                </div>
              </div>
            )}

            {/* Pending activity banners */}
            {isOwnerOrRealtor && listing.has_pending_deal_request && (
              <div className="mb-3 rounded-xl px-4 py-3" style={{ background: 'rgba(240,168,0,0.15)', border: '1px solid rgba(240,168,0,0.25)' }}>
                <div className="flex items-center gap-2 text-[12.5px] font-semibold" style={{ color: '#fbbf24' }}>
                  <Clock size={13} />
                  {t('listing_panel.deal_request_pending')}
                </div>
                <div className="mt-1 text-[11.5px]" style={{ color: 'rgba(251,191,36,0.7)' }}>
                  {t('listing_panel.deal_request_review')}
                </div>
              </div>
            )}
            {isOwnerOrRealtor && listing.has_pending_edit && (
              <div className="mb-3 rounded-xl px-4 py-3" style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)' }}>
                <div className="flex items-center gap-2 text-[12.5px] font-semibold" style={{ color: '#c4b5fd' }}>
                  <Clock size={13} />
                  {t('listing_panel.edit_pending')}
                </div>
                <div className="mt-1 text-[11.5px]" style={{ color: 'rgba(196,181,253,0.7)' }}>
                  {t('listing_panel.edit_pending_review')}
                </div>
              </div>
            )}

            {/* Divider */}
            <div className="border-t mb-5" style={{ borderColor: 'rgba(255,255,255,0.15)' }} />

            {/* Stats row: Views + Leads */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.15)' }}>
                  <Eye size={16} style={{ color: 'rgba(255,255,255,0.8)' }} />
                </div>
                <div>
                  <div className="text-[20px] font-extrabold text-white leading-tight">
                    {(listing.view_count ?? 0).toLocaleString()}
                  </div>
                  <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{t('listing_panel.views')}</div>
                </div>
              </div>
              <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.15)' }}>
                  <Users size={16} style={{ color: 'rgba(255,255,255,0.8)' }} />
                </div>
                <div>
                  <div className="text-[20px] font-extrabold text-white leading-tight">
                    {(listing.leads_count ?? 0).toLocaleString()}
                  </div>
                  <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{t('listing_panel.leads')}</div>
                </div>
              </div>
            </div>
          </div>

          {/* White floating card */}
          <div className="bg-paper rounded-t-3xl -mt-5 px-5 pt-6 pb-6 space-y-6 min-h-full">

            {/* Property Information */}
            <div>
              <div className="text-[10.5px] font-bold uppercase tracking-widest text-dim mb-4">
                {t('listing_panel.section_property_info')}
              </div>
              <div className="divide-y divide-line-soft">
                {propRows.map((row, ri) => (
                  <div key={ri} className="grid grid-cols-3 py-3.5 gap-2">
                    {row.map(({ Icon, label, value }) => (
                      <div key={label} className="flex items-start gap-2 min-w-0">
                        <div className="mt-0.5 shrink-0">
                          <Icon size={14} style={{ color: tone }} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[10.5px] text-dim leading-tight truncate">{label}</div>
                          <div className="text-[13.5px] font-bold text-ink mt-0.5 truncate">{String(value)}</div>
                        </div>
                      </div>
                    ))}
                    {row.length < 3 && Array.from({ length: 3 - row.length }).map((_, i) => (
                      <div key={`empty-${i}`} />
                    ))}
                  </div>
                ))}

                {listing.construction_status && (
                  <div className="py-3.5 flex items-center gap-2">
                    <CheckCircle2 size={14} style={{ color: tone }} />
                    <div>
                      <div className="text-[10.5px] text-dim">{t('listing_panel.section_construction')}</div>
                      <div className="text-[13.5px] font-bold text-ink capitalize">
                        {listing.construction_status.replace(/_/g, ' ')}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bool badges */}
            {boolBadges.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {boolBadges.map(b => (
                  <span
                    key={b.label}
                    className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
                  >
                    {b.label}
                  </span>
                ))}
              </div>
            )}

            {/* Features */}
            {listing.features?.length > 0 && (
              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-widest text-dim mb-3">{t('listing_panel.section_features')}</div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  {listing.features.map(f => (
                    <div key={f} className="flex items-center gap-2">
                      <CheckCircle2 size={14} style={{ color: tone }} className="shrink-0" />
                      <span className="text-[13px] text-ink">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {(() => {
              const tags = listing.tags?.length ? listing.tags : listing.tag ? [listing.tag] : []
              if (!tags.length) return null
              return (
                <div>
                  <div className="text-[10.5px] font-bold uppercase tracking-widest text-dim mb-3">{t('listing_panel.section_tags')}</div>
                  <div className="flex flex-wrap gap-2">
                    {tags.map(tag => (
                      <span key={tag} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold bg-white border border-line text-ink">
                        <Tag size={11} className="text-dim" />
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* What is Included (rent only) */}
            {listing.transaction === 'rent' && (listing.included_utilities?.length ?? 0) > 0 && (
              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-widest text-dim mb-3">{t('listing_panel.section_included')}</div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  {listing.included_utilities!.map(u => (
                    <div key={u} className="flex items-center gap-2">
                      <CheckCircle2 size={14} style={{ color: tone }} className="shrink-0" />
                      <span className="text-[13px] text-ink">{u}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Deposit (rent only) */}
            {listing.transaction === 'rent' && listing.deposit_policy && listing.deposit_policy !== 'none' && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-line-soft bg-paper2">
                <Calendar size={15} className="text-dim shrink-0" />
                <div>
                  <div className="text-[10.5px] text-dim">{t('listing_panel.section_deposit')}</div>
                  <div className="text-[13.5px] font-bold text-ink">
                    {DEPOSIT_LABELS[listing.deposit_policy] ?? listing.deposit_policy}
                  </div>
                </div>
              </div>
            )}

            {/* Owner PayPal payout email (daily rental only) */}
            {PAYPAL_ENABLED && listing.price_per_day != null && listing.owner_paypal_email && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-line-soft bg-paper2">
                <Mail size={15} className="text-dim shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10.5px] text-dim">Owner PayPal Payout Email</div>
                  <a
                    href={`mailto:${listing.owner_paypal_email}`}
                    className="text-[13.5px] font-bold text-ink hover:underline truncate block"
                  >
                    {listing.owner_paypal_email}
                  </a>
                </div>
              </div>
            )}

            {/* Utilities */}
            {listing.utilities && (
              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-widest text-dim mb-2">{t('listing_panel.section_utilities')}</div>
                {(() => {
                  const raw = listing.utilities!
                  const html = raw.trimStart().startsWith('<') ? raw : `<p>${raw}</p>`
                  const safe = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })
                  return <div className="detail-prose" dangerouslySetInnerHTML={{ __html: safe }} />
                })()}
              </div>
            )}

            {/* Video links */}
            {(listing.video_links?.length ?? 0) > 0 && (
              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-widest text-dim mb-3">{t('listing_panel.section_videos')}</div>
                <div className="space-y-2.5">
                  {listing.video_links!.map((url, i) => {
                    const safe = safeUrl(url)
                    if (!safe) return null
                    const embed = youtubeEmbedUrl(safe)
                    if (embed) {
                      return (
                        <div key={i} className="rounded-xl overflow-hidden aspect-video">
                          <iframe
                            src={embed}
                            className="w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            title={`Video ${i + 1}`}
                          />
                        </div>
                      )
                    }
                    return (
                      <a key={i} href={safe} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-line-soft bg-paper2 hover:bg-paper transition-colors text-[12.5px] font-semibold text-ink group">
                        <Video size={14} className="text-dim shrink-0 group-hover:text-ink" />
                        <span className="flex-1 truncate">{safe}</span>
                        <Link2 size={12} className="text-dim shrink-0" />
                      </a>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 3D Tour */}
            {listing.tour_3d_url && safeUrl(listing.tour_3d_url) && (
              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-widest text-dim mb-2">{t('listing_panel.section_3d_tour')}</div>
                <a
                  href={safeUrl(listing.tour_3d_url)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-line-soft bg-paper2 hover:bg-paper transition-colors text-[12.5px] font-semibold text-ink group"
                >
                  <Box size={14} className="text-dim shrink-0 group-hover:text-ink" />
                  <span className="flex-1 truncate">{safeUrl(listing.tour_3d_url)}</span>
                  <Link2 size={12} className="text-dim shrink-0" />
                </a>
              </div>
            )}

            {/* Maps URL */}
            {(() => {
              try {
                const u = new URL(listing.maps_url ?? '')
                if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
                return (
                  <div className="flex items-center gap-2 text-[12.5px]">
                    <Link2 size={13} className="text-dim shrink-0" />
                    <a href={u.href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">
                      {t('listing_panel.maps_link')}
                    </a>
                  </div>
                )
              } catch { return null }
            })()}

            {/* Deal of the Week badge */}
            {listing.is_deal && (
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl" style={{ background: '#f0a80018', border: '1px solid #f0a80030' }}>
                <Star size={14} fill="#f0a800" style={{ color: '#f0a800' }} />
                <div>
                  <div className="text-[12.5px] font-bold" style={{ color: '#c07800' }}>{t('listing_panel.deal_badge')}</div>
                  {listing.deal_discount_value != null && (
                    <div className="text-[11px]" style={{ color: '#c07800' }}>
                      {listing.deal_discount_type === 'fixed'
                        ? `−$${Number(listing.deal_discount_value).toLocaleString()} ${t('listing_panel.deal_off_price')}`
                        : `−${listing.deal_discount_value}% ${t('listing_panel.deal_off_price')}`}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Description */}
            {listing.description && (
              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-widest text-dim mb-2">{t('listing_panel.section_description')}</div>
                {(() => {
                  const raw  = listing.description
                  const html = raw.trimStart().startsWith('<') ? raw : `<p>${raw}</p>`
                  const safe = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })
                  return <div className="detail-prose" dangerouslySetInnerHTML={{ __html: safe }} />
                })()}
              </div>
            )}

            {/* Managing Realtor (owner view — only when a realtor submitted it) */}
            {role === 'owner' && !selfManaged && listing.submitted_by_name && (
              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-widest text-dim mb-3">Managing Realtor</div>
                <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-line-soft bg-paper2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full shrink-0 grid place-items-center" style={{ background: `${tone}18` }}>
                      <UserCircle size={18} style={{ color: tone }} />
                    </div>
                    <div>
                      <div className="text-[13.5px] font-bold text-ink">{listing.submitted_by_name}</div>
                      <div className="text-[11.5px] text-dim">Your assigned realtor</div>
                    </div>
                  </div>
                  {realtorCalendlyUrl && safeUrl(realtorCalendlyUrl) && (
                    <a
                      href={safeUrl(realtorCalendlyUrl)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white no-underline"
                      style={{ background: tone }}
                    >
                      <CalendarCheck size={13} /> Schedule Meeting
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Co-Listing */}
            {listing.co_listing_enabled && (
              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-widest text-dim mb-4">{t('listing_panel.section_co_listing')}</div>
                <div className="divide-y divide-line-soft">
                  {listing.co_listing_brokerage && (
                    <div className="py-3.5 flex items-start gap-2">
                      <Building2 size={14} style={{ color: tone }} className="shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-[10.5px] text-dim leading-tight truncate">{t('listing_panel.co_ext_brokerage')}</div>
                        <div className="text-[13.5px] font-bold text-ink mt-0.5 truncate">{listing.co_listing_brokerage}</div>
                      </div>
                    </div>
                  )}
                  {listing.co_listing_agent_name && (
                    <div className="py-3.5 flex items-start gap-2">
                      <Users size={14} style={{ color: tone }} className="shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-[10.5px] text-dim leading-tight truncate">{t('listing_panel.co_ext_agent')}</div>
                        <div className="text-[13.5px] font-bold text-ink mt-0.5 truncate">{listing.co_listing_agent_name}</div>
                      </div>
                    </div>
                  )}
                  {listing.co_listing_brokerage_email && (
                    <div className="py-3.5 flex items-start gap-2">
                      <Mail size={14} style={{ color: tone }} className="shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-[10.5px] text-dim leading-tight truncate">{t('listing_panel.co_brokerage_email')}</div>
                        <a href={`mailto:${listing.co_listing_brokerage_email}`} className="text-[13.5px] font-bold text-ink mt-0.5 truncate block hover:underline">{listing.co_listing_brokerage_email}</a>
                      </div>
                    </div>
                  )}
                  {listing.co_listing_brokerage_phone && (
                    <div className="py-3.5 flex items-start gap-2">
                      <Phone size={14} style={{ color: tone }} className="shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-[10.5px] text-dim leading-tight truncate">{t('listing_panel.co_brokerage_phone')}</div>
                        <a href={`tel:${listing.co_listing_brokerage_phone}`} className="text-[13.5px] font-bold text-ink mt-0.5 truncate block hover:underline">{listing.co_listing_brokerage_phone}</a>
                      </div>
                    </div>
                  )}
                  {listing.co_listing_commission_split != null && (
                    <div className="py-3.5 flex items-start gap-2">
                      <TrendingUp size={14} style={{ color: tone }} className="shrink-0 mt-0.5" />
                      <div>
                        <div className="text-[10.5px] text-dim leading-tight">{t('listing_panel.co_commission')}</div>
                        <div className="text-[13.5px] font-bold text-ink mt-0.5">{listing.co_listing_commission_split}%</div>
                      </div>
                    </div>
                  )}
                  {listing.co_listing_status && (() => {
                    const statusMap: Record<string, { bg: string; color: string; label: string }> = {
                      available: { bg: '#dbeafe', color: '#1d4ed8', label: t('listing_panel.co_status_available') },
                      active:    { bg: '#dcfce7', color: '#15803d', label: t('listing_panel.co_status_active')    },
                      closed:    { bg: '#f3f4f6', color: '#4b5563', label: t('listing_panel.co_status_closed')    },
                      cancelled: { bg: '#fee2e2', color: '#dc2626', label: t('listing_panel.co_status_cancelled') },
                    }
                    const chip = statusMap[listing.co_listing_status] ?? { bg: '#f3f4f6', color: '#4b5563', label: listing.co_listing_status }
                    return (
                      <div className="py-3.5 flex items-start gap-2">
                        <CheckCircle2 size={14} style={{ color: tone }} className="shrink-0 mt-0.5" />
                        <div>
                          <div className="text-[10.5px] text-dim leading-tight">{t('listing_panel.co_status')}</div>
                          <span
                            className="inline-flex items-center mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold"
                            style={{ background: chip.bg, color: chip.color }}
                          >
                            {chip.label}
                          </span>
                        </div>
                      </div>
                    )
                  })()}
                  {listing.co_listing_agreement_accepted && (
                    <div className="py-3.5 flex items-start gap-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.5" className="shrink-0 mt-0.5"><polyline points="20 6 9 17 4 12"/></svg>
                      <div>
                        <div className="text-[10.5px] text-dim leading-tight">{t('listing_panel.co_terms')}</div>
                        <div className="text-[13.5px] font-bold mt-0.5" style={{ color: '#15803d' }}>Accepted</div>
                      </div>
                    </div>
                  )}
                  {listing.co_listing_agreement_url && (
                    <div className="py-3.5 flex items-start gap-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500 shrink-0 mt-0.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      <div>
                        <div className="text-[10.5px] text-dim leading-tight">{t('listing_panel.co_agreement_pdf')}</div>
                        <a href={listing.co_listing_agreement_url} target="_blank" rel="noopener noreferrer"
                          className="text-[13px] text-blue-600 underline font-semibold mt-0.5 inline-block">
                          View PDF
                        </a>
                      </div>
                    </div>
                  )}
                  {listing.co_listing_notes && (
                    <div className="py-3.5 flex items-start gap-2">
                      <FileText size={14} style={{ color: tone }} className="shrink-0 mt-0.5" />
                      <div>
                        <div className="text-[10.5px] text-dim leading-tight mb-1">{t('listing_panel.co_notes')}</div>
                        <div className="text-[13px] text-ink whitespace-pre-line">{listing.co_listing_notes}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Deal request form (above footer) ─────────────────────────── */}
        {canRequestDeal && dealOpen && (
          <div className="border-t border-amber-200 bg-amber-50/80 px-5 py-4 shrink-0 space-y-3">
            <div className="text-[12px] font-semibold" style={{ color: '#c07800' }}>{t('listing_panel.request_deal_title')}</div>

            {/* Discount type toggle */}
            <div className="flex rounded-lg border border-line overflow-hidden text-[12px] font-semibold bg-white">
              {(['pct', 'fixed'] as const).map(dtype => (
                <button
                  key={dtype}
                  onClick={() => { setDiscountType(dtype); setDiscountValue('') }}
                  className="flex-1 py-1.5 cursor-pointer transition-colors"
                  style={discountType === dtype
                    ? { background: '#f0a800', color: 'white', border: 'none' }
                    : { color: '#6b7280', border: 'none', background: 'transparent' }
                  }
                >
                  {dtype === 'pct' ? t('listing_panel.pct_off') : t('listing_panel.fixed_usd')}
                </button>
              ))}
            </div>

            <div>
              <label className="text-[11px] text-dim block mb-1">
                {discountType === 'pct' ? t('listing_panel.discount_pct_label') : t('listing_panel.discount_fixed_label')}
              </label>
              <div className="flex items-center gap-2">
                {discountType === 'fixed' && <span className="text-[13px] font-bold text-dim shrink-0">$</span>}
                <input
                  type="number"
                  min="1"
                  max={discountType === 'pct' ? 99 : undefined}
                  step={discountType === 'pct' ? 0.5 : 1000}
                  value={discountValue}
                  onChange={e => setDiscountValue(e.target.value)}
                  placeholder={discountType === 'pct' ? 'e.g. 10' : 'e.g. 25000'}
                  className="flex-1 px-3 py-2 rounded-lg border border-line bg-white text-[12.5px] text-ink outline-none focus:border-amber-400"
                />
                {discountType === 'pct' && <span className="text-[13px] font-bold text-dim shrink-0">% off</span>}
              </div>
            </div>

            <div>
              <label className="text-[11px] text-dim block mb-1">{t('listing_panel.message_admin')}</label>
              <textarea
                value={dealMessage}
                onChange={e => setDealMessage(e.target.value)}
                placeholder={t('listing_panel.message_ph')}
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-line bg-white text-[12.5px] text-ink outline-none focus:border-amber-400 resize-none"
              />
            </div>
            <button
              onClick={handleDealSubmit}
              disabled={!discountValue || submitting}
              className="w-full py-2 rounded-lg text-[12.5px] font-bold text-white cursor-pointer disabled:opacity-50 border-0"
              style={{ background: '#f0a800' }}
            >
              {submitting ? t('listing_panel.submitting') : t('listing_panel.submit_request')}
            </button>
          </div>
        )}

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <div className="border-t border-line px-5 py-4 flex flex-wrap gap-3 shrink-0 bg-paper">
          {canOpenPerformance && <ListingPerformanceAction listingId={listing.id} />}
          {role === 'owner' && !selfManaged && realtorCalendlyUrl && safeUrl(realtorCalendlyUrl) && (
            <a
              href={safeUrl(realtorCalendlyUrl)!}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-bold text-white no-underline"
              style={{ background: tone }}
            >
              <CalendarCheck size={14} /> Schedule Meeting
            </a>
          )}
          {onEdit && (
            <button
              onClick={onEdit}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-bold text-white cursor-pointer"
              style={{ background: tone }}
            >
              <Pencil size={14} /> {t('listing_panel.edit_listing')}
            </button>
          )}
          {canRequestDeal && (
            <button
              onClick={() => { setDealOpen(v => !v); setDiscountValue(''); setDealMessage('') }}
              title={t('listing_panel.request_deal_title')}
              className="w-10 h-10 flex items-center justify-center rounded-xl border cursor-pointer transition-colors"
              style={dealOpen
                ? { background: '#f0a800', borderColor: '#f0a800', color: 'white' }
                : { background: '#f0a80012', borderColor: '#f0a80050', color: '#c07800' }
              }
            >
              <Star size={15} />
            </button>
          )}
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-[13px] font-semibold text-ink border border-line bg-paper cursor-pointer"
          >
            {t('listing_panel.close')}
          </button>
        </div>
      </div>
    </>
  )
}
