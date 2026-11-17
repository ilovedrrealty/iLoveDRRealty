import client from './axios'

export const TRANSACTION_DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const
export const TRANSACTION_DOCUMENT_BYTES = 6 * 1024 * 1024
export const TRANSACTION_DOCUMENT_TITLE = 160

type MediaType = typeof TRANSACTION_DOCUMENT_TYPES[number]
type DocumentStatus = 'submitted' | 'approved' | 'rejected'
export type TransactionDocumentVersion = {
  id: string; number: number; file_name: string; content_type: MediaType; byte_count: number
  uploaded_at: string; reviewed_at: string | null; status: DocumentStatus
  can_download: boolean; can_review: boolean
  share_with_buyer: boolean | null; professional_grant_id: string | null
}
export type TransactionDocument = {
  id: string; title: string; can_add_version: boolean; versions: TransactionDocumentVersion[]
}
export type TransactionDocumentList = { can_upload: boolean; items: TransactionDocument[] }
export type DocumentReservation = {
  request_id: string; document_id?: string; title: string; file_name: string
  content_type: MediaType; byte_count: number; sha256: string
}
type DocumentReceipt = {
  document_id: string; version_id: string; number: number; status: 'reserved' | DocumentStatus
}
export type DocumentReview = {
  expected_version: number; status: 'approved' | 'rejected'
  share_with_buyer: boolean; professional_grant_id: string | null
}

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i
const names = { pdf: 'application/pdf', jpeg: 'image/jpeg', jpg: 'image/jpeg', png: 'image/png' } as const
const documentsPath = (id: string) => `/transactions/${encodeURIComponent(id)}/documents`
const versionPath = (room: string, document: string, version: string) =>
  `${documentsPath(room)}/${encodeURIComponent(document)}/versions/${encodeURIComponent(version)}`

function boundedPlainText(value: string, max: number): boolean {
  return Boolean(value) && [...value].length <= max && !/\p{C}/u.test(value)
}

function safeFileName(value: string): boolean {
  return boundedPlainText(value, 140) && value !== '.' && value !== '..' && !/[\\/:<>"|?*]/.test(value)
}

export function validDocumentTitle(title: string): boolean {
  return boundedPlainText(title.trim(), TRANSACTION_DOCUMENT_TITLE)
}

export function transactionDocumentType(file: File): MediaType | null {
  if (!safeFileName(file.name.trim()) || file.size < 1 || file.size > TRANSACTION_DOCUMENT_BYTES) return null
  if (file.type) return TRANSACTION_DOCUMENT_TYPES.includes(file.type as MediaType) ? file.type as MediaType : null
  const suffix = /\.([a-z]+)$/i.exec(file.name.trim())?.[1]?.toLowerCase()
  return suffix && Object.prototype.hasOwnProperty.call(names, suffix) ? names[suffix as keyof typeof names] : null
}

export async function prepareDocumentReservation(file: File, title: string, requestId: string, documentId?: string): Promise<DocumentReservation> {
  const contentType = transactionDocumentType(file)
  if (!contentType || !validDocumentTitle(title)) throw new Error('Invalid transaction document')
  const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return {
    request_id: requestId, ...(documentId ? { document_id: documentId } : {}),
    title: title.trim(), file_name: file.name.trim(), content_type: contentType, byte_count: file.size,
    sha256: [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join(''),
  }
}

export async function listTransactionDocuments(room: string, signal: AbortSignal): Promise<TransactionDocumentList> {
  const { data } = await client.get<TransactionDocumentList>(documentsPath(room), { signal })
  return data
}

function expectReceipt(data: DocumentReceipt, documentId?: string, versionId?: string) {
  if (typeof data.document_id !== 'string' || typeof data.version_id !== 'string'
    || !UUID.test(data.document_id) || !UUID.test(data.version_id)
    || !Number.isInteger(data.number) || data.number < 1
    || (documentId && documentId !== data.document_id) || (versionId && versionId !== data.version_id)
    || !['reserved', 'submitted', 'approved', 'rejected'].includes(data.status)) {
    throw new Error('Unexpected transaction document receipt')
  }
}

export async function uploadTransactionDocument(room: string, reservation: DocumentReservation, file: File, signal: AbortSignal) {
  signal.throwIfAborted()
  const { data } = await client.post<DocumentReceipt>(documentsPath(room), reservation, { signal })
  expectReceipt(data, reservation.document_id)
  if (data.status === 'reserved') {
    const endpoint = `${versionPath(room, data.document_id, data.version_id)}/content`
    const { data: finalized } = await client.put<DocumentReceipt>(endpoint, file, { headers: { 'Content-Type': reservation.content_type }, signal })
    expectReceipt(finalized, data.document_id, data.version_id)
    if (finalized.status === 'reserved') throw new Error('Document review submission was not confirmed')
  }
}

export async function downloadTransactionDocument(room: string, document: string, version: TransactionDocumentVersion, signal: AbortSignal): Promise<Blob> {
  if (!version.can_download || !safeFileName(version.file_name)) throw new Error('Unavailable transaction document')
  const endpoint = `${versionPath(room, document, version.id)}/download`
  const response = await client.get<Blob>(endpoint, { signal, responseType: 'blob' })
  const cache = response.headers?.['cache-control']
  if (!(response.data instanceof Blob) || response.data.size !== version.byte_count || response.data.size < 1
    || response.data.size > TRANSACTION_DOCUMENT_BYTES || response.data.type !== version.content_type
    || typeof cache !== 'string' || !cache.toLowerCase().split(',').some(directive => directive.trim() === 'no-store')) {
    throw new Error('Unexpected transaction document response')
  }
  return response.data
}

export async function reviewTransactionDocument(room: string, document: string, version: string, review: DocumentReview, signal: AbortSignal): Promise<void> {
  const { data } = await client.post<DocumentReceipt>(`${versionPath(room, document, version)}/review`, review, { signal })
  expectReceipt(data, document, version)
  if (data.status !== review.status) throw new Error('Document review was not confirmed')
}
