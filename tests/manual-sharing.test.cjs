const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript'), React = require('react')
const root = path.resolve(__dirname, '..'), id = '00000000-0000-4000-8000-000000000001'
const plain = value => JSON.parse(JSON.stringify(value))
function loader(globals = {}, react = React, language = 'en') {
  const cache = new Map()
  function load(file) {
    const absolute = path.resolve(root, file)
    assert.ok(absolute.startsWith(root + path.sep))
    if (cache.has(absolute)) return cache.get(absolute).exports
    const module = { exports: {} }; cache.set(absolute, module)
    const code = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { fileName: absolute, compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText
    vm.runInNewContext(code, { module, exports: module.exports, URL, URLSearchParams, AbortController, DOMException, Blob, Uint8Array, Intl,
      process: { env: { NEXT_PUBLIC_API_URL: 'https://api.example.invalid' } }, ...globals,
      require(name) {
        if (name === 'react') return react
        if (name === 'react/jsx-runtime') return require(name)
        if (name === 'react-i18next') return { useTranslation: () => ({ i18n: { language } }) }
        assert.ok(name.startsWith('.'), 'Unexpected external dependency ' + name)
        const base = path.resolve(path.dirname(absolute), name), target = ['.ts', '.tsx'].map(s => base + s).find(f => fs.existsSync(f))
        assert.ok(target, 'Missing source import ' + name); return load(path.relative(root, target))
      },
    }, { filename: absolute })
    return module.exports
  }
  return load
}
const core = loader()('packages/sharing/manual.ts'), copy = loader()('packages/sharing/manualCopy.ts').manualCopy
const content = { title: 'Public villa', facts: ['For sale', 'Sale price: USD 250,000'], url: core.manualTargetUrl({ kind: 'listing', id }), audience: 'public' }
const listing = changes => ({ id, status: 'active', type: 'villa', transaction: 'both', title: 'Villa Azul', location: 'Sosúa', location_precision: 'area', location_verified: true,
  currency: 'DOP', price: 12000000, price_per_month: 45000, price_per_day: 2500, bedrooms: 3, bathrooms: 3,
  submitted_by_email: 'PRIVATE_CONTACT', description: 'PRIVATE_DESCRIPTION', latitude: 19.7, images: ['https://images.example.com/public.jpg'], ...changes })
function jpeg(width = 1200, height = 600) { return new Uint8Array([255, 216, 255, 192, 0, 17, 8, height >> 8, height & 255, width >> 8, width & 255,
  3, 1, 17, 0, 2, 17, 1, 3, 17, 1, 255, 218, 0, 12, 3, 1, 0, 2, 17, 3, 17, 0, 63, 0, 1, 255, 217]) }
function png(width, height, animated = false) {
  const chunk = (kind, value) => { const b = Buffer.alloc(12 + value.length); b.writeUInt32BE(value.length); b.write(kind, 4); Buffer.from(value).copy(b, 8); return b }
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), ...(animated ? [chunk('acTL', Buffer.alloc(8))] : []), chunk('IDAT', Buffer.from([1])), chunk('IEND', Buffer.alloc(0))])
}
function webp(width, height, flags = 0, mismatch = false) {
  const extended = Buffer.alloc(10); extended[0] = flags; extended.writeUIntLE(width - 1, 4, 3); extended.writeUIntLE(height - 1, 7, 3)
  const frame = Buffer.alloc(10); frame.set([157, 1, 42], 3); frame.writeUInt16LE(width + (mismatch ? 1 : 0), 6); frame.writeUInt16LE(height, 8)
  const chunks = Buffer.concat([Buffer.from('VP8X'), Buffer.from([10, 0, 0, 0]), extended, Buffer.from('VP8 '), Buffer.from([10, 0, 0, 0]), frame])
  const header = Buffer.alloc(12); header.write('RIFF'); header.writeUInt32LE(chunks.length + 4, 4); header.write('WEBP', 8)
  return Buffer.concat([header, chunks])
}
function losslessWebp(width, height) {
  const payload = Buffer.alloc(6); payload[0] = 47; payload.writeUInt32LE(((width - 1) | ((height - 1) << 14)) >>> 0, 1)
  const header = Buffer.alloc(20); header.write('RIFF'); header.writeUInt32LE(18, 4); header.write('WEBP', 8); header.write('VP8L', 12); header.writeUInt32LE(5, 16)
  return Buffer.concat([header, payload])
}

