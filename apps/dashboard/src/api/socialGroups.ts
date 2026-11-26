import client from './axios'

const ROOT = '/property-network'
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
export const GROUP_PHOTO_LIMIT = 5 * 1024 * 1024
export type GroupRole = 'owner' | 'admin' | 'moderator' | 'member'
export type MembershipState = 'requested' | 'invited' | 'active' | 'declined' | 'cancelled' | 'left' | 'removed' | 'blocked' | 'expired'
export type GroupFields = {
  name: string; description: string; purpose: 'community' | 'professional' | 'local_area' | 'property_project'
  area_label: string; visibility: 'private' | 'network'; join_policy: 'approval_required' | 'open'
  post_policy: 'members' | 'moderated'; comments_enabled: boolean
}
export type GroupMembership = {
  id: string; group_id: string; user_code: number | null; member_alias: string | null
  role: Exclude<GroupRole, 'owner'>; state: MembershipState; version: number
  invite_expires_at: string | null; updated_at: string
}
export type GroupMedia = {
  id: string; group_id: string; url: string; kind: 'group_image' | 'post'; content_type: 'image/webp'
  bytes: number; sha256: string; width: number; height: number
}
export type Group = GroupFields & {
  id: string; status: 'active' | 'archived'; version: number; owner_alias: string; my_role: GroupRole | null
  membership: GroupMembership | null; member_count: number; image: GroupMedia | null
  publication_summary: { network_posts: number; private_posts: number } | null
  can_read_feed: boolean; can_read_members: boolean; can_manage: boolean; can_moderate: boolean
  can_post: boolean; can_join: boolean; can_publish: boolean; can_archive: boolean
  can_revoke_access: boolean; can_revoke_links: boolean; created_at: string; updated_at: string
}
export type GroupLink = {
  id: string; group_id: string; expires_at: string; revoked_at: string | null; max_uses: number; use_count: number
  version: number; state: 'active' | 'expired' | 'revoked' | 'exhausted'; created_at: string
}
export type GroupAuthor = { user_code: number | null; display_name: string; avatar_media_id: string | null }
export type GroupPost = {
  id: string; group_id: string; author: GroupAuthor; body: string; media_ids: string[]
  created_audience: 'private' | 'network'; status: 'pending' | 'visible' | 'hidden'; version: number
  created_at: string; can_hide: boolean; can_approve: boolean; can_comment: boolean
}
export type GroupComment = {
  id: string; post_id: string; author: GroupAuthor; body: string; media_id: string | null
  hidden: boolean; version: number; created_at: string; can_hide: boolean
}
export type GroupPage<T> = { items: T[]; total: number; page: number; page_size: 30 }
export type GroupRoster = GroupPage<GroupMembership> & { owner: { user_code: number | null; member_alias: string; role: 'owner' } }
export type GroupReceipt = {
  submission_id: string; operation: string; target_id: string; applied_at: string
  result_versions: { version: number }
  current: Group | GroupMembership | GroupLink | GroupMedia | GroupPost | GroupComment | null
}
export type GroupInvitation = {
  group_id: string; name: string; description: string; visibility: 'private' | 'network'
  expires_at: string; already_member: boolean; grants_role: 'member'
}
export type OwnMemberAction = 'join' | 'request' | 'cancel' | 'accept_invite' | 'decline_invite' | 'leave'
export type ManageMemberAction = 'invite' | 'approve' | 'decline' | 'revoke_invite' | 'set_role' | 'remove' | 'block' | 'unblock'

