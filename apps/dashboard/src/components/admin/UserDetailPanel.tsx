import { X, Check, ChevronDown, Key, Building2, Mail, Phone, Calendar, Copy, CheckCheck, UserCheck } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { ROLE_COLOR } from '../../pages/admin/shared'
import type { AdminUser, AdminUpgradeRequest, AdminAgent } from '../../api/admin'
import { changeUserRole, assignRealtorToOwner, getAdminAgents } from '../../api/admin'
import { agentChoiceLabel } from '../../lib/agentChoices'
import { ConfirmModal } from '../shared/ConfirmModal'

const UPGRADE_ROLE_ICON: Record<string, typeof Key>  = { owner: Key, realtor: Building2 }
const UPGRADE_ROLE_COLOR: Record<string, string>     = { owner: '#f0a800', realtor: '#1f7a3d' }
const UPGRADE_STATUS_CLASS: Record<string, string>   = {
  pending:  'bg-amber-50  text-amber-700  border-amber-200',
  approved: 'bg-green-50  text-green-700  border-green-200',
  rejected: 'bg-red-50    text-red-700    border-red-200',
}

const STATUS_CHIP: Record<string, { bg: string; color: string; label: string }> = {
  active:    { bg: '#16a34a', color: 'white',   label: 'Active'    },
  pending:   { bg: '#f0a800', color: 'white',   label: 'Pending'   },
  suspended: { bg: '#6b7280', color: 'white',   label: 'Suspended' },
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmtPhone(raw: string) {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
  if (digits.length === 11) return `+${digits[0]} (${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`
  return raw
}
function roleColor(role: string) {
  return ROLE_COLOR[role.charAt(0).toUpperCase() + role.slice(1)] ?? '#7884a0'
}

interface Props {
  user: AdminUser | null
  requests: AdminUpgradeRequest[]
  working: string | null
  openRejectId?: string | null
  onClose: () => void
  onSuspend: (u: AdminUser) => void
  onUnsuspend: (u: AdminUser) => void
  onApproveUpgrade: (reqId: string) => void
  onRejectUpgrade: (reqId: string, reason: string) => void
  onRoleChange: (userId: string, newRole: string) => void
}

export function UserDetailPanel({
  user, requests, working, openRejectId, onClose,
  onSuspend, onUnsuspend, onApproveUpgrade, onRejectUpgrade, onRoleChange,
}: Props) {
  const { t } = useTranslation('admin')

  const UPGRADE_ROLE_LABEL: Record<string, string> = {
    owner:   t('user_panel.role_owner'),
    realtor: t('user_panel.role_realtor'),
  }

  const [rejectingId,   setRejectingId]   = useState<string | null>(null)
  const [rejectReason,  setRejectReason]  = useState('')
  const [copied,        setCopied]        = useState(false)
  const [confirmSuspend, setConfirmSuspend] = useState(false)
  const [selectedRole,  setSelectedRole]  = useState(user?.role ?? 'buyer')
  const [confirmRole,   setConfirmRole]   = useState(false)
  const [changingRole,  setChangingRole]  = useState(false)
  const [realtors,        setRealtors]        = useState<AdminAgent[]>([])
  const [selectedRealtor, setSelectedRealtor] = useState<string>('')
  const [assigningRealtor, setAssigningRealtor] = useState(false)

  useEffect(() => {
    if (openRejectId) {
      setRejectingId(openRejectId)
      setRejectReason('')
    }
  }, [openRejectId])

  useEffect(() => {
    if (user) setSelectedRole(user.role)
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (user?.role === 'owner' || user?.role === 'admin') {
      getAdminAgents().then(setRealtors).catch(() => {})
      setSelectedRealtor(user.assigned_realtor_id ?? '')
    }
  }, [user?.id, user?.role]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRoleChange() {
    if (!user) return
    setChangingRole(true)
    try {
      await changeUserRole(user.id, selectedRole)
      onRoleChange(user.id, selectedRole)
      toast.success(t('user_panel.toast_role_changed', { role: selectedRole }))
      setConfirmRole(false)
    } catch {
      toast.error(t('user_panel.toast_role_error'))
    } finally {
      setChangingRole(false)
    }
  }

  async function handleAssignRealtor() {
    if (!user) return
    setAssigningRealtor(true)
    try {
      await assignRealtorToOwner(user.id, selectedRealtor || null)
      const r = realtors.find(r => r.id === selectedRealtor)
      toast.success(r ? t('agent_choices.assigned', { name: agentChoiceLabel(r, { admin: t('agent_choices.role_admin'), realtor: t('agent_choices.role_realtor') }) }) : t('agent_choices.unassigned'))
    } catch {
      toast.error(t('agent_choices.assign_error'))
    } finally {
      setAssigningRealtor(false)
    }
  }

  function copyEmail() {
    navigator.clipboard.writeText(user?.email ?? '').then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (!user) return null

  const rc       = roleColor(user.role)
  const chip     = STATUS_CHIP[user.status] ?? STATUS_CHIP['active']
  const initial  = (user.display_name ?? user.email)[0].toUpperCase()
  const userReqs = requests.filter(r => r.user_id === user.id)

  function handleReject(reqId: string) {
    if (!rejectReason.trim()) return
    onRejectUpgrade(reqId, rejectReason.trim())
    setRejectingId(null)
    setRejectReason('')
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full sm:w-100 z-50 flex flex-col overflow-hidden shadow-2xl">

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto bg-nav flex flex-col">

          {/* ── Navy header ──────────────────────────────────────────── */}
          <div className="relative px-5 pt-12 pb-10 flex flex-col items-center gap-3">
            {/* Close */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full cursor-pointer border-0"
              style={{ background: 'rgba(255,255,255,.12)' }}
            >
              <X size={15} color="rgba(255,255,255,.8)" />
            </button>

            {/* Avatar */}
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt=""
                className="w-20 h-20 rounded-full object-cover shrink-0 ring-4 ring-white/20"
              />
            ) : (
              <div
                className="w-20 h-20 rounded-full grid place-items-center text-white text-3xl font-bold shrink-0"
                style={{ background: rc }}
              >
                {initial}
              </div>
            )}

            {/* Name + user code */}
            <div className="text-[18px] font-bold text-white text-center leading-tight">
              {user.display_name ?? user.email}
            </div>
            {user.user_code != null && (
              <div className="text-[11px] font-mono font-semibold text-white/50 tracking-widest">
                #{String(user.user_code).padStart(7, '0')}
              </div>
            )}

            {/* Badges */}
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <span
                className="text-[11.5px] font-bold px-3 py-0.75 rounded-full capitalize"
                style={{ background: rc, color: 'white' }}
              >
                {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
              </span>
              <span
                className="text-[11.5px] font-bold px-3 py-0.75 rounded-full"
                style={{ background: chip.bg, color: chip.color }}
              >
                {chip.label}
              </span>
            </div>
          </div>

          {/* ── White floating card ──────────────────────────────────── */}
          <div className="bg-paper rounded-t-3xl -mt-3 px-5 pt-6 pb-6 space-y-6 flex-1">

            {/* Contact Information */}
            <div>
              <div className="text-[10.5px] font-bold uppercase tracking-widest text-dim mb-4">
                {t('user_panel.section_contact')}
              </div>
              <div className="space-y-3.5">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full grid place-items-center shrink-0"
                    style={{ background: `${rc}18` }}
                  >
                    <Mail size={13} style={{ color: rc }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10.5px] text-dim font-semibold uppercase tracking-wide">{t('user_panel.label_email')}</div>
                    <div className="flex items-center gap-1.5">
                      <div className="text-[13px] text-ink truncate">{user.email}</div>
                      <button
                        onClick={copyEmail}
                        className="shrink-0 p-1 rounded-md border-0 bg-transparent cursor-pointer hover:bg-line-soft transition-colors"
                        title="Copy email"
                      >
                        {copied
                          ? <CheckCheck size={13} style={{ color: rc }} />
                          : <Copy size={13} className="text-dim" />
                        }
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full grid place-items-center shrink-0"
                    style={{ background: `${rc}18` }}
                  >
                    <Phone size={13} style={{ color: rc }} />
                  </div>
                  <div>
                    <div className="text-[10.5px] text-dim font-semibold uppercase tracking-wide">{t('user_panel.label_phone')}</div>
                    <div className="text-[13px] text-ink">
                      {user.phone ? fmtPhone(user.phone) : <span className="text-dim/60">{t('user_panel.not_provided')}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full grid place-items-center shrink-0"
                    style={{ background: `${rc}18` }}
                  >
                    <Calendar size={13} style={{ color: rc }} />
                  </div>
                  <div>
                    <div className="text-[10.5px] text-dim font-semibold uppercase tracking-wide">{t('user_panel.label_member_since')}</div>
                    <div className="text-[13px] text-ink">{fmt(user.created_at)}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Role Management */}
            {user.role !== 'admin' && (
              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-widest text-dim mb-4">
                  {t('user_panel.section_role')}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedRole}
                    onChange={e => setSelectedRole(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-line bg-white text-[13px] text-ink outline-none focus:border-coral cursor-pointer"
                  >
                    <option value="buyer">Buyer</option>
                    <option value="owner">Owner</option>
                    <option value="realtor">Realtor</option>
                  </select>
                  <button
                    onClick={() => setConfirmRole(true)}
                    disabled={selectedRole === user.role || changingRole}
                    className="px-4 py-2 rounded-lg border-0 text-[13px] font-semibold text-white cursor-pointer disabled:opacity-40"
                    style={{ background: ROLE_COLOR[selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)] ?? '#7884a0' }}
                  >
                    {t('user_panel.change_role_btn')}
                  </button>
                </div>
              </div>
            )}

            {/* Owners and admins can select an agent for their own owner workspace. */}
            {(user.role === 'owner' || user.role === 'admin') && (
              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-widest text-dim mb-4 flex items-center gap-1.5">
                  <UserCheck size={11} /> {t('agent_choices.assigned_agent')}
                </div>
                {user.assigned_realtor_name && (
                  <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200">
                    <div className="w-6 h-6 rounded-full grid place-items-center text-white text-[10px] font-bold shrink-0" style={{ background: '#1f7a3d' }}>
                      {(user.assigned_realtor_name)[0].toUpperCase()}
                    </div>
                    <span className="text-[12.5px] font-semibold text-green-800">{user.assigned_realtor_name}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <select
                    value={selectedRealtor}
                    onChange={e => setSelectedRealtor(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-line bg-white text-[13px] text-ink outline-none focus:border-coral cursor-pointer"
                  >
                    <option value="">{t('agent_choices.none')}</option>
                    {selectedRealtor && !realtors.some(agent => agent.id === selectedRealtor) && <option value={selectedRealtor}>{user.assigned_realtor_name || t('agent_choices.unavailable_current')}</option>}
                    {realtors.map(r => (
                      <option key={r.id} value={r.id}>{agentChoiceLabel(r, { admin: t('agent_choices.role_admin'), realtor: t('agent_choices.role_realtor') })}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleAssignRealtor}
                    disabled={assigningRealtor || selectedRealtor === (user.assigned_realtor_id ?? '')}
                    className="px-4 py-2 rounded-lg border-0 text-[13px] font-semibold text-white cursor-pointer disabled:opacity-40"
                    style={{ background: '#1f7a3d' }}
                  >
                    {assigningRealtor ? '…' : t('agent_choices.assign')}
                  </button>
                </div>
              </div>
            )}

            {/* Upgrade Request History */}
            <div>
              <div className="text-[10.5px] font-bold uppercase tracking-widest text-dim mb-4">
                {t('user_panel.section_upgrades')}
              </div>

              {userReqs.length === 0 ? (
                <div className="text-[12.5px] text-dim py-2">{t('user_panel.no_upgrades')}</div>
              ) : (
                <div className="space-y-2.5">
                  {userReqs.map(req => {
                    const Icon        = UPGRADE_ROLE_ICON[req.requested_role] ?? Key
                    const reqColor    = UPGRADE_ROLE_COLOR[req.requested_role] ?? '#7884a0'
                    const roleLabel   = UPGRADE_ROLE_LABEL[req.requested_role] ?? req.requested_role
                    const isRejectOpen = rejectingId === req.id

                    return (
                      <div key={req.id} className="rounded-xl border border-line bg-white overflow-hidden">
                        {/* Top bar: role → requested role + status */}
                        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-line-soft">
                          <span
                            className="flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1 rounded-full"
                            style={{ background: `${reqColor}14`, color: reqColor }}
                          >
                            <Icon size={12} /> {roleLabel}
                          </span>
                          <span className={`text-[11.5px] font-semibold px-2.5 py-1 rounded-full border capitalize ${UPGRADE_STATUS_CLASS[req.status]}`}>
                            {req.status}
                          </span>
                        </div>

                        {/* Meta rows */}
                        <div className="px-4 py-3 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-dim">{t('user_panel.label_requested')}</span>
                            <span className="text-[12.5px] text-ink">{fmt(req.created_at)}</span>
                          </div>
                          {req.reviewed_by_name ? (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-dim shrink-0">
                                {req.status === 'approved' ? t('user_panel.approved_by') : t('user_panel.reviewed_by')}
                              </span>
                              <span className="text-[12.5px] text-ink text-right">
                                {req.reviewed_by_name}
                                {req.reviewed_at && <span className="text-dim"> · {fmt(req.reviewed_at)}</span>}
                              </span>
                            </div>
                          ) : null}
                          {req.rejection_reason && (
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-dim shrink-0">{t('user_panel.label_reason')}</span>
                              <span className="text-[12.5px] text-red-600 text-right">{req.rejection_reason}</span>
                            </div>
                          )}

                          {req.status === 'pending' && (
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                onClick={() => onApproveUpgrade(req.id)}
                                disabled={!!working}
                                className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg border-0 cursor-pointer text-[12.5px] font-semibold text-white disabled:opacity-50"
                                style={{ background: '#1f7a3d' }}
                              >
                                <Check size={12} /> {t('user_panel.approve')}
                              </button>
                              <button
                                onClick={() => { setRejectingId(isRejectOpen ? null : req.id); setRejectReason('') }}
                                disabled={!!working}
                                className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg border border-line cursor-pointer text-[12.5px] font-semibold text-ink2 bg-paper disabled:opacity-50"
                              >
                                <X size={12} /> {t('user_panel.reject')}
                                <ChevronDown
                                  size={10}
                                  style={{ transform: isRejectOpen ? 'rotate(180deg)' : undefined, transition: 'transform 150ms' }}
                                />
                              </button>
                            </div>
                          )}
                        </div>

                        {isRejectOpen && (
                          <div className="mt-3 flex gap-2">
                            <input
                              type="text"
                              value={rejectReason}
                              onChange={e => setRejectReason(e.target.value)}
                              placeholder={t('user_panel.reason_ph')}
                              className="flex-1 px-3 py-2 rounded-lg border border-line bg-white text-[12.5px] text-ink outline-none focus:border-coral"
                              autoFocus
                            />
                            <button
                              onClick={() => handleReject(req.id)}
                              disabled={!rejectReason.trim() || !!working}
                              className="px-4 py-2 rounded-lg border-0 cursor-pointer text-[12px] font-bold text-white disabled:opacity-50"
                              style={{ background: '#e10f1f' }}
                            >
                              {t('user_panel.confirm')}
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <div className="bg-paper border-t border-line px-5 py-4 shrink-0 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-line text-[13px] font-semibold text-ink2 cursor-pointer hover:bg-line-soft bg-transparent"
          >
            {t('user_panel.close')}
          </button>
          {user.role !== 'admin' && (
            user.status === 'suspended' ? (
              <button
                onClick={() => setConfirmSuspend(true)}
                disabled={working === user.id}
                className="flex-1 px-4 py-2.5 rounded-xl border-0 text-[13px] font-semibold text-white cursor-pointer disabled:opacity-50"
                style={{ background: '#1f7a3d' }}
              >
                {t('user_panel.restore')}
              </button>
            ) : (
              <button
                onClick={() => setConfirmSuspend(true)}
                disabled={working === user.id}
                className="flex-1 px-4 py-2.5 rounded-xl border-0 text-[13px] font-semibold text-white cursor-pointer disabled:opacity-50"
                style={{ background: '#dc2626' }}
              >
                {t('user_panel.suspend')}
              </button>
            )
          )}
        </div>

      </div>
      {confirmSuspend && (
        <ConfirmModal
          title={user.status === 'suspended' ? t('users_page.confirm_restore_title') : t('users_page.confirm_suspend_title')}
          description={user.status === 'suspended'
            ? t('users_page.confirm_restore_desc', { name: user.display_name ?? user.email })
            : t('users_page.confirm_suspend_desc', { name: user.display_name ?? user.email })
          }
          confirmLabel={user.status === 'suspended' ? t('users_page.confirm_restore_btn') : t('users_page.confirm_suspend_btn')}
          variant={user.status === 'suspended' ? 'warning' : 'danger'}
          loading={working === user.id}
          onConfirm={() => {
            if (user.status === 'suspended') onUnsuspend(user)
            else onSuspend(user)
            setConfirmSuspend(false)
            onClose()
          }}
          onCancel={() => setConfirmSuspend(false)}
        />
      )}
      {confirmRole && (
        <ConfirmModal
          title={t('user_panel.confirm_role_title')}
          description={t('user_panel.confirm_role_desc', {
            name: user.display_name ?? user.email,
            from: user.role,
            to: selectedRole,
          })}
          confirmLabel={t('user_panel.confirm_role_confirm')}
          variant="warning"
          loading={changingRole}
          onConfirm={handleRoleChange}
          onCancel={() => setConfirmRole(false)}
        />
      )}
    </>
  )
}
