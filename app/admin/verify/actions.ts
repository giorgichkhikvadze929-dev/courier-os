'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { audit } from '@/lib/audit'
import { notify } from '@/lib/notifications'

async function requireAdmin() {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')
  return session
}

/**
 * Mark a RECEIVED delivery as physically present in the warehouse.
 * RECEIVED → IN_WAREHOUSE
 */
export async function verifyDelivery(deliveryId: string, formData: FormData): Promise<void> {
  const session = await requireAdmin()
  const actorId = (session.user as { id?: string }).id ?? null
  const note = (formData.get('note') as string | null)?.trim() || null

  const before = await prisma.delivery.findUnique({ where: { id: deliveryId }, select: { status: true } })
  if (!before || before.status !== 'RECEIVED') return

  await prisma.delivery.update({
    where: { id: deliveryId },
    data: {
      status: 'IN_WAREHOUSE',
      verifiedAt: new Date(),
      verifiedNote: note,
    },
  })
  await prisma.deliveryHistory.create({
    data: { deliveryId, status: 'IN_WAREHOUSE', note: note ?? 'Verified at warehouse', actorId },
  })
  await audit({ actorId, action: 'VERIFY', entity: 'Delivery', entityId: deliveryId, before: { status: 'RECEIVED' }, after: { status: 'IN_WAREHOUSE' }, note: note ?? undefined })

  revalidatePath('/admin/verify')
  revalidatePath('/admin/deliveries')
  revalidatePath(`/admin/deliveries/${deliveryId}`)
}

/**
 * Flag a discrepancy found during warehouse verification (PRD: შეუსაბამობების ფლაგირება).
 * Records a problemFlag + audit entry. Does NOT change status.
 */
export async function flagDiscrepancy(deliveryId: string, formData: FormData): Promise<void> {
  const session = await requireAdmin()
  const actorId = (session.user as { id?: string }).id ?? null
  const note = (formData.get('note') as string | null)?.trim() || null
  if (!note) return

  const before = await prisma.delivery.findUnique({ where: { id: deliveryId }, select: { problemFlag: true } })
  await prisma.delivery.update({
    where: { id: deliveryId },
    data: { problemFlag: `DISCREPANCY: ${note}` },
  })
  await prisma.deliveryHistory.create({
    data: { deliveryId, status: 'RECEIVED', note: `Discrepancy flagged: ${note}`, actorId },
  })
  await audit({
    actorId, action: 'UPDATE', entity: 'Delivery', entityId: deliveryId,
    before, after: { problemFlag: `DISCREPANCY: ${note}` },
    note: 'Warehouse discrepancy flagged',
  })

  revalidatePath('/admin/verify')
  revalidatePath(`/admin/deliveries/${deliveryId}`)
}

/**
 * Verify EVERY pending parcel in the system in one shot.
 *
 * Optimized for large queues:
 *   1. updateMany flips status RECEIVED → IN_WAREHOUSE in a single query.
 *   2. createMany batch-inserts the history rows.
 *   3. ONE audit entry summarizes the whole bulk action (instead of N entries).
 */
export async function verifyAllPending(): Promise<{ verified: number }> {
  const session = await requireAdmin()
  const actorId = (session.user as { id?: string }).id ?? null

  const pending = await prisma.delivery.findMany({
    where: { status: 'RECEIVED' },
    select: { id: true },
  })
  const ids = pending.map((p) => p.id)
  if (ids.length === 0) return { verified: 0 }

  // 1. Bulk status flip.
  const now = new Date()
  await prisma.delivery.updateMany({
    where: { id: { in: ids } },
    data: { status: 'IN_WAREHOUSE', verifiedAt: now },
  })

  // 2. Bulk history insert.
  await prisma.deliveryHistory.createMany({
    data: ids.map((id) => ({ deliveryId: id, status: 'IN_WAREHOUSE', note: 'Bulk verify-all', actorId })),
  })

  // 3. Single audit entry summarizing the whole bulk action.
  await audit({
    actorId,
    action: 'VERIFY',
    entity: 'Delivery',
    entityId: 'BULK',
    after: { status: 'IN_WAREHOUSE', count: ids.length },
    note: `Bulk verify-all — ${ids.length} parcels promoted RECEIVED → IN_WAREHOUSE`,
  })

  revalidatePath('/admin/verify')
  revalidatePath('/admin/deliveries')
  return { verified: ids.length }
}

