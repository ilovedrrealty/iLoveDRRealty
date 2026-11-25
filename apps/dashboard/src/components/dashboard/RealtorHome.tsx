import { useState, useEffect } from 'react'
import {
  Building2, ClipboardList, Home, MessageCircle, Plus, Clock, Star, Pencil, type LucideIcon,
} from 'lucide-react'
import type { UserInfo } from '../../lib/auth'
import { useTranslation } from 'react-i18next'
import { Card, StatusPill, RoleKpiCard, fmtPrice } from './shared'
import { SetupBanners, useListingSetup } from './SetupBanners'
import { getMyListings, type Listing } from '../../api/listings'
import { getRealtorLeads, type Lead } from '../../api/leads'
import { SaleCatalogLink } from '../shared/SaleCatalogLink'

export const REALTOR_LISTINGS = [
  { name: 'Oceanfront Villa — Cap Cana',   status: 'Active', leads: 8, views: 1420, price: '$2.45M' },
  { name: 'Golf Villa — Punta Cana',       status: 'Active', leads: 5, views: 892,  price: '$875K'  },
  { name: 'Garden Condo — Cabarete',       status: 'Active', leads: 3, views: 554,  price: '$245K'  },
  { name: 'Beachfront Residence — Samaná', status: 'Review', leads: 0, views: 0,    price: '$1.2M'  },
  { name: 'Penthouse — Piantini',          status: 'Active', leads: 6, views: 710,  price: '$389K'  },
  { name: 'Hillside Villa — Jarabacoa',    status: 'Active', leads: 2, views: 320,  price: '$320K'  },
]

export const REALTOR_LEADS = [
  { name: 'James Wilson',   region: 'Cap Cana',     budget: '$2-3M',     type: 'Villa', status: 'Hot',  time: '1h ago'    },
  { name: 'Marie Dubois',   region: 'Las Terrenas', budget: '$600-900K', type: 'Condo', status: 'Warm', time: '4h ago'    },
  { name: 'David Park',     region: 'Punta Cana',   budget: '$800K-1M',  type: 'Villa', status: 'Hot',  time: 'Yesterday' },
  { name: 'Lucia Ferreira', region: 'Sto. Domingo', budget: '$300-500K', type: 'Apt',   status: 'Cold', time: '2d ago'    },
  { name: 'Tom Bradley',    region: 'Cabarete',     budget: '$200-300K', type: 'Condo', status: 'Warm', time: '3d ago'    },
  { name: 'Ana González',   region: 'Sto. Domingo', budget: '$500-700K', type: 'Comm.', status: 'Cold', time: '4d ago'    },
]

export const REALTOR_PIPELINE: { name: string; property: string; value: string; stage: 'Prospect' | 'Showing' | 'Offer' }[] = [
  { name: 'James Wilson',   property: 'Oceanfront Villa — Cap Cana',    value: '$2.45M', stage: 'Offer'    },
  { name: 'Lucia Ferreira', property: 'Penthouse — Piantini',            value: '$389K',  stage: 'Showing'  },
  { name: 'David Park',     property: 'Golf Villa — Punta Cana',         value: '$875K',  stage: 'Showing'  },
  { name: 'Marie Dubois',   property: 'Cliffside Villa — Sosúa',         value: '$1.65M', stage: 'Prospect' },
  { name: 'Tom Bradley',    property: 'Garden Condo — Cabarete',         value: '$245K',  stage: 'Prospect' },
  { name: 'Ana González',   property: 'Commercial Building — Sto. Dgo.', value: '$540K',  stage: 'Prospect' },
]

export const REALTOR_CAL_EVENTS = [
  { type: 'Showing', client: 'James Wilson', property: 'Cap Cana Villa',     date: 'Jun 5, 10:00am' },
  { type: 'Call',    client: 'Marie Dubois', property: 'Las Terrenas Condo', date: 'Jun 5, 2:00pm'  },
  { type: 'Showing', client: 'David Park',   property: 'Golf Villa',         date: 'Jun 6, 11:00am' },
  { type: 'Offer',   client: 'James Wilson', property: 'Oceanfront Villa',   date: 'Jun 7, 3:00pm'  },
  { type: 'Meeting', client: 'New buyer',    property: 'Office',             date: 'Jun 8, 9:00am'  },
]

