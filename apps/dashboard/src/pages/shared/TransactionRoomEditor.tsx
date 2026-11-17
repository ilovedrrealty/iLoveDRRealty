import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  canManageTransaction, closeTransactionRoom, createTransactionTask, inviteTransactionProfessional,
  revokeTransactionMember, saveTransactionMilestone, transactionAccountCode, transactionTaskStatuses,
  TRANSACTION_WORK_TITLE_LIMIT, updateTransactionTask, type TransactionMember, type TransactionMilestone,
  type TransactionRoom, type TransactionTask, type TransactionTaskStatus,
} from '../../api/transactions'
import { todayInDR, validCalendarDate } from '../../api/propertyManagement'
import { listTransactionDocuments } from '../../api/transactionDocuments'
import { NETWORK_BUTTON, NETWORK_FIELD, NETWORK_PRIMARY, useNetworkDraftGuard } from '../../components/network/NetworkShared'
import { ProfessionalConfirmation } from '../../components/shared/ProfessionalConfirmation'
import { ProfessionalDialog } from '../../components/shared/ProfessionalDialog'
import { useTransactionMutation } from '../../hooks/useTransactionMutation'
import { useNetworkRead } from '../../hooks/useNetworkRead'

export type TransactionEdit = { version: number } & (
  { kind: 'task'; task?: TransactionTask } | { kind: 'milestone'; milestone?: TransactionMilestone }
  | { kind: 'invite' } | { kind: 'close' } | { kind: 'revoke'; member: TransactionMember }
)

const validOptionalDate = (value: string) => !value || validCalendarDate(value)

type EditorProps = {
  editor: TransactionEdit
  room: TransactionRoom
  userId: string
  stale: boolean
  refresh: () => void
  onCancelled: () => void
  onUpdated: (value: TransactionRoom) => void
  onDenied: () => void
}

