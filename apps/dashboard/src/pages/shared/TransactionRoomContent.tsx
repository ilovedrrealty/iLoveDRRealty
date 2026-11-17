import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  canManageTransaction, getTransactionHistory, transactionAccessDenied, transactionTaskStatuses, TRANSACTION_HISTORY_SIZE,
  type TransactionRoom, type TransactionTaskEvidenceLink,
} from '../../api/transactions'
import { NetworkDate, NETWORK_BUTTON, NETWORK_PRIMARY } from '../../components/network/NetworkShared'
import { useNetworkRead } from '../../hooks/useNetworkRead'
import { TransactionRoomEditor, type TransactionEdit } from './TransactionRoomEditor'
import { TransactionDocuments } from './TransactionDocuments'

const ROOM_SECTIONS = ['tasks', 'milestones', 'members', 'documents', 'history'] as const
const HISTORY_ACTIONS = new Set([
  'room_created', 'room_closed', 'room_retired', 'professional_invited', 'professional_accepted',
  'professional_revoked', 'assignment_changed', 'task_created', 'task_updated', 'task_evidence_reviewed', 'milestone_created',
  'milestone_updated', 'document_version_submitted', 'document_version_approved', 'document_version_rejected',
  'document_version_access_changed', 'document_version_withdrawn',
])
const rowClass = 'flex min-w-0 flex-wrap items-start justify-between gap-3 rounded-xl border border-line bg-white p-4'
type ContentProps = {
  room: TransactionRoom
  userId: string
  stale: boolean
  refresh: () => void
  onUpdated: (room: TransactionRoom) => void
  onDenied: () => void
}

function RoomHistory({ roomId, userId, onDenied }: { roomId: string; userId: string; onDenied: () => void }) {
  const { t } = useTranslation('transactions')
  const [cursors, setCursors] = useState<number[]>([])
  const before = cursors[cursors.length - 1]
  const read = useNetworkRead(`transaction-history:${userId}:${roomId}:${before ?? 'latest'}`, signal => getTransactionHistory(roomId, before, signal))
  const denied = transactionAccessDenied(read.error)
  useEffect(() => {
    if (denied) onDenied()
  }, [denied, onDenied])
  if (denied) return <p role="alert">{t('error_access')}</p>
  if (read.error) return <div className="space-y-3">
    <p role="alert">{t('error_retry')}</p>
    <button type="button" className={NETWORK_BUTTON} onClick={read.refresh}>{t('retry')}</button>
  </div>
  if (!read.data) return <p role="status" className="text-sm text-ink2">{t('loading')}</p>
  const items = [...read.data].sort((a, b) => b.sequence - a.sequence)
  const oldest = items[items.length - 1]?.sequence
  const hasOlder = oldest !== undefined && oldest > 1 && items.length >= TRANSACTION_HISTORY_SIZE
  return <>
    {items.length ? <ol className="space-y-3">
      {items.map(entry => <li className={rowClass} key={entry.sequence}>
        <div className="min-w-0">
          <p className="break-words text-sm font-bold">{t(HISTORY_ACTIONS.has(entry.action) ? `event.${entry.action}` : 'event.other')}</p>
          <p className="mt-1 text-xs text-ink2">{t(`role.${entry.actor_role}`)}</p>
        </div>
        <p className="text-xs text-ink2"><NetworkDate value={entry.created_at} showTime /></p>
      </li>)}
    </ol> : <p className="text-sm text-ink2">{t(before ? 'empty_page' : 'no_history')}</p>}
    {before || hasOlder ? <nav aria-label={t('history_pages')} className="flex flex-wrap gap-2">
      <button type="button" className={NETWORK_BUTTON} disabled={!before || read.checking}
        onClick={() => setCursors(current => current.slice(0, -1))}>{t('newer_history')}</button>
      <button type="button" className={NETWORK_BUTTON} disabled={!hasOlder || read.checking}
        onClick={() => { if (oldest !== undefined) setCursors(current => [...current, oldest]) }}>{t('older_history')}</button>
    </nav> : null}
  </>
}

