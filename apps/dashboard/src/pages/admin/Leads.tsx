import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ClipboardList, Search } from 'lucide-react'
import { getAdminLeads, type Lead } from '../../api/leads'
import { getAdminAgents, type AdminAgent } from '../../api/admin'
import { TONE, FilterPills } from './shared'
import { LeadDetailPanel } from '../../components/admin/LeadDetailPanel'
import { parsePhone } from '../../utils/phone'

const TYPE_LABEL: Record<string, string> = {
  property_inquiry: 'Inquiry',
  booking: 'Booking',
  buyer_interest: 'Buyer',
  seller_interest: 'Seller',
  rental_interest: 'Renter',
  owner_access: 'Owner Access',
}

const TYPE_COLOR: Record<string, string> = {
  property_inquiry: '#1f7a3d',
  booking: '#0d9488',
  buyer_interest: '#e10f1f',
  seller_interest: '#f0a800',
  rental_interest: '#006BFF',
  owner_access: '#7c3aed',
}

function effectiveType(lead: Lead): string {
  if (lead.type === 'seller_interest' && !lead.property_id) return 'owner_access'
  return lead.type
}

const STATUS_LABEL: Record<string, string> = {
  new: 'New',
  assigned: 'Assigned',
  contacted: 'Contacted',
  closed: 'Closed',
}

const STATUS_COLOR: Record<string, string> = {
  new: '#64748b',
  assigned: '#0d9488',
  contacted: '#1f7a3d',
  closed: '#94a3b8',
}

const TYPE_PILLS  = ['All', 'Inquiry', 'Booking', 'Buyer', 'Seller', 'Renter', 'Owner Access'] as const
const STATUS_PILLS = ['All', 'New', 'Assigned', 'Contacted', 'Closed'] as const

const TYPE_PILL_MAP: Record<string, string> = {
  Inquiry:       'property_inquiry',
  Booking:       'booking',
  Buyer:         'buyer_interest',
  Seller:        'seller_interest',
  Renter:        'rental_interest',
  'Owner Access': 'owner_access',
}
const STATUS_PILL_MAP: Record<string, string> = {
  New: 'new', Assigned: 'assigned', Contacted: 'contacted', Closed: 'closed',
}

const COLS = 'grid-cols-[100px_1fr_1fr_1.2fr_160px_56px_110px]'

function fmtUserCode(code: string | null): string {
  if (!code) return ''
  return '#' + code.padStart(7, '0')
}

function LeadAvatar({ name, avatarUrl, color }: { name: string; avatarUrl: string | null; color: string }) {
  const [imgError, setImgError] = useState(false)
  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className="w-8 h-8 rounded-full object-cover shrink-0"
      />
    )
  }
  return (
    <div className="w-8 h-8 rounded-full grid place-items-center text-white text-xs font-bold shrink-0" style={{ background: color }}>
      {name[0]?.toUpperCase() ?? '?'}
    </div>
  )
}

function fmtRelative(iso: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return t('rel.just_now')
  if (m < 60) return t('rel.mins_ago', { count: m })
  const h = Math.floor(m / 60)
  if (h < 24) return t('rel.hrs_ago', { count: h })
  const d = Math.floor(h / 24)
  if (d < 30) return t('rel.days_ago', { count: d })
  return t('rel.months_ago', { count: Math.floor(d / 30) })
}

function TypeBadge({ lead }: { lead: Lead }) {
  const { t } = useTranslation('admin')
  const etype = effectiveType(lead)
  const color = TYPE_COLOR[etype] ?? '#64748b'
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold"
      style={{ background: `${color}18`, color }}
    >
      {t(`lead_panel.type_${etype}`, { defaultValue: TYPE_LABEL[etype] ?? etype })}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation('admin')
  const color = STATUS_COLOR[status] ?? '#64748b'
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ background: `${color}18`, color }}
    >
      {t(`lead_panel.status_${status}`, { defaultValue: STATUS_LABEL[status] ?? status })}
    </span>
  )
}

const BOOKING_STATUS_COLOR: Record<string, string> = {
  pending:   '#d97706',
  confirmed: '#1f7a3d',
  cancelled: '#64748b',
}

function BookingStatusBadge({ status }: { status: string | null }) {
  const s = status ?? 'pending'
  const color = BOOKING_STATUS_COLOR[s] ?? '#64748b'
  const label = s.charAt(0).toUpperCase() + s.slice(1)
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ background: `${color}18`, color }}
    >
      {label}
    </span>
  )
}

function LeadStatusBadge({ lead }: { lead: Lead }) {
  if (lead.type === 'booking') return <BookingStatusBadge status={lead.booking_status} />
  return <StatusBadge status={lead.status} />
}


