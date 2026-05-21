/**
 * Column mapping: maps various header names to canonical fields.
 * Includes English, Georgian (ქართული), and Russian (русский) aliases so
 * customers can import files in their native language without renaming columns.
 */
const ALIASES: Record<string, string[]> = {
  customerName: [
    'customer name', 'customer', 'recipient', 'recipient name', 'name', 'client',
    // Georgian — recipient
    'მიმღები', 'მიმღების სახელი', 'მიმღების სახელი და გვარი', 'სახელი', 'სახელი და გვარი', 'კლიენტი',
    // Georgian — sender/company (used as customerName when no recipient column exists)
    'კომპანია', 'გამგზავნი', 'მაღაზია',
    // Russian
    'имя', 'фио', 'клиент', 'получатель', 'имя получателя', 'отправитель', 'компания',
  ],
  customerPhone: [
    'phone', 'mobile', 'tel', 'telephone', 'contact', 'customer phone', 'phone number',
    // Georgian
    'ტელეფონი', 'მობილური', 'ნომერი', 'ტელ', 'ტელ.',
    // Russian
    'телефон', 'тел', 'тел.', 'мобильный', 'номер',
  ],
  customerEmail: [
    'email', 'e-mail', 'customer email', 'mail',
    // Georgian
    'მეილი', 'ელ. ფოსტა', 'ელ.ფოსტა', 'ფოსტა',
    // Russian
    'почта', 'эл. почта', 'эл.почта', 'email',
  ],
  dropoffAddress: [
    'address', 'dropoff', 'dropoff address', 'destination', 'to', 'delivery address', 'street',
    // Georgian
    'მისამართი', 'მისამართის ჩაბარების', 'ჩაბარების მისამართი', 'ქუჩა',
    // Russian
    'адрес', 'адрес доставки', 'улица', 'куда',
  ],
  zone: [
    'zone', 'area', 'district', 'region', 'sector',
    // Georgian
    'რეგიონი', 'მხარე', 'ზონა', 'რაიონი', 'უბანი',
    // Russian
    'регион', 'область', 'зона', 'район',
  ],
  codAmount: [
    'cod', 'cod amount', 'cash on delivery', 'amount', 'total', 'price', 'value',
    // Georgian
    'ფასი', 'თანხა', 'ღირებულება', 'ფასი ლარი', 'სულ',
    // Russian
    'цена', 'сумма', 'стоимость', 'цена доставки',
  ],
  notes: [
    'notes', 'note', 'comments', 'remarks', 'instructions',
    // Georgian
    'კომენტარი', 'შენიშვნა', 'შენიშვნები', 'მითითება',
    // Russian
    'комментарий', 'примечание', 'заметки', 'инструкции',
  ],
  packageType: [
    'package type', 'package', 'type', 'parcel type', 'item type',
    // Georgian
    'პაკეტის ტიპი', 'ტიპი', 'ამანათის ტიპი', 'პროდუქტი',
    // Russian
    'тип', 'тип посылки', 'тип товара',
  ],
  priority: [
    'priority', 'urgency', 'level',
    // Georgian
    'პრიორიტეტი', 'სისწრაფე',
    // Russian
    'приоритет', 'срочность',
  ],
  weightKg: [
    'weight', 'weight kg', 'weight (kg)', 'kg', 'kgs', 'mass',
    // Georgian
    'წონა', 'წონა კგ', 'წონა (კგ)', 'კგ',
    // Russian
    'вес', 'вес кг', 'масса',
  ],
  sizeCm: [
    'size', 'size cm', 'size (cm)', 'dimensions', 'dim', 'dimensions cm',
    'l x w x h', 'lxwxh', 'length width height',
    // Georgian
    'ზომა', 'ზომა სმ', 'ზომები', 'სმ',
    // Russian
    'размер', 'размеры', 'размер см', 'габариты',
  ],
  city: [
    'city', 'town', 'municipality', 'settlement', 'locality',
    // Georgian
    'ქალაქი', 'დასახლება', 'მუნიციპალიტეტი', 'სოფელი',
    // Russian
    'город', 'населённый пункт', 'муниципалитет',
  ],
  postalCode: [
    'postal code', 'postalcode', 'postal', 'zip', 'zip code', 'zipcode',
    'index', 'post index', 'postal index',
    // Georgian
    'საფოსტო კოდი', 'საფოსტო ინდექსი', 'ინდექსი', 'საფოსტო',
    // Russian
    'почтовый индекс', 'индекс', 'почтовый код',
  ],
}

