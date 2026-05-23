#!/usr/bin/env node
/**
 * Create one COMPANY user per existing Company so each sender can log in
 * and see their own parcels / orders.
 *
 *   email    = company-<slug>@example.com  (handle generated from name)
 *   password = company123
 *   role     = COMPANY
 *   companyId = the company row's id
 *
 * Idempotent: skips companies that already have a linked COMPANY user.
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })
const PASSWORD = 'company123'

function slug(name, fallback) {
  // Strip diacritics + non-ASCII (Georgian script) to keep emails dialable.
  // If nothing survives, fall back to the company id suffix.
  const s = (name ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return s || fallback
}

async function main() {
  const companies = await prisma.company.findMany({
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  })
  console.log(`Companies: ${companies.length}`)

  const hashed = await bcrypt.hash(PASSWORD, 10)

  // For uniqueness of email handles, append a counter when we get collisions.
  const used = new Set()
  let created = 0
  let skipped = 0

  for (const c of companies) {
    // Already has a COMPANY user?
    const existing = await prisma.user.findFirst({
      where:  { companyId: c.id, role: 'COMPANY' },
      select: { id: true },
    })
    if (existing) { skipped++; continue }

    let handle = slug(c.name, c.id.slice(-6))
    let candidate = `company-${handle}@example.com`
    let n = 1
    while (used.has(candidate) || await prisma.user.findUnique({ where: { email: candidate } })) {
      n++
      candidate = `company-${handle}-${n}@example.com`
    }
    used.add(candidate)

    await prisma.user.create({
      data: {
        name:      `${c.name}`,
        email:     candidate,
        password:  hashed,
        role:      'COMPANY',
        active:    true,
        companyId: c.id,
      },
    })
    created++
    if (created % 25 === 0) console.log(`  …${created} created`)
  }

  console.log(`Created: ${created} · Skipped (already had user): ${skipped}`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('FAILED:', e)
  await prisma.$disconnect()
  process.exit(1)
})
