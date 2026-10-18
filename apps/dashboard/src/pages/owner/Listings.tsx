import { useState, useEffect, useRef } from 'react'
import {
  Building2, Plus, Search, MoreHorizontal, Home, Pencil, Trash2, EyeOff, MapPin, Star, Clock, MessageCircle, X, UserCircle, CalendarCheck,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getMyListingsPage, type Listing } from '../../api/listings'
import { ListingDetailPanel } from '../../components/listings/ListingDetailPanel'
import { OwnerSubmitListing } from './SubmitListing'
import { submitLead } from '../../api/leads'
import { getMe, getMyAgent } from '../../api/auth'
import type { UserInfo } from '../../lib/auth'
import { useListingSetup } from '../../components/dashboard/SetupBanners'
import toast from 'react-hot-toast'

function pageWindow(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = new Set([1, total, current - 1, current, current + 1])
  const sorted = [...pages].filter(p => p >= 1 && p <= total).sort((a, b) => a - b)
  const out: (number | '…')[] = []
  let prev = 0
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push('…')
    out.push(p)
    prev = p
  }
  return out
}

function PaginationBar({
  page, totalPages, total, pageSize, tone, border, onPrev, onNext, onSetPage,
}: {
  page: number; totalPages: number; total: number; pageSize: number; tone: string
  border: 'border-b' | 'border-t'
  onPrev: () => void; onNext: () => void; onSetPage: (p: number) => void
}) {
  const { t } = useTranslation('owner')
  return (
    <div className={`flex items-center justify-between gap-3 flex-wrap px-4 sm:px-5.5 py-3.5 ${border} border-line`}>
      <span className="text-[12px] text-dim">
        {t('listings_page.showing_range', {
          from: total === 0 ? 0 : (page - 1) * pageSize + 1,
          to: Math.min(page * pageSize, total),
          total,
        })}
      </span>
      {totalPages > 1 && (
        <div className="flex items-center gap-1.5">
          <button
            disabled={page <= 1}
            onClick={onPrev}
            className="py-1.5 px-3 rounded-lg border border-line bg-paper text-ink text-[12px] font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('listings_page.prev')}
          </button>
          {pageWindow(page, totalPages).map((p, i) =>
            p === '…' ? (
              <span key={`e${i}`} className="px-1 text-dim text-[12px]">…</span>
            ) : (
              <button
                key={p}
                onClick={() => onSetPage(p)}
                className="w-8 h-8 rounded-lg text-[12px] font-semibold cursor-pointer"
                style={{
                  background: p === page ? tone : 'transparent',
                  color: p === page ? '#fff' : '#33425f',
                  border: `1px solid ${p === page ? tone : '#e4ddcf'}`,
                }}
              >
                {p}
              </button>
            )
          )}
          <button
            disabled={page >= totalPages}
            onClick={onNext}
            className="py-1.5 px-3 rounded-lg border border-line bg-paper text-ink text-[12px] font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('listings_page.next')}
          </button>
        </div>
      )}
    </div>
  )
}

const STATUS_MAP: Record<string, { label: string; bg: string; color: string; filter: string }> = {
  active:           { label: 'Active',   bg: '#dcfce7', color: '#15803d', filter: 'Active'   },
  pending_approval: { label: 'Review',   bg: '#fef9c3', color: '#a16207', filter: 'Review'   },
  rejected:         { label: 'Rejected', bg: '#fee2e2', color: '#b91c1c', filter: 'Rejected' },
  archived:         { label: 'Archived', bg: '#f3f4f6', color: '#6b7280', filter: 'Archived' },
}

function fmtPrice(price: number): string {
  if (price >= 1_000_000_000_000) return `$${(price / 1_000_000_000_000).toFixed(2)}T`
  if (price >= 1_000_000_000)     return `$${(price / 1_000_000_000).toFixed(2)}B`
  if (price >= 1_000_000)         return `$${(price / 1_000_000).toFixed(2)}M`
  if (price >= 1_000)             return `$${Math.round(price / 1_000)}K`
  return `$${price}`
}