export async function verifyMany(ids: string[]): Promise<{ verified: number; skipped: number }> {
  const session = await requireAdmin()
  const actorId = (session.user as { id?: string }).id ?? null
  let verified = 0
  let skipped = 0
  for (const id of ids) {
    try {
      const d = await prisma.delivery.findUnique({ where: { id }, select: { status: true } })
      if (!d || d.status !== 'RECEIVED') { skipped++; continue }
      await prisma.delivery.update({
        where: { id },
        data: { status: 'IN_WAREHOUSE', verifiedAt: new Date() },
      })
      await prisma.deliveryHistory.create({ data: { deliveryId: id, status: 'IN_WAREHOUSE', note: 'Bulk verified', actorId } })
      await audit({ actorId, action: 'VERIFY', entity: 'Delivery', entityId: id, after: { status: 'IN_WAREHOUSE' }, note: 'Bulk verify' })
      verified++
    } catch {
      skipped++
    }
  }
  revalidatePath('/admin/verify')
  revalidatePath('/admin/deliveries')
  return { verified, skipped }
}

/**
 * Deny a parcel at warehouse verification.
 * Per current product decision: denial = HARD DELETE the delivery from the DB.
 * The audit log captures a full snapshot of the deleted record (sender contact,
 * tracking number, reason) so it's recoverable for compliance even though the
 * Delivery row is gone.
 *
 * Reason is required. The sending company's users are still notified.
 */
export async function denyDelivery(deliveryId: string, formData: FormData): Promise<void> {
  const session = await requireAdmin()
  const actorId = (session.user as { id?: string }).id ?? null
  const reason = (formData.get('reason') as string | null)?.trim()
  if (!reason) return

  const before = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    select: {
      status: true, trackingNumber: true, companyId: true, problemFlag: true,
      customerName: true, customerPhone: true, customerEmail: true,
      dropoffAddress: true, zone: true, packageType: true,
      company: { select: { name: true, contact: true, phone: true, email: true, address: true } },
    },
  })
  if (!before || before.status !== 'RECEIVED') return

  const senderLine = before.company
    ? [before.company.name, before.company.contact, before.company.phone, before.company.email, before.company.address]
        .filter(Boolean).join(' · ')
    : 'no sender on record'
  const returnNote = `Return to sender — ${senderLine}`

  // Audit FIRST so we keep a permanent record of what was deleted, before the row vanishes.
  await audit({
    actorId,
    action: 'DELETE',
    entity: 'Delivery',
    entityId: deliveryId,
    before: { ...before, problemFlag: before.problemFlag ?? null },
    after: null,
    note: `Denied at warehouse verification — DELETED. Reason: ${reason}. ${returnNote}`,
  })

  // Hard delete: history rows first (FK), then the delivery itself.
  await prisma.deliveryHistory.deleteMany({ where: { deliveryId } })
  await prisma.delivery.delete({ where: { id: deliveryId } })

  // Fire-and-forget: notify sending company's users without blocking the user.
  if (before.companyId) {
    void (async () => {
      try {
        const users = await prisma.user.findMany({
          where: { companyId: before.companyId!, active: true },
          select: { id: true },
        })
        const body = `${before.trackingNumber} was denied at verification and removed from the system. Reason: ${reason}. ${returnNote}`
        await Promise.all(users.map((u) => notify(u.id, 'Parcel denied — removed from system', body, 'WARNING')))
      } catch {
        // Notification failures shouldn't surface as a denial failure.
      }
    })()
  }

  revalidatePath('/admin/verify')
  revalidatePath('/admin/deliveries')
}