export function TransactionRoomEditor({ editor, room, userId, stale, refresh, onCancelled, onUpdated, onDenied }: EditorProps) {
  const { t } = useTranslation('transactions')
  const mutation = useTransactionMutation(onDenied, refresh)
  const task = editor.kind === 'task' ? editor.task : undefined
  const milestone = editor.kind === 'milestone' ? editor.milestone : undefined
  const [title, setTitle] = useState(task?.title ?? milestone?.title ?? '')
  const [assignee, setAssignee] = useState(task?.assignee_user_id ?? '')
  const [evidenceVersion, setEvidenceVersion] = useState(task?.evidence?.version_id ?? '')
  const [dueOn, setDueOn] = useState(task?.due_on ?? '')
  const [status, setStatus] = useState<TransactionTaskStatus>(task?.status ?? 'open')
  const [targetOn, setTargetOn] = useState(milestone?.target_on ?? '')
  const [actualOn, setActualOn] = useState(milestone?.actual_on ?? '')
  const [code, setCode] = useState('')
  const manager = canManageTransaction(room)
  const taskStatuses = task ? transactionTaskStatuses(room, task, userId) : []
  const eligible = manager || (editor.kind === 'task' && taskStatuses.length > 0)
  const conflict = editor.version !== room.version
  const disabled = mutation.busy || stale || conflict || !eligible
  const active = room.members.filter(member => member.state === 'active')
  const assigneeGrant = active.find(member => member.role === 'professional' && member.user_id === assignee)?.grant_id
  const canChooseEvidence = manager && editor.kind === 'task' && task?.status !== 'done' && Boolean(assigneeGrant)
  const documents = useNetworkRead(`review-documents:${userId}:${room.id}:${room.version}:${assigneeGrant ?? ''}`,
    signal => listTransactionDocuments(room.id, signal), canChooseEvidence)
  const choices = (!documents.error && !documents.stale && !documents.checking ? documents.data?.items ?? [] : [])
    .flatMap(document => document.versions.filter(version => version.can_download && version.status === 'approved'
      && version.professional_grant_id === assigneeGrant).map(version => ({
      documentId: document.id, title: document.title, number: version.number, id: version.id,
    })))
  const selectedEvidence = choices.find(choice => choice.id === evidenceVersion)
  const evidenceChanged = evidenceVersion !== (task?.evidence?.version_id ?? '')
  const newEvidenceScope = evidenceChanged || (task?.requires_evidence_review && assignee !== (task.assignee_user_id ?? ''))
  const reviewStatuses = evidenceVersion && manager ? taskStatuses.filter(value => value !== 'done') : taskStatuses
  const memberCode = transactionAccountCode(code)
  const validTitle = Boolean(title.trim()) && title.trim().length <= TRANSACTION_WORK_TITLE_LIMIT
  const validAssignee = !assignee || active.some(member => member.user_id === assignee)
  const validTask = (manager ? validTitle && validOptionalDate(dueOn) && validAssignee : true)
    && (!newEvidenceScope || Boolean(selectedEvidence)) && (!task || reviewStatuses.includes(status))
  const today = todayInDR()
  const validMilestone = validTitle && validOptionalDate(targetOn) && validOptionalDate(actualOn) && (!actualOn || actualOn <= today)
  const dirty = title !== (task?.title ?? milestone?.title ?? '') || assignee !== (task?.assignee_user_id ?? '')
    || status !== (task?.status ?? 'open') || dueOn !== (task?.due_on ?? '') || evidenceChanged
    || targetOn !== (milestone?.target_on ?? '') || actualOn !== (milestone?.actual_on ?? '') || Boolean(code)
  useNetworkDraftGuard(dirty, mutation.busy)

  const dialogTitle = editor.kind === 'task' ? task ? manager ? 'edit_task' : 'change_status' : 'add_task'
    : editor.kind === 'milestone' ? milestone ? 'edit_milestone' : 'add_milestone'
    : editor.kind === 'invite' ? 'invite_professional' : editor.kind === 'revoke' ? 'revoke_access' : 'close_room'
  const cancel = () => { if (!mutation.busy) onCancelled() }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (disabled) return
    if (editor.kind === 'invite' && memberCode !== null) {
      void mutation.run(signal => inviteTransactionProfessional(room, memberCode, signal), onUpdated)
    } else if (editor.kind === 'task' && validTask) {
      if (!manager && task) {
        void mutation.run(signal => updateTransactionTask(room, task.id, { status }, signal), onUpdated)
      } else if (manager) {
        const fields = {
          title: title.trim(), assignee_user_id: assignee || null, due_on: dueOn || null,
          ...(evidenceChanged && selectedEvidence ? {
            evidence: { document_id: selectedEvidence.documentId, version_id: selectedEvidence.id },
          } : {}),
        }
        void mutation.run(signal => task ? updateTransactionTask(room, task.id, { ...fields, status }, signal)
          : createTransactionTask(room, fields, signal), onUpdated)
      }
    } else if (editor.kind === 'milestone' && validMilestone && manager) {
      const fields = { title: title.trim(), target_on: targetOn || null, actual_on: actualOn || null }
      void mutation.run(signal => saveTransactionMilestone(room, fields, milestone?.id ?? null, signal), onUpdated)
    }
  }

  function decide() {
    if (disabled || !manager) return
    if (editor.kind === 'close') {
      void mutation.run(signal => closeTransactionRoom(room, signal), onUpdated)
    } else if (editor.kind === 'revoke' && editor.member.grant_id) {
      const grantId = editor.member.grant_id
      void mutation.run(signal => revokeTransactionMember(room, grantId, signal), onUpdated)
    }
  }

  const confirmation = editor.kind === 'close' || editor.kind === 'revoke'
  return <ProfessionalDialog title={t(dialogTitle)} closeLabel={t('close_dialog')} onClose={cancel}>
    {conflict ? <p role="alert" className="mb-4 text-sm text-red-800">{t('review_changed')}</p>
      : mutation.error ? <p role="alert" className="mb-4 text-sm text-red-800">{t(mutation.error)}</p> : null}
    {confirmation ? disabled && !mutation.busy ? <button type="button" className={NETWORK_BUTTON} onClick={cancel}>{t('cancel')}</button>
      : <ProfessionalConfirmation message={t(editor.kind === 'close' ? 'close_confirm' : 'revoke_confirm')}
        confirmLabel={t(editor.kind === 'close' ? 'confirm_close' : 'confirm_revoke')} cancelLabel={t('cancel')}
        busy={mutation.busy} onConfirm={decide} onCancel={cancel} /> : <form className="space-y-4" onSubmit={submit}>
      {editor.kind === 'invite' ? <label className="block text-sm font-semibold">
        {t('account_code')}
        <input className={NETWORK_FIELD} value={code} onChange={event => setCode(event.target.value)}
          maxLength={11} autoComplete="off" disabled={disabled} required />
        <span className="mt-1 block text-xs font-normal text-ink2">{t('invite_hint')}</span>
      </label> : null}
      {editor.kind === 'task' ? <div className="space-y-3">
        {manager ? <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <label className="block min-w-0 text-sm font-semibold sm:col-span-2">{t('task_title')}
            <input className={NETWORK_FIELD} value={title} onChange={event => setTitle(event.target.value)}
              maxLength={TRANSACTION_WORK_TITLE_LIMIT} disabled={disabled} required />
          </label>
          <label className="block min-w-0 text-sm font-semibold">{t('assignee')}
            <select className={NETWORK_FIELD} value={assignee} onChange={event => setAssignee(event.target.value)} disabled={disabled}>
              <option value="">{t('unassigned')}</option>
              {!validAssignee ? <option value={assignee} disabled>{t('assignee_unavailable')}</option> : null}
              {active.map(member => <option key={member.user_id} value={member.user_id}>{member.display_name || t(`role.${member.role}`)}</option>)}
            </select>
          </label>
          <label className="block min-w-0 text-sm font-semibold">{t('due_on')}
            <input className={NETWORK_FIELD} type="date" value={dueOn} onChange={event => setDueOn(event.target.value)} disabled={disabled} />
          </label>
          {canChooseEvidence && <label className="block min-w-0 text-sm font-semibold sm:col-span-2">
            {t('document_evidence')}
            <select className={NETWORK_FIELD} value={evidenceVersion}
              disabled={disabled || documents.checking || documents.stale}
              onChange={event => setEvidenceVersion(event.target.value)}>
              <option value="" disabled={!!task?.requires_evidence_review}>{t('no_document_evidence')}</option>
              {evidenceVersion && !selectedEvidence && <option value={evidenceVersion} disabled>
                {t('existing_document_evidence')}
              </option>}
              {choices.map(choice => <option key={choice.id} value={choice.id}>
                {t('named_document_evidence', { title: choice.title, number: choice.number })}
              </option>)}
            </select>
            <span className="mt-1 block text-xs font-normal text-ink2">{t('document_evidence_hint')}</span>
          </label>}
          {canChooseEvidence && !!documents.error && <button type="button" className={NETWORK_BUTTON}
            onClick={documents.refresh}>{t('retry')}</button>}
        </div> : null}
        {task && reviewStatuses.length ? <label className="block text-sm font-semibold">{t('status')}
          <select className={NETWORK_FIELD} value={status} onChange={event => setStatus(event.target.value as TransactionTaskStatus)} disabled={disabled}>
            {reviewStatuses.map(value => <option key={value} value={value}>{t(`task_status.${value}`)}</option>)}
          </select>
        </label> : null}
      </div> : null}
      {editor.kind === 'milestone' ? <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <label className="block min-w-0 text-sm font-semibold sm:col-span-2">{t('milestone_title')}
          <input className={NETWORK_FIELD} value={title} onChange={event => setTitle(event.target.value)}
            maxLength={TRANSACTION_WORK_TITLE_LIMIT} disabled={disabled} required />
        </label>
        <label className="block min-w-0 text-sm font-semibold">{t('target_on')}
          <input className={NETWORK_FIELD} type="date" value={targetOn} onChange={event => setTargetOn(event.target.value)} disabled={disabled} />
        </label>
        <label className="block min-w-0 text-sm font-semibold">{t('actual_on')}
          <input className={NETWORK_FIELD} type="date" max={today} value={actualOn}
            onChange={event => setActualOn(event.target.value)} disabled={disabled} />
        </label>
      </div> : null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={NETWORK_PRIMARY} disabled={disabled || (editor.kind === 'invite' && memberCode === null)
          || (editor.kind === 'task' && !validTask) || (editor.kind === 'milestone' && !validMilestone)}>
          {t(editor.kind === 'invite' ? 'send_invitation' : 'save')}
        </button>
        <button type="button" className={NETWORK_BUTTON} disabled={mutation.busy} onClick={cancel}>{t('cancel')}</button>
      </div>
    </form>}
  </ProfessionalDialog>
}
