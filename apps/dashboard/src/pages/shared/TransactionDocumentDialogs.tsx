import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  prepareDocumentReservation, reviewTransactionDocument, transactionDocumentType, TRANSACTION_DOCUMENT_TITLE,
  TRANSACTION_DOCUMENT_TYPES, uploadTransactionDocument, validDocumentTitle,
  type DocumentReservation, type TransactionDocument, type TransactionDocumentVersion,
} from '../../api/transactionDocuments'
import type { TransactionRoom } from '../../api/transactions'
import { NETWORK_BUTTON, NETWORK_FIELD, NETWORK_PRIMARY, useNetworkDraftGuard } from '../../components/network/NetworkShared'
import { ProfessionalConfirmation } from '../../components/shared/ProfessionalConfirmation'
import { ProfessionalDialog } from '../../components/shared/ProfessionalDialog'
import { useTransactionMutation } from '../../hooks/useTransactionMutation'

type DialogProps = {
  room: TransactionRoom
  enabled: boolean
  onCancel: () => void
  onSaved: () => void
  onDenied: () => void
  refresh: () => void
}

export function TransactionDocumentUpload({ room, document, enabled, onCancel, onSaved, onDenied, refresh }: DialogProps & {
  document?: TransactionDocument
}) {
  const { t } = useTranslation('transactions')
  const [title, setTitle] = useState(document?.title ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [badFile, setBadFile] = useState(false)
  const [pending, setPending] = useState<DocumentReservation | null>(null)
  const mutation = useTransactionMutation(onDenied, refresh)
  useNetworkDraftGuard(Boolean(file || badFile || (!document && title.trim())), mutation.busy)
  const cancel = () => { if (!mutation.busy) onCancel() }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!enabled || !file || !validDocumentTitle(title)) return
    void mutation.run(async signal => {
      const reservation = pending ?? await prepareDocumentReservation(file, title, crypto.randomUUID(), document?.id)
      signal.throwIfAborted()
      setPending(reservation)
      await uploadTransactionDocument(room.id, reservation, file, signal)
    }, onSaved)
  }

  return <ProfessionalDialog title={t(document ? 'documents_ui.add_version' : 'documents_ui.add_document')}
    closeLabel={t('close_dialog')} onClose={cancel}>
    <form onSubmit={submit} className="min-w-0 space-y-4">
      {document ? <p className="break-words font-semibold">{document.title}</p> : <label className="block text-sm font-semibold">
        {t('documents_ui.title')}
        <input className={NETWORK_FIELD} required value={title} maxLength={2 * TRANSACTION_DOCUMENT_TITLE}
          disabled={!enabled || mutation.busy || Boolean(pending)} onChange={event => setTitle(event.target.value)} />
      </label>}
      <div className="space-y-1">
        <label className="block text-sm font-semibold">
          {t('documents_ui.file')}
          <input className="mt-2 block min-w-0 max-w-full text-sm" type="file" accept={TRANSACTION_DOCUMENT_TYPES.join(',')}
            disabled={!enabled || mutation.busy || Boolean(pending)} onChange={event => {
              const selected = event.target.files?.[0] ?? null
              const invalid = Boolean(selected && !transactionDocumentType(selected))
              setBadFile(invalid)
              setFile(invalid ? null : selected)
              if (invalid) event.currentTarget.value = ''
            }} />
        </label>
        <p className="text-xs text-ink2">{t('documents_ui.file_help')}</p>
      </div>
      {badFile ? <p role="alert" className="text-sm text-red-800">{t('documents_ui.invalid_file')}</p> : null}
      {mutation.error ? <p role="alert" className="text-sm text-red-800">{t(mutation.error)}</p> : null}
      {mutation.busy ? <p role="status" className="text-sm text-ink2">{t('documents_ui.uploading')}</p> : null}
      {!mutation.busy && pending ? <p className="text-sm text-ink2">{t('documents_ui.retry_same_help')}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={NETWORK_PRIMARY} disabled={!enabled || mutation.busy || !file || !validDocumentTitle(title)}>
          {t(pending ? 'documents_ui.retry_same' : 'documents_ui.submit')}
        </button>
        <button type="button" className={NETWORK_BUTTON} onClick={cancel} disabled={mutation.busy}>{t('cancel')}</button>
      </div>
    </form>
  </ProfessionalDialog>
}

