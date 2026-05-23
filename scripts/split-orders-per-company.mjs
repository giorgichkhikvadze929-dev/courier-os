#!/usr/bin/env node
/**
 * Reverse the umbrella-order collapse: split the one IMP-2026-1513 order
 * back into one IMPORT order per (file × company). Each company will now
 * see exactly their own parcels grouped under their own order at
 * /company/orders.
 *
 * Strategy:
 *   1. Find the umbrella order.
 *   2. groupBy delivery.companyId for that order's deliveries.
 *   3. Create one new IMPORT order per company with the same file label.
 *   4. updateMany to repoint deliveries to their company's new order.
 *   5. Delete the now-empty umbrella.
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const YEAR = new Date().getUTCFullYear()

async function nextSeq(prefix) {
  const latest = await prisma.order.findFirst({
    where:   { orderNumber: { startsWith: prefix } },
    orderBy: { orderNumber: 'desc' },
    select:  { orderNumber: true },
  })
  let n = latest ? parseInt(latest.orderNumber.slice(prefix.length), 10) : 0
  return () => String(++n).padStart(4, '0')
}

async function main() {
  const umbrella = await prisma.order.findFirst({
    where:  { notes: { contains: 'Source file: 2.05' } },
    select: { id: true, orderNumber: true, notes: true, parcelCount: true, totalValue: true },
  })
  if (!umbrella) {
    console.log('No umbrella order found — already split or never created.')
    await prisma.$disconnect()
    return
  }
  console.log(`Umbrella: ${umbrella.orderNumber} → ${umbrella.parcelCount} parcels, ${umbrella.totalValue.toFixed(2)} ₾`)

  const groups = await prisma.delivery.groupBy({
    by:     ['companyId'],
    where:  { orderId: umbrella.id, companyId: { not: null } },
    _count: { _all: true },
    _sum:   { codAmount: true },
  })
  console.log(`Companies with parcels under this order: ${groups.length}`)

  const prefix = `IMP-${YEAR}-`
  const seq = await nextSeq(prefix)

  let made = 0
  for (const g of groups) {
    if (!g.companyId) continue
    const order = await prisma.order.create({
      data: {
        orderNumber: `${prefix}${seq()}`,
        type:        'IMPORT',
        companyId:   g.companyId,
        parcelCount: g._count._all,
        totalValue:  g._sum.codAmount ?? 0,
        notes:       umbrella.notes,  // same "Source file: ..." label
      },
      select: { id: true },
    })
    await prisma.delivery.updateMany({
      where: { orderId: umbrella.id, companyId: g.companyId },
      data:  { orderId: order.id },
    })
    made++
    if (made % 25 === 0) console.log(`  ${made}/${groups.length}`)
  }
  console.log(`Per-company orders created: ${made}`)

  // Sanity: any deliveries still tied to the umbrella?
  const remaining = await prisma.delivery.count({ where: { orderId: umbrella.id } })
  console.log(`Deliveries still on umbrella: ${remaining}`)
  if (remaining === 0) {
    await prisma.order.delete({ where: { id: umbrella.id } })
    console.log('Umbrella deleted.')
  } else {
    console.log('⚠️  Umbrella kept — some deliveries had no companyId.')
  }

  const finalCount = await prisma.order.count({ where: { type: 'IMPORT' } })
  console.log(`Final IMPORT order count: ${finalCount}`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('FAILED:', e)
  await prisma.$disconnect()
  process.exit(1)
})
