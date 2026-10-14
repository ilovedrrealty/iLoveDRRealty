import { useState, useEffect } from 'react'
import {
  CheckCircle2, XCircle, UserPlus, Bell, Archive,
  ClipboardList, Users,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { TONE, FilterPills, ApprovalRow } from './shared'
import { getAdminListings, getAdminUpgradeRequests, getAdminStats, getAdminActivityLog, getAdminUsers, type AdminListing, type AdminUpgradeRequest, type ActivityEntry, type AdminStats, type AdminUser } from '../../api/admin'
import { getAdminLeads, type Lead } from '../../api/leads'

type ApprovalItem = {
  id: string
  type: 'Listing' | 'User' | 'Lead'
  title: string
  submittedBy: string
  time: string
  flag?: string
}

type TFn = (key: string, opts?: Record<string, unknown>) => string

function fmtRelative(dateStr: string | null | undefined, t: TFn): string {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return t('rel.just_now')
  if (mins < 60) return t('rel.mins_ago', { count: mins })
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return t('rel.hrs_ago', { count: hrs })
  const days = Math.floor(hrs / 24)
  if (days < 30) return t('rel.days_ago', { count: days })
  return t('rel.months_ago', { count: Math.floor(days / 30) })
}

function toApprovalItem(l: AdminListing, t: TFn): ApprovalItem {
  return {
    id: l.id,
    type: 'Listing',
    title: l.title,
    submittedBy: l.submitted_by_name ?? l.submitted_by,
    time: fmtRelative(l.updated_at, t),
  }
}

function upgradeToApprovalItem(r: AdminUpgradeRequest, t: TFn): ApprovalItem {
  const role = r.requested_role.charAt(0).toUpperCase() + r.requested_role.slice(1)
  return {
    id: r.user_id,
    type: 'User',
    title: t('home_page.new_role_item', { role, name: r.user_display_name }),
    submittedBy: r.user_email,
    time: fmtRelative(r.created_at, t),
  }
}

const LEAD_TYPE_LABEL: Record<string, string> = {
  property_inquiry: 'Inquiry',
  booking:          'Booking',
  buyer_interest:   'Buyer Interest',
  seller_interest:  'Seller Interest',
}

function leadToApprovalItem(l: Lead, t: TFn): ApprovalItem {
  const typeLabel = LEAD_TYPE_LABEL[l.type] ?? l.type
  const sub = [l.email || l.phone || t('lead_panel.not_provided'), l.property_title].filter(Boolean).join(' · ')
  return {
    id: l.id,
    type: 'Lead',
    title: `${typeLabel}: ${l.name}`,
    submittedBy: sub,
    time: fmtRelative(l.created_at, t),
  }
}

const EVENT_META: Record<string, { icon: typeof CheckCircle2; tone: string }> = {
  listing_approved: { icon: CheckCircle2, tone: '#1f7a3d' },
  listing_rejected: { icon: XCircle,      tone: '#e10f1f' },
  listing_archived: { icon: Archive,      tone: '#7884a0' },
  upgrade_approved: { icon: UserPlus,     tone: '#0b63ab' },
  upgrade_rejected: { icon: XCircle,      tone: '#e10f1f' },
  edit_approved:    { icon: CheckCircle2, tone: '#1f7a3d' },
  edit_rejected:    { icon: XCircle,      tone: '#e10f1f' },
}
const DEFAULT_META = { icon: Bell, tone: '#7884a0' }

function last6Months(): { key: string; label: string }[] {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('en-US', { month: 'short' }),
    }
  })
}

