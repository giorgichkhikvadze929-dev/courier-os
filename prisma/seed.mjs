// One-shot bootstrap for a fresh Supabase Postgres database.
//
// Creates:
//   - 1 admin (kagon / Kagon2026!)
//   - 2 companies (Acme Trading, Peak Logistics), one user each
//   - 2 couriers (bob / Bob2026!, charlie / Charlie2026!)
//   - Tariffs per company across all 12 Georgian regions
//   - 89 GeoPlace rows covering every Georgian region, municipality, and city
//
// Run after `prisma migrate deploy` finishes creating the empty schema.
//
// Usage:
//   node prisma/seed.mjs
// (DATABASE_URL must be set in .env.local or the shell.)

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'

dotenv.config()
dotenv.config({ path: '.env.local', override: true })

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

// ─── Companies + users ──────────────────────────────────────────────────────
const COMPANIES = [
  { id: 'seed-co-acme', name: 'Acme Trading',   contact: 'Acme Ops', phone: '+995-555-1000', email: 'orders@acme.example', address: 'Rustaveli Ave 12, Tbilisi', uploadEnabled: true },
  { id: 'seed-co-peak', name: 'Peak Logistics', contact: 'Peak Ops', phone: '+995-555-2000', email: 'ops@peak.example',    address: 'Chavchavadze 47, Tbilisi',  uploadEnabled: true },
]

const USERS = [
  { username: 'kagon',   password: 'Kagon2026!',   name: 'Kagon (Admin)',     role: 'ADMIN' },
  { username: 'acme',    password: 'Acme2026!',    name: 'Acme Trading',      role: 'COMPANY', phone: '+995-555-1000', companyId: 'seed-co-acme' },
  { username: 'peak',    password: 'Peak2026!',    name: 'Peak Logistics',    role: 'COMPANY', phone: '+995-555-2000', companyId: 'seed-co-peak' },
  { username: 'bob',     password: 'Bob2026!',     name: 'Bob (Courier)',     role: 'COURIER', phone: '+995-555-0201' },
  { username: 'charlie', password: 'Charlie2026!', name: 'Charlie (Courier)', role: 'COURIER', phone: '+995-555-0202' },
]

// ─── Tariffs (rate per company × region) ───────────────────────────────────
// Acme is the cheaper carrier in Tbilisi; Peak undercuts on regional & mountain.
const TARIFF_RATES = {
  'seed-co-acme': { TBILISI: 5.0, ABKHAZIA: 15, ADJARA: 12, GURIA: 10, IMERETI: 8,  KAKHETI: 9,  KVEMO_KARTLI: 7,  MTSKHETA_MTIANETI: 18, RACHA_LECHKHUMI: 20, SAMEGRELO: 11, SAMTSKHE_JAVAKHETI: 13, SHIDA_KARTLI: 8 },
  'seed-co-peak': { TBILISI: 4.5, ABKHAZIA: 14, ADJARA: 11, GURIA: 9,  IMERETI: 7,  KAKHETI: 8,  KVEMO_KARTLI: 6,  MTSKHETA_MTIANETI: 16, RACHA_LECHKHUMI: 18, SAMEGRELO: 10, SAMTSKHE_JAVAKHETI: 12, SHIDA_KARTLI: 7 },
}

