import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  acceptTransactionInvitation, createTransactionRoom, getTransactionRoom, listTransactionInvitations,
  listTransactionRooms, transactionAccessDenied, transactionForLead, transactionOpenId, TRANSACTION_TITLE_LIMIT,
  TRANSACTION_MAX_PAGE, TRANSACTION_PAGE_SIZE,
  type TransactionRoom,
} from '../../api/transactions'
import { NETWORK_BUTTON, NETWORK_FIELD, NETWORK_PRIMARY, NetworkDate, useNetworkDraftGuard } from '../../components/network/NetworkShared'
import { ProfessionalConfirmation } from '../../components/shared/ProfessionalConfirmation'
import { ProfessionalDialog } from '../../components/shared/ProfessionalDialog'
import { useNetworkRead, type NetworkRead } from '../../hooks/useNetworkRead'
import { useTransactionMutation } from '../../hooks/useTransactionMutation'
import type { UserInfo } from '../../lib/auth'
import { TransactionRoomContent } from './TransactionRoomContent'

const surface = 'min-w-0 space-y-4 rounded-2xl border border-line bg-paper p-4 sm:p-6'
const canCreate = (role: string) => role === 'admin' || role === 'realtor'

function ReadState({ read }: { read: NetworkRead<unknown> }) {
  const { t } = useTranslation('transactions')
  if (transactionAccessDenied(read.error)) return <p role="alert">{t('error_access')}</p>
  if (!read.data && !read.checking && read.error) return <div className="space-y-3">
    <p role="alert">{t('error_retry')}</p>
    <button type="button" className={NETWORK_BUTTON} onClick={read.refresh}>{t('retry')}</button>
  </div>
  if (!read.data || read.checking) return <p className={read.data ? 'sr-only' : 'text-sm text-ink2'} role="status">{t('loading')}</p>
  return null
}

function RoomPagination({ label, page, count, move, busy }: {
  label: string; page: number; count: number | undefined; move: (value: number) => void; busy: boolean
}) {
  const { t } = useTranslation('transactions')
  if (page === 1 && (count ?? 0) < TRANSACTION_PAGE_SIZE) return null
  return <nav aria-label={label} className="flex min-w-0 flex-wrap items-center gap-2">
    <button type="button" disabled={busy || page <= 1} className={NETWORK_BUTTON} onClick={() => move(page - 1)}>{t('previous_page')}</button>
    <span role="status" className="text-sm text-ink2">{t('page', { page })}</span>
    <button type="button" disabled={busy || page >= TRANSACTION_MAX_PAGE || (count ?? 0) < TRANSACTION_PAGE_SIZE}
      className={NETWORK_BUTTON} onClick={() => move(page + 1)}>{t('next_page')}</button>
  </nav>
}

function RoomIndex({ user, open }: { user: UserInfo; open: (id: string) => void }) {
  const { t } = useTranslation('transactions')
  const [generation, setGeneration] = useState(0)
  const [roomPage, setRoomPage] = useState(1)
  const [invitationPage, setInvitationPage] = useState(1)
  const rooms = useNetworkRead(`transactions:${user.id}:${generation}:${roomPage}`, signal => listTransactionRooms(roomPage, signal))
  const invitations = useNetworkRead(`transaction-invitations:${user.id}:${generation}:${invitationPage}`, signal => listTransactionInvitations(invitationPage, signal))
  const [accepting, setAccepting] = useState<string | null>(null)
  const [accepted, setAccepted] = useState<{ invitation: string; room: string } | null>(null)
  function refresh() { rooms.refresh(); invitations.refresh() }
  function onDenied() {
    setAccepting(null)
    setAccepted(null)
    setGeneration(previous => previous + 1)
  }
  const mutation = useTransactionMutation(onDenied, refresh)
  useNetworkDraftGuard(false, mutation.busy)
  function acceptInvitation(id: string) {
    void mutation.run(signal => acceptTransactionInvitation(id, signal), room => {
      setAccepting(null)
      setAccepted({ invitation: id, room: room.id })
      refresh()
    })
  }

  const pending = invitations.data?.filter(invitation => invitation.id !== accepted?.invitation)
  return <div className="min-w-0 space-y-4">
    <section className={surface} aria-labelledby="transaction-list">
      <h2 id="transaction-list" className="text-lg font-bold">{t('your_rooms')}</h2>
      <ReadState read={rooms} />
      {rooms.data?.length === 0 ? <p className="text-sm text-ink2">{t(roomPage === 1 ? 'no_rooms' : 'empty_page')}</p> : null}
      {rooms.data?.length ? <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rooms.data.map(room => <li key={room.id} className="min-w-0 rounded-xl border border-line bg-white p-4">
          <h3 className="break-words font-bold text-ink">{room.title}</h3>
          <p className="my-2 text-xs text-ink2">{t(`role.${room.role}`)} · {t(`room_status.${room.status}`)}</p>
          <button type="button" className={NETWORK_BUTTON} onClick={() => open(room.id)}>{t('open_room')}</button>
        </li>)}
      </ul> : null}
      {!transactionAccessDenied(rooms.error) ? <RoomPagination label={t('rooms_pages')} page={roomPage} count={rooms.data?.length}
        move={setRoomPage} busy={rooms.checking || mutation.busy} /> : null}
    </section>
    <section className={surface} aria-labelledby="transaction-invitations">
      <h2 id="transaction-invitations" className="text-lg font-bold">{t('invitations')}</h2>
      <ReadState read={invitations} />
      {mutation.error ? <p role="alert" className="text-sm text-red-800">{t(mutation.error)}</p> : null}
      {accepted ? <div className="flex flex-wrap items-center gap-3">
        <p role="status" className="text-sm">{t('accepted')}</p>
        <button type="button" className={NETWORK_BUTTON} onClick={() => open(accepted.room)}>{t('open_accepted_room')}</button>
      </div> : null}
      {pending?.length === 0 ? <p className="text-sm text-ink2">{t(invitationPage === 1 ? 'no_invitations' : 'empty_page')}</p> : null}
      {pending?.length ? <ul className="space-y-3">
        {pending.map(invitation => <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white p-3 text-sm">
          <div><p className="font-semibold">{t('professional_invitation')}</p><NetworkDate value={invitation.invited_at} showTime /></div>
          <button type="button" className={NETWORK_BUTTON} disabled={invitations.stale || mutation.busy} onClick={() => {
            mutation.clearError()
            setAccepting(invitation.id)
          }}>{t('accept_invitation')}</button>
        </li>)}
      </ul> : null}
      {!transactionAccessDenied(invitations.error) ? <RoomPagination label={t('invitation_pages')} page={invitationPage}
        count={invitations.data?.length} move={setInvitationPage} busy={invitations.checking || mutation.busy} /> : null}
    </section>
    {accepting ? <ProfessionalDialog title={t('accept_invitation')} closeLabel={t('close_dialog')} onClose={() => {
      if (!mutation.busy) setAccepting(null)
    }}>
      {mutation.error ? <p role="alert" className="mb-3 text-sm text-red-800">{t(mutation.error)}</p> : null}
      <ProfessionalConfirmation message={t('accept_confirm')} confirmLabel={t('accept_and_join')} cancelLabel={t('cancel')} busy={mutation.busy}
        onConfirm={() => acceptInvitation(accepting)} onCancel={() => setAccepting(null)} />
    </ProfessionalDialog> : null}
  </div>
}