export class GroupContractError extends Error {
  constructor() { super('Invalid group response'); this.name = 'GroupContractError' }
}
function invalid(): never { throw new GroupContractError() }
function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : invalid()
}
function exact(row: Record<string, unknown>, fields: string[]) {
  if (Object.keys(row).length !== fields.length || fields.some(key => !Object.prototype.hasOwnProperty.call(row, key))) invalid()
}
function text(value: unknown, max: number, min = 0): string {
  return typeof value === 'string' && [...value].length >= min && [...value].length <= max
    && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value) ? value : invalid()
}
function integer(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max ? value : invalid()
}
function bool(value: unknown): boolean { return typeof value === 'boolean' ? value : invalid() }
function uuid(value: unknown): string { return typeof value === 'string' && UUID.test(value) ? value : invalid() }
function nullableId(value: unknown): string | null { return value === null ? null : uuid(value) }
function memberCode(value: unknown): number | null { return value === null ? null : integer(value, 1, 2147483647) }
function choice<T extends string>(value: unknown, options: readonly T[]): T {
  return typeof value === 'string' && options.includes(value as T) ? value as T : invalid()
}
function timestamp(value: unknown): string {
  const result = text(value, 40, 20)
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(result)
    && Number.isFinite(Date.parse(result)) ? result : invalid()
}
function nullableTime(value: unknown): string | null { return value === null ? null : timestamp(value) }
function author(value: unknown): GroupAuthor {
  const row = object(value)
  // Old servers and already-open old clients keep the exact two-key shape.
  const visual = Object.prototype.hasOwnProperty.call(row, 'avatar_media_id')
  exact(row, visual ? ['user_code', 'display_name', 'avatar_media_id'] : ['user_code', 'display_name'])
  return { user_code: memberCode(row.user_code), display_name: text(row.display_name, 100),
    avatar_media_id: visual ? nullableId(row.avatar_media_id) : null }
}
export function readGroupMembership(value: unknown): GroupMembership {
  const row = object(value)
  exact(row, ['id', 'group_id', 'user_code', 'member_alias', 'role', 'state', 'version', 'invite_expires_at', 'updated_at'])
  return {
    id: uuid(row.id), group_id: uuid(row.group_id), user_code: memberCode(row.user_code),
    member_alias: row.member_alias === null ? null : text(row.member_alias, 100),
    role: choice(row.role, ['admin', 'moderator', 'member']),
    state: choice(row.state, ['requested', 'invited', 'active', 'declined', 'cancelled', 'left', 'removed', 'blocked', 'expired']),
    version: integer(row.version, 1), invite_expires_at: nullableTime(row.invite_expires_at), updated_at: timestamp(row.updated_at),
  }
}
export function readGroupMedia(value: unknown): GroupMedia {
  const row = object(value)
  exact(row, ['id', 'group_id', 'url', 'content_type', 'bytes', 'sha256', 'width', 'height', 'kind'])
  const id = uuid(row.id), hash = text(row.sha256, 64, 64)
  if (row.url !== `${ROOT}/group-media/${id}` || !/^[0-9a-f]{64}$/.test(hash)) invalid()
  return { id, group_id: uuid(row.group_id), url: row.url as string, kind: choice(row.kind, ['group_image', 'post']),
    content_type: choice(row.content_type, ['image/webp']), bytes: integer(row.bytes, 1, GROUP_PHOTO_LIMIT),
    sha256: hash, width: integer(row.width, 1, 1800), height: integer(row.height, 1, 1800) }
}
export function readGroup(value: unknown): Group {
  const row = object(value)
  const capabilities = ['can_read_feed', 'can_read_members', 'can_manage', 'can_moderate', 'can_post', 'can_join',
    'can_publish', 'can_archive', 'can_revoke_access', 'can_revoke_links'] as const
  exact(row, ['id', 'name', 'description', 'purpose', 'area_label', 'visibility', 'join_policy', 'post_policy',
    'comments_enabled', 'status', 'version', 'owner_alias', 'my_role', 'membership', 'member_count', 'image',
    'publication_summary', ...capabilities, 'created_at', 'updated_at'])
  const summary = row.publication_summary === null ? null : object(row.publication_summary)
  if (summary) exact(summary, ['network_posts', 'private_posts'])
  const flags = Object.fromEntries(capabilities.map(key => [key, bool(row[key])])) as Pick<Group, typeof capabilities[number]>
  return { id: uuid(row.id), name: text(row.name, 120, 1), description: text(row.description, 2000),
    purpose: choice(row.purpose, ['community', 'professional', 'local_area', 'property_project']), area_label: text(row.area_label, 160),
    visibility: choice(row.visibility, ['private', 'network']), join_policy: choice(row.join_policy, ['approval_required', 'open']),
    post_policy: choice(row.post_policy, ['members', 'moderated']), comments_enabled: bool(row.comments_enabled),
    status: choice(row.status, ['active', 'archived']), version: integer(row.version, 1), owner_alias: text(row.owner_alias, 100, 1),
    my_role: row.my_role === null ? null : choice<GroupRole>(row.my_role, ['owner', 'admin', 'moderator', 'member']),
    membership: row.membership === null ? null : readGroupMembership(row.membership), member_count: integer(row.member_count, 1),
    image: row.image === null ? null : readGroupMedia(row.image),
    publication_summary: summary === null ? null : { network_posts: integer(summary.network_posts), private_posts: integer(summary.private_posts) },
    ...flags, created_at: timestamp(row.created_at), updated_at: timestamp(row.updated_at) }
}
export function readGroupLink(value: unknown): GroupLink {
  const row = object(value)
  exact(row, ['id', 'group_id', 'expires_at', 'revoked_at', 'max_uses', 'use_count', 'version', 'state', 'created_at'])
  const maximum = integer(row.max_uses, 1, 1000)
  return { id: uuid(row.id), group_id: uuid(row.group_id), expires_at: timestamp(row.expires_at), revoked_at: nullableTime(row.revoked_at),
    max_uses: maximum, use_count: integer(row.use_count, 0, maximum), version: integer(row.version, 1),
    state: choice(row.state, ['active', 'expired', 'revoked', 'exhausted']), created_at: timestamp(row.created_at) }
}
export function readGroupPost(value: unknown): GroupPost {
  const row = object(value)
  exact(row, ['id', 'group_id', 'author', 'body', 'media_ids', 'created_audience', 'status', 'version', 'created_at', 'can_hide', 'can_approve', 'can_comment'])
  if (!Array.isArray(row.media_ids) || row.media_ids.length > 6) invalid()
  const media = row.media_ids.map(uuid)
  if (new Set(media).size !== media.length) invalid()
  return { id: uuid(row.id), group_id: uuid(row.group_id), author: author(row.author), body: text(row.body, 4000), media_ids: media,
    created_audience: choice(row.created_audience, ['private', 'network']), status: choice(row.status, ['pending', 'visible', 'hidden']),
    version: integer(row.version, 1), created_at: timestamp(row.created_at), can_hide: bool(row.can_hide),
    can_approve: bool(row.can_approve), can_comment: bool(row.can_comment) }
}
export function readGroupComment(value: unknown): GroupComment {
  const row = object(value)
  exact(row, ['id', 'post_id', 'author', 'body', 'media_id', 'hidden', 'version', 'created_at', 'can_hide'])
  return { id: uuid(row.id), post_id: uuid(row.post_id), author: author(row.author), body: text(row.body, 2000, 1),
    media_id: nullableId(row.media_id), hidden: bool(row.hidden), version: integer(row.version, 1),
    created_at: timestamp(row.created_at), can_hide: bool(row.can_hide) }
}
function current(value: unknown): GroupReceipt['current'] {
  if (value === null) return null
  const row = object(value)
  if ('owner_alias' in row) return readGroup(row)
  if ('member_alias' in row) return readGroupMembership(row)
  if ('max_uses' in row) return readGroupLink(row)
  if ('sha256' in row) return readGroupMedia(row)
  if ('media_ids' in row) return readGroupPost(row)
  if ('post_id' in row) return readGroupComment(row)
  return invalid()
}
export function readGroupReceipt(value: unknown, submissionId: string): GroupReceipt {
  const row = object(value)
  exact(row, ['submission_id', 'operation', 'target_id', 'applied_at', 'result_versions', 'current'])
  const versions = object(row.result_versions); exact(versions, ['version'])
  if (uuid(row.submission_id) !== submissionId) invalid()
  const operation = choice(row.operation, ['group_create', 'group_edit', 'archive', 'join', 'request',
    'cancel', 'accept_invite', 'decline_invite', 'leave', 'invite', 'approve_member', 'decline_member', 'revoke_invite',
    'set_role', 'remove', 'block', 'unblock', 'link_create', 'link_revoke', 'link_accept', 'post_create', 'post_approve',
    'post_hide', 'comment_create', 'comment_hide', 'media_upload'])
  const target = uuid(row.target_id), resultVersion = integer(versions.version, 1), decoded = current(row.current)
  if (decoded) {
    if (decoded.id !== target || 'version' in decoded && decoded.version < resultVersion) invalid()
    const kind = 'owner_alias' in decoded ? 'group' : 'member_alias' in decoded ? 'membership'
      : 'max_uses' in decoded ? 'link' : 'sha256' in decoded ? 'media' : 'media_ids' in decoded ? 'post' : 'comment'
    const expected = ['group_create', 'group_edit', 'archive'].includes(operation) ? 'group'
      : operation.startsWith('post_') ? 'post' : operation.startsWith('comment_') ? 'comment'
        : operation === 'media_upload' ? 'media' : ['link_create', 'link_revoke'].includes(operation) ? 'link' : 'membership'
    if (kind !== expected) invalid()
  }
  return { submission_id: submissionId, operation, target_id: target, applied_at: timestamp(row.applied_at),
    result_versions: { version: resultVersion }, current: decoded }
}
function page<T>(value: unknown, decode: (item: unknown) => T, extra: string[] = []): GroupPage<T> {
  const row = object(value); exact(row, ['items', 'total', 'page', 'page_size', ...extra])
  if (!Array.isArray(row.items) || row.items.length > 30 || row.page_size !== 30) invalid()
  const total = integer(row.total)
  if (total < row.items.length) invalid()
  return { items: row.items.map(decode), total, page: integer(row.page, 1, 1000), page_size: 30 }
}
function scopedPage<T extends { group_id: string }>(value: unknown, decode: (item: unknown) => T, id: string) {
  const result = page(value, decode)
  if (result.items.some(item => item.group_id !== id)) invalid()
  return result
}
async function get<T>(path: string, decode: (value: unknown) => T, params?: object, signal?: AbortSignal) {
  const { data } = await client.get<unknown>(ROOT + path, { params, signal }); return decode(data)
}
async function write(method: 'post' | 'put', path: string, input: { submission_id: string } & object, operation: string) {
  // Response presentation never changes the action body/submission identity.
  const visual = operation.startsWith('post_') || operation.startsWith('comment_')
  const { data } = await client[method]<unknown>(ROOT + path, input, visual ? { params: { author_visuals: true } } : undefined)
  const receipt = readGroupReceipt(data, uuid(input.submission_id))
  if (receipt.operation !== operation) invalid()
  const group = /^\/groups\/([a-f0-9-]{36})(?:\/|$)/i.exec(path)
  if (group && receipt.current) {
    const scope = 'owner_alias' in receipt.current ? receipt.current.id
      : 'group_id' in receipt.current ? receipt.current.group_id : null
    if (scope !== group[1]) invalid()
  }
  const target = /^\/group-(?:posts|comments)\/([a-f0-9-]{36})\/actions$/i.exec(path)
  if (target && receipt.target_id !== target[1]) invalid()
  const parent = /^\/group-posts\/([a-f0-9-]{36})\/comments$/i.exec(path)
  if (parent && receipt.current && (!('post_id' in receipt.current) || receipt.current.post_id !== parent[1])) invalid()
  return receipt
}
export const getGroups = (view: 'mine' | 'discover', q: string, number: number, signal?: AbortSignal) =>
  get('/groups', value => page(value, readGroup), { view, q, page: number }, signal)