function fmtListingPrice(l: Listing) {
  if (l.transaction === 'rent') {
    const parts = []
    if (l.price_per_day)   parts.push(`$${Number(l.price_per_day).toLocaleString()}/day`)
    if (l.price_per_month) parts.push(`$${Number(l.price_per_month).toLocaleString()}/mo`)
    if (parts.length) return parts.join(' · ')
  }
  return fmtPrice(Number(l.price))
}

function fmtType(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

function fmtRelative(dateStr: string | null | undefined, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)    return t('rel.just_now')
  if (mins < 60)   return t('rel.mins_ago', { count: mins })
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)    return t('rel.hrs_ago', { count: hrs })
  const days = Math.floor(hrs / 24)
  if (days < 30)   return t('rel.days_ago', { count: days })
  const months = Math.floor(days / 30)
  if (months < 12) return t('rel.months_ago', { count: months })
  return t('rel.years_ago', { count: Math.floor(months / 12) })
}

const titleCase = (s: string) =>
  s === s.toUpperCase() ? s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : s

function StatusChip({ status }: { status: string }) {
  const { t } = useTranslation('common')
  const s = STATUS_MAP[status] ?? { label: status, bg: '#f3f4f6', color: '#6b7280' }
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ background: s.bg, color: s.color }}
    >
      {t(`status_labels.${status}`, { defaultValue: s.label })}
    </span>
  )
}

