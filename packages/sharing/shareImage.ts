import { containPhoto, publicSharePhoto, shareAssetSize, validateManualContent, type ManualContent, type ShareFormat, type ShareLocale } from './manual'
import { manualCopy } from './manualCopy'

const PHOTO_BYTES = 8 * 1024 * 1024
const PHOTO_PIXELS = 24000000

function ensureActive(signal: AbortSignal) { if (signal.aborted) throw new DOMException('Canceled', 'AbortError') }

/** Conservative static-image headers only. This reduces exposure before the platform decoder; it is not an absolute browser-memory ceiling. */
export function publicPhotoDimensions(bytes: Uint8Array, type: string): { width: number; height: number } {
  const require = (condition: boolean) => { if (!condition) throw new Error('Unsupported public photo') }
  require(bytes.byteLength > 0 && bytes.byteLength <= PHOTO_BYTES)
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const name = (offset: number, size: number) => String.fromCharCode(...bytes.subarray(offset, offset + size))
  const valid = (width: number, height: number) => { require(Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0 && width * height <= PHOTO_PIXELS); return { width, height } }
  if (type === 'image/png') {
    require(bytes.length >= 45 && name(0, 8) === '\x89PNG\r\n\x1a\n')
    let offset = 8, dimensions: { width: number; height: number } | null = null, pixels = false
    while (offset + 12 <= bytes.length) {
      const size = data.getUint32(offset), kind = name(offset + 4, 4)
      require(size <= bytes.length - offset - 12 && /^[A-Za-z]{4}$/.test(kind) && !['acTL', 'fcTL', 'fdAT'].includes(kind))
      if (offset === 8) { require(kind === 'IHDR' && size === 13); dimensions = valid(data.getUint32(offset + 8), data.getUint32(offset + 12)) }
      else require(kind !== 'IHDR')
      if (kind === 'IDAT') pixels = true
      offset += size + 12
      if (kind === 'IEND') { require(size === 0 && pixels && offset === bytes.length && dimensions !== null); return dimensions! }
    }
    throw new Error('Unsupported public photo')
  }
  if (type === 'image/jpeg') {
    require(bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[bytes.length - 2] === 255 && bytes[bytes.length - 1] === 217)
    let offset = 2, dimensions: { width: number; height: number } | null = null
    const frame = (marker: number) => marker >= 192 && marker <= 207 && ![196, 200, 204].includes(marker)
    while (offset + 4 <= bytes.length) {
      require(bytes[offset++] === 255)
      while (bytes[offset] === 255) offset++
      const marker = bytes[offset++]; require(offset + 2 <= bytes.length)
      const size = data.getUint16(offset); require(size >= 2 && size <= bytes.length - offset - 2)
      if (frame(marker)) {
        require([192, 193, 194].includes(marker) && dimensions === null && size >= 8 && bytes[offset + 2] === 8)
        const components = bytes[offset + 7]; require([1, 3, 4].includes(components) && size === 8 + 3 * components)
        dimensions = valid(data.getUint16(offset + 5), data.getUint16(offset + 3))
      }
      if (marker === 218) {
        require(dimensions !== null && size >= 6 && size === 6 + 2 * bytes[offset + 2])
        // Reject additional frames/concatenated JPEGs. Entropy-coded FF bytes are stuffed with 00.
        for (let position = offset + size; position < bytes.length - 2; position++)
          require(!(bytes[position] === 255 && (frame(bytes[position + 1]) || [216, 217].includes(bytes[position + 1]))))
        return dimensions!
      }
      require([192, 193, 194, 196, 204, 219, 221, 254].includes(marker) || marker >= 224 && marker <= 239)
      offset += size
    }
    throw new Error('Unsupported public photo')
  }
  if (type === 'image/webp') {
    require(bytes.length >= 20 && name(0, 4) === 'RIFF' && name(8, 4) === 'WEBP' && data.getUint32(4, true) === bytes.length - 8)
    let offset = 12, dimensions: { width: number; height: number } | null = null, canvas: { width: number; height: number } | null = null
    const uint24 = (position: number) => bytes[position] + bytes[position + 1] * 256 + bytes[position + 2] * 65536
    while (offset + 8 <= bytes.length) {
      const kind = name(offset, 4), size = data.getUint32(offset + 4, true), start = offset + 8
      require(size <= bytes.length - start && ['VP8X', 'VP8 ', 'VP8L', 'ALPH', 'ICCP', 'EXIF', 'XMP '].includes(kind))
      if (kind === 'VP8X') {
        require(offset === 12 && size === 10 && (bytes[start] & ~60) === 0 && bytes[start + 1] === 0 && bytes[start + 2] === 0 && bytes[start + 3] === 0)
        canvas = valid(1 + uint24(start + 4), 1 + uint24(start + 7))
      } else if (kind === 'VP8 ') {
        require(dimensions === null && size >= 10 && (bytes[start] & 1) === 0 && name(start + 3, 3) === '\x9d\x01\x2a')
        dimensions = valid(data.getUint16(start + 6, true), data.getUint16(start + 8, true))
      } else if (kind === 'VP8L') {
        require(dimensions === null && size >= 5 && bytes[start] === 47)
        const packed = data.getUint32(start + 1, true); require(packed >>> 29 === 0)
        dimensions = valid(1 + (packed & 16383), 1 + ((packed >>> 14) & 16383))
      }
      if (size % 2) require(start + size < bytes.length && bytes[start + size] === 0)
      offset = start + size + (size % 2)
      require(offset <= bytes.length)
    }
    require(offset === bytes.length && dimensions !== null && (!canvas || canvas.width === dimensions!.width && canvas.height === dimensions!.height))
    return dimensions!
  }
  throw new Error('Unsupported public photo')
}