export const STAGE_TONE: Record<string, string> = { Prospect: '#7884a0', Showing: '#f0a800', Offer: '#e10f1f' }
export const STAGES = ['Prospect', 'Showing', 'Offer'] as const
export const LEAD_STATUS_TONE: Record<string, string> = { Hot: '#e10f1f', Warm: '#f0a800', Cold: '#7884a0' }
export const REALTOR_EVENT_TONE: Record<string, string> = { Showing: '#0b63ab', Call: '#f0a800', Offer: '#e10f1f', Meeting: '#1f7a3d' }

const STATUS_TONE_MAP: Record<string, string> = {
  active: '#1f7a3d', pending_approval: '#f0a800', rejected: '#e10f1f', archived: '#9ca3af',
}

function fmtRelative(dateStr: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
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

function avatarTone(name: string): string {
  const tones = ['#e10f1f', '#0b63ab', '#f0a800', '#7884a0', '#1f7a3d', '#9333ea']
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return tones[h % tones.length]
}

export function RealtorHome({ go, tone, user }: { go: (v: string) => void; tone: string; user: UserInfo }) {
  const { t } = useTranslation('realtor')
  const { t: tCommon } = useTranslation('common')

  const [myListings,      setMyListings]      = useState<Listing[]>([])
  const [leads,           setLeads]           = useState<Lead[]>([])
  const [loadingListings, setLoadingListings] = useState(true)
  const [loadingLeads,    setLoadingLeads]    = useState(true)

  useEffect(() => {
    getMyListings().then(setMyListings).catch(() => {}).finally(() => setLoadingListings(false))
    getRealtorLeads().then(setLeads).catch(() => {}).finally(() => setLoadingLeads(false))
  }, [])

  const activeCount  = myListings.filter(l => l.status === 'active').length
  const pendingCount = myListings.filter(l => l.status === 'pending_approval').length
  const hotLeads     = leads.filter(l => l.status === 'assigned')

  const kpis = [
    { label: t('kpis.active_clients'),   value: '18',  sub: t('kpis.clients_sub', { n: 4 }) },
    { label: t('kpis.active_listings'),  value: loadingListings ? '…' : String(activeCount),   sub: t('kpis.listings_pending', { count: pendingCount }) },
    { label: t('kpis.pending_closings'), value: '3',   sub: t('kpis.closings_sub') },
    { label: t('kpis.needs_attention'),  value: loadingLeads ? '…' : String(hotLeads.length), sub: hotLeads.length ? t('kpis.attention_assigned') : t('kpis.attention_ok'), accent: hotLeads.length > 0 ? '#e10f1f' : undefined },
  ]

  const typeLabel: Record<string, string> = {
    property_inquiry: t('hot_leads.type_inquiry'),
    booking:          t('hot_leads.type_booking'),
    buyer_interest:   t('hot_leads.type_buyer'),
    seller_interest:  t('hot_leads.type_seller'),
  }

  // Same rule as the banner and every other "add listing" button (see SetupBanners).
  const { canAddListings, blockedReason } = useListingSetup(user, 'realtor')

  return (
    <>
      <div className="mb-5"><SaleCatalogLink accountRole={user.role} /></div>
      <SetupBanners kind="realtor" user={user} go={go} />
      <div className="grid grid-cols-2 gap-3 mb-5 lg:grid-cols-4 lg:gap-4 lg:mb-6">
        {kpis.map((k, i) => <RoleKpiCard key={i} {...k} />)}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-5">
          <Card title={<><Building2 size={14} /> {t('listings.title')}</>} padded={false}
            action={<button onClick={() => go('listings')} className="text-xs font-bold text-brand bg-transparent border-none cursor-pointer">{t('listings.manage')}</button>}>
            {loadingListings ? (
              <div>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className={`flex items-center gap-3 py-3 px-5.5 animate-pulse ${i < 3 ? 'border-b border-line' : ''}`}>
                    <div className="w-10 h-10 rounded-lg bg-line-soft shrink-0" />
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
                  <Building2 size={20} style={{ color: tone }} />
                </div>
                <div className="text-center">
                  <div className="text-[13.5px] font-semibold text-ink mb-0.5">{t('listings.empty_heading')}</div>
                  <div className="text-[11.5px] text-dim">{t('listings.empty_sub')}</div>
                </div>
                <button
                  onClick={() => canAddListings && go('submit-listing')}
                  disabled={!canAddListings}
                  title={blockedReason}
                  className="flex items-center gap-1.5 py-1.75 px-4 rounded-full text-[12.5px] font-bold cursor-pointer border-0 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: tone }}
                >
                  <Plus size={13} strokeWidth={2.5} /> {t('listings.add')}
                </button>
              </div>
            ) : (
              <div>
                {myListings.slice(0, 4).map((l, i) => (
                  <div key={l.id} className={`flex items-center gap-3 py-3 px-5.5 ${i < Math.min(3, myListings.length - 1) ? 'border-b border-line' : ''}`}>
                    <div className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center" style={{ background: `${tone}20` }}>
                      <Home size={16} style={{ color: tone }} />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="text-[13px] font-semibold text-ink truncate">{l.title}</div>
                      <div className="text-[11.5px] text-dim mt-0.5">{fmtPrice(l.price)} · {l.view_count.toLocaleString()} {t('listings.views')} · {l.leads_count} {t('listings.leads')}</div>
                    </div>
                    <StatusPill label={tCommon(`status_labels.${l.status}`, { defaultValue: l.status })} tone={STATUS_TONE_MAP[l.status]} />
                  </div>
                ))}
                <div className="py-3 px-5.5">
                  <button onClick={() => go('listings')} className="text-[12.5px] font-semibold text-brand bg-transparent border-none cursor-pointer p-0">
                    {t('listings.view_all', { count: myListings.length })}
                  </button>
                </div>
              </div>
            )}
          </Card>

        </div>

        <div className="flex flex-col gap-5">
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

          <Card title={<><ClipboardList size={14} /> {t('hot_leads.title')}</>}
            action={<button onClick={() => go('leads')} className="text-xs font-bold text-brand bg-transparent border-none cursor-pointer">{t('hot_leads.all')}</button>}>
            {loadingLeads ? (
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
            ) : hotLeads.length === 0 ? (
              <div className="py-8 flex flex-col items-center gap-2 text-center">
                <MessageCircle size={22} className="text-dim" />
                <div className="text-[13px] font-semibold text-ink">
                  {leads.length === 0 ? t('hot_leads.no_leads') : t('hot_leads.caught_up')}
                </div>
                <div className="text-[11.5px] text-dim">
                  {leads.length === 0 ? t('hot_leads.no_leads_sub') : t('hot_leads.caught_up_sub')}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {hotLeads.slice(0, 5).map((lead, i) => {
                  const typeColor: Record<string, string> = {
                    property_inquiry: '#1f7a3d', booking: '#0d9488',
                    buyer_interest: '#e10f1f', seller_interest: '#f0a800',
                  }
                  const c = typeColor[lead.type] ?? '#64748b'
                  return (
                    <div key={lead.id} className={`flex items-start gap-2.5 pb-2.5 ${i < Math.min(hotLeads.length, 5) - 1 ? 'border-b border-line' : ''}`}>
                      <div className="w-8.5 h-8.5 rounded-full shrink-0 grid place-items-center font-bold text-[13px] text-white" style={{ background: c }}>
                        {lead.name[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex justify-between items-center gap-2">
                          <div className="text-[13px] font-bold text-ink truncate">{lead.name}</div>
                          <div className="text-[11px] text-dim shrink-0">{fmtRelative(lead.assigned_at ?? lead.created_at, t)}</div>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10.5px] font-semibold px-1.5 py-px rounded-full" style={{ background: `${c}18`, color: c }}>
                            {typeLabel[lead.type] ?? lead.type}
                          </span>
                          {lead.property_title && (
                            <div className="text-[11px] text-dim truncate">{lead.property_title}</div>
                          )}
                        </div>
                        {lead.message && (
                          <div className="text-[11.5px] text-ink2 leading-[1.35] mt-0.5 line-clamp-1">{lead.message}</div>
                        )}
                      </div>
                    </div>
                  )
                })}
                <button onClick={() => go('leads')} className="text-[12.5px] font-semibold bg-transparent border-none cursor-pointer p-0 text-left" style={{ color: tone }}>
                  {t('hot_leads.view_all', { count: leads.length })}
                </button>
              </div>
            )}
          </Card>

        </div>
      </div>
    </>
  )
}
