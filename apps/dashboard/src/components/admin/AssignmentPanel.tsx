import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AssignmentChangeError, createAssignmentIntent, getCurrentAssignment, submitAssignment,
  type AssignmentIntent, type AssignmentScope, type CurrentAssignment } from '../../api/assignments'
import type { AdminAgent } from '../../api/admin'
import { agentChoiceLabel, filterAgentChoices } from '../../lib/agentChoices'
import { ConfirmModal } from '../shared/ConfirmModal'
import { AssignmentHistory, assignmentButton } from './AssignmentHistory'

type Change = { kind: 'idle' | 'saved' | 'refused' } | { kind: 'sending' | 'uncertain' | 'reading' | 'read_error'; intent: AssignmentIntent; confirmed: boolean }
type Props = {
  scope: AssignmentScope; targetId: string; initial: CurrentAssignment; agents: AdminAgent[]
  onCurrent: (current: CurrentAssignment) => void; ownerAccess?: boolean
  propertyAgent?: { id: string; name: string | null }
  readOnly?: boolean
}

// Callers key this component by scope and target so no selection, frozen
// command, late read or cached history can move to a different person.
export function AssignmentPanel({ scope, targetId, initial, agents, onCurrent, ownerAccess = false, propertyAgent, readOnly = false }: Props) {
  const { t } = useTranslation('communications'), { t: admin } = useTranslation('admin')
  const [selected, setSelected] = useState(initial.realtor_id ?? '')
  const [query, setQuery] = useState('')
  const [current, setCurrent] = useState<CurrentAssignment | null>(initial)
  const [change, setChange] = useState<Change>({ kind: 'idle' })
  const [denied, setDenied] = useState(false), [revision, setRevision] = useState(0)
  const [confirmAgent, setConfirmAgent] = useState<string | null>(null)
  const mounted = useRef(true), active = useRef<AbortController | null>(null)
  const frozen = useRef<AssignmentIntent | null>(null)
  const sending = useRef(false), reading = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; active.current?.abort() }
  }, [])
  const loseAccess = useCallback(() => {
    active.current?.abort(); setCurrent(null); setDenied(true); setConfirmAgent(null); setChange({ kind: 'idle' })
  }, [])
  const roleLabels = { admin: admin('agent_choices.role_admin'), realtor: admin('agent_choices.role_realtor') }
  const choices = scope === 'lead' ? filterAgentChoices(agents, query, roleLabels) : agents
  const locked = readOnly || denied || change.kind === 'sending' || change.kind === 'uncertain' || change.kind === 'reading' || change.kind === 'read_error'
  const busy = change.kind === 'sending' || change.kind === 'reading'
  const alive = (controller: AbortController) => mounted.current && !controller.signal.aborted && active.current === controller

  async function readCurrent(intent: AssignmentIntent, confirmed: boolean) {
    if (reading.current) return
    reading.current = true
    const controller = new AbortController(); active.current?.abort(); active.current = controller
    setCurrent(null); setChange({ kind: 'reading', intent, confirmed })
    try {
      const value = await getCurrentAssignment(scope, targetId, controller.signal)
      if (!alive(controller)) return
      setCurrent(value); setSelected(value.realtor_id ?? ''); setQuery(''); frozen.current = null
      setChange({ kind: confirmed ? 'saved' : 'refused' }); setRevision(value => value + 1); onCurrent(value)
    } catch (error) {
      if (!alive(controller)) return
      const status = (error as { response?: { status?: number } })?.response?.status
      if (status === 401 || status === 403 || status === 404) loseAccess()
      else setChange({ kind: 'read_error', intent, confirmed })
    } finally { reading.current = false }
  }
  async function send(intent: AssignmentIntent) {
    if (sending.current || readOnly || denied) return
    sending.current = true
    const controller = new AbortController(); active.current?.abort(); active.current = controller
    setCurrent(null); setChange({ kind: 'sending', intent, confirmed: false })
    try {
      await submitAssignment(intent, controller.signal)
      if (alive(controller)) await readCurrent(intent, true)
    } catch (error) {
      if (!alive(controller)) return
      if (error instanceof AssignmentChangeError && error.kind === 'denied') loseAccess()
      else if (error instanceof AssignmentChangeError && error.kind === 'refused') await readCurrent(intent, false)
      else setChange({ kind: 'uncertain', intent, confirmed: false })
    } finally { sending.current = false }
  }
  function start(agentId: string) {
    if (readOnly || denied || frozen.current) return
    try {
      const intent = createAssignmentIntent(scope, targetId, agentId || null)
      frozen.current = intent; setSelected(agentId); setConfirmAgent(null); void send(intent)
    } catch { setChange({ kind: 'refused' }) }
  }
  function request(agentId: string) { if (ownerAccess) setConfirmAgent(agentId); else start(agentId) }
  return <section aria-label={t('assignment.title')} aria-busy={busy} className="min-w-0 space-y-3">
    <h3 className="font-semibold text-ink">{t('assignment.title')}</h3>
    {denied ? <p role="alert">{t('assignment.access_lost')}</p> : <>
      {!readOnly ? <><p className="text-sm [overflow-wrap:anywhere]">{current
        ? current.realtor_id ? current.realtor_name || admin('agent_choices.unavailable_current') : admin('agent_choices.none')
        : t('assignment.current_unavailable')}</p>
      {scope === 'account' ? <p className="text-xs leading-relaxed text-ink2">{t('assignment.account_scope')}</p> : null}
      {scope === 'lead' ? <label className="block min-w-0 text-sm">{admin('lead_panel.search_realtors_ph')}
        <input type="search" value={query} disabled={locked} maxLength={120} onChange={event => setQuery(event.target.value)} className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-line bg-white px-2 text-sm" />
      </label> : null}
      {propertyAgent && propertyAgent.id !== current?.realtor_id && agents.some(agent => agent.id === propertyAgent.id) ? <button type="button" className={assignmentButton}
        disabled={locked} onClick={() => request(propertyAgent.id)}>{admin('lead_panel.quick_assign')}{propertyAgent.name ? `: ${propertyAgent.name}` : ''}</button> : null}
      <div className="flex min-w-0 flex-wrap gap-2">
        <label className="min-w-0 flex-1 text-sm">{t('assignment.agent')}
          <select value={selected} disabled={locked} onChange={event => setSelected(event.target.value)} className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-line bg-white px-2 text-sm">
            <option value="" disabled={scope === 'lead'}>{scope === 'account' ? admin('agent_choices.none') : t('assignment.choose')}</option>
            {selected && !choices.some(agent => agent.id === selected) ? <option value={selected}>{agents.some(agent => agent.id === selected) ? agentChoiceLabel(agents.find(agent => agent.id === selected)!, roleLabels) : admin('agent_choices.unavailable_current')}</option> : null}
            {choices.map(agent => <option key={agent.id} value={agent.id}>{agentChoiceLabel(agent, roleLabels)}</option>)}
          </select>
        </label>
        <button type="button" className={assignmentButton} disabled={locked || scope === 'lead' && !selected || scope === 'account' && selected === (current?.realtor_id ?? '')}
          onClick={() => request(selected)}>{t('assignment.save')}</button>
      </div>
      {busy ? <p role="status">{t(change.kind === 'sending' ? 'assignment.saving' : 'assignment.reading_current')}</p> : null}
      {change.kind === 'uncertain' ? <div className="space-y-2"><p role="alert">{t('assignment.change_uncertain')}</p>
        <button type="button" className={assignmentButton} onClick={() => void send(change.intent)}>{t('assignment.resolve')}</button></div> : null}
      {change.kind === 'read_error' ? <div className="space-y-2"><p role="alert">{t(change.confirmed ? 'assignment.saved_read_error' : 'assignment.refused_read_error')}</p>
        <button type="button" className={assignmentButton} onClick={() => void readCurrent(change.intent, change.confirmed)}>{t('assignment.refresh_current')}</button></div> : null}
      {change.kind === 'saved' ? <p role="status">{t('assignment.saved')}</p> : null}
      {change.kind === 'refused' ? <p role="alert">{t('assignment.refused')}</p> : null}</> : null}
      <AssignmentHistory key={`history:${scope}:${targetId}`} scope={scope} targetId={targetId} revision={revision} onAccessLost={loseAccess} />
    </>}
    {confirmAgent !== null && !denied ? <ConfirmModal title={admin('lead_panel.grant_access_title')} description={admin('lead_panel.grant_access_desc')}
      confirmLabel={admin('lead_panel.grant_access_confirm')} variant="warning" loading={busy}
      onConfirm={() => start(confirmAgent)} onCancel={() => setConfirmAgent(null)} /> : null}
  </section>
}