test('entry links are canonical fixed routes without current host, entered figures, private records or grants', () => {
  const expected = new Map([
    [{ kind: 'listing', id }, 'https://ilovedrrealty.com/listing/' + id + '/'],
    [{ kind: 'resource', id: 'official_guide-1' }, 'https://ilovedrrealty.com/blog/#resource-official_guide-1'],
    [{ kind: 'calculator' }, 'https://ilovedrrealty.com/calculator/'], [{ kind: 'library' }, 'https://ilovedrrealty.com/blog/#website-resources-heading'],
    [{ kind: 'area' }, 'https://app.ilovedrrealty.com/buyer-tools#area-converter-heading'], [{ kind: 'research' }, 'https://app.ilovedrrealty.com/research'],
    ...['Buyer', 'Owner', 'Realtor'].map(workspace => [{ kind: 'hub', workspace }, 'https://app.ilovedrrealty.com/' + workspace.toLowerCase() + '-tools']),
  ])
  for (const [target, url] of expected) { assert.equal(core.manualTargetUrl({ ...target, privateInputs: 'PRIVATE_FINANCE' }), url); assert.equal(core.approvedManualUrl(url), true) }
  for (const target of [{ kind: 'listing', id: id + '\n' }, { kind: 'resource', id: 'guide?token=private' }, { kind: 'hub', workspace: 'Admin' }]) assert.equal(core.manualTargetUrl(target), null)
  for (const url of [content.url + '?token=PRIVATE', 'https://preview.vercel.app/calculator/', 'https://ilovedrrealty.com/projects/' + id,
    'https://user:pass@ilovedrrealty.com/calculator/', 'https://app.ilovedrrealty.com/research?project=PRIVATE']) assert.equal(core.approvedManualUrl(url), false)
})

test('manual composers keep the reviewed caption and canonical link, without recipients or automatic sends', () => {
  for (const locale of ['en', 'es']) {
    const links = core.manualComposeLinks(content, copy(locale).public)
    assert.equal(new URL(links.whatsapp).searchParams.get('text'), links.preview)
    assert.equal(new URL(links.email).searchParams.get('body'), links.preview)
    assert.equal(new URL(links.sms).searchParams.get('body'), links.preview)
    assert.equal(new URL(links.facebook).searchParams.get('u'), content.url)
    assert.equal(new URL(links.facebook).searchParams.size, 1)
    assert.equal(new URL(links.email).pathname, '')
    assert.equal(core.manualComposeLinks({ ...content, title: 'Title\r\nBcc: private@example.com' }, ''), null)
  }
})

test('only explicit safe public photo URLs survive; credentials, private signatures and local addresses do not', () => {
  assert.equal(core.publicSharePhoto('https://images.example.com/public.jpg?w=1080'), true)
  for (const url of ['http://images.example.com/p.jpg', 'https://user:pass@images.example.com/p.jpg', 'https://127.0.0.1/p.jpg', 'https://[::1]/p.jpg',
    'https://files.internal/p.jpg', 'https://localhost./p.jpg', 'https://files.internal./p.jpg', 'https://images.example.com/p.jpg?token=PRIVATE', 'https://images.example.com/p.jpg?X-Amz-Signature=PRIVATE',
    'https://example.supabase.co/storage/v1/object/sign/private/p.jpg', 'https://images.example.com/p.jpg#private', 'https://images.example.com:444/p.jpg']) assert.equal(core.publicSharePhoto(url), false, url)
  assert.equal(core.safeShareTitle('Call +1 809 555 0100', 'Property resources'), 'Property resources')
  const { publicPhotoDimensions: dimensions } = loader()('packages/sharing/shareImage.ts')
  for (const [type, bytes] of [['image/jpeg', jpeg(320, 240)], ['image/png', png(320, 240)], ['image/webp', webp(320, 240)], ['image/webp', losslessWebp(320, 240)]]) {
    assert.deepEqual(plain(dimensions(bytes, type)), { width: 320, height: 240 })
    assert.throws(() => dimensions(bytes.subarray(0, bytes.length - 1), type))
  }
  for (const [type, bytes] of [['image/jpeg', jpeg(6000, 6000)], ['image/png', png(6000, 6000)], ['image/webp', webp(6000, 6000)], ['image/webp', losslessWebp(6000, 6000)],
    ['image/png', png(320, 240, true)], ['image/webp', webp(320, 240, 2)], ['image/webp', webp(320, 240, 0, true)],
    ['image/avif', jpeg()], ['image/png', jpeg()], ['image/jpeg', new Uint8Array([255, 216, 255, 217])]]) assert.throws(() => dimensions(bytes, type))
  assert.throws(() => dimensions(Buffer.concat([jpeg().subarray(0, 35), Buffer.from([255, 192, 0, 1]), jpeg().subarray(35)]), 'image/jpeg'))
})

