const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { webcrypto } = require('node:crypto')
const { test } = require('node:test')
const ts = require('typescript')

const room = '6257bb39-75bd-449a-852a-5f88819d84f5'
const document = '6bf36a26-007c-46de-8be8-1c4255b2006f'
const version = '54b6a38b-4214-445f-8f38-37ff9e87d3e6'
const request = 'f281a724-68ce-4a3f-acfa-97105b8c39ce'
const professional = '4a2efa92-15ea-4f0d-8d68-40390921d3ad'
const root = `/transactions/${room}/documents`
const scopedVersion = `${root}/${document}/versions/${version}`
const bytes = '%PDF-1.4\n% synthetic fixture\n%%EOF\n'
const file = new File([bytes], 'Contrato de prueba.pdf', { type: 'application/pdf' })
const receipt = status => ({ document_id: document, version_id: version, number: 1, status })

function harness({ posted = 'reserved', finalized = 'submitted', cache = 'private, no-store', blob = file } = {}) {
  const calls = []
  const http = {
    post: async (...args) => { calls.push(['POST', ...args]); return { data: receipt(posted) } },
    put: async (...args) => { calls.push(['PUT', ...args]); return { data: receipt(finalized) } },
    get: async (...args) => { calls.push(['GET', ...args]); return { data: blob, headers: { 'cache-control': cache } } },
  }
  const filename = path.resolve(__dirname, '../apps/dashboard/src/api/transactionDocuments.ts')
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, reportDiagnostics: true, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
  } })
  assert.deepEqual(compiled.diagnostics, [])
  const module = { exports: {} }
  vm.runInNewContext(compiled.outputText, { module, exports: module.exports, Blob, crypto: webcrypto, require: name => {
    assert.equal(name, './axios')
    return http
  } })
  return { api: module.exports, calls }
}

test('upload reserves the digest and exact file before scoped raw transfer; retries keep the same reservation', async () => {
  const { api, calls } = harness()
  const { signal } = new AbortController()
  const reservation = await api.prepareDocumentReservation(file, '   Synthetic legal document  ', request)
  assert.equal(reservation.request_id, request)
  assert.equal(reservation.title, 'Synthetic legal document')
  assert.equal(reservation.file_name, file.name)
  assert.equal(reservation.content_type, 'application/pdf')
  assert.equal(reservation.byte_count, file.size)
  assert.match(reservation.sha256, /^[a-f0-9]{64}$/)
  await api.uploadTransactionDocument(room, reservation, file, signal)
  await api.uploadTransactionDocument(room, reservation, file, signal)
  assert.deepEqual(calls.map(([method, url]) => [method, url]), [
    ['POST', root], ['PUT', `${scopedVersion}/content`], ['POST', root], ['PUT', `${scopedVersion}/content`],
  ])
  assert.equal(calls[0][2], reservation)
  assert.equal(calls[2][2], reservation)
  assert.equal(calls[1][2], file)
  assert.equal(calls[1][3].headers['Content-Type'], 'application/pdf')
  assert.equal(calls[3][3].signal, signal)
})

test('a finalized replay never transfers bytes again and a different existing document receipt is denied', async () => {
  const { api, calls } = harness({ posted: 'approved' })
  const { signal } = new AbortController()
  await api.uploadTransactionDocument(room, await api.prepareDocumentReservation(file, 'Same document', request, document), file, signal)
  assert.equal(calls.length, 1)
  assert.equal(calls[0][2].document_id, document)
  await assert.rejects(api.uploadTransactionDocument(room, await api.prepareDocumentReservation(file, 'Other document', request, request), file, signal))
  assert.equal(calls.length, 2)
})

test('only supported bounded files and plain names are valid, including missing browser MIME with a known extension', () => {
  const { api } = harness()
  assert.equal(api.transactionDocumentType(new File([bytes], 'check.PDF')), 'application/pdf')
  assert.equal(api.transactionDocumentType(new File([bytes], 'check.html', { type: 'text/html' })), null)
  assert.equal(api.transactionDocumentType(new File([bytes], '../check.pdf', { type: 'application/pdf' })), null)
  assert.equal(api.transactionDocumentType(new File([bytes], 'unsafe\u202ename.pdf', { type: 'application/pdf' })), null)
  assert.equal(api.transactionDocumentType(new File([new Uint8Array(6 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' })), null)
  assert.equal(api.validDocumentTitle('  Actual title  '), true)
  assert.equal(api.validDocumentTitle('abc\n123'), false)
  assert.equal(api.validDocumentTitle('x'.repeat(161)), false)
})

test('exact-version approval carries only the chosen audience and reviewed room version', async () => {
  const { api, calls } = harness({ posted: 'approved' })
  const { signal } = new AbortController()
  const review = { expected_version: 40, status: 'approved', share_with_buyer: true, professional_grant_id: professional }
  await api.reviewTransactionDocument(room, document, version, review, signal)
  assert.deepEqual(calls[0].slice(0, 3), ['POST', `${scopedVersion}/review`, review])
  assert.equal(calls[0][3].signal, signal)
})

test('protected downloads require an authorized row and matching no-store bytes', async () => {
  const record = { id: version, file_name: file.name, can_download: true, byte_count: file.size, content_type: file.type }
  const { signal } = new AbortController()
  const { api, calls } = harness()
  assert.equal(await api.downloadTransactionDocument(room, document, record, signal), file)
  assert.deepEqual(calls[0].slice(0, 2), ['GET', `${scopedVersion}/download`])
  assert.equal(calls[0][2].responseType, 'blob')
  await assert.rejects(api.downloadTransactionDocument(room, document, { ...record, can_download: false }, signal))
  assert.equal(calls.length, 1)
  await assert.rejects(api.downloadTransactionDocument(room, document, { ...record, byte_count: file.size + 1 }, signal))
  await assert.rejects(harness({ cache: 'private, max-age=60' }).api.downloadTransactionDocument(room, document, record, signal))
})
