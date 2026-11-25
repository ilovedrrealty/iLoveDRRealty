import client from './axios'

export const INBOX_POLICY = 'native-inbox-v1'
export const INBOX_SIZE = 30
export const ENTRY_KINDS = ['message', 'manual_whatsapp', 'manual_call'] as const
export const CALL_OUTCOMES = ['connected', 'voicemail', 'missed', 'no_answer', 'declined', 'unspecified'] as const
const reasons = ['blocked', 'assignment_changed', 'participant_unavailable', 'buyer_relationship_required', 'review_required', 'legacy_read_only'] as const
export type Member = { id: string; user_code: number | null; display_name: string; role: 'buyer' | 'owner' | 'realtor' | 'admin' }
export type Recipient = Member & { relationship: 'admin' | 'assigned_agent' | 'assigned_buyer' | 'member' }
export type Page<T> = { items: T[]; total: number; page: number; page_size: 30 }
export type Preferences = { visibility: 'private' | 'members'; version: number; policy_version: typeof INBOX_POLICY; admin_oversight: true }
export type Source = { kind: 'native' | 'service_award' | 'service_negotiation'; id: string; recipient_id: string | null }
export type Summary = { id: string; participants: Member[]; brokerage_subject_id: string | null; created_at: string; last_entry_at: string | null;
  last_sequence: number; last_entry_preview: string | null; unread_count: number; is_observer: boolean; can_send: boolean;
  read_only_reason: typeof reasons[number] | null; policy_version: typeof INBOX_POLICY; admin_oversight: true }
export type Entry = { id: string; sequence: number | null; kind: typeof ENTRY_KINDS[number]; body: string; author: Member; context_role: 'owner' | 'provider' | null;
  created_at: string; occurred_at: string | null; reported_direction: 'incoming' | 'outgoing' | null; call_outcome: typeof CALL_OUTCOMES[number] | null;
  delivery_state: 'stored_in_app' | 'manual_record' | 'legacy_recorded' }
export type ThreadPage = { source: Source; conversation: Summary | null; items: Entry[]; total: number; cursor: string | null; next_cursor: string | null;
  page_size: 30; read_only: boolean; read_only_reason: typeof reasons[number] | null; policy_version: typeof INBOX_POLICY; admin_oversight: true;
  review_id: string | null; review_expires_at: string | null }
