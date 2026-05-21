'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import { notify } from '@/lib/notifications'
import { audit } from '@/lib/audit'

async function requireAdmin() {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')
  return session
}

export type AssignPlanRow = { deliveryId: string; courierId: string }
export type ApplyPlanResult = { assigned: number; skipped: number; failed: number }

/**
 * Apply a confirmed assignment plan — a list of (deliveryId → courierId) pairs.
 * Only IN_WAREHOUSE parcels are assignable; anything else is skipped so a stale
 * preview can't push a parcel into a bad state.
 */
export async function applyAssignmentPlan(plan: AssignPlanRow[]): Promise<ApplyPlanResult> {
  const session = await requireAdmin()
  const actorId = (session.user as { id?: string }).id ?? null

  const out: ApplyPlanResult = { assigned: 0, skipped: 0, failed: 0 }
  if (plan.length === 0) return out

  // Validate courier ids up front.
  const courierIds = [...new Set(plan.map((p) => p.courierId).filter(Boolean))]
  const validCouriers = new Set(
    (await prisma.user.findMany({ where: { id: { in: courierIds }, role: 'COURIER', active: true }, select: { id: true } }))
      .map((c) => c.id),
  )

  for (const row of plan) {
    if (!row.courierId || !validCouriers.has(row.courierId)) { out.skipped++; continue }
    try {
      const d = await prisma.delivery.findUnique({
        where: { id: row.deliveryId },
        select: { status: true, trackingNumber: true, courierId: true },
      })
      if (!d || d.status !== 'IN_WAREHOUSE') { out.skipped++; continue }

      await prisma.delivery.update({
        where: { id: row.deliveryId },
        data: { courierId: row.courierId, status: 'ASSIGNED' },
      })
      await prisma.deliveryHistory.create({
        data: { deliveryId: row.deliveryId, status: 'ASSIGNED', note: 'Assigned via Smart Assign', actorId },
      })
      await notify(
        row.courierId,
        'New delivery assigned',
        `Delivery ${d.trackingNumber} has been assigned to you.`,
        'INFO',
        `/courier/deliveries/${row.deliveryId}`,
      )
      await audit({
        actorId, action: 'ASSIGN', entity: 'Delivery', entityId: row.deliveryId,
        before: { courierId: d.courierId, status: d.status },
        after:  { courierId: row.courierId, status: 'ASSIGNED' },
        note: 'Smart Assign',
      })
      out.assigned++
    } catch {
      out.failed++
    }
  }

  revalidatePath('/admin/assign')
  revalidatePath('/admin/deliveries')
  return out
}
