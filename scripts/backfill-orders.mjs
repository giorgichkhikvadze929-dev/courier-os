#!/usr/bin/env node
/**
 * Backfill orders for parcels seeded before the Order model existed.
 *
 *  IMPORT     : group by (companyId, dateNote) → one IMPORT order each.
 *               `dateNote` is whatever the importer wrote into Delivery.notes
 *               (the original "1აპრილი" / "30აპრილი" string from the file).
 *  ASSIGNMENT : group by (courierId) for parcels already in ASSIGNED status.
 *               Today's bulk seed treats all 211 of them as one bundle per
 *               courier (the file represents a single day's assignment).
 *
 *  Idempotent: skips parcels that already have orderId / assignmentOrderId set.
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const YEAR = new Date().getUTCFullYear()

async function nextSeq(prefix) {
  const latest = await prisma.order.findFirst({
    where: { orderNumber: { startsWith: prefix } },
    orderBy: { orderNumber: 'desc' },
    select: { orderNumber: true },
  })
  let n = latest ? parseInt(latest.orderNumber.slice(prefix.length), 10) : 0
  return () => String(++n).padStart(4, '0')
}

async function backfillImportOrders() {
  console.log('— IMPORT backfill —')
  // Pull every parcel that has a company but no orderId yet. The notes column
  // carries the original date string from the Excel file (e.g. "30აპრილი").
  const rows = await prisma.delivery.findMany({
    where:  { orderId: null, companyId: { not: null } },
    select: { id: true, companyId: true, notes: true, codAmount: true },
  })
  console.log(`Unattached parcels: ${rows.length}`)
  if (rows.length === 0) return

  // Group by company + date-note.
  const groups = new Map()
  for (const r of rows) {
    const key = `${r.companyId}::${r.notes ?? ''}`
    if (!groups.has(key)) groups.set(key, { companyId: r.companyId, note: r.notes, ids: [], value: 0 })
    const g = groups.get(key)
    g.ids.push(r.id)
    g.value += r.codAmount ?? 0
  }
  console.log(`Groups (company × date): ${groups.size}`)

  const prefix = `IMP-${YEAR}-`
  const seq = await nextSeq(prefix)

  let made = 0
  for (const g of groups.values()) {
    const order = await prisma.order.create({
      data: {
        orderNumber: `${prefix}${seq()}`,
        type:        'IMPORT',
        companyId:   g.companyId,
        parcelCount: g.ids.length,
        totalValue:  g.value,
        notes:       g.note ? `Backfilled — ${g.note}` : 'Backfilled',
      },
      select: { id: true },
    })
    // Chunk the update so PostgreSQL doesn't choke on a giant IN list.
    const CHUNK = 1000
    for (let i = 0; i < g.ids.length; i += CHUNK) {
      await prisma.delivery.updateMany({
        where: { id: { in: g.ids.slice(i, i + CHUNK) } },
        data:  { orderId: order.id },
      })
    }
    made++
    if (made % 50 === 0) console.log(`  ${made} / ${groups.size}`)
  }
  console.log(`IMPORT orders created: ${made}`)
}

async function backfillAssignmentOrders() {
  console.log('— ASSIGNMENT backfill —')
  const rows = await prisma.delivery.findMany({
    where:  { assignmentOrderId: null, courierId: { not: null }, status: 'ASSIGNED' },
    select: { id: true, courierId: true, codAmount: true },
  })
  console.log(`Unattached assigned parcels: ${rows.length}`)
  if (rows.length === 0) return

  const groups = new Map()
  for (const r of rows) {
    if (!groups.has(r.courierId)) groups.set(r.courierId, { courierId: r.courierId, ids: [], value: 0 })
    const g = groups.get(r.courierId)
    g.ids.push(r.id)
    g.value += r.codAmount ?? 0
  }

  const prefix = `ASN-${YEAR}-`
  const seq = await nextSeq(prefix)

  let made = 0
  for (const g of groups.values()) {
    const order = await prisma.order.create({
      data: {
        orderNumber: `${prefix}${seq()}`,
        type:        'ASSIGNMENT',
        courierId:   g.courierId,
        parcelCount: g.ids.length,
        totalValue:  g.value,
        notes:       'Backfilled from April assignment',
      },
      select: { id: true },
    })
    await prisma.delivery.updateMany({
      where: { id: { in: g.ids } },
      data:  { assignmentOrderId: order.id },
    })
    made++
  }
  console.log(`ASSIGNMENT orders created: ${made}`)
}

async function main() {
  await backfillImportOrders()
  await backfillAssignmentOrders()
  const totals = {
    imports:     await prisma.order.count({ where: { type: 'IMPORT' } }),
    assignments: await prisma.order.count({ where: { type: 'ASSIGNMENT' } }),
    unattachedImport:     await prisma.delivery.count({ where: { orderId: null, companyId: { not: null } } }),
    unattachedAssigned:   await prisma.delivery.count({ where: { assignmentOrderId: null, courierId: { not: null }, status: 'ASSIGNED' } }),
  }
  console.log(JSON.stringify(totals, null, 2))
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('FAILED:', e)
  await prisma.$disconnect()
  process.exit(1)
})
