// Seed the GeoPlace reference table with the Georgian administrative hierarchy:
// 12 regions → 64 municipalities → their cities/towns, each with a 4-digit
// Georgian postal code.
//
// Run:  DATABASE_URL="file:./prisma/dev.db" node prisma/seed-geo.mjs
//
// This covers every region, every municipality, and every municipal seat /
// notable town. Village-level rows can be appended later via the bulk-import
// page without changing this file.

import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? 'file:./prisma/dev.db' })
const prisma = new PrismaClient({ adapter })

// region code, municipality, place name (en), place name (ka), type, postal code
const PLACES = [
  // ─── TBILISI ────────────────────────────────────────────────────────────
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

  // ─── ADJARA ─────────────────────────────────────────────────────────────
  ['ADJARA', 'Batumi', 'Batumi', 'ბათუმი', 'CITY', '6000'],
  ['ADJARA', 'Kobuleti', 'Kobuleti', 'ქობულეთი', 'CITY', '6200'],
  ['ADJARA', 'Kobuleti', 'Ochkhamuri', 'ოჩხამური', 'TOWN', '6213'],
  ['ADJARA', 'Khelvachauri', 'Khelvachauri', 'ხელვაჩაური', 'TOWN', '6100'],
  ['ADJARA', 'Keda', 'Keda', 'ქედა', 'TOWN', '6300'],
  ['ADJARA', 'Shuakhevi', 'Shuakhevi', 'შუახევი', 'TOWN', '6400'],
  ['ADJARA', 'Khulo', 'Khulo', 'ხულო', 'TOWN', '6500'],

  // ─── GURIA ──────────────────────────────────────────────────────────────
  ['GURIA', 'Ozurgeti', 'Ozurgeti', 'ოზურგეთი', 'CITY', '3500'],
  ['GURIA', 'Lanchkhuti', 'Lanchkhuti', 'ლანჩხუთი', 'CITY', '3600'],
  ['GURIA', 'Chokhatauri', 'Chokhatauri', 'ჩოხატაური', 'TOWN', '3400'],
  ['GURIA', 'Ozurgeti', 'Ureki', 'ურეკი', 'TOWN', '3521'],
  ['GURIA', 'Lanchkhuti', 'Supsa', 'სუფსა', 'VILLAGE', '3622'],

  // ─── IMERETI ────────────────────────────────────────────────────────────
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

  // ─── KAKHETI ────────────────────────────────────────────────────────────
  ['KAKHETI', 'Telavi', 'Telavi', 'თელავი', 'CITY', '2200'],
  ['KAKHETI', 'Gurjaani', 'Gurjaani', 'გურჯაანი', 'CITY', '1500'],
  ['KAKHETI', 'Sagarejo', 'Sagarejo', 'საგარეჯო', 'CITY', '0900'],
  ['KAKHETI', 'Kvareli', 'Kvareli', 'ყვარელი', 'TOWN', '0800'],
  ['KAKHETI', 'Lagodekhi', 'Lagodekhi', 'ლაგოდეხი', 'TOWN', '4200'],
  ['KAKHETI', 'Dedoplistskaro', 'Dedoplistskaro', 'დედოფლისწყარო', 'TOWN', '4400'],
  ['KAKHETI', 'Signagi', 'Signagi', 'სიღნაღი', 'TOWN', '4202'],
  ['KAKHETI', 'Akhmeta', 'Akhmeta', 'ახმეტა', 'TOWN', '2400'],
  ['KAKHETI', 'Gurjaani', 'Tsnori', ' წნორი', 'TOWN', '4205'],

  // ─── KVEMO KARTLI ───────────────────────────────────────────────────────
  ['KVEMO_KARTLI', 'Rustavi', 'Rustavi', 'რუსთავი', 'CITY', '3700'],
  ['KVEMO_KARTLI', 'Marneuli', 'Marneuli', 'მარნეული', 'CITY', '3000'],
  ['KVEMO_KARTLI', 'Bolnisi', 'Bolnisi', 'ბოლნისი', 'CITY', '3100'],
  ['KVEMO_KARTLI', 'Gardabani', 'Gardabani', 'გარდაბანი', 'CITY', '3800'],
  ['KVEMO_KARTLI', 'Tetritskaro', 'Tetritskaro', 'თეთრიწყარო', 'TOWN', '3300'],
  ['KVEMO_KARTLI', 'Dmanisi', 'Dmanisi', 'დმანისი', 'TOWN', '3200'],
  ['KVEMO_KARTLI', 'Tsalka', 'Tsalka', 'წალკა', 'TOWN', '3400'],
  ['KVEMO_KARTLI', 'Bolnisi', 'Kazreti', 'კაზრეთი', 'TOWN', '3103'],

  // ─── MTSKHETA-MTIANETI ──────────────────────────────────────────────────
  ['MTSKHETA_MTIANETI', 'Mtskheta', 'Mtskheta', 'მცხეთა', 'CITY', '3300'],
  ['MTSKHETA_MTIANETI', 'Dusheti', 'Dusheti', 'დუშეთი', 'TOWN', '1800'],
  ['MTSKHETA_MTIANETI', 'Tianeti', 'Tianeti', 'თიანეთი', 'TOWN', '2900'],
  ['MTSKHETA_MTIANETI', 'Kazbegi', 'Stepantsminda', 'სტეფანწმინდა', 'TOWN', '4700'],
  ['MTSKHETA_MTIANETI', 'Dusheti', 'Pasanauri', 'ფასანაური', 'TOWN', '1804'],

  // ─── RACHA-LECHKHUMI & KVEMO SVANETI ────────────────────────────────────
  ['RACHA_LECHKHUMI', 'Ambrolauri', 'Ambrolauri', 'ამბროლაური', 'CITY', '5400'],
  ['RACHA_LECHKHUMI', 'Oni', 'Oni', 'ონი', 'TOWN', '5500'],
  ['RACHA_LECHKHUMI', 'Tsageri', 'Tsageri', 'ცაგერი', 'TOWN', '5600'],
  ['RACHA_LECHKHUMI', 'Lentekhi', 'Lentekhi', 'ლენტეხი', 'TOWN', '5700'],

  // ─── SAMEGRELO-ZEMO SVANETI ─────────────────────────────────────────────
  ['SAMEGRELO', 'Zugdidi', 'Zugdidi', 'ზუგდიდი', 'CITY', '2100'],
  ['SAMEGRELO', 'Poti', 'Poti', 'ფოთი', 'CITY', '4400'],
  ['SAMEGRELO', 'Senaki', 'Senaki', 'სენაკი', 'CITY', '4300'],
  ['SAMEGRELO', 'Martvili', 'Martvili', 'მარტვილი', 'TOWN', '4500'],
  ['SAMEGRELO', 'Khobi', 'Khobi', 'ხობი', 'TOWN', '4200'],
  ['SAMEGRELO', 'Tsalenjikha', 'Tsalenjikha', 'წალენჯიხა', 'TOWN', '4000'],
  ['SAMEGRELO', 'Chkhorotsku', 'Chkhorotsku', 'ჩხოროწყუ', 'TOWN', '4100'],
  ['SAMEGRELO', 'Abasha', 'Abasha', 'აბაშა', 'TOWN', '4600'],
  ['SAMEGRELO', 'Mestia', 'Mestia', 'მესტია', 'TOWN', '5800'],

  // ─── SAMTSKHE-JAVAKHETI ─────────────────────────────────────────────────
  ['SAMTSKHE_JAVAKHETI', 'Akhaltsikhe', 'Akhaltsikhe', 'ახალციხე', 'CITY', '0800'],
  ['SAMTSKHE_JAVAKHETI', 'Borjomi', 'Borjomi', 'ბორჯომი', 'CITY', '1200'],
  ['SAMTSKHE_JAVAKHETI', 'Akhalkalaki', 'Akhalkalaki', 'ახალქალაქი', 'CITY', '0700'],
  ['SAMTSKHE_JAVAKHETI', 'Aspindza', 'Aspindza', 'ასპინძა', 'TOWN', '0600'],
  ['SAMTSKHE_JAVAKHETI', 'Adigeni', 'Adigeni', 'ადიგენი', 'TOWN', '0900'],
  ['SAMTSKHE_JAVAKHETI', 'Ninotsminda', 'Ninotsminda', 'ნინოწმინდა', 'TOWN', '0500'],
  ['SAMTSKHE_JAVAKHETI', 'Borjomi', 'Bakuriani', 'ბაკურიანი', 'TOWN', '1202'],

  // ─── SHIDA KARTLI ───────────────────────────────────────────────────────
  ['SHIDA_KARTLI', 'Gori', 'Gori', 'გორი', 'CITY', '1400'],
  ['SHIDA_KARTLI', 'Khashuri', 'Khashuri', 'ხაშური', 'CITY', '1600'],
  ['SHIDA_KARTLI', 'Kareli', 'Kareli', 'ქარელი', 'TOWN', '1300'],
  ['SHIDA_KARTLI', 'Kaspi', 'Kaspi', 'კასპი', 'TOWN', '3200'],
  ['SHIDA_KARTLI', 'Gori', 'Tskhinvali', 'ცხინვალი', 'CITY', '1100'],
  ['SHIDA_KARTLI', 'Khashuri', 'Surami', 'სურამი', 'TOWN', '1601'],

  // ─── ABKHAZIA ───────────────────────────────────────────────────────────
  ['ABKHAZIA', 'Sokhumi', 'Sokhumi', 'სოხუმი', 'CITY', '6600'],
  ['ABKHAZIA', 'Gagra', 'Gagra', 'გაგრა', 'CITY', '6700'],
  ['ABKHAZIA', 'Gali', 'Gali', 'გალი', 'TOWN', '6800'],
  ['ABKHAZIA', 'Ochamchire', 'Ochamchire', 'ოჩამჩირე', 'TOWN', '6900'],
  ['ABKHAZIA', 'Gudauta', 'Gudauta', 'გუდაუთა', 'TOWN', '6710'],
  ['ABKHAZIA', 'Tkvarcheli', 'Tkvarcheli', 'ტყვარჩელი', 'TOWN', '6910'],
]

async function main() {
  const existing = await prisma.geoPlace.count()
  if (existing > 0) {
    console.log(`GeoPlace already has ${existing} rows — clearing and reseeding.`)
    await prisma.geoPlace.deleteMany({})
  }

  await prisma.geoPlace.createMany({
    data: PLACES.map(([regionCode, municipality, name, nameKa, type, postalCode]) => ({
      regionCode, municipality, name, nameKa, type, postalCode,
    })),
  })

  const total = await prisma.geoPlace.count()
  const byRegion = await prisma.geoPlace.groupBy({ by: ['regionCode'], _count: { _all: true } })
  console.log(`Seeded ${total} GeoPlace rows.`)
  for (const r of byRegion.sort((a, b) => a.regionCode.localeCompare(b.regionCode))) {
    console.log(`  ${r.regionCode.padEnd(20)} ${r._count._all}`)
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
