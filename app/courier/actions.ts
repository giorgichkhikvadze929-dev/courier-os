'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import { audit } from '@/lib/audit'
import { notify } from '@/lib/notifications'

/**
 * Ping every active admin when a courier moves a parcel through its lifecycle.
 * Keeps the admin side reactive to courier field activity without manual
 * dashboard refresh — pairs with the AutoRefresh polling.
 */
async function notifyAdminsOfStatusChange(opts: {
  deliveryId: string
  trackingNumber: string
  fromStatus: string
  toStatus: string
  courierName: string
}) {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', active: true },
    select: { id: true },
  })
  const STATUS_VERB: Record<string, string> = {
    IN_TRANSIT:   'picked up',
    DELIVERED:    'delivered',
    FAILED:       'marked failed',
    REFUSED:      'marked refused',
    IN_WAREHOUSE: 'returned to warehouse',
    RETURNED:     'returned',
  }
  const verb = STATUS_VERB[opts.toStatus] ?? `set ${opts.toStatus}`
  const SEVERITY: Record<string, 'INFO' | 'WARNING'> = {
    DELIVERED: 'INFO',
    IN_TRANSIT: 'INFO',
    IN_WAREHOUSE: 'WARNING',
    FAILED: 'WARNING',
    REFUSED: 'WARNING',
  }
  const severity = SEVERITY[opts.toStatus] ?? 'INFO'
  await Promise.all(admins.map((a) =>
    notify(
      a.id,
      `Courier ${verb}: ${opts.trackingNumber}`,
      `${opts.courierName} ${verb} ${opts.trackingNumber}.`,
      severity,
      `/admin/deliveries/${opts.deliveryId}`,
    ),
  ))
}

async function requireCourier() {
  const session = await auth()
  if (!session) redirect('/login')
  const role = session.user?.role as string
  if (!['COURIER', 'ADMIN'].includes(role)) redirect('/login')
  return session
}

export async function updateDeliveryStatus(deliveryId: string, formData: FormData): Promise<void> {
  const session = await requireCourier()
  const courierId = (session.user as { id?: string }).id

  const status        = formData.get('status') as string
  const courierComment = (formData.get('courierComment') as string | null)?.trim() || null
  const proofNote      = (formData.get('proofNote') as string | null)?.trim() || null
  const proofSignedBy  = (formData.get('proofSignedBy') as string | null)?.trim() || null
  const problemFlag    = (formData.get('problemFlag') as string | null)?.trim() || null

  const timeField: Record<string, string> = {
    IN_TRANSIT: 'pickedUpAt',
    DELIVERED:  'deliveredAt',
    FAILED:     'failedAt',
    REFUSED:    'refusedAt',
    RETURNED:   'returnedAt',
  }

  const data: Record<string, unknown> = {
    status,
    courierComment,
    ...(timeField[status] ? { [timeField[status]]: new Date() } : {}),
    ...(proofNote ? { proofNote } : {}),
    ...(proofSignedBy ? { proofSignedBy } : {}),
    ...(problemFlag ? { problemFlag } : {}),
  }

  const before = await prisma.delivery.findUnique({ where: { id: deliveryId }, select: { status: true, trackingNumber: true } })
  if (!before) return

  await prisma.delivery.update({
    where: { id: deliveryId, courierId: courierId ?? undefined },
    data,
  })

  await prisma.deliveryHistory.create({
    data: { deliveryId, status, note: courierComment ?? problemFlag, actorId: courierId ?? null },
  })

  await audit({
    actorId: courierId ?? null,
    action: 'STATUS_CHANGE',
    entity: 'Delivery',
    entityId: deliveryId,
    before: { status: before.status },
    after: { status },
    note: courierComment ?? problemFlag ?? undefined,
  })

  await notifyAdminsOfStatusChange({
    deliveryId,
    trackingNumber: before.trackingNumber,
    fromStatus: before.status,
    toStatus: status,
    courierName: session.user?.name ?? 'A courier',
  })

  revalidatePath(`/courier/deliveries/${deliveryId}`)
  revalidatePath('/courier')
  revalidatePath('/admin/deliveries')
}

