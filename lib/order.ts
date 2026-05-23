import prisma from './prisma'

/**
 * Allocate the next ORD-YYYY-NNNN sequential id. Per-year sequence so the
 * numbers stay short and human-readable.
 */
export async function nextOrderNumber(): Promise<string> {
  const year = new Date().getUTCFullYear()
  const prefix = `ORD-${year}-`
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
 * Create an Order representing one import batch. Returns the new order id so
 * the caller can stamp `orderId` on each Delivery row it inserts.
 *
 * `parcelCount` and `totalValue` are stored at creation time (snapshot of the
 * batch). They never get out of sync because Deliveries can't be added to an
 * existing Order — every commit makes a new one.
 */
export async function createOrderForBatch(args: {
  companyId: string
  importBatchId?: string | null
  parcelCount: number
  totalValue: number
  notes?: string | null
}): Promise<{ id: string; orderNumber: string }> {
  const orderNumber = await nextOrderNumber()
  const order = await prisma.order.create({
    data: {
      orderNumber,
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