function LeadRoom({ id, user, open }: { id: string; user: UserInfo; open: (id: string) => void }) {
  const { t } = useTranslation('transactions')
  const [generation, setGeneration] = useState(0)
  const read = useNetworkRead(`transaction-lead:${user.id}:${id}:${generation}`, signal => transactionForLead(id, signal))
  const [created, setCreated] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const mutation = useTransactionMutation(() => {
    setTitle('')
    setCreated(null)
    setGeneration(previous => previous + 1)
  }, read.refresh)
  const roomId = read.data ? read.data.room?.id ?? created : null
  useNetworkDraftGuard(Boolean(title.trim()) && !roomId, mutation.busy)

  function submit(event: FormEvent) {
    event.preventDefault()
    const value = title.trim()
    if (!value || value.length > TRANSACTION_TITLE_LIMIT || read.stale || !canCreate(user.role) || !read.data || roomId) return
    void mutation.run(signal => createTransactionRoom(id, value, signal), room => {
      setTitle('')
      setCreated(room.id)
      read.refresh()
    })
  }

  return <section className={surface} aria-labelledby="transaction-lead-heading">
    <h2 id="transaction-lead-heading" className="text-lg font-bold">{t('lead_room')}</h2>
    <ReadState read={read} />
    {mutation.error ? <p role="alert" className="text-sm text-red-800">{t(mutation.error)}</p> : null}
    {roomId ? <button type="button" className={NETWORK_PRIMARY} onClick={() => open(roomId)}>{t('open_room')}</button> : null}
    {!roomId && read.data && canCreate(user.role) ? <form className="max-w-lg space-y-3" onSubmit={submit}>
      <p className="text-sm text-ink2">{t('new_room_access')}</p>
      <label className="block text-sm font-semibold">{t('room_title')}
        <input className={NETWORK_FIELD} value={title} onChange={event => setTitle(event.target.value)}
          required maxLength={TRANSACTION_TITLE_LIMIT} disabled={mutation.busy} />
      </label>
      <button type="submit" className={NETWORK_PRIMARY} disabled={read.stale || mutation.busy || !title.trim()}>{t('create_room')}</button>
    </form> : null}
  </section>
}

function RoomDetails({ id, user }: { id: string; user: UserInfo }) {
  const [generation, setGeneration] = useState(0)
  const read = useNetworkRead(`transaction-room:${user.id}:${id}:${generation}`, signal => getTransactionRoom(id, signal))
  const [updated, setUpdated] = useState<TransactionRoom | null>(null)
  const room = read.data && updated && updated.version > read.data.version ? updated : read.data
  function onDenied() {
    setUpdated(null)
    setGeneration(previous => previous + 1)
  }
  return <>
    <ReadState read={read} />
    {room ? <TransactionRoomContent room={room} userId={user.id} stale={read.stale} refresh={read.refresh}
      onUpdated={value => {
        if (value.id === id) setUpdated(value)
        read.refresh()
      }} onDenied={onDenied} /> : null}
  </>
}

export function TransactionRooms({ user, go, fromLead = false }: {
  user: UserInfo; go: (view: string, openId?: string) => void; fromLead?: boolean
}) {
  const { t } = useTranslation('transactions')
  const [params] = useSearchParams()
  const id = transactionOpenId(params)
  if (!params.has('openId') && !fromLead) return <RoomIndex key={user.id} user={user} open={value => go('transactions', value)} />
  return <div className="min-w-0 space-y-4">
    <button type="button" className={NETWORK_BUTTON} onClick={() => go(fromLead ? 'leads' : 'transactions')}>{t(fromLead ? 'back_to_leads' : 'back_to_rooms')}</button>
    {!id ? <p role="alert">{t('error_access')}</p> : fromLead
      ? <LeadRoom key={id} id={id} user={user} open={value => go('transactions', value)} />
      : <RoomDetails key={id} id={id} user={user} />}
  </div>
}
