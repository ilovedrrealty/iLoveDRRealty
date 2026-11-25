const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { webcrypto } = require('node:crypto')
const { File } = require('node:buffer')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333']
const time = '2026-11-18T12:00:00Z'
const clone = value => JSON.parse(JSON.stringify(value))
function load(relative, imports = {}, extra = {}) {
  const compiled = ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), {
    fileName: relative, compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  })
  const exports = {}
  vm.runInNewContext(compiled.outputText, { exports, Blob, FormData, URL, URLSearchParams, atob, btoa, ...extra,
    require(name) { assert.ok(Object.hasOwn(imports, name), 'Unexpected dependency'); return imports[name] } })
  return exports
}
const membership = () => ({ id: ids[1], group_id: ids[0], user_code: 123, member_alias: 'Chosen group alias', role: 'member',
  state: 'active', version: 2, invite_expires_at: null, updated_at: time })
const group = () => ({ id: ids[0], name: 'Synthetic group', description: 'Group description', purpose: 'community', area_label: 'Sosúa',
  visibility: 'private', join_policy: 'approval_required', post_policy: 'members', comments_enabled: true, status: 'active', version: 1,
  owner_alias: 'Chosen owner alias', my_role: 'member', membership: membership(), member_count: 2, image: null, publication_summary: null,
  can_read_feed: true, can_read_members: true, can_manage: false, can_moderate: false, can_post: true, can_join: false,
  can_publish: false, can_archive: false, can_revoke_access: false, can_revoke_links: false, created_at: time, updated_at: time })
const media = () => ({ id: ids[1], group_id: ids[0], url: '/property-network/group-media/' + ids[1], content_type: 'image/webp',
  bytes: 32, sha256: 'a'.repeat(64), width: 10, height: 10, kind: 'post' })
const receipt = (operation = 'join', current = membership()) => ({ submission_id: ids[2], operation,
  target_id: current?.id ?? ids[1], applied_at: time, result_versions: { version: 1 }, current })
const page = items => ({ items, total: items.length, page: 1, page_size: 30 })
function api(handler = async () => group()) {
  const calls = []
  const client = Object.fromEntries(['get', 'post', 'put'].map(method => [method, async (...args) => {
    calls.push([method, ...args]); return { data: await handler(method, ...args) }
  }]))
  return { ...load('apps/dashboard/src/api/socialGroups.ts', { './axios': { __esModule: true, default: client } }), calls }
}

test('group reader retains explicit audience, chosen aliases and separate closed-group revocation capabilities', () => {
  const a = api(), value = group()
  value.status = 'archived'; value.can_post = false; value.my_role = 'moderator'; value.can_revoke_access = true
  assert.deepEqual(clone(a.readGroup(value)), value)
  assert.equal(a.readGroup(value).can_manage, false)
})

test('group readers reject private account fields and malformed permission or membership data', () => {
  const a = api()
  for (const change of [value => { value.email = 'private@example.com' }, value => { value.can_manage = 'true' },
    value => { delete value.can_revoke_access }, value => { value.my_role = 'super_admin' },
    value => { value.membership.user_code = '123' }, value => { value.visibility = 'anonymous' },
    value => { value.member_count = -1 }]) {
    const value = group(); change(value); assert.throws(() => a.readGroup(value), /Invalid group response/)
  }
})

test('action receipts couple operation, target, current kind and retained result version', () => {
  const a = api()
  assert.equal(a.readGroupReceipt(receipt(), ids[2]).current.version, 2)
  assert.equal(a.readGroupReceipt(receipt('join', null), ids[2]).current, null)
  for (const value of [receipt('post_create'), { ...receipt(), target_id: ids[0] },
    { ...receipt(), submission_id: ids[0] }, { ...receipt(), result_versions: { version: 3 } },
    { ...receipt(), current: { ...membership(), email: 'private@example.com' } }]) {
    assert.throws(() => a.readGroupReceipt(value, ids[2]), /Invalid group response/)
  }
})