/**
 * Delivery courier brings an undelivered parcel back to the warehouse.
 *
 * Used when the courier couldn't deliver (FAILED) or the customer refused
 * (REFUSED) and they've physically returned the parcel to the warehouse.
 *
 * The parcel goes back to IN_WAREHOUSE (re-assignable to a different courier
 * or a re-attempt) and the assignment is cleared so it shows up in the assign
 * queue again. The `returnedAt` timestamp records the round-trip happened so
 * the admin can see this parcel has already been out once.
 */
export async function returnToWarehouse(deliveryId: string, formData: FormData): Promise<void> {
  const session = await requireCourier()
  const actorId = (session.user as { id?: string }).id ?? null
  const reason = (formData.get('problemFlag') as string | null)?.trim() || null

  const before = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    select: { status: true, courierId: true, trackingNumber: true },
  })
  if (!before) return
  // Only the assigned courier (or an admin) may return a parcel to warehouse.
  const role = session.user?.role as string
  if (role === 'COURIER' && before.courierId !== actorId) return
  // Only sensible from a problem state.
  if (!['FAILED', 'REFUSED', 'IN_TRANSIT'].includes(before.status)) return

  await prisma.delivery.update({
    where: { id: deliveryId },
    data: {
      status: 'IN_WAREHOUSE',
      courierId: null,                 // clear assignment — admin will re-assign
      returnedAt: new Date(),          // record the round-trip
      problemFlag: reason ?? before.status, // keep the reason visible to admin
    },
  })
  await prisma.deliveryHistory.create({
    data: { deliveryId, status: 'IN_WAREHOUSE', note: `Returned to warehouse by courier${reason ? ' — ' + reason : ''}`, actorId },
  })
  await audit({
    actorId,
    action: 'STATUS_CHANGE',
    entity: 'Delivery',
    entityId: deliveryId,
    before: { status: before.status, courierId: before.courierId },
    after:  { status: 'IN_WAREHOUSE', courierId: null },
    note: `Returned to warehouse${reason ? ' — ' + reason : ''}`,
  })

  await notifyAdminsOfStatusChange({
    deliveryId,
    trackingNumber: before.trackingNumber,
    fromStatus: before.status,
    toStatus: 'IN_WAREHOUSE',
    courierName: session.user?.name ?? 'A courier',
  })

  revalidatePath(`/courier/deliveries/${deliveryId}`)
  revalidatePath('/courier')
  revalidatePath('/admin/assign')
  revalidatePath('/admin/verify')
  revalidatePath('/admin/deliveries')
}

/**
 * Pickup courier confirms they've brought the parcel from the sender to the
 * warehouse. Stamps pickupCollectedAt, moves the parcel to IN_WAREHOUSE so the
 * delivery courier flow can begin.
 */
export async function markPickedUpAt(deliveryId: string): Promise<void> {
  const session = await requireCourier()
  const actorId = (session.user as { id?: string }).id ?? null

  const before = await prisma.delivery.findUnique({ where: { id: deliveryId }, select: { status: true, pickupCourierId: true, trackingNumber: true } })
  if (!before) return
  // Defensive: only the assigned pickup courier (or admin) can mark it.
  const role = session.user?.role as string
  if (role === 'COURIER' && before.pickupCourierId !== actorId) return
  if (before.status !== 'RECEIVED') return

  await prisma.delivery.update({
    where: { id: deliveryId },
    data: {
      status: 'IN_WAREHOUSE',
      pickupCollectedAt: new Date(),
    },
  })
  await prisma.deliveryHistory.create({
    data: { deliveryId, status: 'IN_WAREHOUSE', note: 'Picked up by courier — delivered to warehouse', actorId },
  })
  await audit({
    actorId,
    action: 'STATUS_CHANGE',
    entity: 'Delivery',
    entityId: deliveryId,
    before: { status: before.status },
    after: { status: 'IN_WAREHOUSE' },
    note: 'Pickup courier delivered to warehouse',
  })
  revalidatePath('/courier/pickups')
  revalidatePath('/admin/verify')
  revalidatePath(`/admin/deliveries/${deliveryId}`)
}
