import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import Shell from '@/app/components/Shell'
import AssignPanel, { type ZoneBucket, type CourierOption } from './AssignPanel'
import { getT } from '@/lib/i18n-server'

/**
 * Smart Assign — bulk courier assignment by zone.
 *
 * The PRD calls for fast assignment, not data correction. Parcels are grouped
 * into zone buckets; each bucket pre-selects the courier with (a) the most
 * delivered-in-zone history, then (b) the lowest current load. One click
 * assigns every parcel in that bucket to that courier.
 *
 * Parcels with no zone fall into an "unassigned" bucket so they can still be
 * assigned manually — never blocked behind data fixing.
 */
export default async function AssignPage() {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')

  const { t, lang } = await getT()

  // Cap the warehouse query at 1,000 parcels — that's far more than a normal
  // day's assignment volume, but stops the page from blowing up when a giant
  // seeded backlog lands in IN_WAREHOUSE. The bucketing still works; if the
  // backlog ever exceeds 1k an admin can pick the next batch by re-running.
  const WAREHOUSE_DISPLAY_CAP = 1000
  const [warehouseParcels, totalWarehouseCount, couriers, activeLoad, zoneHistory] = await Promise.all([
    prisma.delivery.findMany({
      where:   { status: 'IN_WAREHOUSE' },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take:    WAREHOUSE_DISPLAY_CAP,
      select:  {
        id: true, trackingNumber: true, customerName: true, customerPhone: true,
        dropoffAddress: true, zone: true, city: true, priority: true, codAmount: true,
      },
    }),
    prisma.delivery.count({ where: { status: 'IN_WAREHOUSE' } }),
    prisma.user.findMany({
      where: { role: 'COURIER', active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    // Currently active deliveries per courier (load).
    prisma.delivery.groupBy({
      by: ['courierId'],
      where: { courierId: { not: null }, status: { in: ['ASSIGNED', 'IN_TRANSIT'] } },
      _count: { _all: true },
    }),
    // Historical experience per courier × zone (DELIVERED count).
    prisma.delivery.groupBy({
      by: ['courierId', 'zone'],
      where: { courierId: { not: null }, status: 'DELIVERED', zone: { not: null } },
      _count: { _all: true },
    }),
  ])

  const loadByCourier: Record<string, number> = {}
  for (const c of couriers) loadByCourier[c.id] = 0
  for (const w of activeLoad) if (w.courierId) loadByCourier[w.courierId] = w._count._all

  // expByZone[zone][courierId] = how many DELIVERED parcels that courier has handled in that zone
  const expByZone: Record<string, Record<string, number>> = {}
  for (const z of zoneHistory) {
    if (!z.courierId || !z.zone) continue
    expByZone[z.zone] ??= {}
    expByZone[z.zone][z.courierId] = z._count._all
  }

  function pickBestCourierFor(zone: string | null): string {
    if (couriers.length === 0) return ''
    const exp = zone ? (expByZone[zone] ?? {}) : {}
    // Sort: zone experience desc, then current load asc.
    const ranked = [...couriers].sort((a, b) => {
      const expDiff = (exp[b.id] ?? 0) - (exp[a.id] ?? 0)
      if (expDiff !== 0) return expDiff
      return (loadByCourier[a.id] ?? 0) - (loadByCourier[b.id] ?? 0)
    })
    return ranked[0]?.id ?? ''
  }

  // Bucket parcels by zone.
  const buckets = new Map<string, ZoneBucket>()
  for (const p of warehouseParcels) {
    const zoneKey = p.zone ?? ''
    if (!buckets.has(zoneKey)) {
      buckets.set(zoneKey, {
        zone: p.zone,
        suggestedCourierId: pickBestCourierFor(p.zone),
        zoneExperience: p.zone ? (expByZone[p.zone] ?? {}) : {},
        parcels: [],
      })
    }
    buckets.get(zoneKey)!.parcels.push({
      id: p.id,
      trackingNumber: p.trackingNumber,
      customerName: p.customerName,
      customerPhone: p.customerPhone,
      dropoffAddress: p.dropoffAddress,
      city: p.city,
      priority: p.priority,
      codAmount: p.codAmount,
    })
  }

  // Order zones: most parcels first, but "unassigned" (no zone) at the bottom.
  const orderedBuckets = Array.from(buckets.values()).sort((a, b) => {
    if (!a.zone && b.zone) return 1
    if (a.zone && !b.zone) return -1
    return b.parcels.length - a.parcels.length
  })

  const courierOptions: CourierOption[] = couriers.map((c) => ({
    id: c.id,
    name: c.name,
    currentLoad: loadByCourier[c.id] ?? 0,
  }))

  const totalReady = warehouseParcels.length
  const moreInWarehouse = totalWarehouseCount > totalReady

  return (
    <Shell
      currentPath="/admin/assign"
      title={t('assign_title')}
      subtitle={totalReady > 0
        ? `${totalReady} ${t('parcel_word_plural')} · ${orderedBuckets.length} ${t('assign_buckets_label')}${moreInWarehouse ? ` (of ${totalWarehouseCount.toLocaleString()})` : ''}`
        : t('assign_nothing')}
    >
      <AssignPanel buckets={orderedBuckets} couriers={courierOptions} lang={lang} />
    </Shell>
  )
}
