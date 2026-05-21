import { tStatus, tPriority, tZone, type Lang } from '@/lib/i18n'

// 8 PRD statuses
const STATUS_STYLES: Record<string, string> = {
  RECEIVED:     'bg-slate-100 text-slate-700  dark:bg-slate-500/20  dark:text-slate-300',
  IN_WAREHOUSE: 'bg-cyan-100  text-cyan-700   dark:bg-cyan-500/20   dark:text-cyan-300',
  ASSIGNED:     'bg-blue-100  text-blue-700   dark:bg-blue-500/20   dark:text-blue-300',
  IN_TRANSIT:   'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
  DELIVERED:    'bg-green-100 text-green-700  dark:bg-green-500/20  dark:text-green-300',
  FAILED:       'bg-red-100   text-red-700    dark:bg-red-500/20    dark:text-red-300',
  REFUSED:      'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300',
  RETURNED:     'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300',
}

const STATUS_DOT: Record<string, string> = {
  RECEIVED:     'bg-slate-400',
  IN_WAREHOUSE: 'bg-cyan-500',
  ASSIGNED:     'bg-blue-500',
  IN_TRANSIT:   'bg-orange-500',
  DELIVERED:    'bg-green-500',
  FAILED:       'bg-red-500',
  REFUSED:      'bg-purple-500',
  RETURNED:     'bg-yellow-500',
}

const PRIORITY_STYLES: Record<string, string> = {
  LOW:    'bg-slate-100 text-slate-600  dark:bg-slate-500/15  dark:text-slate-400',
  NORMAL: 'bg-blue-50   text-blue-600   dark:bg-blue-500/15   dark:text-blue-300',
  HIGH:   'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
  URGENT: 'bg-red-100   text-red-700    dark:bg-red-500/20    dark:text-red-300',
}

const FALLBACK = 'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400'

export function StatusBadge({ status, lang = 'ge' }: { status: string; lang?: Lang }) {
  const cls = STATUS_STYLES[status] ?? FALLBACK
  const dot = STATUS_DOT[status] ?? 'bg-slate-400'
  const label = tStatus(status, lang)
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  )
}

export function PriorityBadge({ priority, lang = 'ge' }: { priority: string; lang?: Lang }) {
  return (
    <span className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-full ${PRIORITY_STYLES[priority] ?? FALLBACK}`}>
      {tPriority(priority, lang)}
    </span>
  )
}

// Reusable enums for option lists
export const ALL_STATUSES = [
  'RECEIVED', 'IN_WAREHOUSE', 'ASSIGNED', 'IN_TRANSIT',
  'DELIVERED', 'FAILED', 'REFUSED', 'RETURNED',
] as const

export const PROBLEM_STATUSES = ['FAILED', 'REFUSED', 'RETURNED'] as const

// The 12 Georgian administrative regions (mkhare). Order matches a roughly
// north→south, east→west sweep so dropdowns are scannable.
export const ZONES = [
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
] as const

/** Plain map for English fallback (used in PDF/Excel exports where we don't have a session lang) */
export const ZONE_LABEL: Record<string, string> = {
  TBILISI:            'Tbilisi',
  ABKHAZIA:           'Abkhazia',
  ADJARA:             'Adjara',
  GURIA:              'Guria',
  IMERETI:            'Imereti',
  KAKHETI:            'Kakheti',
  KVEMO_KARTLI:       'Kvemo Kartli',
  MTSKHETA_MTIANETI:  'Mtskheta-Mtianeti',
  RACHA_LECHKHUMI:    'Racha-Lechkhumi & Kvemo Svaneti',
  SAMEGRELO:          'Samegrelo-Zemo Svaneti',
  SAMTSKHE_JAVAKHETI: 'Samtskhe-Javakheti',
  SHIDA_KARTLI:       'Shida Kartli',
}

/** Server-side aware zone label (use in pages with `await getLang()`) */
export function zoneLabel(zone: string | null | undefined, lang: Lang): string {
  return tZone(zone, lang)
}