export const getGroup = (id: string, signal?: AbortSignal) => get(`/groups/${uuid(id)}`, value => {
  const group = readGroup(value); if (group.id !== id) invalid(); return group
}, undefined, signal)
export const getGroupMemberships = (state: 'all' | 'active' | 'invited' | 'requested', number: number, signal?: AbortSignal) =>
  get('/group-memberships', value => page(value, readGroupMembership), { state, page: number }, signal)
export const getGroupMembers = (id: string, state: 'active' | 'pending' | 'all', number: number, signal?: AbortSignal) =>
  get(`/groups/${uuid(id)}/members`, value => {
    const result = page(value, readGroupMembership, ['owner']), owner = object(object(value).owner)
    if (result.items.some(row => row.group_id !== id)) invalid()
    exact(owner, ['user_code', 'member_alias', 'role'])
    return { ...result, owner: { user_code: memberCode(owner.user_code), member_alias: text(owner.member_alias, 100, 1), role: choice(owner.role, ['owner']) } }
  }, { state, page: number }, signal)
export const getGroupLinks = (id: string, number: number, signal?: AbortSignal) =>
  get(`/groups/${uuid(id)}/invite-links`, value => scopedPage(value, readGroupLink, id), { page: number }, signal)
export const getGroupPosts = (id: string, number: number, signal?: AbortSignal) =>
  get(`/groups/${uuid(id)}/posts`, value => scopedPage(value, readGroupPost, id), { page: number, author_visuals: true }, signal)