export function TransactionDocumentReview({ room, document, version, expectedVersion, enabled, onCancel, onSaved, onDenied, refresh }: DialogProps & {
  document: TransactionDocument; version: TransactionDocumentVersion; expectedVersion: number
}) {
  const { t } = useTranslation('transactions')
  const mutation = useTransactionMutation(onDenied, refresh)
  const initialBuyer = version.share_with_buyer === true
  const initialProfessional = version.professional_grant_id ?? ''
  const [buyer, setBuyer] = useState(initialBuyer)
  const [professional, setProfessional] = useState(initialProfessional)
  const [decision, setDecision] = useState<'approved' | 'rejected' | null>(null)
  const professionals = room.members.filter(member => member.role === 'professional' && member.state === 'active' && member.grant_id)
  const targetMissing = Boolean(professional && !professionals.some(member => member.grant_id === professional))
  const conflicted = room.version !== expectedVersion
  const disabled = !enabled || conflicted || mutation.busy
  const approved = version.status === 'approved'
  const action = decision === 'rejected'
    ? approved ? 'documents_ui.withdraw' : 'documents_ui.reject'
    : approved ? 'documents_ui.save_access' : 'documents_ui.approve'
  useNetworkDraftGuard(buyer !== initialBuyer || professional !== initialProfessional || decision !== null, mutation.busy)

  function confirm() {
    if (disabled || !decision || (decision === 'approved' && targetMissing)) return
    void mutation.run(signal => reviewTransactionDocument(room.id, document.id, version.id, {
      expected_version: expectedVersion, status: decision,
      share_with_buyer: decision === 'approved' && buyer,
      professional_grant_id: decision === 'approved' && professional ? professional : null,
    }, signal), onSaved)
  }

  return <ProfessionalDialog title={t('documents_ui.review')} closeLabel={t('close_dialog')} onClose={() => {
    if (!mutation.busy) onCancel()
  }}>
    <p className="mb-4 break-words text-sm text-ink2">{document.title} · {t('documents_ui.version', { number: version.number })}</p>
    {conflicted ? <p role="alert" className="mb-4 text-sm text-red-800">{t('review_changed')}</p>
      : mutation.error ? <p role="alert" className="mb-4 text-sm text-red-800">{t(mutation.error)}</p> : null}
    {decision && (enabled && !conflicted) ? <ProfessionalConfirmation
      message={t(decision === 'approved' ? 'documents_ui.approval_confirm' : approved ? 'documents_ui.withdraw_confirm' : 'documents_ui.reject_confirm')}
      confirmLabel={t(action)} cancelLabel={t('cancel')} busy={mutation.busy} onConfirm={confirm} onCancel={() => setDecision(null)} />
      : <div className="space-y-4">
        <p className="text-sm text-ink2">{t('documents_ui.audience_help')}</p>
        <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={buyer} onChange={event => setBuyer(event.target.checked)} disabled={disabled} />
          {t('documents_ui.share_buyer')}
        </label>
        <label className="block min-w-0 text-sm font-semibold">{t('documents_ui.share_professional')}
          <select value={professional} onChange={event => setProfessional(event.target.value)} disabled={disabled} className={NETWORK_FIELD}>
            <option value="">{t('documents_ui.no_professional')}</option>
            {targetMissing ? <option value={professional} disabled>{t('documents_ui.professional_unavailable')}</option> : null}
            {professionals.map(member => <option key={member.grant_id} value={member.grant_id ?? ''}>
              {member.display_name || t('role.professional')}
            </option>)}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={NETWORK_PRIMARY} onClick={() => setDecision('approved')} disabled={disabled || targetMissing}>
            {t(approved ? 'documents_ui.review_access' : 'documents_ui.review_approve')}
          </button>
          <button type="button" className={NETWORK_BUTTON} onClick={() => setDecision('rejected')} disabled={disabled}>
            {t(approved ? 'documents_ui.review_withdraw' : 'documents_ui.review_reject')}
          </button>
          <button type="button" className={NETWORK_BUTTON} onClick={onCancel} disabled={mutation.busy}>{t('cancel')}</button>
        </div>
      </div>}
  </ProfessionalDialog>
}
