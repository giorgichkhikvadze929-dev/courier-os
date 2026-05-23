'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { generateTrackingNumber } from '@/lib/tracking'
import { parseRows, type CanonicalRow } from '@/lib/import'
import { audit } from '@/lib/audit'
import { createOrderForBatch } from '@/lib/order'

async function requireAdmin() {
  const session = await auth()
  if (!session) redirect('/login')
  const role = session.user?.role as string
  if (role !== 'ADMIN') redirect('/login')
  return session
}

export type ImportOutcome = {
  created: number
  skipped: number
  failed: number
  duplicatesInDb: number
  errors: { rowNumber: number; reason: string }[]
  // If this commit created (or extended) an Order, the id is returned so the
  // client can pass it back on the next chunk — keeps the whole file as ONE
  // order rather than one-per-chunk.
  orderId?: string | null
}

export async function commitImport(
  rowsJson: string,
  options: { skipDuplicates: boolean; companyId?: string; filename?: string; orderId?: string },
): Promise<ImportOutcome> {
  const session = await requireAdmin()
  const actorId = (session.user as { id?: string }).id ?? null

  const rawRows = JSON.parse(rowsJson) as Record<string, unknown>[]
  const parsed = parseRows(rawRows)

  const out: ImportOutcome = {
    created: 0, skipped: 0, failed: 0, duplicatesInDb: 0, errors: [],
  }

  const existing = options.skipDuplicates
    ? await prisma.delivery.findMany({
        where: { status: { in: ['RECEIVED', 'IN_WAREHOUSE', 'ASSIGNED', 'IN_TRANSIT'] } },
        select: { customerPhone: true, dropoffAddress: true },
      })
    : []
  const existingKeys = new Set(
    existing.map((d) => `${d.customerPhone}::${d.dropoffAddress.toLowerCase()}`)
  )

  // One Order per file across chunks: the first chunk creates the order, the
  // client passes its id back on subsequent chunks via options.orderId.
  let orderId: string | null = options.orderId ?? null
  let orderNumber: string | null = null
  if (!orderId && options.companyId) {
    const created = await createOrderForBatch({
      companyId:   options.companyId,
      parcelCount: 0,    // updated after we know how many committed
      totalValue:  0,
      // Stash the filename in notes so the Orders list can show it as the
      // row label — same shape as the company import already uses.
      notes:       options.filename
        ? `Source file: ${options.filename}`
        : 'Imported by admin',
    })
    orderId = created.id
    orderNumber = created.orderNumber
  }

  let totalValue = 0

  for (const row of parsed.rows) {
    if (row.errors.length > 0) {
      out.failed++
      out.errors.push({ rowNumber: row.rowNumber, reason: row.errors.join('; ') })
      continue
    }

    const d = row.data as Required<Pick<CanonicalRow, 'customerName' | 'customerPhone' | 'dropoffAddress'>> & CanonicalRow
    const key = `${d.customerPhone}::${d.dropoffAddress.toLowerCase()}`
    if (options.skipDuplicates && existingKeys.has(key)) {
      out.duplicatesInDb++
      out.skipped++
      continue
    }

    try {
      // Admin imports skip the verify queue — admins import when they're
      // physically at the warehouse with the parcels in front of them, so
      // there's no separate verification step to perform. Company imports go
      // through /company/import which uses RECEIVED status + admin verifies.
      const created = await prisma.delivery.create({
        data: {
          trackingNumber: generateTrackingNumber(),
          status:         'IN_WAREHOUSE',
          verifiedAt:     new Date(),
          verifiedNote:   'Imported directly by admin',
          priority:       d.priority ?? 'NORMAL',
          customerName:   d.customerName,
          customerPhone:  d.customerPhone,
          customerEmail:  d.customerEmail ?? null,
          dropoffAddress: d.dropoffAddress,
          zone:           d.zone ?? null,
          city:           d.city ?? null,
          postalCode:     d.postalCode ?? null,
          packageType:    d.packageType ?? null,
          weightKg:       d.weightKg ?? null,
          sizeCm:         d.sizeCm ?? null,
          codAmount:      d.codAmount ?? null,
          notes:          d.notes ?? null,
          companyId:      options.companyId ?? null,
          orderId:        orderId,
        },
      })
      await prisma.deliveryHistory.create({
        data: { deliveryId: created.id, status: 'IN_WAREHOUSE', note: 'Imported directly by admin', actorId },
      })
      out.created++
      totalValue += d.codAmount ?? 0
      existingKeys.add(key)
    } catch (err) {
      out.failed++
      out.errors.push({ rowNumber: row.rowNumber, reason: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  // Update the Order with the running totals. We add (not set) because the
  // client may call commitImport multiple times for one file (chunking) — the
  // order must reflect the cumulative count + value across all chunks. The
  // empty-chunk case is only meaningful for the FIRST chunk (no orderId came
  // in); a later empty chunk is a no-op and the order stays.
  if (orderId && out.created > 0) {
    await prisma.order.update({
      where: { id: orderId },
      data:  {
        parcelCount: { increment: out.created },
        totalValue:  { increment: totalValue },
      },
    })
  } else if (orderId && out.created === 0 && !options.orderId) {
    // First chunk created the order but committed nothing — drop it.
    await prisma.order.delete({ where: { id: orderId } })
    orderId = null
  }

  await audit({
    actorId, action: 'IMPORT', entity: 'Delivery',
    note: `Imported ${out.created} · skipped ${out.skipped} · failed ${out.failed} · dup ${out.duplicatesInDb}${orderNumber ? ' · order ' + orderNumber : ''}`,
  })

  revalidatePath('/admin/deliveries')
  revalidatePath('/admin')
  revalidatePath('/admin/assign')
  revalidatePath('/admin/orders')
  return { ...out, orderId }
}