const PACKAGE_TYPES = ['SMALL', 'MEDIUM', 'LARGE', 'FRAGILE', 'DOCUMENT']
const PRIORITIES    = ['LOW', 'NORMAL', 'HIGH', 'URGENT']
// The 12 Georgian administrative regions (mkhare). Codes are uppercase ASCII so
// they're safe for URLs / filter dropdowns / SQL queries; human labels live in i18n.
const ZONES         = [
  'TBILISI',
  'ABKHAZIA',
  'ADJARA',
  'GURIA',
  'IMERETI',
  'KAKHETI',
  'KVEMO_KARTLI',
  'MTSKHETA_MTIANETI',
  'RACHA_LECHKHUMI',
  'SAMEGRELO',
  'SAMTSKHE_JAVAKHETI',
  'SHIDA_KARTLI',
]

// Only block import for fields the database literally cannot accept null for.
// `customerName` is also DB-required, but we always auto-fill it (sender column,
// else "—") so it never blocks. Everything else is nullable in the schema.
const REQUIRED_FIELDS = [
  'customerPhone',
  'dropoffAddress',
] as const

/**
 * Georgian city / municipality / district → region (zone enum) lookup.
 * Built from the same canonical list as the GeoPlace seed. Lets us accept
 * real-world Excel files where the "region" column actually holds a city name
 * (e.g. `ხელვაჩაური` → ADJARA + city=Khelvachauri).
 *
 * Keys are lowercased; values are [zoneEnum, canonicalCityName].
 */