export const getGroupComments = (id: string, number: number, signal?: AbortSignal) =>
  get(`/group-posts/${uuid(id)}/comments`, value => {
    const result = page(value, readGroupComment)
    if (result.items.some(row => row.post_id !== id)) invalid()
    return result
  }, { page: number, author_visuals: true }, signal)
export const getGroupSubmission = (id: string) => get(`/group-submissions/${uuid(id)}`, value => readGroupReceipt(value, id), { author_visuals: true })
export const createGroup = (input: GroupFields & { submission_id: string; owner_alias: string }) => write('post', '/groups', input, 'group_create')
export const editGroup = (id: string, input: GroupFields & { submission_id: string; expected_version: number; image_media_id: string | null; publication_acknowledged: boolean }) => write('put', `/groups/${uuid(id)}`, input, 'group_edit')
export const archiveGroup = (id: string, input: { submission_id: string; expected_version: number; action: 'archive'; reason: string }) => write('post', `/groups/${uuid(id)}/actions`, input, 'archive')
export const actOnOwnMembership = (id: string, input: { submission_id: string; expected_membership_version: number; action: OwnMemberAction; member_alias: string }) => write('post', `/groups/${uuid(id)}/membership/actions`, input, input.action)
export const manageGroupMember = (id: string, code: number, input: { submission_id: string; expected_membership_version: number; action: ManageMemberAction; role?: Exclude<GroupRole, 'owner'>; expires_in_days?: number; reason?: string }) =>
  write('post', `/groups/${uuid(id)}/members/${integer(code, 1, 2147483647)}/actions`, input,
    input.action === 'approve' ? 'approve_member' : input.action === 'decline' ? 'decline_member' : input.action)