// ─── 89 Georgian places — see prisma/seed-geo.mjs for the canonical list ────
const PLACES = [
  ['TBILISI', 'Tbilisi', 'Tbilisi', 'თბილისი', 'CITY', '0100'],
  ['TBILISI', 'Tbilisi', 'Vake', 'ვაკე', 'DISTRICT', '0179'],
  ['TBILISI', 'Tbilisi', 'Saburtalo', 'საბურთალო', 'DISTRICT', '0160'],
  ['TBILISI', 'Tbilisi', 'Didube', 'დიდუბე', 'DISTRICT', '0171'],
  ['TBILISI', 'Tbilisi', 'Gldani', 'გლდანი', 'DISTRICT', '0167'],
  ['TBILISI', 'Tbilisi', 'Isani', 'ისანი', 'DISTRICT', '0114'],
  ['TBILISI', 'Tbilisi', 'Samgori', 'სამგორი', 'DISTRICT', '0116'],
  ['TBILISI', 'Tbilisi', 'Mtatsminda', 'მთაწმინდა', 'DISTRICT', '0105'],
  ['TBILISI', 'Tbilisi', 'Krtsanisi', 'კრწანისი', 'DISTRICT', '0102'],
  ['TBILISI', 'Tbilisi', 'Nadzaladevi', 'ნაძალადევი', 'DISTRICT', '0140'],
  ['TBILISI', 'Tbilisi', 'Chughureti', 'ჩუღურეთი', 'DISTRICT', '0102'],
  ['ADJARA', 'Batumi', 'Batumi', 'ბათუმი', 'CITY', '6000'],
  ['ADJARA', 'Kobuleti', 'Kobuleti', 'ქობულეთი', 'CITY', '6200'],
  ['ADJARA', 'Kobuleti', 'Ochkhamuri', 'ოჩხამური', 'TOWN', '6213'],
  ['ADJARA', 'Khelvachauri', 'Khelvachauri', 'ხელვაჩაური', 'TOWN', '6100'],
  ['ADJARA', 'Keda', 'Keda', 'ქედა', 'TOWN', '6300'],
  ['ADJARA', 'Shuakhevi', 'Shuakhevi', 'შუახევი', 'TOWN', '6400'],
  ['ADJARA', 'Khulo', 'Khulo', 'ხულო', 'TOWN', '6500'],
  ['GURIA', 'Ozurgeti', 'Ozurgeti', 'ოზურგეთი', 'CITY', '3500'],
  ['GURIA', 'Lanchkhuti', 'Lanchkhuti', 'ლანჩხუთი', 'CITY', '3600'],
  ['GURIA', 'Chokhatauri', 'Chokhatauri', 'ჩოხატაური', 'TOWN', '3400'],
  ['GURIA', 'Ozurgeti', 'Ureki', 'ურეკი', 'TOWN', '3521'],
  ['GURIA', 'Lanchkhuti', 'Supsa', 'სუფსა', 'VILLAGE', '3622'],
  ['IMERETI', 'Kutaisi', 'Kutaisi', 'ქუთაისი', 'CITY', '4600'],
  ['IMERETI', 'Tskaltubo', 'Tskaltubo', 'წყალტუბო', 'CITY', '4700'],
  ['IMERETI', 'Samtredia', 'Samtredia', 'სამტრედია', 'CITY', '4400'],
  ['IMERETI', 'Zestaponi', 'Zestaponi', 'ზესტაფონი', 'CITY', '2000'],
  ['IMERETI', 'Chiatura', 'Chiatura', 'ჭიათურა', 'CITY', '2100'],
  ['IMERETI', 'Sachkhere', 'Sachkhere', 'საჩხერე', 'TOWN', '1800'],
  ['IMERETI', 'Tkibuli', 'Tkibuli', 'ტყიბული', 'TOWN', '1900'],
  ['IMERETI', 'Vani', 'Vani', 'ვანი', 'TOWN', '4900'],
  ['IMERETI', 'Bagdati', 'Bagdati', 'ბაღდათი', 'TOWN', '4800'],
  ['IMERETI', 'Kharagauli', 'Kharagauli', 'ხარაგაული', 'TOWN', '1700'],
  ['IMERETI', 'Terjola', 'Terjola', 'თერჯოლა', 'TOWN', '2200'],
  ['IMERETI', 'Khoni', 'Khoni', 'ხონი', 'TOWN', '5100'],
  ['KAKHETI', 'Telavi', 'Telavi', 'თელავი', 'CITY', '2200'],
  ['KAKHETI', 'Gurjaani', 'Gurjaani', 'გურჯაანი', 'CITY', '1500'],
  ['KAKHETI', 'Sagarejo', 'Sagarejo', 'საგარეჯო', 'CITY', '0900'],
  ['KAKHETI', 'Kvareli', 'Kvareli', 'ყვარელი', 'TOWN', '0800'],
  ['KAKHETI', 'Lagodekhi', 'Lagodekhi', 'ლაგოდეხი', 'TOWN', '4200'],
  ['KAKHETI', 'Dedoplistskaro', 'Dedoplistskaro', 'დედოფლისწყარო', 'TOWN', '4400'],
  ['KAKHETI', 'Signagi', 'Signagi', 'სიღნაღი', 'TOWN', '4202'],
  ['KAKHETI', 'Akhmeta', 'Akhmeta', 'ახმეტა', 'TOWN', '2400'],
  ['KAKHETI', 'Gurjaani', 'Tsnori', ' წნორი', 'TOWN', '4205'],
  ['KVEMO_KARTLI', 'Rustavi', 'Rustavi', 'რუსთავი', 'CITY', '3700'],
  ['KVEMO_KARTLI', 'Marneuli', 'Marneuli', 'მარნეული', 'CITY', '3000'],
  ['KVEMO_KARTLI', 'Bolnisi', 'Bolnisi', 'ბოლნისი', 'CITY', '3100'],
  ['KVEMO_KARTLI', 'Gardabani', 'Gardabani', 'გარდაბანი', 'CITY', '3800'],
  ['KVEMO_KARTLI', 'Tetritskaro', 'Tetritskaro', 'თეთრიწყარო', 'TOWN', '3300'],
  ['KVEMO_KARTLI', 'Dmanisi', 'Dmanisi', 'დმანისი', 'TOWN', '3200'],
  ['KVEMO_KARTLI', 'Tsalka', 'Tsalka', 'წალკა', 'TOWN', '3400'],
  ['KVEMO_KARTLI', 'Bolnisi', 'Kazreti', 'კაზრეთი', 'TOWN', '3103'],
  ['MTSKHETA_MTIANETI', 'Mtskheta', 'Mtskheta', 'მცხეთა', 'CITY', '3300'],
  ['MTSKHETA_MTIANETI', 'Dusheti', 'Dusheti', 'დუშეთი', 'TOWN', '1800'],
  ['MTSKHETA_MTIANETI', 'Tianeti', 'Tianeti', 'თიანეთი', 'TOWN', '2900'],
  ['MTSKHETA_MTIANETI', 'Kazbegi', 'Stepantsminda', 'სტეფანწმინდა', 'TOWN', '4700'],
  ['MTSKHETA_MTIANETI', 'Dusheti', 'Pasanauri', 'ფასანაური', 'TOWN', '1804'],
  ['RACHA_LECHKHUMI', 'Ambrolauri', 'Ambrolauri', 'ამბროლაური', 'CITY', '5400'],
  ['RACHA_LECHKHUMI', 'Oni', 'Oni', 'ონი', 'TOWN', '5500'],
  ['RACHA_LECHKHUMI', 'Tsageri', 'Tsageri', 'ცაგერი', 'TOWN', '5600'],
  ['RACHA_LECHKHUMI', 'Lentekhi', 'Lentekhi', 'ლენტეხი', 'TOWN', '5700'],
  ['SAMEGRELO', 'Zugdidi', 'Zugdidi', 'ზუგდიდი', 'CITY', '2100'],
  ['SAMEGRELO', 'Poti', 'Poti', 'ფოთი', 'CITY', '4400'],
  ['SAMEGRELO', 'Senaki', 'Senaki', 'სენაკი', 'CITY', '4300'],
  ['SAMEGRELO', 'Martvili', 'Martvili', 'მარტვილი', 'TOWN', '4500'],
  ['SAMEGRELO', 'Khobi', 'Khobi', 'ხობი', 'TOWN', '4200'],
  ['SAMEGRELO', 'Tsalenjikha', 'Tsalenjikha', 'წალენჯიხა', 'TOWN', '4000'],
  ['SAMEGRELO', 'Chkhorotsku', 'Chkhorotsku', 'ჩხოროწყუ', 'TOWN', '4100'],
  ['SAMEGRELO', 'Abasha', 'Abasha', 'აბაშა', 'TOWN', '4600'],
  ['SAMEGRELO', 'Mestia', 'Mestia', 'მესტია', 'TOWN', '5800'],
  ['SAMTSKHE_JAVAKHETI', 'Akhaltsikhe', 'Akhaltsikhe', 'ახალციხე', 'CITY', '0800'],
  ['SAMTSKHE_JAVAKHETI', 'Borjomi', 'Borjomi', 'ბორჯომი', 'CITY', '1200'],
  ['SAMTSKHE_JAVAKHETI', 'Akhalkalaki', 'Akhalkalaki', 'ახალქალაქი', 'CITY', '0700'],
  ['SAMTSKHE_JAVAKHETI', 'Aspindza', 'Aspindza', 'ასპინძა', 'TOWN', '0600'],
  ['SAMTSKHE_JAVAKHETI', 'Adigeni', 'Adigeni', 'ადიგენი', 'TOWN', '0900'],
  ['SAMTSKHE_JAVAKHETI', 'Ninotsminda', 'Ninotsminda', 'ნინოწმინდა', 'TOWN', '0500'],
  ['SAMTSKHE_JAVAKHETI', 'Borjomi', 'Bakuriani', 'ბაკურიანი', 'TOWN', '1202'],
  ['SHIDA_KARTLI', 'Gori', 'Gori', 'გორი', 'CITY', '1400'],
  ['SHIDA_KARTLI', 'Khashuri', 'Khashuri', 'ხაშური', 'CITY', '1600'],
  ['SHIDA_KARTLI', 'Kareli', 'Kareli', 'ქარელი', 'TOWN', '1300'],
  ['SHIDA_KARTLI', 'Kaspi', 'Kaspi', 'კასპი', 'TOWN', '3200'],
  ['SHIDA_KARTLI', 'Gori', 'Tskhinvali', 'ცხინვალი', 'CITY', '1100'],
  ['SHIDA_KARTLI', 'Khashuri', 'Surami', 'სურამი', 'TOWN', '1601'],
  ['ABKHAZIA', 'Sokhumi', 'Sokhumi', 'სოხუმი', 'CITY', '6600'],
  ['ABKHAZIA', 'Gagra', 'Gagra', 'გაგრა', 'CITY', '6700'],
  ['ABKHAZIA', 'Gali', 'Gali', 'გალი', 'TOWN', '6800'],
  ['ABKHAZIA', 'Ochamchire', 'Ochamchire', 'ოჩამჩირე', 'TOWN', '6900'],
  ['ABKHAZIA', 'Gudauta', 'Gudauta', 'გუდაუთა', 'TOWN', '6710'],
  ['ABKHAZIA', 'Tkvarcheli', 'Tkvarcheli', 'ტყვარჩელი', 'TOWN', '6910'],
]