async function publicPhoto(url: string, signal: AbortSignal): Promise<ImageBitmap> {
  if (!publicSharePhoto(url)) throw new Error('Unavailable public photo')
  const response = await fetch(url, { signal, credentials: 'omit', mode: 'cors', redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer' })
  const type = (response.headers.get('content-type') ?? '').split(';')[0].toLowerCase()
  if (!response.ok || !['image/jpeg', 'image/png', 'image/webp'].includes(type)
    || Number(response.headers.get('content-length') ?? 0) > PHOTO_BYTES || !response.body) throw new Error('Unavailable public photo')
  const reader = response.body.getReader(), chunks: Uint8Array<ArrayBuffer>[] = []
  let bytes = 0
  try {
    while (true) {
      const result = await reader.read()
      if (result.done) break
      bytes += result.value.byteLength
      if (bytes > PHOTO_BYTES) throw new Error('Photo size limit')
      chunks.push(new Uint8Array(result.value))
    }
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock() }
  ensureActive(signal)
  const input = new Uint8Array(bytes)
  let offset = 0
  for (const chunk of chunks) { input.set(chunk, offset); offset += chunk.byteLength }
  const dimensions = publicPhotoDimensions(input, type)
  const image = await createImageBitmap(new Blob([input], { type }))
  // EXIF orientation may transpose the two dimensions, but cannot change their magnitudes or pixel budget.
  if (!(image.width === dimensions.width && image.height === dimensions.height || image.width === dimensions.height && image.height === dimensions.width)
    || image.width * image.height > PHOTO_PIXELS) { image.close(); throw new Error('Photo dimensions unavailable') }
  return image
}

/** Canvas text is literal text, never HTML or an SVG containing remote resources. */
export function wrapShareText(text: string, measure: (text: string) => number, width: number, maximum: number): string[] {
  const lines: string[] = [], words = text.replace(/\s+/g, ' ').trim().split(' ')
  let line = ''
  for (const word of words) {
    if (measure((line ? line + ' ' : '') + word) <= width) { line += (line ? ' ' : '') + word; continue }
    if (line) { lines.push(line); line = '' }
    for (const character of word) {
      if (line && measure(line + character) > width) { lines.push(line); line = '' }
      line += character
    }
  }
  if (line) lines.push(line)
  if (lines.length > maximum) {
    lines.length = maximum
    let last = lines[maximum - 1]
    while (last && measure(last + '…') > width) last = [...last].slice(0, -1).join('')
    lines[maximum - 1] = last + '…'
  }
  return lines
}

export function drawShareCard(ctx: CanvasRenderingContext2D, content: ManualContent, format: ShareFormat, locale: ShareLocale,
  image: CanvasImageSource | null, imageSize: { width: number; height: number } | null) {
  const safe = validateManualContent(content)
  if (!safe) throw new Error('Unavailable sharing content')
  const copy = manualCopy(locale), { width, height } = shareAssetSize(format), story = format === 'story'
  const margin = 72, textWidth = width - 2 * margin
  ctx.fillStyle = '#081b3b'; ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#ef163d'; ctx.fillRect(margin, story ? 145 : 50, 80, 8)
  ctx.fillStyle = '#ffffff'; ctx.font = '700 38px Arial, sans-serif'; ctx.textBaseline = 'alphabetic'
  ctx.fillText(copy.brand, margin, story ? 220 : 118)
  ctx.font = `700 ${story ? 64 : 56}px Arial, sans-serif`
  wrapShareText(safe.title, value => ctx.measureText(value).width, textWidth, 3)
    .forEach((line, index) => ctx.fillText(line, margin, (story ? 325 : 194) + index * (story ? 72 : 64)))
  const box = { x: margin, y: story ? 550 : 370, width: textWidth, height: story ? 740 : 350 }
  ctx.fillStyle = '#e8eff5'; ctx.fillRect(box.x, box.y, box.width, box.height)
  if (image && imageSize) {
    // Preserve the whole selected photo; do not crop rooms, alter details or add scenery.
    const fit = containPhoto(imageSize, box)
    ctx.drawImage(image, fit.x, fit.y, fit.width, fit.height)
  } else {
    ctx.fillStyle = '#0f3d68'; ctx.font = '700 54px Arial, sans-serif'
    ctx.fillText('I LOVE DR', box.x + 50, box.y + box.height / 2 - 5)
    ctx.font = '32px Arial, sans-serif'
    ctx.fillText('REALTY', box.x + 50, box.y + box.height / 2 + 45)
  }
  ctx.fillStyle = '#ffffff'; ctx.font = `${story ? 38 : 28}px Arial, sans-serif`
  const labels = safe.audience === 'public' ? safe.facts : [...safe.facts, safe.audience === 'research' ? copy.imageResearch : copy.imageMember]
  const facts = labels.flatMap(fact => wrapShareText(fact, value => ctx.measureText(value).width, textWidth, 2)).slice(0, 5)
  facts.forEach((line, index) => ctx.fillText(line, margin, (story ? 1380 : 780) + index * (story ? 58 : 42)))
  ctx.fillStyle = '#ffb7c3'; ctx.font = `700 ${story ? 30 : 24}px Arial, sans-serif`
  ctx.fillText(copy.visit, margin, story ? 1740 : 986)
  ctx.fillStyle = '#ffffff'; ctx.font = `${story ? 25 : 20}px Arial, sans-serif`
  wrapShareText(safe.url, value => ctx.measureText(value).width, textWidth, 3)
    .forEach((line, index) => ctx.fillText(line, margin, (story ? 1788 : 1020) + index * (story ? 32 : 26)))
}

/** No provider call or upload: one user-triggered local PNG, with an optional explicitly selected public photo. */
export async function createShareImage(content: ManualContent, format: ShareFormat, locale: ShareLocale, photo: string | null, signal: AbortSignal): Promise<Blob> {
  const safe = validateManualContent(content)
  if (!safe || photo !== null && !safe.photos?.includes(photo)) throw new Error('Unavailable sharing content')
  ensureActive(signal)
  const canvas = document.createElement('canvas'), size = shareAssetSize(format)
  canvas.width = size.width; canvas.height = size.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Image export unavailable')
  let image: ImageBitmap | null = null
  try {
    if (photo !== null) image = await publicPhoto(photo, signal)
    ensureActive(signal)
    drawShareCard(ctx, safe, format, locale, image, image ? { width: image.width, height: image.height } : null)
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Image export unavailable')), 'image/png'))
    ensureActive(signal)
    return blob
  } finally { image?.close(); canvas.width = 1; canvas.height = 1 }
}

export function downloadShareFile(blob: Blob, filename: string) {
  if (!/^ilovedrrealty-(?:post|story|caption)-(?:en|es)\.(?:png|txt)$/.test(filename)) throw new Error('Invalid download name')
  const url = URL.createObjectURL(blob), anchor = document.createElement('a')
  anchor.href = url; anchor.download = filename; anchor.rel = 'noopener'; anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 30000)
}