export function AdminHome({ go }: { go: (v: string, openId?: string) => void }) {
  const { t } = useTranslation('admin')
  const [filter, setFilter] = useState<'All' | 'Listing' | 'User' | 'Lead'>('All')
  const [pendingListings,  setPendingListings]  = useState<AdminListing[]>([])
  const [pendingUpgrades,  setPendingUpgrades]  = useState<AdminUpgradeRequest[]>([])
  const [newLeads,         setNewLeads]         = useState<Lead[]>([])
  const [loadingQueue,     setLoadingQueue]      = useState(true)
  const [stats,            setStats]             = useState<AdminStats | null>(null)
  const [loadingStats,     setLoadingStats]      = useState(true)
  const [activity,         setActivity]          = useState<ActivityEntry[]>([])
  const [loadingActivity,  setLoadingActivity]   = useState(true)
  const [allUsers,         setAllUsers]          = useState<AdminUser[]>([])
  const [loadingUsers,     setLoadingUsers]      = useState(true)

  useEffect(() => {
    Promise.all([
      getAdminListings({ status: 'pending_approval', pageSize: 50 }),
      getAdminUpgradeRequests('pending'),
      getAdminLeads({ status: 'new' }),
    ])
      .then(([listingsPage, upgrades, leads]) => {
        setPendingListings(listingsPage.items)
        setPendingUpgrades(upgrades)
        setNewLeads(leads)
      })
      .catch(() => {})
      .finally(() => setLoadingQueue(false))
  }, [])

  useEffect(() => {
    getAdminStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoadingStats(false))
  }, [])

  useEffect(() => {
    getAdminActivityLog(20)
      .then(setActivity)
      .catch(() => {})
      .finally(() => setLoadingActivity(false))
  }, [])

  useEffect(() => {
    getAdminUsers()
      .then(setAllUsers)
      .catch(() => {})
      .finally(() => setLoadingUsers(false))
  }, [])

  const approvalQueue: ApprovalItem[] = [
    ...newLeads.map(l => leadToApprovalItem(l, t)),
    ...pendingListings.map(l => toApprovalItem(l, t)),
    ...pendingUpgrades.map(r => upgradeToApprovalItem(r, t)),
  ]

  const filtered = approvalQueue.filter(a => filter === 'All' || a.type === filter)

  const pendingCount  = pendingListings.length + pendingUpgrades.length + newLeads.length
  const loadingKpis   = loadingQueue || loadingStats

  const kpis = [
    {
      label: t('home_page.kpi_pending'),
      value: pendingCount,
      sub: t('home_page.kpi_pending_detail', { leads: newLeads.length, listings: pendingListings.length, requests: pendingUpgrades.length }),
      accent: pendingCount > 0 ? '#d97706' : undefined as string | undefined,
    },
    {
      label: t('home_page.kpi_total_users'),
      value: stats?.total_users ?? 0,
      sub: t('home_page.kpi_total_users_sub'),
      accent: undefined as string | undefined,
    },
    {
      label: t('home_page.kpi_active_listings'),
      value: stats?.active_listings ?? 0,
      sub: t('home_page.kpi_active_sub'),
      accent: undefined as string | undefined,
    },
    {
      label: t('home_page.kpi_pending_listings'),
      value: stats?.pending_listings ?? 0,
      sub: t('home_page.kpi_pending_sub'),
      accent: (stats?.pending_listings ?? 0) > 0 ? '#d97706' : undefined as string | undefined,
    },
  ]

  const months  = last6Months()
  const barData = months.map(m => ({
    label: m.label,
    count: allUsers.filter(u => u.created_at.startsWith(m.key)).length,
  }))
  const maxBar = Math.max(...barData.map(d => d.count), 1)

  return (
    <>
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 lg:mb-7">
        {loadingKpis
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
                  {k.value.toLocaleString()}
                </div>
                <div className="text-[11px] text-dim mt-1.5 truncate">{k.sub}</div>
              </div>
            ))
        }
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.4fr_1fr]">

        {/* Approval queue */}
        <div className="bg-paper border border-line rounded-2xl overflow-hidden">
          <div className="flex flex-wrap justify-between items-center gap-2 px-4 sm:px-5.5 py-4 border-b border-line">
            <div className="font-sans text-[17px] font-bold text-ink">{t('home_page.approval_queue')}</div>
            <div className="flex items-center gap-3">
              <FilterPills options={['All', 'Lead', 'Listing', 'User']} value={filter} onChange={v => setFilter(v as typeof filter)} />
            </div>
          </div>
          <div className="flex flex-col">
            {loadingQueue ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={`px-5.5 py-4 animate-pulse ${i < 3 ? 'border-b border-line-soft' : ''}`}>
                  <div className="flex gap-3">
                    <div className="h-6 w-16 bg-line-soft rounded-full shrink-0" />
                    <div className="flex-1 space-y-2 pt-0.5">
                      <div className="h-3.5 bg-line-soft rounded w-3/4" />
                      <div className="h-3 bg-line-soft rounded w-1/2" />
                    </div>
                  </div>
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="py-10 flex flex-col items-center gap-4 text-center px-6">
                <div className="text-dim text-sm">{t('home_page.all_clear')}</div>
                <div className="flex gap-3">
                  <button
                    onClick={() => go('listings')}
                    className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer border"
                    style={{ color: TONE, borderColor: TONE, background: `${TONE}10` }}
                  >
                    <ClipboardList size={13} /> {t('home_page.review_listings')}
                  </button>
                  <button
                    onClick={() => go('users')}
                    className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer border"
                    style={{ color: TONE, borderColor: TONE, background: `${TONE}10` }}
                  >
                    <Users size={13} /> {t('home_page.review_users')}
                  </button>
                </div>
              </div>
            ) : (
              filtered.slice(0, 5).map((item, i) => (
                <ApprovalRow
                  key={i}
                  item={item}
                  last={i === Math.min(4, filtered.length - 1)}
                  onClick={() => go(item.type === 'Listing' ? 'listings' : item.type === 'Lead' ? 'leads' : 'users', item.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-5">

          {/* User growth chart */}
          <div className="bg-paper border border-line rounded-2xl p-5.5">
            <div className="font-sans text-[17px] font-bold text-ink mb-1">{t('home_page.user_growth')}</div>
            <div className="text-xs text-dim mb-4">{t('home_page.registrations_sub')}</div>
            {loadingUsers ? (
              <div className="flex items-end gap-2 h-25 animate-pulse">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                    <div className="w-full rounded-t-lg bg-line-soft" style={{ height: 20 + i * 8 }} />
                    <div className="h-2 bg-line-soft rounded w-4" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-end gap-2 h-25">
                {barData.map((d, i) => {
                  const h   = Math.max((d.count / maxBar) * 80, d.count > 0 ? 4 : 0)
                  const isLast = i === barData.length - 1
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                      <div className={`text-[10px] ${isLast ? 'font-bold text-ink' : 'text-dim'}`}>
                        {d.count > 0 ? (d.count >= 1000 ? (d.count / 1000).toFixed(1) + 'K' : d.count) : '—'}
                      </div>
                      <div className="w-full rounded-t-lg" style={{ height: h, background: isLast ? TONE : `${TONE}50` }} />
                      <div className="text-[10px] text-dim">{d.label}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Activity feed */}
          <div className="bg-paper border border-line rounded-2xl p-5.5 flex-1">
            <div className="font-sans text-[17px] font-bold text-ink mb-4">{t('home_page.recent_activity')}</div>
            <div className="flex flex-col gap-2.5">
              {loadingActivity ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-2.5 animate-pulse">
                    <div className="w-4 h-4 rounded-full bg-line-soft shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-line-soft rounded w-4/5" />
                      <div className="h-2.5 bg-line-soft rounded w-1/3" />
                    </div>
                  </div>
                ))
              ) : activity.length === 0 ? (
                <div className="py-4 text-center text-dim text-sm">{t('home_page.no_activity')}</div>
              ) : (
                activity.map((entry) => {
                  const meta = EVENT_META[entry.event_type] ?? DEFAULT_META
                  const { icon: Icon, tone } = meta
                  return (
                    <div key={entry.id} className="flex items-start gap-2.5">
                      <Icon size={15} className="shrink-0 mt-0.5" color={tone} />
                      <div className="flex-1">
                        <div className="text-[12.5px] text-ink leading-snug">{entry.description}</div>
                        <div className="text-[11px] text-dim mt-0.5">{fmtRelative(entry.created_at, t)}</div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
