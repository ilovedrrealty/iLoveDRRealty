const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const ts = require('typescript')

const root = path.resolve(__dirname, '../apps/dashboard/src')
const roomId = '946f9047-e6fb-4b68-89a4-7063b174b82d'
const leadId = '448c9373-936e-4f57-82bf-1ccd47059a38'
const grantId = '77349a11-b89c-4f33-b102-cc31308caabd'
const taskId = 'b63f1daf-d393-4943-8395-007f74d80017'
const start = { id: roomId, role: 'realtor', status: 'open', version: 17 }
const plain = value => JSON.parse(JSON.stringify(value))

function harness(response = start) {
  const calls = []
  const client = {}
  for (const method of ['get', 'post', 'put', 'patch']) {
    client[method] = async (...args) => {
      calls.push([method, ...args])
      return { data: response }
    }
  }
  const runtime = name => {
    if (name === 'axios') return { isAxiosError: error => error.isAxiosError === true }
    if (name === './axios') return client
    throw new Error(name)
  }
  const filename = path.join(root, 'api/transactions.ts')
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename, reportDiagnostics: true, compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
    },
  })
  assert.deepEqual(compiled.diagnostics, [])
  const module = { exports: {} }
  vm.runInNewContext(compiled.outputText, { module, exports: module.exports, require: runtime })
  return { api: module.exports, calls }
}

test('room routes accept one current UUID and only potential linked buyer leads expose the staff shortcut', () => {
  const { api } = harness()
  assert.equal(api.transactionOpenId(new URLSearchParams({ openId: roomId.toUpperCase() })), roomId)
  assert.equal(api.transactionOpenId(new URLSearchParams({ openId: '9/other-room' })), null)
  assert.equal(api.transactionOpenId(new URLSearchParams(`openId=${roomId}&openId=${roomId}`)), null)
  const lead = { type: 'buyer_interest', property_id: 'property', from_user_id: 'buyer', assigned_realtor_id: 'agent' }
  assert.equal(api.isTransactionRoomLead(lead), true)
  assert.equal(api.isTransactionRoomLead({ ...lead, type: 'property_inquiry' }), true)
  assert.equal(api.isTransactionRoomLead({ ...lead, type: 'seller_interest' }), false)
  assert.equal(api.isTransactionRoomLead({ ...lead, assigned_realtor_id: null }), false)
  assert.equal(api.isTransactionRoomLead({ ...lead, from_user_id: null }), false)
})

test('member codes and task controls observe role, assignee, room closure and terminal states', () => {
  const { api } = harness()
  assert.equal(api.transactionAccountCode(' #0000029 '), 29)
  assert.equal(api.transactionAccountCode('0'), null)
  assert.equal(api.transactionAccountCode('2147483648'), null)
  assert.equal(api.transactionAccountCode('person@example.invalid'), null)
  const task = { assignee_user_id: 'me', status: 'open' }
  assert.deepEqual(plain(api.transactionTaskStatuses(start, task, 'me')), ['open', 'in_progress', 'done', 'cancelled'])
  const person = { ...start, role: 'professional' }
  assert.deepEqual(plain(api.transactionTaskStatuses(person, task, 'me')), ['open', 'in_progress', 'done'])
  assert.equal(api.transactionTaskStatuses(person, task, 'other').length, 0)
  assert.equal(api.transactionTaskStatuses(person, { ...task, status: 'done' }, 'me').length, 0)
  assert.equal(api.transactionTaskStatuses({ ...start, status: 'closed' }, task, 'me').length, 0)
})

test('only the scoped room and invite endpoints are called and workflow writes carry the reviewed room version', async () => {
  const { api, calls } = harness()
  const { signal } = new AbortController()
  await api.createTransactionRoom(leadId, 'Synthetic room', signal)
  await api.getTransactionRoom(roomId, signal)
  await api.inviteTransactionProfessional(start, 29, signal)
  await api.acceptTransactionInvitation(grantId, signal)
  await api.updateTransactionTask(start, taskId, { status: 'done' }, signal)
  await api.revokeTransactionMember(start, grantId, signal)
  const base = `/transactions/${roomId}`
  assert.deepEqual(plain(calls), [
    ['post', `/transactions/leads/${leadId}`, { title: 'Synthetic room' }, { signal: {} }],
    ['get', base, { signal: {} }],
    ['post', `${base}/invitations`, { expected_version: 17, member_code: 29 }, { signal: {} }],
    ['post', `/transactions/invitations/${grantId}/accept`, {}, { signal: {} }],
    ['patch', `${base}/tasks/${taskId}`, { expected_version: 17, status: 'done' }, { signal: {} }],
    ['post', `${base}/members/${grantId}/revoke`, { expected_version: 17 }, { signal: {} }],
  ])
  for (const call of calls) assert.equal(call.at(-1).signal, signal)
  assert.equal(api.transactionAccessDenied({ isAxiosError: true, response: { status: 404 } }), true)
  assert.equal(api.transactionAccessDenied({ isAxiosError: true, response: { status: 409 } }), false)
})

test('wrong room response fails closed and both locales include the same operational keys', async () => {
  const { api } = harness({ id: leadId })
  await assert.rejects(() => api.getTransactionRoom(roomId, new AbortController().signal))
  const keys = value => typeof value === 'string' ? [] : Object.fromEntries(Object.keys(value).sort().map(key => [key, keys(value[key])]))
  const copy = language => JSON.parse(fs.readFileSync(path.join(root, 'locale', language, 'transactions.json'), 'utf8'))
  assert.deepEqual(keys(copy('en')), keys(copy('es')))
})