const CITY_TO_ZONE: Record<string, [string, string]> = (() => {
  const places: Array<[string, string, string]> = [
    // Tbilisi + districts
    ['TBILISI', 'Tbilisi', 'Tbilisi'], ['TBILISI', 'Tbilisi', 'თბილისი'],
    ['TBILISI', 'Vake', 'Vake'], ['TBILISI', 'Vake', 'ვაკე'],
    ['TBILISI', 'Saburtalo', 'Saburtalo'], ['TBILISI', 'Saburtalo', 'საბურთალო'],
    ['TBILISI', 'Didube', 'Didube'], ['TBILISI', 'Didube', 'დიდუბე'],
    ['TBILISI', 'Gldani', 'Gldani'], ['TBILISI', 'Gldani', 'გლდანი'],
    ['TBILISI', 'Isani', 'Isani'], ['TBILISI', 'Isani', 'ისანი'],
    ['TBILISI', 'Samgori', 'Samgori'], ['TBILISI', 'Samgori', 'სამგორი'],
    ['TBILISI', 'Mtatsminda', 'Mtatsminda'], ['TBILISI', 'Mtatsminda', 'მთაწმინდა'],
    ['TBILISI', 'Krtsanisi', 'Krtsanisi'], ['TBILISI', 'Krtsanisi', 'კრწანისი'],
    ['TBILISI', 'Nadzaladevi', 'Nadzaladevi'], ['TBILISI', 'Nadzaladevi', 'ნაძალადევი'],
    ['TBILISI', 'Chughureti', 'Chughureti'], ['TBILISI', 'Chughureti', 'ჩუღურეთი'],
    // Adjara
    ['ADJARA', 'Batumi', 'Batumi'], ['ADJARA', 'Batumi', 'ბათუმი'],
    ['ADJARA', 'Kobuleti', 'Kobuleti'], ['ADJARA', 'Kobuleti', 'ქობულეთი'],
    ['ADJARA', 'Kobuleti', 'Ochkhamuri'], ['ADJARA', 'Kobuleti', 'ოჩხამური'],
    ['ADJARA', 'Khelvachauri', 'Khelvachauri'], ['ADJARA', 'Khelvachauri', 'ხელვაჩაური'],
    ['ADJARA', 'Keda', 'Keda'], ['ADJARA', 'Keda', 'ქედა'],
    ['ADJARA', 'Shuakhevi', 'Shuakhevi'], ['ADJARA', 'Shuakhevi', 'შუახევი'],
    ['ADJARA', 'Khulo', 'Khulo'], ['ADJARA', 'Khulo', 'ხულო'],
    // Guria
    ['GURIA', 'Ozurgeti', 'Ozurgeti'], ['GURIA', 'Ozurgeti', 'ოზურგეთი'],
    ['GURIA', 'Lanchkhuti', 'Lanchkhuti'], ['GURIA', 'Lanchkhuti', 'ლანჩხუთი'],
    ['GURIA', 'Chokhatauri', 'Chokhatauri'], ['GURIA', 'Chokhatauri', 'ჩოხატაური'],
    ['GURIA', 'Ureki', 'Ureki'], ['GURIA', 'Ureki', 'ურეკი'],
    ['GURIA', 'Supsa', 'Supsa'], ['GURIA', 'Supsa', 'სუფსა'],
    // Imereti
    ['IMERETI', 'Kutaisi', 'Kutaisi'], ['IMERETI', 'Kutaisi', 'ქუთაისი'],
    ['IMERETI', 'Tskaltubo', 'Tskaltubo'], ['IMERETI', 'Tskaltubo', 'წყალტუბო'],
    ['IMERETI', 'Samtredia', 'Samtredia'], ['IMERETI', 'Samtredia', 'სამტრედია'],
    ['IMERETI', 'Zestaponi', 'Zestaponi'], ['IMERETI', 'Zestaponi', 'ზესტაფონი'],
    ['IMERETI', 'Chiatura', 'Chiatura'], ['IMERETI', 'Chiatura', 'ჭიათურა'],
    ['IMERETI', 'Sachkhere', 'Sachkhere'], ['IMERETI', 'Sachkhere', 'საჩხერე'],
    ['IMERETI', 'Tkibuli', 'Tkibuli'], ['IMERETI', 'Tkibuli', 'ტყიბული'],
    ['IMERETI', 'Vani', 'Vani'], ['IMERETI', 'Vani', 'ვანი'],
    ['IMERETI', 'Bagdati', 'Bagdati'], ['IMERETI', 'Bagdati', 'ბაღდათი'],
    ['IMERETI', 'Kharagauli', 'Kharagauli'], ['IMERETI', 'Kharagauli', 'ხარაგაული'],
    ['IMERETI', 'Terjola', 'Terjola'], ['IMERETI', 'Terjola', 'თერჯოლა'],
    ['IMERETI', 'Khoni', 'Khoni'], ['IMERETI', 'Khoni', 'ხონი'],
    // Kakheti
    ['KAKHETI', 'Telavi', 'Telavi'], ['KAKHETI', 'Telavi', 'თელავი'],
    ['KAKHETI', 'Gurjaani', 'Gurjaani'], ['KAKHETI', 'Gurjaani', 'გურჯაანი'],
    ['KAKHETI', 'Sagarejo', 'Sagarejo'], ['KAKHETI', 'Sagarejo', 'საგარეჯო'],
    ['KAKHETI', 'Kvareli', 'Kvareli'], ['KAKHETI', 'Kvareli', 'ყვარელი'],
    ['KAKHETI', 'Lagodekhi', 'Lagodekhi'], ['KAKHETI', 'Lagodekhi', 'ლაგოდეხი'],
    ['KAKHETI', 'Dedoplistskaro', 'Dedoplistskaro'], ['KAKHETI', 'Dedoplistskaro', 'დედოფლისწყარო'],
    ['KAKHETI', 'Signagi', 'Signagi'], ['KAKHETI', 'Signagi', 'სიღნაღი'],
    ['KAKHETI', 'Akhmeta', 'Akhmeta'], ['KAKHETI', 'Akhmeta', 'ახმეტა'],
    ['KAKHETI', 'Tsnori', 'Tsnori'], ['KAKHETI', 'Tsnori', 'წნორი'],
    // Kvemo Kartli
    ['KVEMO_KARTLI', 'Rustavi', 'Rustavi'], ['KVEMO_KARTLI', 'Rustavi', 'რუსთავი'],
    ['KVEMO_KARTLI', 'Marneuli', 'Marneuli'], ['KVEMO_KARTLI', 'Marneuli', 'მარნეული'],
    ['KVEMO_KARTLI', 'Bolnisi', 'Bolnisi'], ['KVEMO_KARTLI', 'Bolnisi', 'ბოლნისი'],
    ['KVEMO_KARTLI', 'Gardabani', 'Gardabani'], ['KVEMO_KARTLI', 'Gardabani', 'გარდაბანი'],
    ['KVEMO_KARTLI', 'Tetritskaro', 'Tetritskaro'], ['KVEMO_KARTLI', 'Tetritskaro', 'თეთრიწყარო'],
    ['KVEMO_KARTLI', 'Dmanisi', 'Dmanisi'], ['KVEMO_KARTLI', 'Dmanisi', 'დმანისი'],
    ['KVEMO_KARTLI', 'Tsalka', 'Tsalka'], ['KVEMO_KARTLI', 'Tsalka', 'წალკა'],
    ['KVEMO_KARTLI', 'Kazreti', 'Kazreti'], ['KVEMO_KARTLI', 'Kazreti', 'კაზრეთი'],
    // Mtskheta-Mtianeti
    ['MTSKHETA_MTIANETI', 'Mtskheta', 'Mtskheta'], ['MTSKHETA_MTIANETI', 'Mtskheta', 'მცხეთა'],
    ['MTSKHETA_MTIANETI', 'Dusheti', 'Dusheti'], ['MTSKHETA_MTIANETI', 'Dusheti', 'დუშეთი'],
    ['MTSKHETA_MTIANETI', 'Tianeti', 'Tianeti'], ['MTSKHETA_MTIANETI', 'Tianeti', 'თიანეთი'],
    ['MTSKHETA_MTIANETI', 'Stepantsminda', 'Stepantsminda'], ['MTSKHETA_MTIANETI', 'Stepantsminda', 'სტეფანწმინდა'],
    ['MTSKHETA_MTIANETI', 'Pasanauri', 'Pasanauri'], ['MTSKHETA_MTIANETI', 'Pasanauri', 'ფასანაური'],
    // Racha-Lechkhumi
    ['RACHA_LECHKHUMI', 'Ambrolauri', 'Ambrolauri'], ['RACHA_LECHKHUMI', 'Ambrolauri', 'ამბროლაური'],
    ['RACHA_LECHKHUMI', 'Oni', 'Oni'], ['RACHA_LECHKHUMI', 'Oni', 'ონი'],
    ['RACHA_LECHKHUMI', 'Tsageri', 'Tsageri'], ['RACHA_LECHKHUMI', 'Tsageri', 'ცაგერი'],
    ['RACHA_LECHKHUMI', 'Lentekhi', 'Lentekhi'], ['RACHA_LECHKHUMI', 'Lentekhi', 'ლენტეხი'],
    // Samegrelo
    ['SAMEGRELO', 'Zugdidi', 'Zugdidi'], ['SAMEGRELO', 'Zugdidi', 'ზუგდიდი'],
    ['SAMEGRELO', 'Poti', 'Poti'], ['SAMEGRELO', 'Poti', 'ფოთი'],
    ['SAMEGRELO', 'Senaki', 'Senaki'], ['SAMEGRELO', 'Senaki', 'სენაკი'],
    ['SAMEGRELO', 'Martvili', 'Martvili'], ['SAMEGRELO', 'Martvili', 'მარტვილი'],
    ['SAMEGRELO', 'Khobi', 'Khobi'], ['SAMEGRELO', 'Khobi', 'ხობი'],
    ['SAMEGRELO', 'Tsalenjikha', 'Tsalenjikha'], ['SAMEGRELO', 'Tsalenjikha', 'წალენჯიხა'],
    ['SAMEGRELO', 'Chkhorotsku', 'Chkhorotsku'], ['SAMEGRELO', 'Chkhorotsku', 'ჩხოროწყუ'],
    ['SAMEGRELO', 'Abasha', 'Abasha'], ['SAMEGRELO', 'Abasha', 'აბაშა'],
    ['SAMEGRELO', 'Mestia', 'Mestia'], ['SAMEGRELO', 'Mestia', 'მესტია'],
    // Samtskhe-Javakheti
    ['SAMTSKHE_JAVAKHETI', 'Akhaltsikhe', 'Akhaltsikhe'], ['SAMTSKHE_JAVAKHETI', 'Akhaltsikhe', 'ახალციხე'],
    ['SAMTSKHE_JAVAKHETI', 'Borjomi', 'Borjomi'], ['SAMTSKHE_JAVAKHETI', 'Borjomi', 'ბორჯომი'],
    ['SAMTSKHE_JAVAKHETI', 'Akhalkalaki', 'Akhalkalaki'], ['SAMTSKHE_JAVAKHETI', 'Akhalkalaki', 'ახალქალაქი'],
    ['SAMTSKHE_JAVAKHETI', 'Aspindza', 'Aspindza'], ['SAMTSKHE_JAVAKHETI', 'Aspindza', 'ასპინძა'],
    ['SAMTSKHE_JAVAKHETI', 'Adigeni', 'Adigeni'], ['SAMTSKHE_JAVAKHETI', 'Adigeni', 'ადიგენი'],
    ['SAMTSKHE_JAVAKHETI', 'Ninotsminda', 'Ninotsminda'], ['SAMTSKHE_JAVAKHETI', 'Ninotsminda', 'ნინოწმინდა'],
    ['SAMTSKHE_JAVAKHETI', 'Bakuriani', 'Bakuriani'], ['SAMTSKHE_JAVAKHETI', 'Bakuriani', 'ბაკურიანი'],
    // Shida Kartli
    ['SHIDA_KARTLI', 'Gori', 'Gori'], ['SHIDA_KARTLI', 'Gori', 'გორი'],
    ['SHIDA_KARTLI', 'Khashuri', 'Khashuri'], ['SHIDA_KARTLI', 'Khashuri', 'ხაშური'],
    ['SHIDA_KARTLI', 'Kareli', 'Kareli'], ['SHIDA_KARTLI', 'Kareli', 'ქარელი'],
    ['SHIDA_KARTLI', 'Kaspi', 'Kaspi'], ['SHIDA_KARTLI', 'Kaspi', 'კასპი'],
    ['SHIDA_KARTLI', 'Tskhinvali', 'Tskhinvali'], ['SHIDA_KARTLI', 'Tskhinvali', 'ცხინვალი'],
    ['SHIDA_KARTLI', 'Surami', 'Surami'], ['SHIDA_KARTLI', 'Surami', 'სურამი'],
    // Abkhazia
    ['ABKHAZIA', 'Sokhumi', 'Sokhumi'], ['ABKHAZIA', 'Sokhumi', 'სოხუმი'],
    ['ABKHAZIA', 'Gagra', 'Gagra'], ['ABKHAZIA', 'Gagra', 'გაგრა'],
    ['ABKHAZIA', 'Gali', 'Gali'], ['ABKHAZIA', 'Gali', 'გალი'],
    ['ABKHAZIA', 'Ochamchire', 'Ochamchire'], ['ABKHAZIA', 'Ochamchire', 'ოჩამჩირე'],
    ['ABKHAZIA', 'Gudauta', 'Gudauta'], ['ABKHAZIA', 'Gudauta', 'გუდაუთა'],
    ['ABKHAZIA', 'Tkvarcheli', 'Tkvarcheli'], ['ABKHAZIA', 'Tkvarcheli', 'ტყვარჩელი'],
  ]
  const out: Record<string, [string, string]> = {}
  for (const [zone, city, alias] of places) {
    out[alias.trim().toLowerCase()] = [zone, city]
  }
  return out
})()