test('public listing captions whitelist current facts and retain explicit currency and rental periods', () => {
  const { publicListingShareFacts: project } = loader()('apps/landing/src/lib/listingShare.ts')
  for (const locale of ['en', 'es']) {
    const result = project(id, listing(), locale), text = JSON.stringify(result)
    assert.ok(result.facts.some(line => line.startsWith(copy(locale).monthly + ': DOP')))
    assert.ok(result.facts.some(line => line.startsWith((locale === 'en' ? 'Per day' : 'Por día') + ': DOP')))
    assert.equal(result.facts.some(line => /Per night|Por noche/.test(line)), false)
    assert.ok(result.facts.some(line => line.includes('Sosúa')))
    for (const privateText of ['PRIVATE_CONTACT', 'PRIVATE_DESCRIPTION', 'latitude', '19.7']) assert.equal(text.includes(privateText), false)
    for (const change of [{ status: 'draft' }, { status: 'archived' }, { id: id.replace(/1$/, '2') }, { transaction: 'unknown' }]) assert.equal(project(id, listing(change), locale), null)
    const hidden = project(id, listing({ location_precision: 'hidden', title: 'Exact hidden property address' }), locale)
    const unverified = project(id, listing({ location_verified: false }), locale)
    for (const result of [hidden, unverified]) { assert.equal(result.title, copy(locale).types.villa); assert.equal(JSON.stringify(result).includes('Sosúa'), false) }
    const daily = project(id, listing({ transaction: 'rent', price_per_month: null }), locale)
    assert.equal(daily.facts.some(line => line.startsWith(copy(locale).price + ':')), false)
    assert.equal(daily.facts.some(line => line.startsWith(copy(locale).monthly + ':')), false)
    const variable = project(id, listing({ transaction: 'sale', construction_status: 'Under Construction' }), locale)
    assert.equal(variable.facts.some(line => line.includes('DOP')), false)
    assert.equal(project(id, listing({ currency: 'EUR' }), locale).facts.some(line => /EUR|DOP|USD/.test(line)), false)
  }
})

test('listing refresh is anonymous and uncached and refuses a stale or unconfirmed response', async () => {
  const calls = [], signal = new AbortController().signal
  let cache = 'no-store', row = listing()
  const load = loader({ fetch: async (...args) => { calls.push(args); return { ok: true, headers: new Headers({ 'cache-control': cache }), json: async () => row } } })
  const { fetchPublicListingShare: read } = load('apps/landing/src/lib/listingShare.ts')
  assert.ok(await read(id, 'en', signal)); assert.equal(calls[0][0], 'https://api.example.invalid/listings/' + id)
  assert.equal(calls[0][1].credentials, 'omit'); assert.equal(calls[0][1].cache, 'no-store'); assert.equal(calls[0][1].signal, signal)
  cache = 'public, max-age=60'; assert.equal(await read(id, 'en', signal), null)
  cache = 'no-store'; row = listing({ status: 'draft' }); assert.equal(await read(id, 'en', signal), null)
  assert.equal(await read('invalid', 'en', signal), null); assert.equal(calls.length, 3)
})