export const createGroupLink = (id: string, input: { submission_id: string; token: string; expires_in_days: number; max_uses: number }) => write('post', `/groups/${uuid(id)}/invite-links`, input, 'link_create')
export const revokeGroupLink = (id: string, link: string, input: { submission_id: string; expected_version: number }) => write('post', `/groups/${uuid(id)}/invite-links/${uuid(link)}/revoke`, input, 'link_revoke')
export const createGroupPost = (id: string, input: { submission_id: string; expected_group_version: number; body: string; media_ids: string[] }) => write('post', `/groups/${uuid(id)}/posts`, input, 'post_create')
export const moderateGroupPost = (id: string, input: { submission_id: string; expected_version: number; action: 'approve' | 'hide'; reason: string }) => write('post', `/group-posts/${uuid(id)}/actions`, input, input.action === 'approve' ? 'post_approve' : 'post_hide')
export const createGroupComment = (id: string, input: { submission_id: string; body: string; media_id: string | null }) => write('post', `/group-posts/${uuid(id)}/comments`, input, 'comment_create')
export const hideGroupComment = (id: string, input: { submission_id: string; expected_version: number; action: 'hide'; reason: string }) => write('post', `/group-comments/${uuid(id)}/actions`, input, 'comment_hide')
export async function resolveGroupInvite(token: string, signal?: AbortSignal): Promise<GroupInvitation> {
  const { data } = await client.post<unknown>(ROOT + '/group-invites/resolve', { token }, { signal })
  const row = object(data); exact(row, ['group_id', 'name', 'description', 'visibility', 'expires_at', 'already_member', 'grants_role'])
  return { group_id: uuid(row.group_id), name: text(row.name, 120, 1), description: text(row.description, 2000),
    visibility: choice(row.visibility, ['private', 'network']), expires_at: timestamp(row.expires_at),
    already_member: bool(row.already_member), grants_role: choice(row.grants_role, ['member']) }
}
export const acceptGroupInvite = (input: { token: string; submission_id: string; member_alias: string }) => write('post', '/group-invites/accept', input, 'link_accept')
export async function uploadGroupPhoto(id: string, kind: 'group_image' | 'post', submissionId: string, file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || !file.size || file.size > GROUP_PHOTO_LIMIT) invalid()
  const form = new FormData(); form.append('file', file); form.append('kind', kind); form.append('submission_id', uuid(submissionId))
  const { data } = await client.post<unknown>(`${ROOT}/groups/${uuid(id)}/media`, form)
  const receipt = readGroupReceipt(data, submissionId)
  if (receipt.operation !== 'media_upload') invalid()
  return receipt
}
export async function getGroupPhoto(id: string, signal?: AbortSignal): Promise<Blob> {
  const { data } = await client.get<Blob>(`${ROOT}/group-media/${uuid(id)}`, { responseType: 'blob', signal })
  if (!(data instanceof Blob) || data.type.split(';')[0] !== 'image/webp' || !data.size || data.size > GROUP_PHOTO_LIMIT) invalid()
  return data
}
