import { normalizeLocation, SEARCH_CATALOG_LOCATIONS } from '../data/searchLocations'
import { roiPdfText, wrapRoiPdfText } from './roiPdf'

const LISTING_ID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i
const TYPES = ['villa', 'apartment', 'condo', 'land', 'commercial'] as const
const TRANSACTIONS = ['sale', 'rent', 'both'] as const
const AREAS = new Map(SEARCH_CATALOG_LOCATIONS.map(area => [normalizeLocation(area), area]))
type Currency = 'USD' | 'DOP'
type Rate = { basis: 'sale_price' | 'per_month' | 'per_day'; amount: number }
type BrochureLocale = 'en' | 'es'
type BrochureTranslate = (key: string) => string

interface Brochure {
  id: string
  url: string
  type: typeof TYPES[number]
  transaction: typeof TRANSACTIONS[number]
  title: string | null
  area: string | null
  bedrooms: number | null
  bathrooms: number | null
  livingSqft: number | null
  lotSqft: number | null
  built: number | null
  currency: Currency | null
  rates: Rate[]
}

const isListingId = (value: unknown): value is string =>
  typeof value === 'string' && value.length === 36 && LISTING_ID.test(value)
const inCatalog = <T extends string>(values: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && (values as readonly string[]).includes(value)

function positiveDecimal(value: unknown, fraction = true): number | null {
  const text = typeof value === 'number' || typeof value === 'string' ? String(value) : ''
  const pattern = fraction ? /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/ : /^[1-9]\d{0,9}$/
  return pattern.test(text) && text.trim() === text && Number(text) > 0 ? Number(text) : null
}

function safeTitle(value: unknown): string | null {
  if (typeof value !== 'string' || /[@<>]|(?:https?:|www\.)|\+?\d(?:[ ().-]*\d){7}/i.test(value)) return null
  // Helvetica has no general Unicode fallback. Keep EN/ES accents and remove
  // unsupported characters before measuring or encoding any listing label.
  const title = roiPdfText(value.normalize('NFC'))
    .replace(/[^\x20-\x7e\xa1-\xff]/g, ' ').replace(/\s+/g, ' ').trim()
  return title.length > 140 ? title.slice(0, 137).trimEnd() + '...' : title || null
}

export function listingBrochureFacts(requestedId: string, input: unknown): Brochure | null {
  if (!isListingId(requestedId) || !input || typeof input !== 'object') return null
  const row = input as Record<string, unknown>
  const { id, type, transaction } = row
  if (!isListingId(id) || id.toLowerCase() !== requestedId.toLowerCase() || row.status !== 'active'
    || !inCatalog(TYPES, type) || !inCatalog(TRANSACTIONS, transaction)) return null

  // A free-form listing label could repeat a location hidden in its public
  // projection. Use a generic type title and omit the area in that case.
  const broadLocationAllowed = row.location_precision === 'area' || row.location_precision === 'exact'
  const area = broadLocationAllowed && typeof row.location === 'string' && row.location.length <= 80
    ? AREAS.get(normalizeLocation(row.location)) ?? null : null
  const currency = row.currency === 'USD' || row.currency === 'DOP' ? row.currency : null
  const rates: Rate[] = []
  const construction = typeof row.construction_status === 'string'
    ? row.construction_status.trim().toLowerCase().replace(/[\s-]+/g, '_') : ''
  const variableDevelopmentPrice = construction === 'pre_construction' || construction === 'under_construction'
  if (currency) {
    const priceFields: [Rate['basis'], unknown][] = [
      ['sale_price', transaction !== 'rent' && !variableDevelopmentPrice ? row.price : null],
      ['per_month', transaction !== 'sale' ? row.price_per_month : null],
      ['per_day', transaction !== 'sale' ? row.price_per_day : null],
    ]
    for (const [basis, value] of priceFields) {
      const amount = positiveDecimal(value)
      if (amount !== null) rates.push({ basis, amount })
    }
  }
  const year = positiveDecimal(row.year_built, false)
  const listing = id.toLowerCase()
  return {
    id: listing, url: 'https://ilovedrrealty.com/listing/' + listing + '/', type, transaction,
    title: broadLocationAllowed ? safeTitle(row.title) : null, area,
    bedrooms: positiveDecimal(row.bedrooms, false), bathrooms: positiveDecimal(row.bathrooms),
    livingSqft: type === 'land' ? null : positiveDecimal(row.area_sqft, false),
    lotSqft: positiveDecimal(row.lot_size_sqft, false),
    built: year !== null && year >= 1000 && year <= new Date().getUTCFullYear() ? year : null,
    currency, rates,
  }
}

export async function createListingBrochure(brochure: Brochure, locale: BrochureLocale, t: BrochureTranslate): Promise<Uint8Array> {
  const { PDFDocument, PDFName, PDFString, StandardFonts, rgb } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  const type = t('types.' + brochure.type)
  const title = brochure.title ?? type
  pdf.setTitle(title + ' | I Love DR Realty')
  pdf.setAuthor('I Love DR Realty')
  pdf.setLanguage(locale)
  pdf.setSubject(t('document_title'))
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const page = pdf.addPage([612, 792])
  const navy = rgb(0.00, 0.06, 0.18), red = rgb(0.72, 0.03, 0.12), dim = rgb(0.27, 0.34, 0.43)
  const white = rgb(1, 1, 1), pale = rgb(0.92, 0.94, 0.97), rose = rgb(1, 0.56, 0.62)
  const left = 48, right = 564, width = right - left
  const draw = (value: string, x: number, y: number, size: number, font = regular, color = navy) =>
    page.drawText(roiPdfText(value), { x, y, size, font, color })
  const rule = (y: number) => page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 0.6, color: pale })
  const language = locale === 'es' ? 'es-DO' : 'en-US'
  const number = new Intl.NumberFormat(language, { maximumFractionDigits: 2 })
  const money = new Intl.NumberFormat(language, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  page.drawRectangle({ x: 0, y: 550, width: 612, height: 242, color: navy })
  page.drawRectangle({ x: left, y: 750, width: 36, height: 3, color: rose })
  draw('I LOVE DR REALTY', left, 728, 13, bold, white)
  draw(t('document_title'), left, 704, 11, regular, rose)
  const titleWidth = (text: string) => bold.widthOfTextAtSize(text, 28)
  const wrappedTitle = wrapRoiPdfText(title, width, titleWidth)
  const titleLines = wrappedTitle.slice(0, 3)
  if (wrappedTitle.length > 3) {
    let last = titleLines[2]
    while (titleWidth(last + '...') > width) last = last.slice(0, -1)
    titleLines[2] = last.trimEnd() + '...'
  }
  titleLines.forEach((line, index) => draw(line, left, 664 - 33 * index, 28, bold, white))
  const subtitle = [brochure.title ? type : null, t('transactions.' + brochure.transaction), brochure.area]
    .filter(Boolean).join('  /  ')
  draw(subtitle, left, 568, 11, regular, white)

  let y = 511
  draw(t('prices'), left, y, 14, bold)
  y -= 30
  if (brochure.currency && brochure.rates.length) {
    for (const rate of brochure.rates) {
      const amount = brochure.currency + ' ' + money.format(rate.amount)
      draw(t(rate.basis), left, y, 11, regular, dim)
      draw(amount, right - bold.widthOfTextAtSize(roiPdfText(amount), 15), y, 15, bold)
      rule(y - 12)
      y -= 35
    }
  } else {
    draw(t('price_unlisted'), left, y, 11, regular, dim)
    y -= 35
  }
  const facts = [
    ['bedrooms', brochure.bedrooms, ''], ['bathrooms', brochure.bathrooms, ''],
    ['living', brochure.livingSqft, ' ft²'], ['lot', brochure.lotSqft, ' ft²'],
    ['built', brochure.built, ''],
  ] as const
  const reported = facts.flatMap(([label, value, unit]) => value === null ? [] : [{ label, value, unit }])
  if (reported.length) {
    draw(t('details'), left, y - 9, 14, bold)
    reported.forEach(({ label, value, unit }, index) => {
      const x = left + (index % 2) * 264
      const baseline = y - 40 - Math.floor(index / 2) * 49
      draw(t(label), x, baseline, 10, regular, dim)
      draw((label === 'built' ? String(value) : number.format(value)) + unit, x, baseline - 19, 15, bold)
    })
  }

  page.drawRectangle({ x: left, y: 46, width, height: 100, color: pale })
  const message = wrapRoiPdfText(t('verify'), width - 32, text => regular.widthOfTextAtSize(text, 10))
  message.forEach((line, index) => draw(line, left + 16, 126 - index * 13, 10, regular, dim))
  const action = t('open_listing')
  draw(action, left + 16, 84, 11, bold, red)
  draw(brochure.url, left + 16, 64, 9, regular, dim)
  const annotation = pdf.context.obj({
    Type: 'Annot', Subtype: 'Link', Rect: [left + 14, 60, right - 14, 98], Border: [0, 0, 0],
    A: { S: 'URI', URI: PDFString.of(brochure.url) },
  })
  page.node.set(PDFName.of('Annots'), pdf.context.obj([pdf.context.register(annotation)]))
  return pdf.save({ useObjectStreams: false })
}

export function saveListingBrochure(bytes: Uint8Array, id: string, locale: BrochureLocale): void {
  const blob = new Blob([new Uint8Array(bytes).buffer], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  try {
    anchor.href = url
    anchor.download = 'ilovedrrealty-' + id + '-' + locale + '.pdf'
    document.body.appendChild(anchor)
    anchor.click()
  } finally {
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}