function canvasHarness(options = {}) {
  const text = [], images = [], canvases = [], closed = [], photoCalls = [], decodes = []
  const ctx = { measureText: value => ({ width: [...value].length * 22 }), fillRect() {}, fillText(value, x, y) { text.push({ value, x, y }) }, drawImage(...args) { images.push(args) } }
  const globals = { document: { createElement(kind) { assert.equal(kind, 'canvas'); const canvas = { width: 0, height: 0, getContext: () => ctx,
    toBlob(fn, type) { canvases.push({ width: this.width, height: this.height, type }); fn(new Blob(['SYNTHETIC_PNG_ENCODER'], { type })) } }; return canvas } },
    fetch: async (...args) => { photoCalls.push(args); if (options.redirect) throw new TypeError('Synthetic refused redirect'); let read = false
      return { ok: true, headers: new Headers({ 'content-type': options.type ?? 'image/jpeg', ...(options.contentLength ? { 'content-length': String(options.contentLength) } : {}) }), body: { getReader: () => ({ read: async () => read ? { done: true } : (read = true, { done: false, value: options.payload ?? jpeg() }), cancel: async () => {}, releaseLock() {} }) } } },
    createImageBitmap: async blob => { decodes.push(blob); return { width: options.decodedWidth ?? 1200, height: options.decodedHeight ?? 600, close() { closed.push(true) } } } }
  return { ...loader(globals)('packages/sharing/shareImage.ts'), text, images, canvases, closed, photoCalls, decodes }
}
test('post and story drawing use literal branded text, whole-photo geometry and member access notes', async () => {
  for (const format of ['post', 'story']) {
    const h = canvasHarness(), photo = 'https://images.example.com/public.jpg'
    await h.createShareImage({ ...content, photos: [photo] }, format, 'en', photo, new AbortController().signal)
    assert.deepEqual(h.canvases[0], { ...plain(core.shareAssetSize(format)), type: 'image/png' })
    assert.equal(h.images.length, 1); assert.equal(h.images[0][3] / h.images[0][4], 2)
    assert.equal(h.closed.length, 1); assert.equal(h.photoCalls[0][1].credentials, 'omit'); assert.equal(h.photoCalls[0][1].redirect, 'error')
    assert.equal(h.photoCalls[0][1].referrerPolicy, 'no-referrer'); assert.equal(h.photoCalls[0][1].mode, 'cors')
    assert.ok(h.text.some(line => line.value === 'I LOVE DR REALTY')); assert.ok(h.text.every(line => line.x >= 72 && line.y < core.shareAssetSize(format).height))
    await assert.rejects(h.createShareImage({ ...content, photos: [photo] }, format, 'en', 'https://images.example.com/other.jpg', new AbortController().signal))
    const aborted = new AbortController(); aborted.abort(); await assert.rejects(h.createShareImage(content, format, 'en', null, aborted.signal))
  }
  const h = canvasHarness()
  await h.createShareImage({ ...content, title: 'Member tools', facts: [], audience: 'research', url: core.manualTargetUrl({ kind: 'research' }) }, 'story', 'es', null, new AbortController().signal)
  assert.equal(h.photoCalls.length, 0); assert.ok(h.text.some(line => line.value.includes('Admin')))
  const photo = 'https://images.example.com/public.jpg'
  for (const options of [{ redirect: true }, { contentLength: 8388609 }, { payload: new Uint8Array(8388609) }, { payload: jpeg(6000, 6000) },
    { type: 'image/avif' }, { payload: png(320, 240, true), type: 'image/png' }]) {
    const refused = canvasHarness(options)
    await assert.rejects(refused.createShareImage({ ...content, photos: [photo] }, 'post', 'en', photo, new AbortController().signal))
    assert.equal(refused.decodes.length, 0, 'Rejected before platform decoding')
  }
  const mismatch = canvasHarness({ decodedWidth: 1201 })
  await assert.rejects(mismatch.createShareImage({ ...content, photos: [photo] }, 'post', 'en', photo, new AbortController().signal))
  assert.equal(mismatch.closed.length, 1)
  const oriented = canvasHarness({ decodedWidth: 600, decodedHeight: 1200 })
  await oriented.createShareImage({ ...content, photos: [photo] }, 'post', 'en', photo, new AbortController().signal)
  assert.equal(oriented.closed.length, 1)
})

