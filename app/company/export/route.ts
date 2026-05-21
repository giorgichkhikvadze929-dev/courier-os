import { NextResponse, type NextRequest } from 'next/server'
import * as XLSX from 'xlsx'
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
    return new NextResponse('No company linked to this account', { status: 400 })
  }

  const filters = parcelFiltersFromUrl(new URL(request.url))
  const deliveries = await prisma.delivery.findMany({
    where: buildParcelWhere(companyId, filters),
    orderBy: { createdAt: 'desc' },
    include: { courier: { select: { name: true } } },
  })

  const rows = deliveries.map((d) => ({
    'Tracking #':       d.trackingNumber,
    'Status':           d.status,
    'Priority':         d.priority,
    'Customer Name':    d.customerName,
    'Customer Phone':   d.customerPhone,
    'Customer Email':   d.customerEmail ?? '',
    'Dropoff Address':  d.dropoffAddress,
    'Zone':             d.zone ? (ZONE_LABEL[d.zone] ?? d.zone) : '',
    'Package Type':     d.packageType ?? '',
    'COD Amount':       d.codAmount ?? '',
    'Notes':            d.notes ?? '',
    'Courier':          d.courier?.name ?? '',
    'Problem Flag':     d.problemFlag ?? '',
    'Courier Comment':  d.courierComment ?? '',
    'Picked Up At':     d.pickedUpAt ? new Date(d.pickedUpAt).toISOString() : '',
    'Delivered At':     d.deliveredAt ? new Date(d.deliveredAt).toISOString() : '',
    'Failed At':        d.failedAt    ? new Date(d.failedAt).toISOString()    : '',
    'Refused At':       d.refusedAt   ? new Date(d.refusedAt).toISOString()   : '',
    'Returned At':      d.returnedAt  ? new Date(d.returnedAt).toISOString()  : '',
    'Created At':       new Date(d.createdAt).toISOString(),
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Parcels')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

  const today = new Date().toISOString().slice(0, 10)
  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="parcels-${today}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  })
}
