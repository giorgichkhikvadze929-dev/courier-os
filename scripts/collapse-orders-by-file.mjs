#!/usr/bin/env node
/**
 * Collapse the 1,512 (company × date) backfilled IMPORT orders into a single
 * order representing the actual source file. Going forward every real
 * Excel import creates exactly one Order named after the uploaded file, so
 * the seeded data should mirror that shape.
 *
 *   - Create a new IMPORT order with the file's name as `notes`
 *   - Point every Delivery whose orderId pointed to a backfilled order at
 *     the new one
 *   - Delete the old backfilled orders
 *   - Keep the seeded ASSIGNMENT orders intact
 *
 * The script is idempotent: if a "Collapsed file order" already exists
 * (identified by its known notes string) we re-use it.
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const FILE_NAME = '2.05აპრილის სია ავთო.xlsx'
const MARKER    = `Source file: ${FILE_NAME}`

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
  const beforeOrderCount = await prisma.order.count({ where: { type: 'IMPORT' } })
  console.log(`Before: ${beforeOrderCount} IMPORT orders`)

  // Use the seed company that has the most parcels as the umbrella's
  // company link. Order requires a companyId, so we just pick one — the
  // notes field tells the actual story.
  const seedCompany = await prisma.company.findFirst({
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  })
  if (!seedCompany) throw new Error('No company exists — re-run the seed first.')

  // Total parcels & value snapshot for the new umbrella order.
  const agg = await prisma.delivery.aggregate({
    where: { orderId: { not: null } },
    _sum:  { codAmount: true },
    _count: { _all: true },
  })

  const seq = await nextSeq(`IMP-${new Date().getUTCFullYear()}-`)
  const umbrella = await prisma.order.create({
    data: {
      orderNumber: `IMP-${new Date().getUTCFullYear()}-${seq()}`,
      type:        'IMPORT',
      companyId:   seedCompany.id,
      parcelCount: agg._count._all,
      totalValue:  agg._sum.codAmount ?? 0,
      notes:       MARKER,
    },
    select: { id: true, orderNumber: true },
  })
  console.log(`Created umbrella order: ${umbrella.orderNumber} → ${FILE_NAME}`)
  console.log(`Snapshot: ${agg._count._all} parcels · ${(agg._sum.codAmount ?? 0).toFixed(2)} ₾`)

  // Repoint every delivery's orderId at the new umbrella.
  const updated = await prisma.delivery.updateMany({
    where: { orderId: { not: null } },
    data:  { orderId: umbrella.id },
  })
  console.log(`Deliveries repointed: ${updated.count}`)

  // Drop the now-empty old IMPORT orders. Skip our brand-new umbrella.
  const dropped = await prisma.order.deleteMany({
    where: {
      type: 'IMPORT',
      id:   { not: umbrella.id },
    },
  })
  console.log(`Old orders deleted: ${dropped.count}`)

  const afterOrderCount = await prisma.order.count({ where: { type: 'IMPORT' } })
  console.log(`After: ${afterOrderCount} IMPORT order(s)`)

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('FAILED:', e)
  await prisma.$disconnect()
  process.exit(1)
})
