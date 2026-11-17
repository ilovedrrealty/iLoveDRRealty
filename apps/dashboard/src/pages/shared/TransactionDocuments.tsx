import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  downloadTransactionDocument, listTransactionDocuments, type TransactionDocument, type TransactionDocumentVersion,
} from '../../api/transactionDocuments'
import { canManageTransaction, transactionAccessDenied, type TransactionRoom } from '../../api/transactions'
import { NETWORK_BUTTON, NETWORK_PRIMARY, NetworkDate } from '../../components/network/NetworkShared'
import { useNetworkRead } from '../../hooks/useNetworkRead'
import { useTransactionMutation } from '../../hooks/useTransactionMutation'
import { TransactionDocumentReview, TransactionDocumentUpload } from './TransactionDocumentDialogs'

type ActiveDialog = { kind: 'upload'; document?: TransactionDocument }
  | { kind: 'review'; document: TransactionDocument; version: TransactionDocumentVersion; expectedVersion: number }

export function TransactionDocuments({ room, userId, stale, refresh, onDenied }: {
  room: TransactionRoom; userId: string; stale: boolean; refresh: () => void; onDenied: () => void
}) {
  const { t } = useTranslation('transactions')
  const read = useNetworkRead(`transaction-documents:${userId}:${room.id}`, signal => listTransactionDocuments(room.id, signal))
  const denied = transactionAccessDenied(read.error)
  const writeBlocked = stale || read.stale || room.status !== 'open'
  const staff = room.role === 'admin' || room.role === 'realtor'
  const manager = canManageTransaction(room)
  const [dialog, setDialog] = useState<ActiveDialog | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const transfer = useRef<{ url: string; timer: number } | null>(null)
  const mutation = useTransactionMutation(onDenied, read.refresh)

  useEffect(() => {
    if (denied) onDenied()
  }, [denied, onDenied])

  useEffect(() => () => {
    if (transfer.current) {
      window.clearTimeout(transfer.current.timer)
      URL.revokeObjectURL(transfer.current.url)
    }
  }, [])

  function updateReads() { read.refresh(); refresh() }

  function openDialog(value: ActiveDialog) {
    mutation.clearError()
    setSuccess(null)
    setDialog(value)
  }

  function download(document: TransactionDocument, version: TransactionDocumentVersion) {
    if (stale || read.stale || !version.can_download || (!staff && version.status !== 'approved')) return
    setSuccess(null)
    void mutation.run(signal => downloadTransactionDocument(room.id, document.id, version, signal), blob => {
      if (transfer.current) {
        window.clearTimeout(transfer.current.timer)
        URL.revokeObjectURL(transfer.current.url)
      }
      const url = URL.createObjectURL(blob)
      const link = window.document.createElement('a')
      link.href = url
      link.download = version.file_name
      link.rel = 'noopener noreferrer'
      window.document.body.append(link)
      link.click()
      link.remove()
      transfer.current = { url, timer: window.setTimeout(() => {
        URL.revokeObjectURL(url)
        transfer.current = null
      }, 1000) }
    })
  }

  if (denied) return <p role="alert">{t('error_access')}</p>
  const documents = read.data?.items ?? []
  const docForDialog = dialog?.document ? documents.find(document => document.id === dialog.document?.id) : undefined
  const versionForDialog = dialog?.kind === 'review' ? docForDialog?.versions.find(version => version.id === dialog.version.id) : undefined
  const canUpload = read.data?.can_upload === true
  const dialogProps = {
    room, onDenied, refresh: updateReads,
    onCancel: () => setDialog(null),
    onSaved: () => {
      setSuccess(dialog?.kind === 'review' ? 'documents_ui.review_saved' : 'documents_ui.upload_saved')
      setDialog(null)
      updateReads()
    },
  }
  return <div className="min-w-0 space-y-4">
    {canUpload ? <button type="button" className={NETWORK_PRIMARY} disabled={writeBlocked}
      onClick={() => openDialog({ kind: 'upload' })}>{t('documents_ui.add_document')}</button> : null}
    {read.error ? <div className="flex flex-wrap items-center gap-3">
      <p role="alert" className="text-sm text-red-800">{t('error_retry')}</p>
      <button type="button" className={NETWORK_BUTTON} onClick={read.refresh}>{t('retry')}</button>
    </div> : !read.data ? <p role="status" className="text-sm text-ink2">{t('loading')}</p> : null}
    {mutation.error ? <p role="alert" className="text-sm text-red-800">{t(mutation.error)}</p> : null}
    {success ? <p role="status" className="text-sm text-ink2">{t(success)}</p> : null}
    {read.data && !documents.length ? <p className="text-sm text-ink2">{t('documents_ui.empty')}</p> : null}
    {documents.map(document => <article key={document.id} aria-label={document.title}
      className="min-w-0 space-y-3 rounded-xl border border-line bg-white p-3 sm:p-4">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <h4 className="min-w-0 break-words font-bold">{document.title}</h4>
        {document.can_add_version ? <button type="button" className={NETWORK_BUTTON} disabled={writeBlocked}
          onClick={() => openDialog({ kind: 'upload', document })}>{t('documents_ui.add_version')}</button> : null}
      </div>
      <ul className="space-y-2">
        {[...document.versions].sort((a, b) => b.number - a.number).map(version => <li key={version.id}
          className="flex min-w-0 flex-wrap items-start justify-between gap-3 rounded-lg border border-line p-3">
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold">{t('documents_ui.version', { number: version.number })} · {t(`documents_ui.status.${version.status}`)}</p>
            <p className="break-all text-sm text-ink2">{version.file_name}</p>
            <p className="text-xs text-ink2"><NetworkDate value={version.uploaded_at} showTime /></p>
          </div>
          <div className="flex min-w-0 flex-wrap gap-2">
            {version.can_download && (staff || version.status === 'approved') ? <button type="button" className={NETWORK_BUTTON}
              disabled={stale || read.stale || mutation.busy} onClick={() => download(document, version)}>
              {t('documents_ui.download', { number: version.number })}
            </button> : null}
            {manager && version.can_review ? <button type="button" className={NETWORK_BUTTON} disabled={writeBlocked}
              onClick={() => openDialog({ kind: 'review', document, version, expectedVersion: room.version })}>
              {t('documents_ui.review_number', { number: version.number })}
            </button> : null}
          </div>
        </li>)}
      </ul>
    </article>)}
    {dialog?.kind === 'upload' ? <TransactionDocumentUpload {...dialogProps} document={dialog.document}
      enabled={!writeBlocked && (dialog.document ? docForDialog?.can_add_version === true : canUpload)} /> : null}
    {dialog?.kind === 'review' ? <TransactionDocumentReview {...dialogProps} document={dialog.document} version={dialog.version}
      expectedVersion={dialog.expectedVersion} enabled={!writeBlocked && manager && versionForDialog?.can_review === true} /> : null}
  </div>
}
