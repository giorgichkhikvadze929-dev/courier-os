'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { generateTrackingNumber } from '@/lib/tracking'
import { parseRows, type CanonicalRow } from '@/lib/import'
import { audit } from '@/lib/audit'

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
}

export async function commitImport(
  rowsJson: string,
  options: { skipDuplicates: boolean; companyId?: string },
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
        },
      })
      await prisma.deliveryHistory.create({
        data: { deliveryId: created.id, status: 'IN_WAREHOUSE', note: 'Imported directly by admin', actorId },
      })
      out.created++
      existingKeys.add(key)
    } catch (err) {
      out.failed++
      out.errors.push({ rowNumber: row.rowNumber, reason: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  await audit({
    actorId, action: 'IMPORT', entity: 'Delivery',
    note: `Imported ${out.created} · skipped ${out.skipped} · failed ${out.failed} · dup ${out.duplicatesInDb}`,
  })

  revalidatePath('/admin/deliveries')
  revalidatePath('/admin')
  revalidatePath('/admin/assign')
  return out
}