export type Legacy = { source: Source; total_messages: number; last_entry_at: string }
export type Receipt = { submission_id: string; action: 'conversation_opened' | 'entry_created' | 'read_marked' | 'visibility_saved' | 'block_saved' | 'review_opened'; target_id: string }
export type Command = { submission_id: string } & (
  { action: 'conversation_opened'; recipient_id: string } |
  { action: 'entry_created'; conversation_id: string; kind: Entry['kind']; body: string; occurred_at?: string | null;
    reported_direction?: Entry['reported_direction']; call_outcome?: Entry['call_outcome']; review_id?: string | null } |
  { action: 'read_marked'; conversation_id: string; last_read_sequence: number } |
  { action: 'visibility_saved'; actor_id: string; expected_version: number; visibility: Preferences['visibility'] } |
  { action: 'block_saved'; user_id: string; blocked: boolean } |
  { action: 'review_opened'; source: Source; reason: 'oversight' | 'support' }
)
export type PreparedCommand = { action: Receipt['action']; submission_id: string; target: string | null; path: string; method: 'post' | 'put'; body: Record<string, unknown> }
export class InboxContractError extends Error { constructor() { super('Invalid inbox response'); this.name = 'InboxContractError' } }
export class InboxInputError extends Error { constructor() { super('Check inbox fields'); this.name = 'InboxInputError' } }
function fail(): never { throw new InboxContractError() }
const uuidPattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i
const unsafe = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/
const preparedCommands = new WeakSet<object>()
function object(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : fail() }
function exact(value: unknown, keys: string[]) { const row = object(value); if (Object.keys(row).some(key => !keys.includes(key)) || keys.some(key => !Object.prototype.hasOwnProperty.call(row, key))) fail(); return row }
function text(value: unknown, max = 2000, min = 0) { return typeof value === 'string' && [...value].length <= max && [...value].length >= min && !unsafe.test(value) && !/[\ud800-\udfff]/u.test(value) ? value : fail() }
export function inboxId(value: unknown): string { return typeof value === 'string' && uuidPattern.test(value) ? value.toLowerCase() : fail() }
function integer(value: unknown, min = 0): number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= min ? value : fail() }
function boolean(value: unknown): boolean { return typeof value === 'boolean' ? value : fail() }
function choice<T extends string>(value: unknown, options: readonly T[]): T { return typeof value === 'string' && options.includes(value as T) ? value as T : fail() }
function nullable<T>(value: unknown, decode: (v: unknown) => T): T | null { return value === null ? null : decode(value) }
function timestamp(value: unknown): string { const result = text(value, 80, 1); return /(?:Z|[+-]\d{2}:\d{2})$/.test(result) && Number.isFinite(Date.parse(result)) ? result : fail() }
export function inboxCursor(value: unknown): string | null { return nullable(value, v => text(v, 512, 1)) }
function policy(row: Record<string, unknown>): { policy_version: typeof INBOX_POLICY; admin_oversight: true } { if (row.policy_version !== INBOX_POLICY || row.admin_oversight !== true) fail(); return { policy_version: INBOX_POLICY, admin_oversight: true } }
export function decodeMember(value: unknown): Member {
  const r = exact(value, ['id', 'user_code', 'display_name', 'role'])
  return { id: inboxId(r.id), user_code: nullable(r.user_code, v => integer(v, 1)), display_name: text(r.display_name, 500), role: choice(r.role, ['buyer', 'owner', 'realtor', 'admin']) }
}
function decodeSource(value: unknown): Source {
  const r = exact(value, ['kind', 'id', 'recipient_id']), kind = choice(r.kind, ['native', 'service_award', 'service_negotiation']), recipient_id = nullable(r.recipient_id, inboxId)
  if ((kind === 'service_negotiation') !== (recipient_id !== null)) fail()
  return { kind, id: inboxId(r.id), recipient_id }
}
export function decodeSummary(value: unknown): Summary {
  const r = exact(value, ['id', 'participants', 'brokerage_subject_id', 'created_at', 'last_entry_at', 'last_sequence', 'last_entry_preview', 'unread_count', 'is_observer', 'can_send', 'read_only_reason', 'policy_version', 'admin_oversight'])
  if (!Array.isArray(r.participants) || r.participants.length !== 2) fail()
  const participants = r.participants.map(decodeMember)
  if (new Set(participants.map(p => p.id)).size !== 2) fail()
  if ((r.can_send === true) !== (r.read_only_reason === null)) fail()
  return { id: inboxId(r.id), participants, brokerage_subject_id: nullable(r.brokerage_subject_id, inboxId), created_at: timestamp(r.created_at),
    last_entry_at: nullable(r.last_entry_at, timestamp), last_sequence: integer(r.last_sequence), last_entry_preview: nullable(r.last_entry_preview, v => text(v)),
    unread_count: integer(r.unread_count), is_observer: boolean(r.is_observer), can_send: boolean(r.can_send), read_only_reason: nullable(r.read_only_reason, v => choice(v, reasons)), ...policy(r) }
}
function decodeEntry(value: unknown, legacy: boolean): Entry {
  const r = exact(value, ['id', 'sequence', 'kind', 'body', 'author', 'context_role', 'created_at', 'occurred_at', 'reported_direction', 'call_outcome', 'delivery_state'])
  const result: Entry = { id: inboxId(r.id), sequence: nullable(r.sequence, v => integer(v, 1)), kind: choice(r.kind, ENTRY_KINDS), body: text(r.body, 2000, 1), author: decodeMember(r.author),
    context_role: nullable(r.context_role, v => choice(v, ['owner', 'provider'])), created_at: timestamp(r.created_at), occurred_at: nullable(r.occurred_at, timestamp),
    reported_direction: nullable(r.reported_direction, v => choice(v, ['incoming', 'outgoing'])), call_outcome: nullable(r.call_outcome, v => choice(v, CALL_OUTCOMES)),
    delivery_state: choice(r.delivery_state, ['stored_in_app', 'manual_record', 'legacy_recorded']) }
  if (legacy ? result.sequence !== null || result.kind !== 'message' || result.delivery_state !== 'legacy_recorded'
    : result.sequence === null || result.context_role !== null || result.delivery_state !== (result.kind === 'message' ? 'stored_in_app' : 'manual_record')) fail()
  if (result.kind === 'message' ? [result.occurred_at, result.reported_direction, result.call_outcome].some(v => v !== null)
    : !result.occurred_at || !result.reported_direction || (result.kind === 'manual_call') !== (result.call_outcome !== null)) fail()
  return result
}
function decodeThread(value: unknown, source: Source, cursor: string | null, review: string | null): ThreadPage {
  const r = exact(value, ['source', 'conversation', 'items', 'total', 'cursor', 'next_cursor', 'page_size', 'read_only', 'read_only_reason', 'policy_version', 'admin_oversight', 'review_id', 'review_expires_at'])
  const actual = decodeSource(r.source), returned = inboxCursor(r.cursor), next = inboxCursor(r.next_cursor)
  if (JSON.stringify(actual) !== JSON.stringify(source) || returned !== cursor || next !== null && next === returned || r.page_size !== INBOX_SIZE
    || !Array.isArray(r.items) || r.items.length > INBOX_SIZE || nullable(r.review_id, inboxId) !== review) fail()
  const items = r.items.map(value => decodeEntry(value, source.kind !== 'native'))
  if (new Set(items.map(item => item.id)).size !== items.length) fail()
  if (source.kind === 'native' && items.some((item, n) => item.sequence === null || n > 0 && item.sequence >= items[n - 1].sequence!)) fail()
  const conversation = nullable(r.conversation, decodeSummary)
  if (source.kind === 'native' ? conversation?.id !== source.id : conversation !== null || r.read_only !== true) fail()
  const expires = nullable(r.review_expires_at, timestamp)
  if ((review === null) !== (expires === null) || integer(r.total) < items.length) fail()
  if (conversation && (r.read_only !== !conversation.can_send || r.read_only_reason !== conversation.read_only_reason
    || items.some(item => item.sequence! > conversation.last_sequence))) fail()
  if (source.kind !== 'native' && r.read_only_reason !== 'legacy_read_only') fail()
  return { source: actual, conversation, items, total: integer(r.total), cursor: returned, next_cursor: next, page_size: INBOX_SIZE,
    read_only: boolean(r.read_only), read_only_reason: nullable(r.read_only_reason, v => choice(v, reasons)), ...policy(r), review_id: review,
    review_expires_at: expires }
}
function page<T>(value: unknown, requested: number, decode: (v: unknown) => T): Page<T> {
  const r = object(value)
  if (r.page !== requested || r.page_size !== INBOX_SIZE || !Array.isArray(r.items) || r.items.length > INBOX_SIZE) fail()
  return { items: r.items.map(decode), total: integer(r.total), page: requested, page_size: INBOX_SIZE }
}
function pageNumber(value: number) { return Number.isSafeInteger(value) && value >= 1 && value <= 1000 ? value : fail() }
async function get(path: string, params: Record<string, unknown> = {}, signal?: AbortSignal): Promise<unknown> {
  const response = await client.get('/messaging' + path, { params, signal })
  if (!String(response.headers['cache-control'] ?? '').toLowerCase().split(',').some(part => part.trim() === 'no-store')) fail()
  return response.data
}
export async function getInboxPolicy(signal?: AbortSignal) {
  const r = exact(await get('/policy', {}, signal), ['policy_version', 'admin_oversight', 'channels']), c = exact(r.channels, ['in_app', 'manual_whatsapp', 'manual_call', 'email', 'gmail', 'whatsapp_sync', 'sms', 'telephone_sync'])
  if (Object.entries(c).some(([key, value]) => value !== ['in_app', 'manual_whatsapp', 'manual_call'].includes(key))) fail()
  return policy(r)
}
export async function getInboxPreferences(signal?: AbortSignal): Promise<Preferences> {
  const r = exact(await get('/preferences', {}, signal), ['visibility', 'version', 'policy_version', 'admin_oversight'])
  return { visibility: choice(r.visibility, ['private', 'members']), version: integer(r.version), ...policy(r) }
}
export async function getInboxRecipients(q: string, n = 1, signal?: AbortSignal): Promise<Page<Recipient>> {
  if (/[\u0000-\u001f\u007f-\u009f]/.test(q)) fail()
  return page(await get('/recipients', { q: text(q, 80), page: pageNumber(n) }, signal), n, raw => {
    const r = exact(raw, ['id', 'user_code', 'display_name', 'role', 'relationship']), { relationship, ...member } = r
    return { ...decodeMember(member), relationship: choice(relationship, ['admin', 'assigned_agent', 'assigned_buyer', 'member']) }
  })
}
export async function getInboxBlocks(n = 1, signal?: AbortSignal) { return page(await get('/blocks', { page: pageNumber(n) }, signal), n, decodeMember) }
export async function getInboxConversations(view: 'mine' | 'oversight', n = 1, signal?: AbortSignal) {
  const result = page(await get('/conversations', { view: choice(view, ['mine', 'oversight']), page: pageNumber(n) }, signal), n, decodeSummary)
  if (view === 'oversight' && result.items.some(item => item.is_observer && item.last_entry_preview !== null)) fail()
  return result
}
export async function getInboxConversation(id: string, signal?: AbortSignal) {
  const result = decodeSummary(await get('/conversations/' + inboxId(id), {}, signal)); if (result.id !== inboxId(id)) fail(); return result
}
export async function getInboxUnread(signal?: AbortSignal) {
  const r = exact(await get('/unread', {}, signal), ['conversations', 'entries']); return { conversations: integer(r.conversations), entries: integer(r.entries) }
}
export async function getInboxLegacy(n = 1, signal?: AbortSignal) {
  const r = object(await get('/admin/legacy', { page: pageNumber(n) }, signal)); policy(r)
  return page(r, n, value => { const item = exact(value, ['source', 'total_messages', 'last_entry_at']), source = decodeSource(item.source); if (source.kind === 'native') fail();
    return { source, total_messages: integer(item.total_messages), last_entry_at: timestamp(item.last_entry_at) } })
}
export async function getInboxThread(source: Source, cursor: string | null, review: string | null = null, signal?: AbortSignal): Promise<ThreadPage> {
  source = decodeSource(source); cursor = inboxCursor(cursor)
  if (source.kind !== 'native' && !review) fail()
  const path = review ? '/admin/reviews/' + inboxId(review) + '/entries' : '/conversations/' + source.id + '/entries'
  return decodeThread(await get(path, cursor === null ? {} : { cursor }, signal), source, cursor, review)
}
function receipt(value: unknown, command: PreparedCommand): Receipt {
  const r = exact(value, ['submission_id', 'action', 'target_id']), target_id = inboxId(r.target_id)
  if (inboxId(r.submission_id) !== command.submission_id || r.action !== command.action || command.target && target_id !== command.target) fail()
  return { submission_id: command.submission_id, action: command.action, target_id }
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { for (const item of Object.values(value)) freeze(item); Object.freeze(value) }
  return value
}
export function prepareInboxCommand(command: Command, now = Date.now()): PreparedCommand {
  try {
    const submission_id = inboxId(command.submission_id), action = command.action
    let path: string, method: 'post' | 'put' = 'post', target: string | null = null, body: Record<string, unknown> = { submission_id }
    if (action === 'conversation_opened') { path = '/conversations'; body.recipient_id = inboxId(command.recipient_id) }
    else if (action === 'visibility_saved') { target = inboxId(command.actor_id); path = '/preferences'; method = 'put'; body = { ...body, expected_version: integer(command.expected_version), visibility: choice(command.visibility, ['private', 'members']) } }
    else if (action === 'block_saved') { target = inboxId(command.user_id); path = '/blocks/' + target; method = 'put'; body.blocked = boolean(command.blocked) }
    else if (action === 'read_marked') { target = inboxId(command.conversation_id); path = '/conversations/' + target + '/read'; method = 'put'; body.last_read_sequence = integer(command.last_read_sequence) }
    else if (action === 'review_opened') { path = '/admin/reviews'; body = { ...body, source: decodeSource(command.source), reason: choice(command.reason, ['oversight', 'support']) } }
    else if (action === 'entry_created') {
      path = '/conversations/' + inboxId(command.conversation_id) + '/entries'
      if (typeof command.body !== 'string' || unsafe.test(command.body)) fail()
      const kind = choice(command.kind, ENTRY_KINDS), content = text(command.body.trim(), 2000, 1)
      body = { ...body, kind, body: content }
      if (command.review_id != null) body.review_id = inboxId(command.review_id)
      if (kind === 'message') { if ([command.occurred_at, command.reported_direction, command.call_outcome].some(v => v != null)) fail() }
      else {
        const occurred_at = timestamp(command.occurred_at), time = Date.parse(occurred_at)
        if (time < 0 || time > now + 300000) fail()
        body.occurred_at = occurred_at; body.reported_direction = choice(command.reported_direction, ['incoming', 'outgoing'])
        if (kind === 'manual_call') body.call_outcome = choice(command.call_outcome, CALL_OUTCOMES)
        else if (command.call_outcome != null) fail()
      }
    } else return fail()
    const prepared: PreparedCommand = freeze({ action, submission_id, target, path, method, body: JSON.parse(JSON.stringify(body)) })
    preparedCommands.add(prepared)
    return prepared
  } catch { throw new InboxInputError() }
}
export async function executeInboxCommand(command: PreparedCommand, signal?: AbortSignal) {
  if (!preparedCommands.has(command)) throw new InboxInputError()
  const response = await client[command.method]('/messaging' + command.path, command.body, { signal })
  if (!String(response.headers['cache-control'] ?? '').toLowerCase().split(',').some(part => part.trim() === 'no-store')) fail()
  return receipt(response.data, command)
}
export async function resolveInboxCommand(command: PreparedCommand, signal?: AbortSignal) {
  if (!preparedCommands.has(command)) throw new InboxInputError()
  return receipt(await get('/commands/' + command.submission_id, {}, signal), command)
}
