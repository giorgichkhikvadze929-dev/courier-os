'use server'

import prisma from '@/lib/prisma'
import { getSession } from '@/lib/session'

/**
 * Server action behind the global ⌘K palette. Returns the top few matches
 * per entity type for a free-text query.
 *
 * Only the user's allowed entities are searched:
 *   - ADMIN → deliveries, orders, companies, couriers
 *   - COMPANY → their own parcels + orders (out of scope for v1)
 *   - COURIER → their assigned deliveries (out of scope for v1)
 *
 * v1: admin only. The palette renders nothing for non-admins.
 */
export type PaletteHit =
  | { type: 'delivery';  id: string; primary: string; secondary: string; href: string }
  | { type: 'order';     id: string; primary: string; secondary: string; href: string }
  | { type: 'company';   id: string; primary: string; secondary: string; href: string }
  | { type: 'courier';   id: string; primary: string; secondary: string; href: string }

export async function paletteSearch(q: string): Promise<PaletteHit[]> {
  const session = await getSession()
  if (!session || (session.user as { role?: string }).role !== 'ADMIN') return []

  const query = q.trim()
  if (query.length < 2) return []

  // Run the four lookups in parallel — each is bounded to the top 5 so the
  // palette stays snappy even with a fuzzy query.
  const [deliveries, orders, companies, couriers] = await Promise.all([
    prisma.delivery.findMany({
      where: {
        OR: [
          { trackingNumber: { contains: query, mode: 'insensitive' } },
          { customerName:   { contains: query, mode: 'insensitive' } },
          { customerPhone:  { contains: query } },
        ],
      },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, trackingNumber: true, customerName: true, status: true },
    }),
    prisma.order.findMany({
      where: { orderNumber: { contains: query, mode: 'insensitive' } },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, orderNumber: true, type: true, parcelCount: true },
    }),
    prisma.company.findMany({
      where: { name: { contains: query, mode: 'insensitive' } },
      take: 5,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, phone: true },
    }),
    prisma.user.findMany({
      where: {
        role: 'COURIER',
        OR: [
          { name:  { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 5,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, email: true },
    }),
  ])

  const hits: PaletteHit[] = []
  for (const d of deliveries) hits.push({
    type: 'delivery', id: d.id,
    primary: d.trackingNumber,
    secondary: `${d.customerName} · ${d.status}`,
    href: `/admin/deliveries/${d.id}`,
  })
  for (const o of orders) hits.push({
    type: 'order', id: o.id,
    primary: o.orderNumber,
    secondary: `${o.type === 'IMPORT' ? 'Inbound' : 'Outbound'} · ${o.parcelCount} parcels`,
    href: `/admin/orders/${o.id}`,
  })
  for (const c of companies) hits.push({
    type: 'company', id: c.id,
    primary: c.name,
    secondary: c.phone ?? '',
    href: `/admin/companies/${c.id}`,
  })
  for (const u of couriers) hits.push({
    type: 'courier', id: u.id,
    primary: u.name ?? u.email ?? 'Unknown',
    secondary: u.email ?? '',
    href: `/admin/deliveries?courier=${u.id}`,
  })

  return hits
}