function uiHarness(props, language = 'en', native = async () => {}) {
  const slots = [], effects = [], copies = [], shares = [], timers = new Map(); let cursor = 0, dirty = true, current, nextTimer = 0
  const slot = kind => { const n = cursor++; slots[n] ??= { kind }; assert.equal(slots[n].kind, kind); return slots[n] }
  const hooks = { ...React, useId: () => 'sharing-test', useState(initial) { const s = slot('state'); if (!Object.hasOwn(s, 'value')) s.value = typeof initial === 'function' ? initial() : initial
    return [s.value, update => { const next = typeof update === 'function' ? update(s.value) : update; if (!Object.is(next, s.value)) { s.value = next; dirty = true } }] },
    useRef(value) { const s = slot('ref'); return s.value ??= { current: value } }, useEffect(fn, deps) { const s = slot('effect'); if (!s.deps || deps.some((v, n) => !Object.is(v, s.deps[n]))) { s.deps = [...deps]; effects.push(() => { s.cleanup?.(); s.cleanup = fn() }) } } }
  const globals = { navigator: { clipboard: { writeText: async text => copies.push(text) }, share: async payload => { shares.push(payload); return native(payload) } },
    window: { setTimeout(fn) { const id = ++nextTimer; timers.set(id, fn); return id }, clearTimeout(id) { timers.delete(id) } } }
  const { ManualShareActions } = loader(globals, hooks, language)('packages/sharing/ManualShareActions.tsx')
  const nodes = () => { const result = []; function visit(node) { if (!node || typeof node !== 'object') return; if (Array.isArray(node)) return node.forEach(visit); result.push(node); visit(node.props?.children) } visit(current); return result }
  const text = node => typeof node === 'string' || typeof node === 'number' ? String(node) : Array.isArray(node) ? node.map(text).join('') : text(node?.props?.children ?? '')
  return { copies, shares, nodes, text, get tree() { return current },
    async flush() { for (let n = 0; n < 20; n++) { if (dirty) { dirty = false; cursor = 0; current = ManualShareActions(props); effects.splice(0).forEach(fn => fn()) } for (let tick = 0; tick < 20; tick++) await Promise.resolve(); if (!dirty && !effects.length) return } assert.fail('Unbounded render') },
    find(label) { const result = nodes().find(n => n.type === 'button' && text(n) === label); assert.ok(result, label); return result },
    dispose() { slots.forEach(s => s.cleanup?.()) },
  }
}
test('actual share UI keeps the preview, clipboard and native payload identical and waits for explicit user actions', async () => {
  for (const locale of ['en', 'es']) {
    const h = uiHarness({ locale, content: { ...content, photos: ['https://images.example.com/public.jpg'] } }, locale, async () => { throw new DOMException('Canceled', 'AbortError') })
    try {
      await h.flush(); assert.equal(h.shares.length, 0); assert.equal(h.copies.length, 0)
      h.nodes().find(n => n.type === 'select' && n.props.value === '').props.onChange({ target: { value: 'https://images.example.com/public.jpg' } }); await h.flush()
      assert.equal(h.nodes().some(n => n.type === 'img'), false, 'A selected remote URL is never used for a preview image')
      const preview = h.nodes().find(n => n.type === 'pre').props.children
      await h.find(copy(locale).copyCaption).props.onClick(); await h.flush(); assert.equal(h.copies[0], preview)
      await h.find(copy(locale).native).props.onClick(); await h.flush(); assert.deepEqual(plain(h.shares[0]), { title: content.title, text: preview })
      assert.ok(h.text(h.tree).includes(copy(locale).canceled)); assert.equal(h.shares.length, 1)
      assert.equal(h.nodes().some(n => n.type === 'a' && n.props.href.startsWith('https://www.instagram.com/')), true)
    } finally { h.dispose() }
  }
})

test('a late listing read cannot revive a closed preview; failed fresh reads expose only an explicit retry', async () => {
  let finish, requested
  const h = uiHarness({ locale: 'en', load: signal => { requested = signal; return new Promise(resolve => { finish = resolve }) } })
  try {
    await h.flush(); h.tree.props.onToggle({ currentTarget: { open: true } }); await h.flush()
    h.tree.props.onToggle({ currentTarget: { open: false } }); await h.flush(); assert.equal(requested.aborted, true)
    finish(content); await h.flush(); assert.equal(h.nodes().some(n => n.type === 'pre'), false)
    h.tree.props.onToggle({ currentTarget: { open: true } }); await h.flush(); finish(null); await h.flush()
    assert.equal(h.nodes().some(n => n.type === 'pre'), false); assert.ok(h.find(copy('en').retry)); assert.equal(h.shares.length, 0)
  } finally { h.dispose() }
})