export function TransactionRoomContent({ room, userId, stale, refresh, onUpdated, onDenied }: ContentProps) {
  const { t } = useTranslation('transactions')
  const [section, setSection] = useState<typeof ROOM_SECTIONS[number]>('tasks')
  const [editor, setEditor] = useState<TransactionEdit | null>(null)
  const [evidenceFocus, setEvidenceFocus] = useState<TransactionTaskEvidenceLink | null>(null)
  const manager = canManageTransaction(room)
  const memberNames = new Map(room.members.map(member => [member.user_id, member.display_name]))
  return <article className="min-w-0 space-y-4">
    <header className="flex min-w-0 flex-wrap items-start justify-between gap-3 rounded-2xl border border-line bg-paper p-4 sm:p-6">
      <div className="min-w-0">
        <h2 className="break-words text-xl font-bold">{room.title}</h2>
        <p className="mt-1 text-sm text-ink2">{t(`role.${room.role}`)} · {t(`room_status.${room.status}`)}</p>
      </div>
      {manager ? <button type="button" className={NETWORK_BUTTON} disabled={stale}
        onClick={() => setEditor({ kind: 'close', version: room.version })}>{t('close_room')}</button> : null}
      {stale ? <div className="flex w-full flex-wrap items-center gap-3">
        <p role="status" className="text-sm text-ink2">{t('checking_access')}</p>
        <button type="button" className={NETWORK_BUTTON} onClick={refresh}>{t('refresh')}</button>
      </div> : null}
    </header>
    <div role="group" aria-label={t('sections')} className="flex min-w-0 flex-wrap gap-2">
      {ROOM_SECTIONS.map(value => <button type="button" key={value} aria-pressed={section === value}
        className={section === value ? NETWORK_PRIMARY : NETWORK_BUTTON}
        onClick={() => { setEvidenceFocus(null); setSection(value) }}>{t(value)}</button>)}
    </div>
    <section className="min-w-0 space-y-4 rounded-2xl border border-line bg-paper p-4 sm:p-6" aria-labelledby="transaction-section">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="transaction-section" className="text-lg font-bold">{t(section)}</h3>
        {manager && section === 'tasks' ? <button type="button" className={NETWORK_PRIMARY} disabled={stale}
          onClick={() => setEditor({ kind: 'task', version: room.version })}>{t('add_task')}</button> : null}
        {manager && section === 'milestones' ? <button type="button" className={NETWORK_PRIMARY} disabled={stale}
          onClick={() => setEditor({ kind: 'milestone', version: room.version })}>{t('add_milestone')}</button> : null}
        {manager && section === 'members' ? <button type="button" className={NETWORK_PRIMARY} disabled={stale}
          onClick={() => setEditor({ kind: 'invite', version: room.version })}>{t('invite_professional')}</button> : null}
      </div>
      {section === 'tasks' ? room.tasks.length ? <ul className="space-y-3">
        {room.tasks.map(task => <li key={task.id} className={rowClass}>
          <div className="min-w-0">
            <h4 className="break-words text-sm font-bold">{task.title}</h4>
            <p className="mt-1 break-words text-sm text-ink2">{(task.assignee_user_id && memberNames.get(task.assignee_user_id)) || t('unassigned')} · {t(`task_status.${task.status}`)}</p>
            {task.due_on ? <p className="mt-1 flex flex-wrap gap-1 text-xs text-ink2">{t('due_on')} <NetworkDate value={task.due_on} /></p> : null}
            {!stale && task.evidence ? <div className="mt-2 space-y-2">
              <button type="button" className={NETWORK_BUTTON} disabled={stale} onClick={() => {
                const evidence = task.evidence
                if (!evidence) return
                setEvidenceFocus({ document_id: evidence.document_id, version_id: evidence.version_id })
                setSection('documents')
              }}>{t('named_document_evidence', { title: task.evidence.title, number: task.evidence.number })}</button>
              {task.evidence.reviewed_at && <p className="flex flex-wrap gap-1 break-words text-xs text-ink2">
                {task.evidence.reviewer_name ? t('document_reviewed_by', { name: task.evidence.reviewer_name })
                  : t('document_review_recorded')}
                <NetworkDate value={task.evidence.reviewed_at} showTime />
              </p>}
            </div> : !stale && task.requires_evidence_review && <p className="mt-2 text-xs text-ink2">{t('document_evidence_unavailable')}</p>}
          </div>
          {transactionTaskStatuses(room, task, userId).length ? <button type="button" className={NETWORK_BUTTON} disabled={stale}
            onClick={() => setEditor({ kind: 'task', version: room.version, task })}>{t(manager ? 'edit_task' : 'change_status')}</button> : null}
        </li>)}
      </ul> : <p className="text-sm text-ink2">{t('no_tasks')}</p> : null}
      {section === 'milestones' ? room.milestones.length ? <ul className="space-y-3">
        {room.milestones.map(milestone => <li key={milestone.id} className={rowClass}>
          <div className="min-w-0">
            <h4 className="break-words text-sm font-bold">{milestone.title}</h4>
            <p className="mt-1 flex flex-wrap gap-1 text-xs text-ink2">{t('target_on')} {milestone.target_on ? <NetworkDate value={milestone.target_on} /> : t('date_unset')}</p>
            <p className="mt-1 flex flex-wrap gap-1 text-xs text-ink2">{t('actual_on')} {milestone.actual_on ? <NetworkDate value={milestone.actual_on} /> : t('date_unset')}</p>
          </div>
          {manager ? <button type="button" className={NETWORK_BUTTON} disabled={stale}
            onClick={() => setEditor({ kind: 'milestone', version: room.version, milestone })}>{t('edit_milestone')}</button> : null}
        </li>)}
      </ul> : <p className="text-sm text-ink2">{t('no_milestones')}</p> : null}
      {section === 'members' ? room.members.length ? <ul className="space-y-3">
        {room.members.map(member => <li key={member.grant_id ?? member.user_id} className={rowClass}>
          <div className="min-w-0">
            <p className="break-words text-sm font-bold">{member.display_name || t(`role.${member.role}`)}</p>
            <p className="mt-1 text-xs text-ink2">{t(`role.${member.role}`)} · {t(`member_state.${member.state}`)}</p>
          </div>
          {manager && member.grant_id && member.state !== 'revoked' ? <button type="button" className={NETWORK_BUTTON} disabled={stale}
            onClick={() => setEditor({ kind: 'revoke', version: room.version, member })}>{t('revoke_access')}</button> : null}
        </li>)}
      </ul> : <p className="text-sm text-ink2">{t('no_members')}</p> : null}
      {section === 'documents' ? <TransactionDocuments key={room.role} room={room} userId={userId} stale={stale}
        refresh={refresh} onDenied={onDenied} focus={evidenceFocus} onClearFocus={() => setEvidenceFocus(null)} /> : null}
      {section === 'history' ? <RoomHistory key={room.version} roomId={room.id} userId={userId} onDenied={onDenied} /> : null}
    </section>
    {editor ? <TransactionRoomEditor editor={editor} room={room} userId={userId} stale={stale}
      onCancelled={() => setEditor(null)} refresh={refresh} onDenied={onDenied} onUpdated={value => {
        setEditor(null)
        onUpdated(value)
      }} /> : null}
  </article>
}
