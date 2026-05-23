'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import { notify } from '@/lib/notifications'
import { audit } from '@/lib/audit'

export async function updateDeliveryFields(deliveryId: string, formData: FormData): Promise<void> {
  const session = await requireAdmin()
  const actorId = (session.user as { id?: string }).id ?? null

  const before = await prisma.delivery.findUnique({ where: { id: deliveryId } })
  if (!before) return

  const num = (k: string): number | null => {
    const v = (formData.get(k) as string | null)?.trim()
    if (!v) return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  const str = (k: string, fallback: string | null = null): string | null => {
    const v = (formData.get(k) as string | null)?.trim()
    return v ? v : fallback
  }

  const data = {
    customerName:   str('customerName', before.customerName)!,
    customerPhone:  str('customerPhone', before.customerPhone)!,
    customerEmail:  str('customerEmail'),
    dropoffAddress: str('dropoffAddress', before.dropoffAddress)!,
    zone:           str('zone'),
    packageType:    str('packageType'),
    codAmount:      num('codAmount'),
    notes:          str('notes'),
    priority:       str('priority', before.priority) ?? 'NORMAL',
  }

  const after = await prisma.delivery.update({ where: { id: deliveryId }, data })
  await audit({
    actorId, action: 'UPDATE', entity: 'Delivery', entityId: deliveryId,
    before, after, note: 'Field edit by admin',
  })
  revalidatePath(`/admin/deliveries/${deliveryId}`)
  revalidatePath('/admin/deliveries')
  redirect(`/admin/deliveries/${deliveryId}`)
}

async function requireAdmin() {
  const session = await auth()
  if (!session) redirect('/login')
  const role = session.user?.role as string
  if (role !== 'ADMIN') redirect('/login')
  return session
}

export type BulkResult = {
  total: number
  assigned: number
  skipped: number
  failed: { id: string; reason: string }[]
}

export async function assignSingle(deliveryId: string, formData: FormData): Promise<void> {
  const session = await requireAdmin()
  const actorId = (session.user as { id?: string }).id ?? null
  const courierId = formData.get('courierId') as string
  if (!courierId) return
  const before = await prisma.delivery.findUnique({ where: { id: deliveryId } })
  if (!before) return
  if (!['IN_WAREHOUSE', 'RECEIVED', 'ASSIGNED'].includes(before.status)) return
  await prisma.delivery.update({ where: { id: deliveryId }, data: { courierId, status: 'ASSIGNED' } })
  await prisma.deliveryHistory.create({ data: { deliveryId, status: 'ASSIGNED', note: 'Assigned by admin', actorId } })
  // One-parcel assignment still gets its own ASSIGNMENT order so the audit /
  // courier-side history stays consistent with the bulk path.
  const { createAssignmentOrder } = await import('@/lib/order')
  await createAssignmentOrder({
    courierId,
    deliveryIds: [deliveryId],
    notes: 'Single assignment by admin',
  })
  await notify(courierId, 'New delivery assigned', `Delivery ${before.trackingNumber} has been assigned to you.`, 'INFO', `/courier/deliveries/${deliveryId}`)
  await audit({ actorId, action: 'ASSIGN', entity: 'Delivery', entityId: deliveryId, before: { courierId: before.courierId, status: before.status }, after: { courierId, status: 'ASSIGNED' } })
  revalidatePath(`/admin/deliveries/${deliveryId}`)
  revalidatePath('/admin/deliveries')
  revalidatePath('/admin/orders')
}

/**
 * Assign a pickup courier — the person who goes to the sender's address and
 * brings the parcel back to the warehouse. Different from `assignSingle` which
 * assigns the delivery courier (warehouse → customer).
 */
export async function assignPickupCourier(deliveryId: string, formData: FormData): Promise<void> {
  const session = await requireAdmin()
  const actorId = (session.user as { id?: string }).id ?? null
  const pickupCourierId = (formData.get('pickupCourierId') as string | null)?.trim() || null
  const before = await prisma.delivery.findUnique({ where: { id: deliveryId } })
  if (!before) return
  // Pickup makes sense only before the parcel is in the warehouse.
  if (before.status !== 'RECEIVED') return

  await prisma.delivery.update({
    where: { id: deliveryId },
    data: {
      pickupCourierId,
      pickupAssignedAt: pickupCourierId ? new Date() : null,
    },
  })
  if (pickupCourierId) {
    await notify(
      pickupCourierId,
      'New pickup task',
      `Pickup task for ${before.trackingNumber} — collect from sender and bring to warehouse.`,
      'INFO',
      `/courier/pickups`,
    )
  }
  await audit({
    actorId,
    action: 'ASSIGN_PICKUP',
    entity: 'Delivery',
    entityId: deliveryId,
    before: { pickupCourierId: before.pickupCourierId },
    after: { pickupCourierId },
  })
  revalidatePath(`/admin/deliveries/${deliveryId}`)
  revalidatePath('/admin/deliveries')
}

export async function bulkAssignToCourier(ids: string[], courierId: string): Promise<BulkResult> {
  const session = await requireAdmin()
  const actorId = (session.user as { id?: string }).id ?? null
  if (ids.length === 0 || !courierId) return { total: 0, assigned: 0, skipped: 0, failed: [] }

  const out: BulkResult = { total: ids.length, assigned: 0, skipped: 0, failed: [] }
  const assignedIds: string[] = []
  for (const id of ids) {
    try {
      const d = await prisma.delivery.findUnique({ where: { id } })
      if (!d) { out.failed.push({ id, reason: 'Not found' }); continue }
      if (d.courierId === courierId) { out.skipped++; continue }
      // Only IN_WAREHOUSE / RECEIVED deliveries are assignable
      if (!['IN_WAREHOUSE', 'RECEIVED', 'ASSIGNED'].includes(d.status)) {
        out.failed.push({ id, reason: `Cannot assign — status ${d.status}` })
        continue
      }
      await prisma.delivery.update({
        where: { id },
        data: { courierId, status: 'ASSIGNED' },
      })
      await prisma.deliveryHistory.create({
        data: { deliveryId: id, status: 'ASSIGNED', note: 'Bulk-assigned by admin', actorId },
      })
      await notify(courierId, 'New delivery assigned', `Delivery ${d.trackingNumber} has been assigned to you.`, 'INFO', `/courier/deliveries/${id}`)
      await audit({ actorId, action: 'ASSIGN', entity: 'Delivery', entityId: id, before: { courierId: d.courierId, status: d.status }, after: { courierId, status: 'ASSIGNED' } })
      out.assigned++
      assignedIds.push(id)
    } catch (err) {
      out.failed.push({ id, reason: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  // Group the successfully-assigned parcels into a new ASSIGNMENT order so
  // the bundle is tracked as one delivery batch (matches the way orders are
  // grouped for imports).
  if (assignedIds.length > 0) {
    const { createAssignmentOrder } = await import('@/lib/order')
    const order = await createAssignmentOrder({
      courierId,
      deliveryIds: assignedIds,
      notes: `Bulk assignment by admin · ${assignedIds.length} parcels`,
    })
    if (order) {
      await audit({
        actorId,
        action: 'CREATE',
        entity: 'Order',
        entityId: order.id,
        after: { orderNumber: order.orderNumber, type: 'ASSIGNMENT', courierId, parcelCount: order.count },
        note: `Created assignment order ${order.orderNumber}`,
      })
    }
  }

  revalidatePath('/admin/deliveries')
  revalidatePath('/admin/orders')
  return out
}
