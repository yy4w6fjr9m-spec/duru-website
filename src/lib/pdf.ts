import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, type RGB } from 'pdf-lib'
import QRCode from 'qrcode'
import type { Card } from '../types'
import { cardUrl, type QrMode } from './playUrl'

const MM = 72 / 25.4
const PAGE_W = 210 * MM // A4
const PAGE_H = 297 * MM
const CARD = 65 * MM
const COLS = 3
const ROWS = 4
const PER_PAGE = COLS * ROWS
const MARGIN_X = (PAGE_W - COLS * CARD) / 2
const MARGIN_Y = (PAGE_H - ROWS * CARD) / 2

const BACK_COLORS: RGB[] = [
  rgb(0.85, 0.16, 0.35), // pink-red
  rgb(0.13, 0.4, 0.8), // blue
  rgb(0.48, 0.2, 0.75), // purple
  rgb(0.05, 0.55, 0.45), // teal
  rgb(0.9, 0.42, 0.08), // orange
  rgb(0.12, 0.2, 0.35), // navy
]

/**
 * Builds an A4 PDF: one page of fronts (QR codes) followed by one page of backs
 * (year, artist, title), repeated. Backs are mirrored so they line up when
 * printed double-sided, flipping on the long edge.
 */
export async function generateDeckPdf(cards: Card[], baseUrl: string, mode: QrMode): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle('Hitster cards')
  const fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    italic: await pdf.embedFont(StandardFonts.HelveticaOblique),
  }

  for (let start = 0; start < cards.length; start += PER_PAGE) {
    const batch = cards.slice(start, start + PER_PAGE)
    const front = pdf.addPage([PAGE_W, PAGE_H])
    const back = pdf.addPage([PAGE_W, PAGE_H])

    batch.forEach((card, i) => {
      const col = i % COLS
      const row = Math.floor(i / COLS)
      const y = PAGE_H - MARGIN_Y - (row + 1) * CARD
      drawFront(front, MARGIN_X + col * CARD, y, cardUrl(baseUrl, card, mode))
      const mirroredX = MARGIN_X + (COLS - 1 - col) * CARD
      drawBack(back, mirroredX, y, card, BACK_COLORS[(start + i) % BACK_COLORS.length], fonts)
    })
    drawCutMarks(front)
  }

  return pdf.save()
}

function drawFront(page: PDFPage, x: number, y: number, url: string) {
  page.drawRectangle({ x, y, width: CARD, height: CARD, color: rgb(1, 1, 1) })

  const qr = QRCode.create(url, { errorCorrectionLevel: 'M' })
  const size = qr.modules.size
  const qrSize = CARD * 0.7
  const cell = qrSize / size
  const qx = x + (CARD - qrSize) / 2
  const qy = y + (CARD - qrSize) / 2
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (qr.modules.get(r, c)) {
        // Slight overlap avoids hairline gaps between cells in some viewers.
        page.drawRectangle({
          x: qx + c * cell,
          y: qy + (size - 1 - r) * cell,
          width: cell + 0.05,
          height: cell + 0.05,
          color: rgb(0, 0, 0),
        })
      }
    }
  }
}

function drawBack(
  page: PDFPage,
  x: number,
  y: number,
  card: Card,
  color: RGB,
  fonts: { regular: PDFFont; bold: PDFFont; italic: PDFFont },
) {
  // Bleed the colour 1mm past the card so small duplex misalignment stays invisible.
  const bleed = 1 * MM
  page.drawRectangle({ x: x - bleed, y: y - bleed, width: CARD + 2 * bleed, height: CARD + 2 * bleed, color })
  const white = rgb(1, 1, 1)
  const pad = 5 * MM
  const maxW = CARD - 2 * pad

  const artistLines = wrap(safeText(fonts.bold, card.artist), fonts.bold, 12, maxW, 2)
  artistLines.forEach((line, i) => {
    const w = fonts.bold.widthOfTextAtSize(line, 12)
    page.drawText(line, { x: x + (CARD - w) / 2, y: y + CARD - pad - 12 - i * 14, size: 12, font: fonts.bold, color: white })
  })

  const year = String(card.year)
  const yearSize = 48
  const yw = fonts.bold.widthOfTextAtSize(year, yearSize)
  page.drawText(year, { x: x + (CARD - yw) / 2, y: y + CARD / 2 - yearSize * 0.35, size: yearSize, font: fonts.bold, color: white })

  const titleLines = wrap(safeText(fonts.italic, card.title), fonts.italic, 11, maxW, 3)
  titleLines.forEach((line, i) => {
    const w = fonts.italic.widthOfTextAtSize(line, 11)
    const fromBottom = titleLines.length - 1 - i
    page.drawText(line, { x: x + (CARD - w) / 2, y: y + pad + fromBottom * 13, size: 11, font: fonts.italic, color: white })
  })
}

/** Light grey lines along every card edge, extended into the margin, for cutting. */
function drawCutMarks(page: PDFPage) {
  const color = rgb(0.75, 0.75, 0.75)
  for (let c = 0; c <= COLS; c++) {
    const x = MARGIN_X + c * CARD
    page.drawLine({ start: { x, y: MARGIN_Y - 5 * MM }, end: { x, y: PAGE_H - MARGIN_Y + 5 * MM }, thickness: 0.3, color })
  }
  for (let r = 0; r <= ROWS; r++) {
    const y = MARGIN_Y + r * CARD
    page.drawLine({ start: { x: MARGIN_X - 5 * MM, y }, end: { x: PAGE_W - MARGIN_X + 5 * MM, y }, thickness: 0.3, color })
  }
}

/** The standard PDF fonts only cover Western European characters; replace the rest. */
function safeText(font: PDFFont, text: string): string {
  const supported = new Set(font.getCharacterSet())
  return Array.from(text)
    .map((ch) => (supported.has(ch.codePointAt(0)!) ? ch : '?'))
    .join('')
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number, maxLines: number): string[] {
  const lines: string[] = []
  let current = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !current) {
      current = candidate
    } else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)

  if (lines.length > maxLines) {
    lines.length = maxLines
    lines[maxLines - 1] += '…'
  }
  // Truncate any single line that is still too wide (e.g. one very long word).
  return lines.map((line) => {
    while (font.widthOfTextAtSize(line, size) > maxWidth && line.length > 1) line = line.slice(0, -2) + '…'
    return line
  })
}
