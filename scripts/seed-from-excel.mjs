#!/usr/bin/env node
/**
 * One-shot seed script — reads /tmp/upload.xlsx (the operator's April list)
 * and creates:
 *   - One Courier user per sheet name (deduped)
 *   - One Company per unique value in the master sheet's `კომპანია` column
 *   - One Delivery per row in Sheet1 (status IN_WAREHOUSE, linked to company)
 *   - Re-walks each courier sheet and assigns its rows (looked up by `N`)
 *     to that courier with status = ASSIGNED.
 *
 * Permissive: skips rows that are obviously empty / missing required fields,
 * but never raises. The user explicitly said "no requirements — get what you
 * can." All inserts are chunked to keep memory bounded.
 *
 * Run:
 *   DATABASE_URL=... node scripts/seed-from-excel.mjs
 */
import XLSX from 'xlsx'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

const FILE = '/tmp/upload.xlsx'
const COURIER_PASSWORD = 'courier123'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

function clean(s) {
  if (s == null) return null
  const t = String(s).trim()
  return t.length === 0 ? null : t
}

function num(s) {
  if (s == null || s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

// Cheap tracking-number generator — unique per row by suffixing `N`.
function trackingFor(n) {
  return `TRK-A${String(n).padStart(7, '0')}`
}

// Strip the " 2.05" / "2.05" / "..." suffix off a courier sheet name.
function courierNameOf(sheet) {
  return sheet
    .replace(/\s*[.…]*\s*2\.05.*$/, '')   // drop "2.05" and trailing variants
    .replace(/[.…]+$/, '')
    .trim()
}

async function main() {
  console.log('Reading workbook…')
  const wb = XLSX.readFile(FILE)
  const sheets = wb.SheetNames
  console.log('Sheets:', sheets.join(', '))

  // ───────────────────────── 1. Master sheet → companies + deliveries ─────────────────────────
  const masterRows = XLSX.utils.sheet_to_json(wb.Sheets['Sheet1'], { defval: null })
  console.log(`Master rows: ${masterRows.length}`)

  const companyNames = new Set()
  for (const r of masterRows) {
    const c = clean(r['კომპანია'])
    if (c) companyNames.add(c)
  }
  console.log(`Unique companies: ${companyNames.size}`)

  // Upsert companies. Existing schema doesn't have a unique on name, so we look
  // up first; in this run the DB was wiped so we just create.
  console.log('Creating companies…')
  const nameToCompanyId = new Map()
  for (const name of companyNames) {
    const created = await prisma.company.create({ data: { name, active: true } })
    nameToCompanyId.set(name, created.id)
  }
  console.log(`Companies created: ${nameToCompanyId.size}`)

  // ───────────────────────── 2. Courier users from sheet names ─────────────────────────
  const courierBaseNames = new Set()
  for (const sheet of sheets) {
    if (sheet === 'Sheet1') continue
    courierBaseNames.add(courierNameOf(sheet))
  }
  console.log(`Couriers (deduped): ${[...courierBaseNames].join(', ')}`)

  const hashed = await bcrypt.hash(COURIER_PASSWORD, 10)
  const courierByName = new Map()
  for (const name of courierBaseNames) {
    // Email used as login handle — Latin-ascii fallback since some chars don't transliterate well.
    const handle = name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/^_+|_+$/g, '') || `courier${courierByName.size + 1}`
    const email = `${handle}@example.com`
    const user = await prisma.user.create({
      data: {
        name:     `${name} (Courier)`,
        email,
        password: hashed,
        role:     'COURIER',
        active:   true,
      },
    })
    courierByName.set(name, user.id)
  }
  console.log(`Couriers created: ${courierByName.size}`)

  // ───────────────────────── 3. Bulk-insert deliveries from Sheet1 ─────────────────────────
  console.log('Building delivery rows…')
  const trackingToN = new Map()
  const deliveriesData = []
  for (const r of masterRows) {
    const N = num(r['N'])
    if (N == null) continue                       // skip rows with no master id
    const phone   = clean(r['ტელეფონი'])
    const address = clean(r['მისამართი'])
    if (!phone || !address) continue              // schema requires phone + address
    const company = clean(r['კომპანია'])
    const codAmt  = num(r['ფასი'])
    const tracking = trackingFor(N)
    trackingToN.set(tracking, N)
    deliveriesData.push({
      trackingNumber: tracking,
      status:         'IN_WAREHOUSE',
      verifiedAt:     new Date(),
      verifiedNote:   'Imported from April list',
      priority:       'NORMAL',
      customerName:   '—',                         // file doesn't have a separate recipient name
      customerPhone:  phone,
      dropoffAddress: address,
      zone:           null,
      city:           clean(r['რეგიონი']),
      codAmount:      codAmt,
      notes:          clean(r['თარიღი']),         // keep the original date string as a note
      companyId:      company ? (nameToCompanyId.get(company) ?? null) : null,
    })
  }
  console.log(`Will insert: ${deliveriesData.length} deliveries`)

  // Bulk insert in chunks of 1000 to keep round trips reasonable.
  let created = 0
  const CHUNK = 1000
  for (let i = 0; i < deliveriesData.length; i += CHUNK) {
    const slice = deliveriesData.slice(i, i + CHUNK)
    const res = await prisma.delivery.createMany({ data: slice })
    created += res.count
    if ((i / CHUNK) % 5 === 0) console.log(`  …${created} / ${deliveriesData.length}`)
  }
  console.log(`Deliveries inserted: ${created}`)

  // ───────────────────────── 4. Look up ids by tracking number for assignment ─────────────────────────
  console.log('Mapping trackingNumber → deliveryId…')
  const trackingToId = new Map()
  // Fetch in 5k chunks of trackingNumbers to avoid huge IN clauses.
  const allTrackings = [...trackingToN.keys()]
  for (let i = 0; i < allTrackings.length; i += 5000) {
    const slice = allTrackings.slice(i, i + 5000)
    const rows = await prisma.delivery.findMany({
      where:  { trackingNumber: { in: slice } },
      select: { id: true, trackingNumber: true },
    })
    for (const r of rows) trackingToId.set(r.trackingNumber, r.id)
  }
  console.log(`Resolved ids for: ${trackingToId.size}`)

  // ───────────────────────── 5. Walk courier sheets → assign ─────────────────────────
  console.log('Assigning courier sheets…')
  let assignedTotal = 0
  for (const sheet of sheets) {
    if (sheet === 'Sheet1') continue
    const courierKey = courierNameOf(sheet)
    const courierId  = courierByName.get(courierKey)
    if (!courierId) continue
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { defval: null })
    const ids = []
    for (const r of rows) {
      const N = num(r['N'])
      if (N == null) continue
      const id = trackingToId.get(trackingFor(N))
      if (id) ids.push(id)
    }
    if (ids.length > 0) {
      const res = await prisma.delivery.updateMany({
        where: { id: { in: ids } },
        data:  { status: 'ASSIGNED', courierId },
      })
      assignedTotal += res.count
      console.log(`  ${sheet} → ${courierKey}: ${res.count} parcels`)
    }
  }
  console.log(`Total assigned: ${assignedTotal}`)

  await prisma.$disconnect()
  console.log('Done.')
}

main().catch(async (e) => {
  console.error('FAILED:', e)
  await prisma.$disconnect()
  process.exit(1)
})