/**
 * Bulk-deny multiple parcels with a single shared reason.
 * Per current product decision: denial = HARD DELETE.
 *
 * Optimized for speed:
 *   1. ONE findMany to load every selected RECEIVED row + sender contact.
 *   2. Audit logs written in parallel (Promise.all).
 *   3. Bulk deleteMany for delivery history + delivery rows (instead of per-row).
 *   4. Notifications dispatched in parallel and NOT awaited so the action returns
 *      immediately — the user sees the rows vanish instantly.
 *
 * Returns a count of successfully deleted vs. skipped.
 */
export async function denyMany(ids: string[], reason: string): Promise<{ denied: number; skipped: number }> {
  const session = await requireAdmin()
  const actorId = (session.user as { id?: string }).id ?? null
  const r = reason.trim()
  if (!r) return { denied: 0, skipped: ids.length }

  // 1. Load every selected RECEIVED row in a single query.
  const rows = await prisma.delivery.findMany({
    where: { id: { in: ids }, status: 'RECEIVED' },
    select: {
      id: true, status: true, trackingNumber: true, companyId: true, problemFlag: true,
      customerName: true, customerPhone: true, customerEmail: true,
      dropoffAddress: true, zone: true, packageType: true,
      company: { select: { name: true, contact: true, phone: true, email: true, address: true } },
    },
  })
  const validIds = rows.map((d) => d.id)
  const skipped = ids.length - validIds.length

  if (validIds.length === 0) {
    return { denied: 0, skipped }
  }

  // 2. Audit logs in parallel.
  await Promise.all(rows.map((d) => {
    const senderLine = d.company
      ? [d.company.name, d.company.contact, d.company.phone, d.company.email, d.company.address].filter(Boolean).join(' · ')
      : 'no sender on record'
    const returnNote = `Return to sender — ${senderLine}`
    return audit({
      actorId,
      action: 'DELETE',
      entity: 'Delivery',
      entityId: d.id,
      before: { ...d, problemFlag: d.problemFlag ?? null },
      after: null,
      note: `Bulk-denied at verification — DELETED. Reason: ${r}. ${returnNote}`,
    })
  }))

  // 3. Bulk delete: history first (FK), then deliveries.
  await prisma.deliveryHistory.deleteMany({ where: { deliveryId: { in: validIds } } })
  await prisma.delivery.deleteMany({ where: { id: { in: validIds } } })

  // 4. Fire-and-forget notifications. Don't block the user on these.
  void (async () => {
    try {
      // Group by company so we only query users once per company.
      const byCompany = new Map<string, typeof rows>()
      for (const d of rows) {
        if (!d.companyId) continue
        const arr = byCompany.get(d.companyId) ?? []
        arr.push(d)
        byCompany.set(d.companyId, arr)
      }
      for (const [companyId, parcels] of byCompany) {
        const users = await prisma.user.findMany({ where: { companyId, active: true }, select: { id: true } })
        if (users.length === 0) continue
        await Promise.all(parcels.flatMap((d) => {
          const senderLine = d.company
            ? [d.company.name, d.company.contact, d.company.phone, d.company.email, d.company.address].filter(Boolean).join(' · ')
            : 'no sender on record'
          const returnNote = `Return to sender — ${senderLine}`
          const body = `${d.trackingNumber} was denied at verification and removed from the system. Reason: ${r}. ${returnNote}`
          return users.map((u) => notify(u.id, 'Parcel denied — removed from system', body, 'WARNING'))
        }))
      }
    } catch {
      // Notification failures shouldn't surface as denial failures.
    }
  })()

  revalidatePath('/admin/verify')
  revalidatePath('/admin/deliveries')
  return { denied: validIds.length, skipped }
}