test('group actions retain numeric member codes, expected versions, draft audience version and stable submissions', async () => {
  const post = { id: ids[1], group_id: ids[0], author: { user_code: 123, display_name: 'Chosen alias' },
    body: 'Private draft', media_ids: [], created_audience: 'private', status: 'visible', version: 1,
    created_at: time, can_hide: true, can_approve: false, can_comment: true }
  const a = api(async (_method, url) => url.endsWith('/posts') ? receipt('post_create', post)
    : receipt(url.includes('/members/') ? 'approve_member' : 'request'))
  await a.actOnOwnMembership(ids[0], { submission_id: ids[2], action: 'request', expected_membership_version: 0, member_alias: 'Chosen group alias' })
  await a.manageGroupMember(ids[0], 456, { submission_id: ids[2], action: 'approve', expected_membership_version: 5 })
  assert.equal(a.calls[0][1], '/property-network/groups/' + ids[0] + '/membership/actions')
  assert.equal(a.calls[0][2].expected_membership_version, 0)
  assert.equal(a.calls[1][1], '/property-network/groups/' + ids[0] + '/members/456/actions')
  assert.equal(a.calls[1][2].expected_membership_version, 5)
  assert.equal(a.calls[1][2].submission_id, ids[2])
  const draft = { submission_id: ids[2], expected_group_version: 7, body: 'Private draft', media_ids: [] }
  await a.createGroupPost(ids[0], draft)
  assert.equal(a.calls[2][2].expected_group_version, 7)
  assert.equal(a.calls[2][2].submission_id, ids[2])
  for (const call of a.calls) assert.equal(Object.hasOwn(call[2], 'email'), false)
})

test('manager history uses all-state read and rejects cross-group records or mutation results', async () => {
  const owner = { user_code: 1, member_alias: 'Chosen owner alias', role: 'owner' }
  const a = api(async () => ({ ...page([membership()]), owner }))
  const result = await a.getGroupMembers(ids[0], 'all', 1)
  assert.equal(result.items[0].version, 2); assert.equal(a.calls[0][2].params.state, 'all')
  const wrong = api(async () => ({ ...page([{ ...membership(), group_id: ids[2] }]), owner }))
  await assert.rejects(wrong.getGroupMembers(ids[0], 'all', 1), /Invalid group response/)
  const wrongGroup = api(async () => ({ ...group(), id: ids[2] }))
  await assert.rejects(wrongGroup.getGroup(ids[0]), /Invalid group response/)
  const wrongAction = api(async () => receipt('leave'))
  await assert.rejects(wrongAction.actOnOwnMembership(ids[0], { submission_id: ids[2], action: 'request', expected_membership_version: 0, member_alias: 'Alias' }), /Invalid group response/)
})

test('group-only photos require private metadata and validated bounded multipart uploads', async () => {
  const a = api(async () => receipt('media_upload', media()))
  const file = new File([new Uint8Array([1, 2, 3])], 'synthetic.jpg', { type: 'image/jpeg' })
  await a.uploadGroupPhoto(ids[0], 'post', ids[2], file)
  const body = a.calls[0][2]
  assert.equal(body.get('kind'), 'post'); assert.equal(body.get('submission_id'), ids[2])
  assert.equal(body.get('file').size, 3)
  assert.throws(() => a.readGroupMedia({ ...media(), url: 'https://example.com/public-photo.webp' }), /Invalid group response/)
  const before = a.calls.length
  await assert.rejects(a.uploadGroupPhoto(ids[0], 'post', ids[2], new File(['x'], 'unsafe.svg', { type: 'image/svg+xml' })), /Invalid group response/)
  await assert.rejects(a.uploadGroupPhoto(ids[0], 'post', ids[2], new File([new Uint8Array(a.GROUP_PHOTO_LIMIT + 1)], 'oversize.jpg', { type: 'image/jpeg' })), /Invalid group response/)
  assert.equal(a.calls.length, before)
})