function RequestChangeModal({ listing, onClose }: { listing: Listing; onClose: () => void }) {
  const { t } = useTranslation('owner')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    getMe().catch(() => {})
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim()) return
    setSubmitting(true)
    try {
      const me = await getMe()
      await submitLead({
        type: 'seller_interest',
        name: me.display_name,
        email: me.email,
        phone: me.phone,
        property_id: listing.id,
        message: message.trim(),
      })
      toast.success(t('listings_page.toast_request_sent'))
      onClose()
    } catch {
      toast.error(t('listings_page.toast_error'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-paper rounded-2xl shadow-2xl w-full max-w-sm">
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-line">
            <div>
              <div className="text-[15px] font-bold text-ink">{t('listings_page.request_change_title')}</div>
              <div className="text-[11.5px] text-dim truncate max-w-55">{listing.title}</div>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-line-soft cursor-pointer border-0 bg-transparent shrink-0">
              <X size={15} className="text-dim" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={4}
              placeholder={t('listings_page.describe_change_ph')}
              autoFocus
              className="w-full px-3 py-2.5 rounded-xl border border-line bg-white text-[13px] text-ink outline-none resize-none placeholder:text-dim"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-line text-[13px] font-semibold text-ink2 cursor-pointer hover:bg-line-soft bg-transparent"
              >
                {t('listings_page.cancel')}
              </button>
              <button
                type="submit"
                disabled={submitting || !message.trim()}
                className="flex-1 py-2.5 rounded-xl border-0 text-[13px] font-bold text-white cursor-pointer disabled:opacity-60"
                style={{ background: '#f0a800' }}
              >
                {submitting ? t('listings_page.sending') : t('listings_page.send_request')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

function ActionMenu({ onRequestDeal, onRequestChange, onEdit }: { onRequestDeal?: () => void; onRequestChange: () => void; onEdit?: () => void }) {
  const { t } = useTranslation('owner')
  const [open, setOpen] = useState(false)
  const [pos,  setPos]  = useState({ top: 0, left: 0 })
  const btnRef  = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current  && !btnRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 6, left: r.right - 144 })
    }
    setOpen(v => !v)
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-dim hover:text-ink hover:bg-line/50 transition-colors cursor-pointer"
      >
        <MoreHorizontal size={15} />
      </button>
      {open && (
        <div
          ref={menuRef}
          className="fixed w-44 bg-paper rounded-xl border border-line shadow-lg z-50 overflow-hidden"
          style={{ top: pos.top, left: pos.left }}
        >
          {onEdit && (
            <button
              onClick={() => { onEdit(); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3.5 py-2.5 text-xs hover:bg-amber-50 transition-colors cursor-pointer"
              style={{ color: '#c07800' }}
            >
              <Pencil size={12} /> {t('listings_page.edit_listing')}
            </button>
          )}
          <button
            onClick={() => { onRequestChange(); setOpen(false) }}
            className="w-full flex items-center gap-2 px-3.5 py-2.5 text-xs hover:bg-amber-50 transition-colors cursor-pointer"
            style={{ color: '#c07800' }}
          >
            <MessageCircle size={12} /> {t('listings_page.request_change')}
          </button>
          {onRequestDeal && (
            <button
              onClick={() => { onRequestDeal(); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3.5 py-2.5 text-xs hover:bg-amber-50 transition-colors cursor-pointer"
              style={{ color: '#c07800' }}
            >
              <Star size={12} /> {t('listings_page.deal_of_week')}
            </button>
          )}
          <button
            onClick={() => setOpen(false)}
            className="w-full flex items-center gap-2 px-3.5 py-2.5 text-xs text-ink hover:bg-line/40 transition-colors cursor-pointer"
          >
            <EyeOff size={12} /> {t('listings_page.hide_listing')}
          </button>
          <div className="border-t border-line" />
          <button
            onClick={() => setOpen(false)}
            className="w-full flex items-center gap-2 px-3.5 py-2.5 text-xs text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
          >
            <Trash2 size={12} /> {t('listings_page.delete_listing')}
          </button>
        </div>
      )}
    </>
  )
}

function PendingReviewsCard({ items, tone, onSelect }: { items: Listing[]; tone: string; onSelect: (l: Listing) => void }) {
  const { t } = useTranslation('owner')
  return (
    <div className="bg-paper border border-line rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-line">
        <div className="flex items-center gap-2 text-[14px] font-bold text-ink">
          <Clock size={14} className="text-dim" />
          {t('listings_page.pending_reviews')}
        </div>
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ color: tone, background: `${tone}18` }}>
          {items.length}
        </span>
      </div>
      <div className="divide-y divide-line-soft">
        {items.map(l => (
          <button
            key={l.id}
            onClick={() => onSelect(l)}
            className="w-full text-left px-4 py-3 hover:bg-line-soft/40 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5 mb-1.5">
              {l.images?.[0] ? (
                <img src={l.images[0]} alt="" className="w-10 h-7 rounded-md object-cover shrink-0" />
              ) : (
                <div className="w-10 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: `${tone}18` }}>
                  <Home size={12} style={{ color: tone }} />
                </div>
              )}
              <div className="text-[12.5px] font-semibold text-ink truncate">{titleCase(l.title)}</div>
            </div>
            <div className="flex flex-col gap-1 pl-0.5">
              {l.has_pending_deal_request && (
                <div className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: '#c07800' }}>
                  <Star size={10} fill="#f0a800" style={{ color: '#f0a800' }} />
                  {t('listings_page.deal_request_pending')}
                </div>
              )}
              {l.has_pending_edit && (
                <div className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: '#7c3aed' }}>
                  <Pencil size={10} />
                  {t('listings_page.edit_pending')}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

const COLS    = 'grid-cols-[2fr_0.8fr_1fr_1fr_0.7fr_0.7fr_1fr_1fr_40px]'
const FILTERS = ['All', 'Active', 'Review', 'Rejected', 'Archived'] as const
const PAGE_SIZE = 50

// UI filter pill -> the DB status value it maps to (inverse of STATUS_MAP's `filter` field)
function filterToStatus(f: string): string | undefined {
  if (f === 'All') return undefined
  if (f === 'Review') return 'pending_approval'
  return f.toLowerCase()
}

export function OwnerListings({ tone, go, user }: { tone: string; go: (v: string) => void; user: UserInfo }) {
  const { t } = useTranslation('owner')
  // Same rule as the setup banners and every other "add listing" button.
  const { canAddListings, blockedReason } = useListingSetup(user, 'owner')
  const [mainItems, setMainItems] = useState<Listing[]>([])
  const [mainTotal, setMainTotal] = useState(0)
  const [pendingReviews, setPendingReviews] = useState<Listing[]>([])
  const [page,     setPage]     = useState(1)
  const [agent, setAgent] = useState<{ name: string; email: string; phone: string | null; calendly_url: string | null } | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [tableLoading, setTableLoading] = useState(true)
  const [loadingAgent, setLoadingAgent] = useState(true)
  const [filter,   setFilter]   = useState<typeof FILTERS[number]>('All')
  const [query,    setQuery]    = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [selected,  setSelected]  = useState<Listing | null>(null)
  const [openDeal,  setOpenDeal]  = useState(false)
  const [requestChangeListing, setRequestChangeListing] = useState<Listing | null>(null)
  const [editTarget, setEditTarget] = useState<Listing | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const statusParam = filterToStatus(filter)

  async function loadMainTable() {
    setTableLoading(true)
    const res = await getMyListingsPage({ page, pageSize: PAGE_SIZE, status: statusParam, q: debouncedQuery.trim() || undefined })
    setMainItems(res.items)
    setMainTotal(res.total)
    setTableLoading(false)
  }

  async function load() {
    setLoading(true)
    const reviewRes = await getMyListingsPage({ pendingReview: true, pageSize: 200 })
    setPendingReviews(reviewRes.items)
    setLoading(false)
    await loadMainTable()
  }

  useEffect(() => {
    load()
    getMyAgent().then(d => {
      if (d.realtor_name) setAgent({ name: d.realtor_name, email: d.realtor_email ?? '', phone: d.realtor_phone ?? null, calendly_url: d.realtor_calendly_url ?? null })
    }).catch(() => {}).finally(() => setLoadingAgent(false))
    getMe().then(me => setCurrentUserId(me.id)).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const didMountTable = useRef(false)
  useEffect(() => {
    if (!didMountTable.current) { didMountTable.current = true; return }
    loadMainTable()
  }, [page, filter, debouncedQuery]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 350)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, debouncedQuery])

  const totalPages = Math.max(1, Math.ceil(mainTotal / PAGE_SIZE))
  const isEmptyOverall = mainTotal === 0 && filter === 'All' && !debouncedQuery.trim()

  if (editTarget) {
    return (
      <OwnerSubmitListing
        go={go}
        tone={tone}
        listing={editTarget}
        isAdmin={user.role === 'admin'}
        onBack={() => { setEditTarget(null); load() }}
      />
    )
  }

  return (
    <>
      {/* Agent Banner */}
      <div className="flex items-center gap-3 bg-paper border border-line rounded-2xl px-4 py-3.5 mb-4">
        {loadingAgent ? (
          <div className="flex items-center gap-3 animate-pulse w-full">
            <div className="w-9 h-9 rounded-full bg-line-soft shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-line-soft rounded w-24" />
              <div className="h-3.5 bg-line-soft rounded w-36" />
            </div>
          </div>
        ) : agent ? (
          <div className="flex items-center justify-between gap-3 w-full">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-full shrink-0 grid place-items-center font-bold text-[13px] text-white"
                style={{ background: tone }}
              >
                {agent.name[0].toUpperCase()}
              </div>
              <div>
                <div className="text-[11.5px] text-dim font-medium">{t('listings_page.your_agent')}</div>
                <div className="text-[13.5px] font-bold text-ink">{agent.name}</div>
                <div className="text-[11.5px] text-dim">{agent.email}{agent.phone ? ` · ${agent.phone}` : ''}</div>
              </div>
            </div>
            {agent.calendly_url && /^https?:\/\//i.test(agent.calendly_url) && (
              <a
                href={agent.calendly_url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold text-white no-underline"
                style={{ background: tone }}
              >
                <CalendarCheck size={13} /> {t('listings_page.schedule_meeting')}
              </a>
            )}
          </div>
        ) : (
          <>
            <div className="w-9 h-9 rounded-full shrink-0 grid place-items-center" style={{ background: `${tone}18` }}>
              <UserCircle size={18} style={{ color: tone }} />
            </div>
            <div>
              <div className="text-[11.5px] text-dim font-medium">{t('listings_page.your_agent')}</div>
              <div className="text-[13px] text-ink2">{t('listings_page.agent_unassigned')}</div>
            </div>
          </>
        )}
      </div>

      <div className={pendingReviews.length > 0 ? 'flex flex-col gap-5 xl:flex-row xl:items-start' : ''}>
      <div className={`bg-paper border border-line rounded-2xl overflow-hidden${pendingReviews.length > 0 ? ' flex-1 min-w-0' : ''}`}>

        {/* Toolbar */}
        <div className="px-4 sm:px-5.5 py-4 border-b border-line space-y-3">
          <div className="font-sans text-[17px] font-bold text-ink">
            {t('listings_page.title')}
            {!loading && <span className="ml-2 text-[13px] font-normal text-dim">({mainTotal})</span>}
          </div>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-line bg-white w-55">
                <Search size={13} className="text-dim" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={t('listings_page.search_ph')}
                  className="text-xs border-0 outline-none bg-transparent text-ink placeholder:text-dim flex-1"
                />
              </div>
              <button
                onClick={() => canAddListings && go('submit-listing')}
                disabled={!canAddListings}
                title={blockedReason}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12.5px] font-semibold text-white shrink-0 border-0 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                style={{ background: tone }}
              >
                <Plus size={13} /> {t('listings_page.add_listing')}
              </button>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {FILTERS.map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className="py-1 px-3 rounded-full text-[11.5px] font-semibold cursor-pointer transition-colors"
                  style={{
                    border:     `1px solid ${filter === f ? tone : '#e4ddcf'}`,
                    background: filter === f ? tone : 'transparent',
                    color:      filter === f ? '#fff' : '#33425f',
                  }}
                >
                  {t(`listings_page.filter_${f.toLowerCase()}`)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Pagination (top) */}
        {!loading && !tableLoading && mainTotal > 0 && (
          <PaginationBar
            page={page} totalPages={totalPages} total={mainTotal} pageSize={PAGE_SIZE} tone={tone} border="border-b"
            onPrev={() => setPage(p => p - 1)} onNext={() => setPage(p => p + 1)} onSetPage={setPage}
          />
        )}

        {/* Desktop table header */}
        <div className={`hidden sm:grid ${COLS} px-5.5 py-2.5 border-b border-line bg-nav/5`}>
          {[t('listings_page.header_property'), t('listings_page.header_type'), t('listings_page.header_price'), t('listings_page.header_status'), t('listings_page.header_views'), t('listings_page.header_leads'), t('listings_page.header_realtor'), t('listings_page.header_updated'), ''].map((h, i) => (
            <div key={i} className="text-[11px] font-bold uppercase tracking-[.07em] text-dim">{h}</div>
          ))}
        </div>

        {/* Body */}
        {loading || tableLoading ? (
          <div className="divide-y divide-line-soft">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5.5 py-4 animate-pulse flex items-center gap-3">
                <div className="w-14 h-9 rounded-lg bg-line-soft shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-line-soft rounded w-1/3" />
                  <div className="h-3 bg-line-soft rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : isEmptyOverall ? (
          <div className="py-14 flex flex-col items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: `${tone}18` }}
            >
              <Building2 size={26} style={{ color: tone }} />
            </div>
            <div className="text-center">
              <div className="text-[15px] font-semibold text-ink mb-1">{t('listings_page.empty_title')}</div>
              <div className="text-xs text-dim max-w-55">
                {t('listings_page.empty_sub')}
              </div>
            </div>
            <button
              onClick={() => canAddListings && go('submit-listing')}
              disabled={!canAddListings}
              title={blockedReason}
              className="px-5 py-2 rounded-full text-[12.5px] font-bold text-white border-0 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              style={{ background: tone }}
            >
              {t('listings_page.list_property_btn')}
            </button>
          </div>
        ) : mainItems.length === 0 ? (
          <div className="py-12 text-center text-sm text-dim">
            {query.trim() ? t('listings_page.no_results', { query }) : t('listings_page.no_filter_listings', { filter: filter.toLowerCase() })}
          </div>
        ) : (
          <div className="divide-y divide-line-soft">
            {mainItems.map(l => (
              <div key={l.id}>
                {/* Desktop row */}
                <div
                  className={`hidden sm:grid ${COLS} items-center px-5.5 py-3.5 cursor-pointer hover:bg-line-soft/40 transition-colors`}
                  onClick={() => setSelected(l)}
                >
                  {/* Property */}
                  <div className="flex items-center gap-3 min-w-0 pr-4">
                    {l.images?.[0] ? (
                      <img src={l.images[0]} alt={l.title} className="w-14 h-9 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-14 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${tone}18` }}>
                        <Home size={16} style={{ color: tone }} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-ink truncate">{titleCase(l.title)}</div>
                      <div className="text-[11px] text-dim flex items-center gap-1 truncate"><MapPin size={9} />{l.location}</div>
                    </div>
                  </div>
                  {/* Type */}
                  <div className="text-[12px] text-ink2">{fmtType(l.type)}</div>
                  {/* Price */}
                  <div className="text-[13px] font-semibold text-ink">{fmtListingPrice(l)}</div>
                  {/* Status */}
                  <div><StatusChip status={l.status} /></div>
                  {/* Views */}
                  <div className="text-[12px] text-ink2">{l.view_count.toLocaleString()}</div>
                  {/* Leads */}
                  <div className="text-[12px] text-ink2">{l.leads_count.toLocaleString()}</div>
                  {/* Realtor */}
                  <div className="text-[12px] truncate" style={{ color: (!l.submitted_by_name || l.submitted_by === currentUserId) ? '#94a3b8' : tone }}>
                    {(!l.submitted_by_name || l.submitted_by === currentUserId) ? t('listings_page.unassigned') : l.submitted_by_name}
                  </div>
                  {/* Updated */}
                  <div className="text-[12px] text-ink2">{fmtRelative(l.updated_at, t)}</div>
                  {/* Actions */}
                  <div onClick={e => e.stopPropagation()}>
                    <ActionMenu
                      onRequestChange={() => setRequestChangeListing(l)}
                      onRequestDeal={l.status === 'active' && !l.is_deal ? () => { setSelected(l); setOpenDeal(true) } : undefined}
                      onEdit={l.submitted_by === currentUserId ? () => setEditTarget(l) : undefined}
                    />
                  </div>
                </div>

                {/* Mobile card */}
                <div
                  className="sm:hidden px-4 py-3.5 cursor-pointer"
                  onClick={() => setSelected(l)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {l.images?.[0] ? (
                        <img src={l.images[0]} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${tone}18` }}>
                          <Home size={14} style={{ color: tone }} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-[13.5px] font-semibold text-ink truncate">{titleCase(l.title)}</div>
                        <div className="text-[11px] text-dim flex items-center gap-1 truncate"><MapPin size={9} />{l.location}</div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <StatusChip status={l.status} />
                      <div className="text-[11px] text-dim">{fmtListingPrice(l)}</div>
                    </div>
                  </div>
                  <div className="text-[11px] text-dim mt-2">
                    {fmtType(l.type)} · {l.view_count} {t('listings.views')} · {l.leads_count} {t('listings.leads')} · {(l.submitted_by_name && l.submitted_by !== currentUserId) ? `${t('listings_page.header_realtor')}: ${l.submitted_by_name}` : t('listings_page.no_realtor')} · {t('listings_page.header_updated')} {fmtRelative(l.updated_at, t)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination (bottom) */}
        {!loading && !tableLoading && mainTotal > 0 && (
          <PaginationBar
            page={page} totalPages={totalPages} total={mainTotal} pageSize={PAGE_SIZE} tone={tone} border="border-t"
            onPrev={() => setPage(p => p - 1)} onNext={() => setPage(p => p + 1)} onSetPage={setPage}
          />
        )}
      </div>

      {pendingReviews.length > 0 && (
        <div className="xl:w-64 shrink-0">
          <PendingReviewsCard items={pendingReviews} tone={tone} onSelect={l => setSelected(l)} />
        </div>
      )}
      </div>

      {selected && (
        <ListingDetailPanel
          listing={selected}
          tone={tone}
          role="owner"
          openDeal={openDeal}
          realtorCalendlyUrl={agent?.calendly_url ?? null}
          selfManaged={selected.submitted_by === currentUserId}
          onEdit={selected.submitted_by === currentUserId
            ? () => { setSelected(null); setOpenDeal(false); setEditTarget(selected) }
            : undefined}
          onClose={() => { setSelected(null); setOpenDeal(false) }}
        />
      )}

      {requestChangeListing && (
        <RequestChangeModal
          listing={requestChangeListing}
          onClose={() => setRequestChangeListing(null)}
        />
      )}
    </>
  )
}
