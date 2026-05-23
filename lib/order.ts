import prisma from './prisma'

/**
 * Two flavours of Order live in the same table, distinguished by `type`:
 *   - IMPORT     — an Excel batch upload (one company, N parcels).
 *                  Numbered IMP-YYYY-NNNN.
 *   - ASSIGNMENT — a bundle of parcels given to a courier in one go.
 *                  Numbered ASN-YYYY-NNNN.
 */
type OrderType = 'IMPORT' | 'ASSIGNMENT'

const PREFIX: Record<OrderType, string> = {
  IMPORT:     'IMP',
  ASSIGNMENT: 'ASN',
}

/** Allocate the next sequential id for the given type. Per-year, per-type. */
export async function nextOrderNumber(type: OrderType): Promise<string> {
  const year = new Date().getUTCFullYear()
  const prefix = `${PREFIX[type]}-${year}-`
  const latest = await prisma.order.findFirst({
    where: { orderNumber: { startsWith: prefix } },
    orderBy: { orderNumber: 'desc' },
    select: { orderNumber: true },
  })
  const lastSeq = latest?.orderNumber?.slice(prefix.length) ?? '0000'
  const next = String(parseInt(lastSeq, 10) + 1).padStart(4, '0')
  return `${prefix}${next}`
}

/**
 * Create an IMPORT order representing one Excel batch. Returns the new order
 * id so the caller can stamp `orderId` on each Delivery row it inserts.
 */
export async function createOrderForBatch(args: {
  companyId: string
  importBatchId?: string | null
  parcelCount: number
  totalValue: number
  notes?: string | null
}): Promise<{ id: string; orderNumber: string }> {
  const orderNumber = await nextOrderNumber('IMPORT')
  const order = await prisma.order.create({
    data: {
      orderNumber,
      type:          'IMPORT',
      companyId:     args.companyId,
      importBatchId: args.importBatchId ?? null,
      parcelCount:   args.parcelCount,
      totalValue:    args.totalValue,
      notes:         args.notes ?? null,
    },
    select: { id: true, orderNumber: true },
  })
  return order
}

/**
 * Create an ASSIGNMENT order grouping a batch of parcels handed to one
 * courier in a single action. Stamps `assignmentOrderId` on each delivery
 * and snapshots parcelCount + totalValue from the affected rows.
 */
export async function createAssignmentOrder(args: {
  courierId: string
  deliveryIds: string[]
  notes?: string | null
}): Promise<{ id: string; orderNumber: string; count: number } | null> {
  if (args.deliveryIds.length === 0) return null

  // Snapshot values from the parcels we're about to bundle.
  const agg = await prisma.delivery.aggregate({
    where: { id: { in: args.deliveryIds } },
    _sum:  { codAmount: true },
    _count: { _all: true },
  })

  const orderNumber = await nextOrderNumber('ASSIGNMENT')
  const order = await prisma.order.create({
    data: {
      orderNumber,
      type:        'ASSIGNMENT',
      courierId:   args.courierId,
      parcelCount: agg._count._all,
      totalValue:  agg._sum.codAmount ?? 0,
      notes:       args.notes ?? null,
    },
    select: { id: true, orderNumber: true },
  })

  await prisma.delivery.updateMany({
    where: { id: { in: args.deliveryIds } },
    data:  { assignmentOrderId: order.id },
  })

  return { id: order.id, orderNumber: order.orderNumber, count: agg._count._all }
}