test('group author readers accept old and opted shapes while retaining only group aliases and selected IDs', () => {
  const a = api(), oldAuthor = { user_code: 123, display_name: 'Group-specific alias' }
  const post = { id: ids[1], group_id: ids[0], author: oldAuthor, body: 'Authorized group body', media_ids: [],
    created_audience: 'private', status: 'visible', version: 1, created_at: time, can_hide: false, can_approve: false, can_comment: false }
  const comment = { id: ids[2], post_id: ids[1], author: oldAuthor, body: 'Authorized comment', media_id: null,
    hidden: false, version: 1, created_at: time, can_hide: false }
  for (const [source, read] of [[post, a.readGroupPost], [comment, a.readGroupComment]]) {
    assert.deepEqual(clone(read(source).author), { ...oldAuthor, avatar_media_id: null })
    assert.deepEqual(clone(read({ ...source, author: { ...oldAuthor, avatar_media_id: ids[0] } }).author),
      { ...oldAuthor, avatar_media_id: ids[0] })
    for (const bad of [undefined, 'https://account.invalid/photo.jpg', 'not-an-id', 1, {}]) {
      assert.throws(() => read({ ...source, author: { ...oldAuthor, avatar_media_id: bad } }), /Invalid group response/)
    }
    for (const key of ['avatar_url', 'email', 'account_name']) {
      assert.throws(() => read({ ...source, author: { ...oldAuthor, avatar_media_id: null, [key]: 'private sentinel' } }), /Invalid group response/)
    }
  }
  const current = { ...post, author: { ...oldAuthor, avatar_media_id: ids[0] } }
  assert.equal(a.readGroupReceipt(receipt('post_create', current), ids[2]).current.author.avatar_media_id, ids[0])
})

test('all seven author operations opt in outside immutable action bodies and still accept an old server', async () => {
  const author = { user_code: 123, display_name: 'Group alias from old server' }
  const post = { id: ids[1], group_id: ids[0], author, body: 'Group post', media_ids: [], created_audience: 'private',
    status: 'visible', version: 1, created_at: time, can_hide: true, can_approve: false, can_comment: true }
  const comment = { id: ids[2], post_id: ids[1], author, body: 'Group comment', media_id: null,
    hidden: false, version: 1, created_at: time, can_hide: true }
  // Model the old server ignoring the new query: every reply has only two author keys.
  const a = api(async (method, url) => {
    if (method === 'get') return url.includes('/group-submissions/') ? receipt('comment_hide', comment)
      : page([url.endsWith('/comments') ? comment : post])
    return receipt(url.endsWith('/comments') ? 'comment_create'
      : url.includes('/group-comments/') ? 'comment_hide'
        : url.endsWith('/actions') ? 'post_hide' : 'post_create', url.includes('/group-comments/') || url.endsWith('/comments') ? comment : post)
  })
  assert.equal((await a.getGroupPosts(ids[0], 1)).items[0].author.avatar_media_id, null)
  assert.equal((await a.getGroupComments(ids[1], 1)).items[0].author.avatar_media_id, null)
  const create = { submission_id: ids[2], expected_group_version: 1, body: 'Draft', media_ids: [] }
  await a.createGroupPost(ids[0], create)
  await a.moderateGroupPost(ids[1], { submission_id: ids[2], expected_version: 1, action: 'hide', reason: '' })
  await a.createGroupComment(ids[1], { submission_id: ids[2], body: 'Comment', media_id: null })
  await a.hideGroupComment(ids[2], { submission_id: ids[2], expected_version: 1, action: 'hide', reason: '' })
  assert.equal((await a.getGroupSubmission(ids[2])).current.author.avatar_media_id, null)
  assert.equal(a.calls.length, 7)
  for (const call of a.calls) {
    const options = call[call[0] === 'get' ? 2 : 3]
    assert.equal(options.params.author_visuals, true)
    if (call[0] !== 'get') {
      assert.equal(Object.hasOwn(call[2], 'author_visuals'), false)
      assert.equal(call[2].submission_id, ids[2])
    }
  }
  assert.deepEqual(a.calls[2][2], create)
})