/** Resolve a free-text city/municipality/region value to [zoneEnum, cityName]. */
function resolveZoneAndCity(raw: string): { zone?: string; city?: string } {
  const k = raw.trim().toLowerCase()
  if (!k) return {}
  // Already a zone enum value
  if (ZONES.includes(k.toUpperCase())) return { zone: k.toUpperCase() }
  // Direct city lookup
  const hit = CITY_TO_ZONE[k]
  if (hit) return { zone: hit[0], city: hit[1] }
  // Partial: zone enum prefix (e.g. "kvemo" → KVEMO_KARTLI)
  const zHit = ZONES.find((z) => z.toLowerCase().startsWith(k) || k.startsWith(z.toLowerCase()))
  if (zHit) return { zone: zHit }
  return {}
}

export type CanonicalRow = {
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  dropoffAddress?: string
  zone?: string
  codAmount?: number
  notes?: string
  packageType?: string
  priority?: string
  weightKg?: number
  sizeCm?: string
  city?: string
  postalCode?: string
}

export type ImportRow = {
  rowNumber: number
  raw: Record<string, unknown>
  data: CanonicalRow
  errors: string[]
}

export type ParseResult = {
  headers: string[]
  mapping: Record<string, string>
  rows: ImportRow[]
  totalRows: number
  validRows: number
  errorRows: number
  duplicateRows: number
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ')
}

