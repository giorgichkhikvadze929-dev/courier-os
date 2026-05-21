import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import bcrypt from 'bcryptjs'

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? 'file:./prisma/dev.db' })
const prisma = new PrismaClient({ adapter })

function tracking() {
  return 'TRK-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 5).toUpperCase()
}

async function main() {
  // ── Companies ─────────────────────────────────────────────────────────
  const acmeCo = await prisma.company.upsert({
    where: { id: 'seed-co-acme' },
    update: {},
    create: {
      id: 'seed-co-acme',
      name: 'Acme Trading',
      contact: 'Giorgi Beridze',
      phone: '+995-555-1000',
      email: 'orders@acme.example',
      address: 'Rustaveli Ave 12, Tbilisi',
    },
  })

  const peakCo = await prisma.company.upsert({
    where: { id: 'seed-co-peak' },
    update: {},
    create: {
      id: 'seed-co-peak',
      name: 'Peak Logistics',
      contact: 'Nino Kapanadze',
      phone: '+995-555-2000',
      email: 'ops@peak.example',
      address: 'Aghmashenebeli Ave 88, Tbilisi',
    },
  })

  // ── Tariffs ───────────────────────────────────────────────────────────
  const tariffs = [
    { companyId: acmeCo.id, zone: 'CAPITAL',  amount: 5.00 },
    { companyId: acmeCo.id, zone: 'REGION',   amount: 10.00 },
    { companyId: acmeCo.id, zone: 'MOUNTAIN', amount: 18.00 },
    { companyId: peakCo.id, zone: 'CAPITAL',  amount: 4.50 },
    { companyId: peakCo.id, zone: 'REGION',   amount: 9.00 },
    { companyId: peakCo.id, zone: 'MOUNTAIN', amount: 16.00 },
  ]
  const effective = new Date('2026-01-01')
  for (const t of tariffs) {
    await prisma.tariff.upsert({
      where: { companyId_zone_effective: { companyId: t.companyId, zone: t.zone, effective } },
      update: { amount: t.amount },
      create: { ...t, effective },
    })
  }

  // ── Users ─────────────────────────────────────────────────────────────
  const accounts = [
    { username: 'kagon',   password: 'Kagon2026!',   name: 'Kagon (Admin)',          role: 'ADMIN' },
    { username: 'acme',    password: 'Acme2026!',    name: 'Acme Trading',           role: 'COMPANY', phone: '+995-555-1000', companyId: acmeCo.id },
    { username: 'peak',    password: 'Peak2026!',    name: 'Peak Logistics',         role: 'COMPANY', phone: '+995-555-2000', companyId: peakCo.id },
    { username: 'bob',     password: 'Bob2026!',     name: 'Bob (Courier)',          role: 'COURIER', phone: '+995-555-0201' },
    { username: 'charlie', password: 'Charlie2026!', name: 'Charlie (Courier)',      role: 'COURIER', phone: '+995-555-0202' },
  ]

  const users: Record<string, { id: string }> = {}
  for (const a of accounts) {
    const hashed = await bcrypt.hash(a.password, 10)
    const u = await prisma.user.upsert({
      where: { email: a.username },
      update: {
        password: hashed, name: a.name, role: a.role,
        phone: a.phone ?? null,
        companyId: ('companyId' in a ? a.companyId : null) ?? null,
        active: true,
      },
      create: {
        email: a.username, password: hashed, name: a.name, role: a.role,
        phone: a.phone ?? null,
        companyId: ('companyId' in a ? a.companyId : null) ?? null,
      },
    })
    users[a.username] = u
  }

  const courier1 = users.bob
  const courier2 = users.charlie

  // ── Sample Deliveries (covering all 8 statuses) ───────────────────────
  const samples: {
    customerName: string
    customerPhone: string
    dropoffAddress: string
    zone: string
    status: string
    priority?: string
    courierId?: string
    companyId?: string
    codAmount?: number
    pickedUpAt?: Date
    deliveredAt?: Date
    failedAt?: Date
    refusedAt?: Date
    returnedAt?: Date
    proofSignedBy?: string
    proofNote?: string
    problemFlag?: string
    courierComment?: string
    notes?: string
  }[] = [
    { customerName: 'Maria Santos',     customerPhone: '+995-555-1001', dropoffAddress: '45 Maple St, Tbilisi',     zone: 'CAPITAL',  status: 'DELIVERED', courierId: courier1.id, companyId: acmeCo.id, codAmount: 35.00, deliveredAt: new Date(Date.now() - 2 * 3600_000), proofSignedBy: 'M. Santos' },
    { customerName: 'James Reyes',      customerPhone: '+995-555-1002', dropoffAddress: '88 Oak Ave, Batumi',       zone: 'REGION',   status: 'IN_TRANSIT', priority: 'HIGH', courierId: courier1.id, companyId: acmeCo.id, pickedUpAt: new Date(Date.now() - 1 * 3600_000) },
    { customerName: 'Ana Cruz',         customerPhone: '+995-555-1003', dropoffAddress: '3 Pine Rd, Kazbegi',       zone: 'MOUNTAIN', status: 'ASSIGNED', courierId: courier2.id, companyId: peakCo.id, codAmount: 50.00 },
    { customerName: 'Pedro Tan',        customerPhone: '+995-555-1004', dropoffAddress: '21 Elm St, Tbilisi',       zone: 'CAPITAL',  status: 'IN_WAREHOUSE', companyId: acmeCo.id },
    { customerName: 'Sofia Mendoza',    customerPhone: '+995-555-1005', dropoffAddress: '9 Birch Ln, Tbilisi',      zone: 'CAPITAL',  status: 'RECEIVED', companyId: peakCo.id },
    { customerName: 'Carlos Lim',       customerPhone: '+995-555-1006', dropoffAddress: '55 Cedar Ave, Kutaisi',    zone: 'REGION',   status: 'RECEIVED', companyId: peakCo.id, priority: 'URGENT' },
    { customerName: 'Elena Rodriguez',  customerPhone: '+995-555-1007', dropoffAddress: '77 Spruce Way, Mestia',    zone: 'MOUNTAIN', status: 'FAILED',  courierId: courier1.id, companyId: acmeCo.id, failedAt: new Date(Date.now() - 5 * 3600_000), problemFlag: 'Customer not at home' },
    { customerName: 'Marco Torres',     customerPhone: '+995-555-1008', dropoffAddress: '34 Walnut Blvd, Rustavi',  zone: 'CAPITAL',  status: 'REFUSED', courierId: courier2.id, companyId: acmeCo.id, refusedAt: new Date(Date.now() - 4 * 3600_000), problemFlag: 'Wrong item', courierComment: 'Customer says they ordered different size' },
    { customerName: 'Lara Patel',       customerPhone: '+995-555-1009', dropoffAddress: '12 Holly St, Tbilisi',     zone: 'CAPITAL',  status: 'RETURNED', courierId: courier2.id, companyId: peakCo.id, returnedAt: new Date(Date.now() - 24 * 3600_000), problemFlag: 'Customer refused — returned to warehouse' },
    { customerName: 'Tako Gelashvili',  customerPhone: '+995-555-1010', dropoffAddress: '99 Gldani St, Tbilisi',    zone: 'CAPITAL',  status: 'DELIVERED', courierId: courier1.id, companyId: peakCo.id, codAmount: 22.50, deliveredAt: new Date(Date.now() - 6 * 3600_000), proofSignedBy: 'T. Gelashvili' },
  ]

  for (const s of samples) {
    const exists = await prisma.delivery.findFirst({ where: { customerPhone: s.customerPhone } })
    if (exists) continue
    const del = await prisma.delivery.create({ data: { trackingNumber: tracking(), priority: 'NORMAL', ...s } })

    const trail: { status: string; note?: string }[] = [{ status: 'RECEIVED', note: 'Imported / order received' }]
    if (s.status !== 'RECEIVED') trail.push({ status: 'IN_WAREHOUSE', note: 'Verified at warehouse' })
    if (['ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'REFUSED', 'RETURNED'].includes(s.status)) trail.push({ status: 'ASSIGNED', note: 'Assigned to courier' })
    if (['IN_TRANSIT', 'DELIVERED'].includes(s.status)) trail.push({ status: 'IN_TRANSIT', note: 'Picked up' })
    if (s.status === 'DELIVERED') trail.push({ status: 'DELIVERED', note: 'Delivered successfully' })
    if (s.status === 'FAILED')    trail.push({ status: 'FAILED',    note: s.problemFlag ?? 'Failed' })
    if (s.status === 'REFUSED')   trail.push({ status: 'REFUSED',   note: s.problemFlag ?? 'Refused' })
    if (s.status === 'RETURNED')  trail.push({ status: 'RETURNED',  note: s.problemFlag ?? 'Returned' })

    for (const t of trail) {
      await prisma.deliveryHistory.create({ data: { deliveryId: del.id, ...t } })
    }
  }

  // ── Seed Notifications ────────────────────────────────────────────────
  const notifExists = await prisma.notification.findFirst()
  if (!notifExists) {
    await prisma.notification.createMany({
      data: [
        { userId: courier1.id, title: 'New delivery assigned',   body: 'A delivery has been assigned to you.', type: 'INFO',    link: '/courier' },
        { userId: courier2.id, title: 'New delivery assigned',   body: 'A delivery has been assigned to you.', type: 'INFO',    link: '/courier' },
        { userId: users.kagon.id, title: 'System ready',         body: 'Skeleton reset complete. PRD-aligned.', type: 'SUCCESS' },
      ],
    })
  }

  console.log('✓ Seed complete')
  console.log('')
  console.log('  Admin:               kagon   / Kagon2026!     → /admin')
  console.log('  Company (Acme):      acme    / Acme2026!      → /company')
  console.log('  Company (Peak):      peak    / Peak2026!      → /company')
  console.log('  Courier (Bob):       bob     / Bob2026!       → /courier')
  console.log('  Courier (Charlie):   charlie / Charlie2026!   → /courier')
}

main().catch(console.error).finally(() => prisma.$disconnect())