function invitation(fragment, pathname = '/group-invite/', search = '') {
  const location = { pathname, search, hash: fragment }
  const historyCalls = [], handlers = new Map(), metadata = []
  const storage = new Proxy({}, { get() { assert.fail('Invitation token touched browser storage') } })
  const history = { state: { key: 'safe' }, replaceState(state, _title, target) {
    historyCalls.push({ state, target }); const url = new URL(target, 'https://example.com')
    location.pathname = url.pathname; location.search = url.search; location.hash = url.hash
  } }
  let randomCalls = 0
  const loaded = load('apps/dashboard/src/lib/groupInviteMemory.ts', {}, {
    location, history, localStorage: storage, sessionStorage: storage,
    document: { head: { append(value) { metadata.push(value) } }, createElement() { return {} } },
    window: { addEventListener(type, handler) { handlers.set(type, handler) }, localStorage: storage, sessionStorage: storage },
    crypto: { getRandomValues(value) { randomCalls++; assert.equal(value.byteLength, 32); return webcrypto.getRandomValues(value) } },
  })
  return { loaded, location, historyCalls, handlers, metadata, randomCalls: () => randomCalls }
}

test('invitation bootstrap scrubs before observers, uses cryptographic32byte tokens and never stores them', () => {
  const token = Buffer.alloc(32, 1).toString('base64url'), h = invitation('#token=' + token)
  assert.equal(h.location.hash, '')
  assert.equal(h.historyCalls[0].target, '/group-invite/')
  assert.equal(JSON.stringify(h.historyCalls).includes(token), false)
  assert.equal(h.loaded.groupInviteSnapshot().token, token)
  assert.equal(h.metadata.find(value => value.name === 'referrer').content, 'no-referrer')
  assert.equal(h.metadata.find(value => value.name === 'robots').content, 'noindex,nofollow')
  const first = h.loaded.createGroupInviteToken(), second = h.loaded.createGroupInviteToken()
  assert.notEqual(first, second); assert.equal(h.randomCalls(), 2)
  assert.equal(h.loaded.validGroupInviteToken(first), true)
})

test('invalid, duplicate and noncanonical invitation fragments are scrubbed without accepting a token', () => {
  const token = Buffer.alloc(32, 1).toString('base64url')
  for (const fragment of ['#token=' + 'B'.repeat(43), '#token=' + token + '&token=' + token,
    '#token=', '#other=' + token, '#token=bad']) {
    const h = invitation(fragment)
    assert.equal(h.location.hash, '')
    assert.equal(h.loaded.groupInviteSnapshot().token, null)
    assert.equal(h.loaded.groupInviteSnapshot().invalid, true)
  }
})

test('router case and encoded-letter aliases scrub tokens before shell initialization; query tokens never authorize', () => {
  const token = Buffer.alloc(32, 1).toString('base64url')
  for (const pathname of ['/GROUP-INVITE/', '/%67roup-invite/', '/group-invite///']) {
    const h = invitation('#token=' + token, pathname, '?tracking=removed')
    assert.equal(h.loaded.isGroupInvitePath(pathname), true)
    assert.equal(h.location.hash, ''); assert.equal(h.location.search, '')
    assert.equal(h.loaded.groupInviteSnapshot().token, token)
  }
  const query = invitation('', '/group-invite/', '?token=' + token)
  assert.equal(query.location.search, ''); assert.equal(query.loaded.groupInviteSnapshot().token, null)
  assert.equal(JSON.stringify(query.historyCalls).includes(token), false)
})

test('a second same-tab invitation replaces the in-memory generation before subscribers observe it', () => {
  const first = Buffer.alloc(32, 1).toString('base64url'), second = Buffer.alloc(32, 2).toString('base64url')
  const h = invitation('#token=' + first), generation = h.loaded.groupInviteSnapshot().generation
  let notifications = 0, stopped = false
  const unsubscribe = h.loaded.subscribeGroupInvite(() => { notifications++; assert.equal(h.location.hash, '') })
  h.location.hash = '#token=' + second
  h.handlers.get('hashchange')({ stopImmediatePropagation() { stopped = true } })
  assert.equal(stopped, true); assert.equal(notifications, 1)
  assert.equal(h.loaded.groupInviteSnapshot().token, second)
  assert.ok(h.loaded.groupInviteSnapshot().generation > generation)
  h.loaded.clearGroupInvite(); assert.equal(h.loaded.groupInviteSnapshot().token, null)
  unsubscribe()
})
