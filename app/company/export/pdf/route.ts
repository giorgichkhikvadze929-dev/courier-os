import { NextResponse, type NextRequest } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { ZONE_LABEL } from '@/app/components/StatusBadge'
import { buildParcelWhere, parcelFiltersFromUrl } from '@/lib/parcel-filters'

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session) return new NextResponse('Unauthorized', { status: 401 })
  const role = session.user?.role as string
  if (!['COMPANY', 'ADMIN'].includes(role)) return new NextResponse('Forbidden', { status: 403 })

  const companyId = (session.user as { companyId?: string | null }).companyId
  if (!companyId && role !== 'ADMIN') {
    return new NextResponse('No company linked', { status: 400 })
  }

  const filters = parcelFiltersFromUrl(new URL(request.url))
  const [company, deliveries] = await Promise.all([
    companyId ? prisma.company.findUnique({ where: { id: companyId }, select: { name: true } }) : null,
    prisma.delivery.findMany({
      where: buildParcelWhere(companyId, filters),
      orderBy: { createdAt: 'desc' },
      take: 1000,
      include: { courier: { select: { name: true } } },
    }),
  ])

  const pdf = await PDFDocument.create()
  const fontReg  = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const PAGE_WIDTH = 842   // A4 landscape
  const PAGE_HEIGHT = 595
  const margin = 28
  const black = rgb(0, 0, 0)
  const grey = rgb(0.4, 0.4, 0.4)
  const headerBg = rgb(0.9, 0.91, 0.93)
  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let cursorY = PAGE_HEIGHT - margin

  // Title
  page.drawText('Parcel Report', { x: margin, y: cursorY - 14, font: fontBold, size: 16, color: black })
  page.drawText(new Date().toLocaleDateString(), { x: PAGE_WIDTH - margin - 80, y: cursorY - 14, font: fontReg, size: 10, color: grey })
  cursorY -= 24
  if (company) {
    page.drawText(`Company: ${company.name}`, { x: margin, y: cursorY - 12, font: fontReg, size: 11, color: grey })
    cursorY -= 18
  }
  page.drawText(`${deliveries.length} parcel(s)`, { x: margin, y: cursorY - 10, font: fontReg, size: 9, color: grey })
  cursorY -= 18

  // Table columns
  const cols = [
    { label: 'Tracking',   width: 95 },
    { label: 'Customer',   width: 110 },
    { label: 'Phone',      width: 85 },
    { label: 'Status',     width: 70 },
    { label: 'Zone',       width: 55 },
    { label: 'Courier',    width: 80 },
    { label: 'COD',        width: 45 },
    { label: 'Created',    width: 65 },
    { label: 'Dropoff',    width: 175 },
  ]
  const rowH = 16

  function drawHeader() {
    page.drawRectangle({ x: margin, y: cursorY - rowH, width: PAGE_WIDTH - 2 * margin, height: rowH, color: headerBg })
    let x = margin + 4
    for (const c of cols) {
      page.drawText(c.label, { x, y: cursorY - rowH + 4, font: fontBold, size: 8, color: black })
      x += c.width
    }
    cursorY -= rowH
  }

  function trim(s: string, max: number): string {
    if (s.length <= max) return s
    return s.slice(0, Math.max(0, max - 1)) + '…'
  }

  function drawRow(values: string[]) {
    if (cursorY - rowH < margin + 20) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      cursorY = PAGE_HEIGHT - margin
      drawHeader()
    }
    let x = margin + 4
    for (let i = 0; i < cols.length; i++) {
      const col = cols[i]
      const max = Math.floor(col.width / 4.5) // rough char fit
      const text = trim(values[i] ?? '', max)
      page.drawText(text, { x, y: cursorY - rowH + 4, font: fontReg, size: 8, color: black })
      x += col.width
    }
    cursorY -= rowH
  }

  drawHeader()
  for (const d of deliveries) {
    drawRow([
      d.trackingNumber,
      d.customerName,
      d.customerPhone,
      d.status.replace(/_/g, ' '),
      d.zone ? (ZONE_LABEL[d.zone] ?? d.zone) : '-',
      d.courier?.name ?? '-',
      d.codAmount != null ? d.codAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' GEL' : '',
      new Date(d.createdAt).toLocaleDateString(),
      d.dropoffAddress,
    ])
  }

  const bytes = await pdf.save()
  const today = new Date().toISOString().slice(0, 10)
  return new NextResponse(Buffer.from(bytes) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="parcels-${today}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
