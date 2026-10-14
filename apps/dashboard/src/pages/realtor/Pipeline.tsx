import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { getRealtorLeads, updateRealtorLeadStatus, type Lead } from '../../api/leads'
import { LeadDetailPanel } from '../../components/admin/LeadDetailPanel'
import type { UserInfo } from '../../lib/auth'
import { parsePhone } from '../../utils/phone'

type PipelineStatus = 'assigned' | 'schedule' | 'contacted' | 'closed'

const STAGES: PipelineStatus[] = ['assigned', 'schedule', 'contacted', 'closed']

const STAGE_LABEL: Record<PipelineStatus, string> = {
  assigned:  'New',
  schedule:  'Schedule',
  contacted: 'Contacted',
  closed:    'Closed',
}

const STAGE_COLOR: Record<PipelineStatus, string> = {
  assigned:  '#0d9488',
  schedule:  '#006BFF',
  contacted: '#1f7a3d',
  closed:    '#64748b',
}

const TYPE_COLOR: Record<string, string> = {
  property_inquiry: '#1f7a3d',
  booking:          '#0d9488',
  buyer_interest:   '#e10f1f',
  seller_interest:  '#f0a800',
  rental_interest:  '#006BFF',
}

const TYPE_LABEL: Record<string, string> = {
  property_inquiry: 'Inquiry',
  booking:          'Booking',
  buyer_interest:   'Buyer',
  seller_interest:  'Seller',
  rental_interest:  'Renter',
}

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return `${Math.floor(d / 30)}mo ago`
}

export function Pipeline({ user }: { user?: UserInfo }) {
  const { t } = useTranslation('admin')
  const [leads,       setLeads]       = useState<Lead[]>([])
  const [loading,     setLoading]     = useState(true)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [moving,      setMoving]      = useState<string | null>(null)

  useEffect(() => {
    getRealtorLeads()
      .then(setLeads)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function moveLead(lead: Lead, direction: 'forward' | 'backward') {
    const idx = STAGES.indexOf(lead.status as PipelineStatus)
    const nextIdx = direction === 'forward' ? idx + 1 : idx - 1
    if (nextIdx < 0 || nextIdx >= STAGES.length) return
    const nextStatus = STAGES[nextIdx]

    setMoving(lead.id)
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: nextStatus } : l))
    try {
      await updateRealtorLeadStatus(lead.id, nextStatus)
    } catch {
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: lead.status } : l))
      toast.error('Failed to update lead status')
    } finally {
      setMoving(null)
    }
  }

  function handleStatusUpdate(leadId: string, status: string) {
    const cast = status as Lead['status']
    setLeads(prev => prev.map(l => l.id !== leadId ? l : { ...l, status: cast }))
    setSelectedLead(prev => prev?.id !== leadId ? prev : { ...prev!, status: cast })
  }

  return (
    <div className="flex flex-col gap-0">
      <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1" style={{ scrollSnapType: 'x mandatory' }}>
        {STAGES.map((stage, si) => {
          const color = STAGE_COLOR[stage]
          const stageLeads = leads.filter(l => l.status === stage)

          return (
            <div
              key={stage}
              className="shrink-0 w-70 sm:flex-1 sm:min-w-50 flex flex-col"
              style={{ scrollSnapAlign: 'start' }}
            >
              {/* Column header */}
              <div
                className="flex items-center justify-between px-4 py-3 rounded-t-2xl border border-b-0 border-line"
                style={{ background: `${color}10` }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                  <span className="text-[13px] font-bold" style={{ color }}>{STAGE_LABEL[stage]}</span>
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${color}20`, color }}>
                  {loading ? '—' : stageLeads.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex-1 bg-paper border border-line rounded-b-2xl p-2.5 flex flex-col gap-2 min-h-60">
                {loading ? (
                  Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="bg-white border border-line rounded-xl p-3 space-y-2 animate-pulse">
                      <div className="h-3 bg-line-soft rounded w-2/3" />
                      <div className="h-2.5 bg-line-soft rounded w-1/2" />
                      <div className="h-2.5 bg-line-soft rounded w-3/4" />
                    </div>
                  ))
                ) : stageLeads.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-8 gap-2 text-center">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${color}12` }}>
                      <ClipboardList size={15} style={{ color }} />
                    </div>
                    <div className="text-[11.5px] text-dim">No leads</div>
                  </div>
                ) : (
                  stageLeads.map(lead => {
                    const tc = TYPE_COLOR[lead.type] ?? '#64748b'
                    const isMoving = moving === lead.id

                    return (
                      <div
                        key={lead.id}
                        onClick={() => !isMoving && setSelectedLead(lead)}
                        className="bg-white border border-line rounded-xl p-3 cursor-pointer hover:shadow-sm transition-shadow border-l-[3px]"
                        style={{ borderLeftColor: color, opacity: isMoving ? 0.5 : 1 }}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${tc}15`, color: tc }}>
                            {TYPE_LABEL[lead.type] ?? lead.type}
                          </span>
                          <span className="text-[10px] text-dim shrink-0">{fmtRelative(lead.created_at)}</span>
                        </div>

                        <div className="text-[13px] font-semibold text-ink truncate">{lead.name}</div>
                        <div className="text-[11px] text-dim truncate mb-1">{lead.email || (lead.phone ? parsePhone(lead.phone).formatted : t('lead_panel.not_provided'))}</div>
                        {lead.property_title && (
                          <div className="text-[11px] text-ink2 truncate mb-1">{lead.property_title}</div>
                        )}

                        {/* Move arrows */}
                        <div className="flex items-center justify-end gap-1 mt-2" onClick={e => e.stopPropagation()}>
                          {si > 0 && (
                            <button
                              disabled={isMoving}
                              onClick={() => moveLead(lead, 'backward')}
                              title={`Move to ${STAGE_LABEL[STAGES[si - 1]]}`}
                              className="w-6 h-6 rounded-lg border border-line bg-white flex items-center justify-center cursor-pointer hover:bg-line-soft disabled:opacity-40 transition-colors"
                            >
                              <ChevronLeft size={12} className="text-ink2" />
                            </button>
                          )}
                          {si < STAGES.length - 1 && (
                            <button
                              disabled={isMoving}
                              onClick={() => moveLead(lead, 'forward')}
                              title={`Move to ${STAGE_LABEL[STAGES[si + 1]]}`}
                              className="w-6 h-6 rounded-lg border flex items-center justify-center cursor-pointer disabled:opacity-40 transition-colors text-white"
                              style={{ background: color, borderColor: color }}
                            >
                              <ChevronRight size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>

      <LeadDetailPanel
        lead={selectedLead}
        realtors={[]}
        onClose={() => setSelectedLead(null)}
        onAssigned={() => {}}
        onStatusUpdated={handleStatusUpdate}
        allowedStatuses={['schedule', 'contacted', 'closed']}
        updateStatusFn={updateRealtorLeadStatus}
        calendlyUrl={user?.calendly_url}
      />
    </div>
  )
}
