import { buildRoiReport, canonicalRoiState, roiNumber, type RoiState, type RoiTranslate } from './roiCalculator'

/** Standard Helvetica covers EN/ES; normalize only typography outside WinAnsi. */
export function roiPdfText(value: string): string {
  return value.replace(/[\u2010-\u2015\u2212]/g, '-').replace(/[\u2000-\u200b\u202f\u00a0]/g, ' ')
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\r\n\t]+/g, ' ')
}
export function wrapRoiPdfText(value: string, width: number, measure: (text: string) => number): string[] {
  if (width <= 0 || !Number.isFinite(width)) throw new Error('Invalid PDF width')
  const words = roiPdfText(value).split(/ +/).filter(Boolean), lines: string[] = []
  let line = ''
  for (const word of words) {
    if (measure(word) > width) {
      if (line) { lines.push(line); line = '' }
      let part = ''
      for (const character of word) {
        if (part && measure(part + character) > width) { lines.push(part); part = '' }
        part += character
      }
      line = part
    } else if (line && measure(line + ' ' + word) > width) { lines.push(line); line = word }
    else line = line ? line + ' ' + word : word
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

/** The PDF dependency is fetched only after an explicit export action. */
export async function createRoiPdf(stateInput: RoiState, t: RoiTranslate): Promise<Uint8Array> {
  const state = canonicalRoiState(stateInput)
  const report = buildRoiReport(state, t)
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const document = await PDFDocument.create()
  document.setTitle(report.title); document.setAuthor('iLoveDR Realty'); document.setLanguage(state.locale)
  document.setSubject('Illustrative USD calculator model v1; chosen assumptions and recalculated results')
  document.setCreator('iLoveDR Realty ROI calculator')
  const regular = await document.embedFont(StandardFonts.Helvetica), bold = await document.embedFont(StandardFonts.HelveticaBold)
  const ink = rgb(0.05, 0.11, 0.24), dim = rgb(0.32, 0.38, 0.46), accent = rgb(0.04, 0.39, 0.63)
  const margin = 46, pageWidth = 612, pageHeight = 792, contentWidth = pageWidth - 2 * margin
  let page = document.addPage([pageWidth, pageHeight]), cursor = 0
  const draw = (text: string, x: number, y: number, size = 10, heavy = false, color = ink) => page.drawText(roiPdfText(text), { x, y, size, font: heavy ? bold : regular, color })
  const header = () => {
    draw('iLoveDR Realty', margin, pageHeight - 43, 14, true, accent)
    draw(t('report.header_currency', { currency: 'USD', language: state.locale.toUpperCase() }), margin, pageHeight - 62, 9, false, dim)
    page.drawLine({ start: { x: margin, y: pageHeight - 75 }, end: { x: pageWidth - margin, y: pageHeight - 75 }, thickness: 0.7, color: rgb(0.82, 0.86, 0.9) })
    cursor = pageHeight - 100
  }
  const ensure = (height: number) => { if (cursor - height < 69) { page = document.addPage([pageWidth, pageHeight]); header() } }
  const paragraph = (text: string, size = 10, heavy = false) => {
    const font = heavy ? bold : regular
    const lines = wrapRoiPdfText(text, contentWidth, value => font.widthOfTextAtSize(value, size))
    const blockHeight = lines.length * (size + 4) + 5
    if (blockHeight <= pageHeight - 169) ensure(blockHeight)
    for (const line of lines) { ensure(size + 6); draw(line, margin, cursor, size, heavy, heavy ? ink : dim); cursor -= size + 4 }
    cursor -= 5
  }
  const section = (title: string, followingHeight = 55) => { ensure(30 + followingHeight); cursor -= 8; draw(title, margin, cursor, 12, true, accent); cursor -= 22 }
  const row = (label: string, value: string) => {
    const left = wrapRoiPdfText(label, 292, text => regular.widthOfTextAtSize(text, 10))
    const right = wrapRoiPdfText(value, 206, text => bold.widthOfTextAtSize(text, 10))
    const height = Math.max(left.length, right.length) * 14 + 9
    ensure(height)
    for (let index = 0; index < left.length; index++) draw(left[index], margin, cursor - index * 14, 10)
    for (let index = 0; index < right.length; index++) {
      const line = right[index]
      draw(line, pageWidth - margin - bold.widthOfTextAtSize(line, 10), cursor - index * 14, 10, true)
    }
    cursor -= height
    page.drawLine({ start: { x: margin, y: cursor + 4 }, end: { x: pageWidth - margin, y: cursor + 4 }, thickness: 0.35, color: rgb(0.9, 0.92, 0.94) })
  }
  header(); paragraph(report.title, 19, true); paragraph(t('report.illustrative'))
  section(t('report.summary'))
  for (const item of report.summary) row(item.label, item.value)
  section(t('report.assumptions'))
  for (const item of report.assumptions) row(item.label, item.value)
  if (report.years.length) {
    section(t('chart.title'))
    for (const year of report.years) {
      ensure(105)
      paragraph(t('chart.year', { n: year.y }), 10, true)
      row(t('chart.income'), roiNumber(year.rent, state.locale, 'money'))
      row(t('chart.expenses'), roiNumber(year.exp, state.locale, 'money'))
      row(t('chart.net'), roiNumber(year.net, state.locale, 'money'))
    }
  }
  if (report.comparisons.length) {
    section(t('comparison.title'))
    for (const comparison of report.comparisons) {
      ensure(105)
      paragraph(comparison.label, 10, true)
      row(t('comparison.col_roi'), comparison.roi); row(t('comparison.col_cf'), comparison.cf); row(t('comparison.col_be'), comparison.be)
    }
  }
  section(t('report.definitions'))
  for (const note of report.notes) paragraph(note, 9)
  section(t('report.sources'))
  for (const source of report.references) { paragraph(source.label, 9, true); paragraph(source.url, 8) }
  const linkHeight = wrapRoiPdfText(report.url, contentWidth, value => regular.widthOfTextAtSize(value, 8)).length * 12 + 5
  section(t('report.restore_link'), linkHeight); paragraph(report.url, 8)
  const pages = document.getPages()
  pages.forEach((item, index) => {
    item.drawText(roiPdfText(t('report.page', { page: index + 1, count: pages.length })), { x: margin, y: 40, size: 8, font: regular, color: dim })
    item.drawText('ilovedrrealty.com', { x: pageWidth - margin - regular.widthOfTextAtSize('ilovedrrealty.com', 8), y: 40, size: 8, font: regular, color: dim })
  })
  return document.save({ useObjectStreams: false })
}

export async function downloadRoiPdf(state: RoiState, t: RoiTranslate): Promise<void> {
  const bytes = await createRoiPdf(state, t)
  const blob = new Blob([new Uint8Array(bytes).buffer], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob), anchor = document.createElement('a')
  try {
    anchor.href = url; anchor.download = `ilovedr-roi-${state.scenario}-${state.locale}.pdf`
    document.body.appendChild(anchor); anchor.click()
  } finally {
    anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}