export function detectMapping(headers: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const raw of headers) {
    const norm = normalizeHeader(raw)
    let matched = ''
    for (const [canonical, aliases] of Object.entries(ALIASES)) {
      if (aliases.includes(norm) || normalizeHeader(canonical) === norm) {
        matched = canonical
        break
      }
    }
    out[raw] = matched
  }
  return out
}

function toStr(v: unknown): string {
  if (v == null) return ''
  return String(v).trim()
}

function toNum(v: unknown): number | undefined {
  if (v == null || v === '') return undefined
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : undefined
}

/**
 * Real-world phone cells often contain multiple numbers separated by /, ;, , or
 * whitespace (e.g. `568777173/598717729`). We take the first as the primary
 * phone; any remaining numbers come back as `extras` so the caller can stash
 * them in `notes` for the courier.
 */
function normalizePhone(v: unknown): { primary: string; extras: string[] } {
  const raw = toStr(v)
  if (!raw) return { primary: '', extras: [] }
  const parts = raw.split(/[\/;,]|\s{2,}/).map((p) => p.replace(/[^\d+]/g, '')).filter(Boolean)
  return { primary: parts[0] ?? '', extras: parts.slice(1) }
}

function normalizeEnum(v: unknown, allowed: string[]): string | undefined {
  const s = toStr(v).toUpperCase()
  if (!s) return undefined
  if (allowed.includes(s)) return s
  const short = s.replace(/\s+/g, '_')
  if (allowed.includes(short)) return short
  const found = allowed.find((a) => a.startsWith(s) || s.startsWith(a))
  return found
}