async function main() {
  console.log('Seeding Supabase database…')

  // Companies — upsert by id so re-running is safe.
  for (const c of COMPANIES) {
    await prisma.company.upsert({
      where: { id: c.id },
      update: c,
      create: c,
    })
  }
  console.log(`✓ ${COMPANIES.length} companies`)

  // Users — upsert by email so re-running is safe.
  let userCount = 0
  for (const u of USERS) {
    const passwordHash = await bcrypt.hash(u.password, 10)
    await prisma.user.upsert({
      where: { email: u.username },
      update: {},  // don't reset password on re-run
      create: {
        email: u.username,
        name:  u.name,
        password: passwordHash,
        role: u.role,
        phone: u.phone ?? null,
        companyId: u.companyId ?? null,
      },
    })
    userCount++
  }
  console.log(`✓ ${userCount} users (admin, 2 companies, 2 couriers)`)

  // Tariffs — one row per (company × region). Clear and re-insert so re-runs are clean.
  await prisma.tariff.deleteMany({})
  let tariffCount = 0
  for (const [companyId, rates] of Object.entries(TARIFF_RATES)) {
    for (const [zone, amount] of Object.entries(rates)) {
      await prisma.tariff.create({ data: { companyId, zone, amount } })
      tariffCount++
    }
  }
  console.log(`✓ ${tariffCount} tariff rows (2 companies × 12 regions)`)

  // GeoPlace — clear and re-seed.
  await prisma.geoPlace.deleteMany({})
  await prisma.geoPlace.createMany({
    data: PLACES.map(([regionCode, municipality, name, nameKa, type, postalCode]) => ({
      regionCode, municipality, name, nameKa, type, postalCode,
    })),
  })
  console.log(`✓ ${PLACES.length} GeoPlace rows across 12 Georgian regions`)

  console.log('\nLogin credentials (dev only):')
  console.log('  Admin    — username: kagon    password: Kagon2026!')
  console.log('  Acme     — username: acme     password: Acme2026!')
  console.log('  Peak     — username: peak     password: Peak2026!')
  console.log('  Bob      — username: bob      password: Bob2026!')
  console.log('  Charlie  — username: charlie  password: Charlie2026!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