export function AdminLeads() {
  const { t } = useTranslation('admin')
  const [leads,        setLeads]        = useState<Lead[]>([])
  const [realtors,     setRealtors]     = useState<AdminAgent[]>([])
  const [loading,      setLoading]      = useState(true)
  const [typeFilter,   setTypeFilter]   = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [query,        setQuery]        = useState('')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    Promise.all([
      getAdminLeads(),
      getAdminAgents(),
    ]).then(([l, r]) => {
      setLeads(l)
      setRealtors(r)
    }).catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const openId = searchParams.get('openId')
    if (!openId || leads.length === 0) return
    const lead = leads.find(l => l.id === openId)
    if (lead) {
      setSelectedLead(lead)
      setSearchParams({}, { replace: true })
    }
  }, [leads, searchParams])

  const filtered = leads.filter(l => {
    if (typeFilter !== 'All' && effectiveType(l) !== TYPE_PILL_MAP[typeFilter]) return false
    if (statusFilter !== 'All' && l.status !== STATUS_PILL_MAP[statusFilter]) return false
    if (query.trim()) {
      const q = query.toLowerCase()
      return (
        l.name.toLowerCase().includes(q) ||
        (l.email?.toLowerCase().includes(q) ?? false) ||
        (l.phone?.toLowerCase().includes(q) ?? false) ||
        (l.property_title?.toLowerCase().includes(q) ?? false) ||
        (l.message?.toLowerCase().includes(q) ?? false)
      )
    }
    return true
  })

  const counts = {
    new:       leads.filter(l => l.status === 'new').length,
    assigned:  leads.filter(l => l.status === 'assigned').length,
    contacted: leads.filter(l => l.status === 'contacted').length,
    closed:    leads.filter(l => l.status === 'closed').length,
  }

  function handleAssigned(leadId: string, realtorId: string, realtorName: string) {
    const now = new Date().toISOString()
    setLeads(prev => prev.map(l =>
      l.id === leadId
        ? { ...l, assigned_realtor_id: realtorId, assigned_realtor_name: realtorName, status: 'assigned' as const, assigned_at: l.assigned_at ?? now }
        : l
    ))
    setSelectedLead(prev =>
      prev?.id === leadId
        ? { ...prev, assigned_realtor_id: realtorId, assigned_realtor_name: realtorName, status: 'assigned' as const, assigned_at: prev.assigned_at ?? now }
        : prev
    )
  }

  function handleStatusUpdate(leadId: string, status: string) {
    const now = new Date().toISOString()
    setLeads(prev => prev.map(l => {
      if (l.id !== leadId) return l
      return {
        ...l,
        status: status as Lead['status'],
        assigned_at:  status === 'assigned'  ? (l.assigned_at  ?? now) : l.assigned_at,
        contacted_at: status === 'contacted' ? (l.contacted_at ?? now) : l.contacted_at,
        closed_at:    status === 'closed'    ? (l.closed_at    ?? now) : l.closed_at,
      }
    }))
    setSelectedLead(prev => {
      if (prev?.id !== leadId) return prev
      return {
        ...prev,
        status: status as Lead['status'],
        assigned_at:  status === 'assigned'  ? (prev.assigned_at  ?? now) : prev.assigned_at,
        contacted_at: status === 'contacted' ? (prev.contacted_at ?? now) : prev.contacted_at,
        closed_at:    status === 'closed'    ? (prev.closed_at    ?? now) : prev.closed_at,
      }
    })
  }

  const kpis = [
    { label: t('leads_page.kpi_new'),       value: counts.new,       sub: t('leads_page.kpi_new_sub'),       accent: counts.new > 0 ? '#e10f1f' : undefined as string | undefined },
    { label: t('leads_page.kpi_assigned'),  value: counts.assigned,  sub: t('leads_page.kpi_assigned_sub'),  accent: undefined as string | undefined },
    { label: t('leads_page.kpi_contacted'), value: counts.contacted, sub: t('leads_page.kpi_contacted_sub'), accent: undefined },
    { label: t('leads_page.kpi_closed'),    value: counts.closed,    sub: t('leads_page.kpi_closed_sub'),    accent: undefined },
  ]

  return (
    <div className="flex flex-col gap-4">

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-paper border border-line rounded-xl px-4 py-4 animate-pulse space-y-2">
                <div className="h-2.5 bg-line-soft rounded w-2/3" />
                <div className="h-7 bg-line-soft rounded w-1/2" />
                <div className="h-2.5 bg-line-soft rounded w-3/4" />
              </div>
            ))
          : kpis.map(k => (
              <div key={k.label} className="bg-paper border border-line rounded-xl px-4 py-4">
                <div className="text-[11px] font-bold uppercase tracking-[.07em] text-dim mb-2">{k.label}</div>
                <div
                  className="text-[28px] font-bold leading-none"
                  style={{ color: k.accent ?? 'var(--ink, #1a1e2e)' }}
                >
                  {k.value}
                </div>
                <div className="text-[11px] text-dim mt-1.5 truncate">{k.sub}</div>
              </div>
            ))
        }
      </div>

      {/* Main card */}
      <div className="bg-paper border border-line rounded-2xl overflow-hidden">

        {/* Toolbar */}
        <div className="px-4 sm:px-5.5 py-4 border-b border-line space-y-3">
          <div className="font-sans text-[17px] font-bold text-ink">
            {t('leads_page.title')}
            {!loading && leads.length > 0 && (
              <span className="ml-2 text-[13px] font-normal text-dim">({filtered.length})</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Search — left */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-line bg-white w-55">
              <Search size={13} className="text-dim shrink-0" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={t('leads_page.search_ph')}
                className="text-[12.5px] border-0 outline-none bg-transparent text-ink placeholder:text-dim flex-1 min-w-0"
              />
            </div>
            {/* Pills — right */}
            <div className="flex items-center gap-3 ml-auto flex-wrap">
              <FilterPills options={[...TYPE_PILLS]}   value={typeFilter}   onChange={setTypeFilter} />
              <div className="w-px h-4 bg-line shrink-0" />
              <FilterPills options={[...STATUS_PILLS]} value={statusFilter} onChange={setStatusFilter} />
            </div>
          </div>
        </div>

        {/* Table header */}
        <div className={`hidden lg:grid ${COLS} gap-3 py-2.5 px-5.5 border-b border-line bg-nav/5`}>
          {[t('leads_page.header_type'), t('leads_page.header_contact'), t('leads_page.header_property'), t('leads_page.header_message'), t('leads_page.header_assign_realtor'), 'GHL', t('leads_page.header_status')].map((h, i) => (
            <div key={i} className="text-[11px] font-bold text-dim uppercase tracking-[.06em]">{h}</div>
          ))}
        </div>

        {loading ? (
          <>
            {/* Desktop skeleton */}
            <div className="hidden lg:block divide-y divide-line-soft">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={`grid ${COLS} gap-3 py-3.5 px-5.5 animate-pulse items-center`}>
                  <div className="h-5 bg-line-soft rounded-full w-16" />
                  <div className="space-y-1.5">
                    <div className="h-3.5 bg-line-soft rounded w-3/4" />
                    <div className="h-2.5 bg-line-soft rounded w-1/2" />
                  </div>
                  <div className="h-3 bg-line-soft rounded w-2/3" />
                  <div className="h-3 bg-line-soft rounded w-4/5" />
                  <div className="h-7 bg-line-soft rounded-lg w-24" />
                  <div className="h-5 bg-line-soft rounded w-7" />
                  <div className="h-5 bg-line-soft rounded-full w-16" />
                </div>
              ))}
            </div>
            {/* Mobile skeleton */}
            <div className="lg:hidden divide-y divide-line-soft">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-4 py-4 flex flex-col gap-2 animate-pulse">
                  <div className="flex items-center justify-between">
                    <div className="h-5 bg-line-soft rounded-full w-16" />
                    <div className="h-3 bg-line-soft rounded w-12" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-3.5 bg-line-soft rounded w-1/2" />
                    <div className="h-3 bg-line-soft rounded w-2/3" />
                  </div>
                  <div className="h-8 bg-line-soft rounded-lg w-32" />
                </div>
              ))}
            </div>
          </>
        ) : filtered.length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-3 text-center px-6">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: `${TONE}18` }}>
              <ClipboardList size={20} style={{ color: TONE }} />
            </div>
            <div>
              {query.trim() ? (
                <>
                  <div className="text-[13.5px] font-semibold text-ink mb-0.5">{t('leads_page.no_results_title', { query })}</div>
                  <div className="text-[11.5px] text-dim">{t('leads_page.no_results_sub')}</div>
                </>
              ) : (
                <>
                  <div className="text-[13.5px] font-semibold text-ink mb-0.5">{t('leads_page.no_leads_title')}</div>
                  <div className="text-[11.5px] text-dim">{t('leads_page.no_leads_sub')}</div>
                </>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block divide-y divide-line-soft">
              {filtered.map(lead => (
                <div
                  key={lead.id}
                  onClick={() => setSelectedLead(lead)}
                  className={`grid ${COLS} gap-3 py-3.5 px-5.5 items-center hover:bg-line-soft/40 transition-colors cursor-pointer`}
                >
                  <div><TypeBadge lead={lead} /></div>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <LeadAvatar name={lead.name} avatarUrl={lead.from_user_avatar_url} color={TYPE_COLOR[effectiveType(lead)] ?? '#64748b'} />
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-ink truncate">{lead.name}</div>
                      {lead.from_user_code && (
                        <div className="text-[10.5px] font-mono font-semibold" style={{ color: TONE }}>{fmtUserCode(lead.from_user_code)}</div>
                      )}
                      {lead.email && <div className="text-[11px] text-dim truncate">{lead.email}</div>}
                      {!lead.email && !lead.phone && <div className="text-[11px] text-dim truncate">{t('lead_panel.not_provided')}</div>}
                      {lead.phone && (() => { const ph = parsePhone(lead.phone); return <div className="flex items-center gap-1 text-[11px] text-dim">{ph.country && <img src={`https://flagcdn.com/w20/${ph.country.toLowerCase()}.png`} alt={ph.country} className="w-3.5 h-auto shrink-0 rounded-xs" />}<span className="truncate">{ph.formatted}</span></div> })()}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[12.5px] text-ink2 truncate">
                      {lead.property_title ?? <span className="text-dim italic">{t('leads_page.no_property')}</span>}
                    </div>
                    {lead.listing_owner_id && (
                      <div className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background: '#7c3aed12', color: '#7c3aed' }}>
                        Owner Listing
                      </div>
                    )}
                  </div>
                  <div className="text-[12px] text-ink2 line-clamp-2">{lead.message ?? '—'}</div>
                  {lead.listing_owner_id ? (
                    <div className="flex flex-col gap-0.5">
                      <div className="text-[11px] font-semibold truncate" style={{ color: '#7c3aed' }}>Owner managed</div>
                      <div className="text-[10.5px] text-dim truncate">{lead.listing_owner_name}</div>
                    </div>
                  ) : (
                    <div className="text-[12.5px] truncate" style={{ color: lead.assigned_realtor_id ? TONE : '#94a3b8' }}>
                      {lead.assigned_realtor_name ?? t('leads_page.unassigned')}
                    </div>
                  )}
                  <div>
                    {lead.ghl_contact_url ? (
                      <a
                        href={lead.ghl_contact_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        title="View in GoHighLevel"
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-[#0069ff12] hover:bg-[#0069ff22] transition-colors"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0069ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                          <polyline points="15 3 21 3 21 9"/>
                          <line x1="10" y1="14" x2="21" y2="3"/>
                        </svg>
                      </a>
                    ) : (
                      <span className="text-[11px] text-dim">—</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <LeadStatusBadge lead={lead} />
                    <div className="text-[10.5px] text-dim">{fmtRelative(lead.created_at, t)}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Mobile cards */}
            <div className="lg:hidden divide-y divide-line">
              {filtered.map(lead => (
                <div
                  key={lead.id}
                  onClick={() => setSelectedLead(lead)}
                  className="px-4 py-4 flex flex-col gap-2 cursor-pointer hover:bg-line-soft/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <TypeBadge lead={lead} />
                    <div className="text-[11px] text-dim">{fmtRelative(lead.created_at, t)}</div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <LeadAvatar name={lead.name} avatarUrl={lead.from_user_avatar_url} color={TYPE_COLOR[effectiveType(lead)] ?? '#64748b'} />
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-semibold text-ink truncate">{lead.name}</div>
                      {lead.from_user_code && (
                        <div className="text-[10.5px] font-mono font-semibold" style={{ color: TONE }}>{fmtUserCode(lead.from_user_code)}</div>
                      )}
                      <div className="text-[11.5px] text-dim truncate">{lead.email || (lead.phone ? parsePhone(lead.phone).formatted : t('lead_panel.not_provided'))}</div>
                    </div>
                  </div>
                  {lead.property_title && (
                    <div className="text-[12px] text-ink2">{lead.property_title}</div>
                  )}
                  {lead.message && (
                    <div className="text-[12px] text-ink2 line-clamp-2">{lead.message}</div>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <LeadStatusBadge lead={lead} />
                    {lead.assigned_realtor_name && (
                      <span className="text-[11.5px] font-medium" style={{ color: TONE }}>
                        {lead.assigned_realtor_name}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <LeadDetailPanel
        lead={selectedLead}
        realtors={realtors}
        onClose={() => setSelectedLead(null)}
        onAssigned={handleAssigned}
        onStatusUpdated={handleStatusUpdate}
      />
    </div>
  )
}
