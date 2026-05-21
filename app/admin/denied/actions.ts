'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import { audit } from '@/lib/audit'
import { notify } from '@/lib/notifications'

async function requireAdmin() {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')
  return session
}

/**
 * Shape of the snapshot we wrote to AuditLog.before when denying. Mirrors the
 * select we use in `denyDelivery` / `denyMany`.
 */
type DeliverySnapshot = {
  status?: string
  trackingNumber?: string
  companyId?: string | null
  problemFlag?: string | null
  customerName?: string
  customerPhone?: string
  customerEmail?: string | null
  dropoffAddress?: string
  zone?: string | null
  packageType?: string | null
}

/**
 * Restore a denied (deleted) parcel from its audit-log snapshot. Recreates the
 * Delivery row with the original id so any links / references are unbroken,
 * sets status back to RECEIVED so it returns to the verify queue, and writes
 * an UPDATE audit entry recording the restore.
 *
 * Also notifies the sending company's active users with full context:
 *   - the original tracking number
 *   - the reason for the original denial (extracted from the audit note)
 *   - confirmation that the parcel is back in the verification queue
 *   - a deep link to view the parcel
 *
 * Returns `senderNotified: true` if at least one notification was dispatched.
 */
export async function undoDenial(auditId: string): Promise<{
  ok: boolean
  deliveryId?: string
  reason?: string
  senderNotified?: boolean
  senderCompany?: string
}> {
  const session = await requireAdmin()
  const actorId = (session.user as { id?: string }).id ?? null

  const entry = await prisma.auditLog.findUnique({ where: { id: auditId } })
  if (!entry) return { ok: false, reason: 'Audit entry not found' }
  if (entry.entity !== 'Delivery' || entry.action !== 'DELETE') {
    return { ok: false, reason: 'Audit entry is not a delivery denial' }
  }
  if (!entry.entityId) return { ok: false, reason: 'Audit entry has no delivery id' }
  if (!entry.before)   return { ok: false, reason: 'Audit entry has no snapshot' }

  // If a delivery with this id already exists, it's already been restored.
  const existing = await prisma.delivery.findUnique({ where: { id: entry.entityId }, select: { id: true } })
  if (existing) return { ok: false, reason: 'Already restored' }

  let snap: DeliverySnapshot
  try {
    snap = JSON.parse(entry.before) as DeliverySnapshot
  } catch {
    return { ok: false, reason: 'Snapshot is not valid JSON' }
  }
  if (!snap.trackingNumber || !snap.customerName) {
    return { ok: false, reason: 'Snapshot is missing required fields' }
  }

  // Recreate the row. Status goes back to RECEIVED so it lands in the verify
  // queue; admin can re-deny or verify it as needed.
  const restored = await prisma.delivery.create({
    data: {
      id:             entry.entityId,
      trackingNumber: snap.trackingNumber,
      status:         'RECEIVED',
      customerName:   snap.customerName,
      customerPhone:  snap.customerPhone ?? '',
      customerEmail:  snap.customerEmail ?? null,
      dropoffAddress: snap.dropoffAddress ?? '',
      zone:           snap.zone ?? null,
      packageType:    snap.packageType ?? null,
      companyId:      snap.companyId ?? null,
      problemFlag:    null,  // clear the denial flag
    },
  })

  await prisma.deliveryHistory.create({
    data: { deliveryId: restored.id, status: 'RECEIVED', note: 'Restored after denial', actorId },
  })

  await audit({
    actorId,
    action: 'UPDATE',
    entity: 'Delivery',
    entityId: restored.id,
    before: { status: 'DELETED' },
    after:  { status: 'RECEIVED', restoredFromAudit: auditId },
    note: 'Denied parcel restored from audit-log snapshot',
  })

  // Sender feedback — awaited (not fire-and-forget) so the UI can confirm it actually reached the sender.
  let senderNotified = false
  let senderCompany: string | undefined
  if (restored.companyId) {
    try {
      const company = await prisma.company.findUnique({
        where: { id: restored.companyId },
        select: { name: true },
      })
      senderCompany = company?.name
      const users = await prisma.user.findMany({
        where: { companyId: restored.companyId, active: true },
        select: { id: true },
      })

      // Extract the original denial reason from the audit note for context.
      const reasonMatch = entry.note?.match(/Reason:\s*([^.]+)/)
      const originalReason = reasonMatch?.[1]?.trim() ?? null

      const body = originalReason
        ? `Your parcel ${restored.trackingNumber} (previously denied for "${originalReason}") has been restored and is back in the verification queue.`
        : `Your parcel ${restored.trackingNumber} has been restored after denial and is back in the verification queue.`

      if (users.length > 0) {
        await Promise.all(users.map((u) =>
          notify(u.id, 'Parcel restored — back in verification', body, 'SUCCESS', `/company/parcels/${restored.id}`),
        ))
        senderNotified = true
      }
    } catch (err) {
      console.error('[undoDenial] sender notification failed', err)
    }
  }

  revalidatePath('/admin/denied')
  revalidatePath('/admin/verify')
  revalidatePath('/admin/deliveries')
  return { ok: true, deliveryId: restored.id, senderNotified, senderCompany }
}
