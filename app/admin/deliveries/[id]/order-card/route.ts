import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { ZONE_LABEL } from '@/app/components/StatusBadge'

/**
 * Single-parcel "Order Card" — print-friendly HTML document that travels with
 * the physical parcel. Acts as order/invoice/receipt in one. Use the browser's
 * Print dialog to print on a label printer or save as PDF.
 *
 * Returned as a raw HTML Response (not a Next page) so the document has its own
 * <html>/<body> and isn't wrapped in the app shell.
 */
function escape(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return new NextResponse('Unauthorized', { status: 401 })
  const role = session.user?.role as string
  if (!['ADMIN', 'COMPANY'].includes(role)) return new NextResponse('Forbidden', { status: 403 })

  const { id } = await params
  const d = await prisma.delivery.findUnique({
    where: { id },
    include: {
      company:       { select: { name: true, address: true, phone: true } },
      courier:       { select: { name: true, phone: true } },
      pickupCourier: { select: { name: true, phone: true } },
    },
  })
  if (!d) return new NextResponse('Not found', { status: 404 })
  if (role === 'COMPANY') {
    const companyId = (session.user as { companyId?: string | null }).companyId
    if (d.companyId !== companyId) return new NextResponse('Forbidden', { status: 403 })
  }

  const created = new Date(d.createdAt).toLocaleDateString('ka-GE')
  const codDisplay = d.codAmount != null
    ? d.codAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₾'
    : '0.00 ₾'
  const codBlock = (d.codAmount != null && d.codAmount > 0)
    ? `<hr><h2>გადახდა მიწოდებისას · Cash on Delivery</h2><div class="cod">${codDisplay}</div>`
    : ''
  const notesBlock = d.notes
    ? `<hr><h2>შენიშვნა / Notes</h2><div class="row">${escape(d.notes)}</div>`
    : ''
  const zoneLine = d.zone
    ? `<div class="muted">${escape(ZONE_LABEL[d.zone] ?? d.zone)}${d.city ? ' · ' + escape(d.city) : ''}${d.postalCode ? ' · ' + escape(d.postalCode) : ''}</div>`
    : ''
  const priorityBadge = (d.priority && d.priority !== 'NORMAL')
    ? `<div class="muted" style="color:#b91c1c;font-weight:700">${escape(d.priority)}</div>`
    : ''
  const courierFooter = (d.pickupCourier || d.courier)
    ? `<div class="footer">
        ${d.pickupCourier ? `<div>აღების კურიერი: ${escape(d.pickupCourier.name)}${d.pickupCourier.phone ? ' · ' + escape(d.pickupCourier.phone) : ''}</div>` : ''}
        ${d.courier       ? `<div>კურიერი: ${escape(d.courier.name)}${d.courier.phone ? ' · ' + escape(d.courier.phone) : ''}</div>` : ''}
      </div>` : ''

  const html = `<!DOCTYPE html>
<html lang="ka">
<head>
<meta charset="utf-8">
<title>Order ${escape(d.trackingNumber)}</title>
<style>
  @page { size: A6 portrait; margin: 8mm; }
  html, body { background: white; color: black; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; }
  .card { width: 100mm; min-height: 132mm; padding: 0; margin: 8mm auto; }
  h1 { font-size: 16pt; margin: 0 0 2pt; font-weight: 800; letter-spacing: 0.5pt; }
  h2 { font-size: 9pt; margin: 0 0 4pt; font-weight: 700; color: #666; text-transform: uppercase; letter-spacing: 0.5pt; }
  .tracking { font-family: ui-monospace, Menlo, monospace; font-size: 10pt; color: #555; margin-bottom: 4pt; }
  .name { font-size: 14pt; font-weight: 700; margin: 2pt 0; }
  .row { font-size: 10pt; margin: 1pt 0; }
  .muted { color: #555; font-size: 9pt; }
  .cod { font-size: 22pt; font-weight: 800; margin: 4pt 0; }
  hr { border: none; border-top: 1px solid #ccc; margin: 6pt 0; }
  .footer { font-size: 8pt; color: #777; margin-top: 8pt; }
  .print-btn { display: inline-block; padding: 8px 16px; background: #4f46e5; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 13px; border: none; cursor: pointer; }
  .toolbar { padding: 16px; background: #f5f5f5; }
  @media print {
    .toolbar { display: none !important; }
    body { background: white; }
    .card { margin: 0; }
  }
</style>
</head>
<body>
<div class="toolbar">
  <button type="button" class="print-btn" onclick="window.print()">Print / Save as PDF</button>
  <span style="margin-left:12px;font-size:12px;color:#666">Press <strong>Ctrl/Cmd + P</strong> to print this order card on a label printer or save as PDF.</span>
</div>
<div class="card">
  <h1>ORDER CARD · შეკვეთის ბარათი</h1>
  <div class="tracking">${escape(d.trackingNumber)}</div>
  <div class="muted">თარიღი / Date: ${escape(created)}</div>
  ${priorityBadge}
  <hr>
  <h2>გამგზავნი / Sender</h2>
  <div class="name">${escape(d.company?.name ?? '—')}</div>
  ${d.company?.phone   ? `<div class="row muted">${escape(d.company.phone)}</div>`   : ''}
  ${d.company?.address ? `<div class="row muted">${escape(d.company.address)}</div>` : ''}
  <hr>
  <h2>მიმღები / Recipient</h2>
  <div class="name">${escape(d.customerName)}</div>
  <div class="row">${escape(d.customerPhone)}</div>
  ${d.customerEmail ? `<div class="row muted">${escape(d.customerEmail)}</div>` : ''}
  <hr>
  <h2>მისამართი / Drop-off</h2>
  <div class="row">${escape(d.dropoffAddress)}</div>
  ${zoneLine}
  ${codBlock}
  ${notesBlock}
  ${courierFooter}
</div>
</body>
</html>`

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