export function parseRows(rawRows: Record<string, unknown>[]): ParseResult {
  if (rawRows.length === 0) {
    return { headers: [], mapping: {}, rows: [], totalRows: 0, validRows: 0, errorRows: 0, duplicateRows: 0 }
  }

  const headers = Object.keys(rawRows[0] ?? {})
  const mapping = detectMapping(headers)

  const seenPhoneAddress = new Set<string>()
  const rows: ImportRow[] = []
  let validRows = 0
  let errorRows = 0
  let duplicateRows = 0

  rawRows.forEach((raw, idx) => {
    const data: CanonicalRow = {}
    const extraNotes: string[] = []
    for (const [rawHeader, canonical] of Object.entries(mapping)) {
      if (!canonical) continue
      const v = raw[rawHeader]
      switch (canonical) {
        case 'customerName':
        case 'dropoffAddress':
        case 'notes':
        case 'customerEmail':
        case 'city':
          data[canonical] = toStr(v) || undefined
          break
        case 'postalCode':
          data.postalCode = toStr(v).replace(/[^0-9]/g, '') || undefined
          break
        case 'customerPhone': {
          const { primary, extras } = normalizePhone(v)
          data.customerPhone = primary || undefined
          if (extras.length > 0) extraNotes.push(`Alt phone: ${extras.join(', ')}`)
          break
        }
        case 'codAmount':
          data.codAmount = toNum(v)
          break
        case 'weightKg':
          data.weightKg = toNum(v)
          break
        case 'sizeCm':
          data.sizeCm = toStr(v) || undefined
          break
        case 'packageType':
          data.packageType = normalizeEnum(v, PACKAGE_TYPES)
          break
        case 'priority':
          data.priority = normalizeEnum(v, PRIORITIES)
          break
        case 'zone': {
          // Accept either an enum value or a city/municipality name (Georgian
          // or English). City names auto-resolve to their parent region and
          // also populate the `city` field if it wasn't otherwise mapped.
          const resolved = resolveZoneAndCity(toStr(v))
          if (resolved.zone) data.zone = resolved.zone
          if (resolved.city && !data.city) data.city = resolved.city
          break
        }
      }
    }

    // Customer name is required by the DB but routinely absent in real-world
    // courier sheets — fall back to a stable placeholder so the row still imports.
    if (!data.customerName) {
      data.customerName = data.customerPhone ? `—` : 'Unknown'
    }

    // Stash any auxiliary info (e.g. alt phone numbers) into notes for the courier.
    if (extraNotes.length > 0) {
      data.notes = [data.notes, ...extraNotes].filter(Boolean).join(' · ')
    }

    const errors: string[] = []
    for (const field of REQUIRED_FIELDS) {
      if (!data[field]) errors.push(`Missing ${field}`)
    }

    let isDuplicate = false
    if (data.customerPhone && data.dropoffAddress) {
      const key = `${data.customerPhone}::${data.dropoffAddress.toLowerCase()}`
      if (seenPhoneAddress.has(key)) {
        isDuplicate = true
        duplicateRows++
        errors.push('Duplicate row (same phone + address)')
      }
      seenPhoneAddress.add(key)
    }

    if (errors.length > 0) errorRows++
    else if (!isDuplicate) validRows++

    rows.push({ rowNumber: idx + 2, raw, data, errors })
  })

  return { headers, mapping, rows, totalRows: rawRows.length, validRows, errorRows, duplicateRows }
}
