import prisma from '@/lib/prisma'
import Link from 'next/link'
import { type Lang, t as translate, type DictKey } from '@/lib/i18n'

/**
 * Per-company reconciliation: how many parcels each active company has uploaded
 * recently vs. how many have actually been received in the warehouse (PRD §4.1
 * — "compare physically arrived parcels against company list").
 *
 * Anything still in RECEIVED state after 24h is considered "expected but not arrived"
 * — surfaced here so the admin can chase up the company about a shortfall.
 */
export default async function ReconciliationPanel({ lang = 'ge' }: { lang?: Lang }) {
  const t = (k: DictKey) => translate(k, lang)

  // 30-day reconciliation window is wide enough to surface stuck batches that
  // never made it to the warehouse, while still excluding ancient archive data.
  const since = new Date()
  since.setDate(since.getDate() - 30)
  // Anything still RECEIVED after 24h is flagged as "expected but not arrived".
  const day = new Date()
  day.setHours(day.getHours() - 24)

  // Pull every active company + the three aggregates we need across all of
  // them in 4 queries total — used to be 5 × N (=685 for 137 companies).
  const [companies, byCompanyStatus, staleByCompany, discrepByCompany] = await Promise.all([
    prisma.company.findMany({
      where:  { active: true },
      select: { id: true, name: true },
    }),
    // count grouped by company × status in the window — covers total /
    // received / warehoused (warehoused = total - received).
    prisma.delivery.groupBy({
      by:     ['companyId', 'status'],
      where:  { companyId: { not: null }, createdAt: { gte: since } },
      _count: { _all: true },
    }),
    // RECEIVED-and-older-than-24h count per company.
    prisma.delivery.groupBy({
      by:     ['companyId'],
      where:  {
        companyId: { not: null },
        status:    'RECEIVED',
        createdAt: { lt: day, gte: since },
      },
      _count: { _all: true },
    }),
    // Anything flagged with a DISCREPANCY problem in the window.
    prisma.delivery.groupBy({
      by:     ['companyId'],
      where:  {
        companyId:    { not: null },
        problemFlag:  { startsWith: 'DISCREPANCY' },
        createdAt:    { gte: since },
      },
      _count: { _all: true },
    }),
  ])

  // Fold the groupBy rows into per-company tallies.
  const tally = new Map<string, { total: number; received: number; stale: number; discrepancies: number }>()
  function bump(id: string | null | undefined): { total: number; received: number; stale: number; discrepancies: number } | null {
    if (!id) return null
    let t = tally.get(id)
    if (!t) { t = { total: 0, received: 0, stale: 0, discrepancies: 0 }; tally.set(id, t) }
    return t
  }
  for (const g of byCompanyStatus) {
    const t = bump(g.companyId); if (!t) continue
    t.total += g._count._all
    if (g.status === 'RECEIVED') t.received += g._count._all
  }
  for (const g of staleByCompany)   { const t = bump(g.companyId); if (t) t.stale         = g._count._all }
  for (const g of discrepByCompany) { const t = bump(g.companyId); if (t) t.discrepancies = g._count._all }

  const stats = companies.map((c) => {
    const t = tally.get(c.id) ?? { total: 0, received: 0, stale: 0, discrepancies: 0 }
    return {
      id:            c.id,
      name:          c.name,
      total:         t.total,
      received:      t.received,
      warehoused:    t.total - t.received,
      stale:         t.stale,
      discrepancies: t.discrepancies,
    }
  })

  const withActivity = stats.filter((s) => s.total > 0)
  if (withActivity.length === 0) return null

  return (
    <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] overflow-hidden mb-4">
      <div className="px-6 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
        <p className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide">{t('reconcile_title')}</p>
        <span className="text-[10px] text-[var(--color-text-muted)]">{t('reconcile_window')}</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)]">
            <th className="text-left px-6 py-2 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('reconcile_company')}</th>
            <th className="text-right px-3 py-2 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('reconcile_uploaded')}</th>
            <th className="text-right px-3 py-2 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('reconcile_arrived')}</th>
            <th className="text-right px-3 py-2 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('reconcile_pending')}</th>
            <th className="text-right px-3 py-2 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('reconcile_stale')}</th>
            <th className="text-right px-3 py-2 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('reconcile_discrepancies')}</th>
          </tr>
        </thead>
        <tbody>
          {withActivity.map((s) => {
            const flag = s.stale > 0 || s.discrepancies > 0
            return (
              <tr key={s.id} className={`border-b border-[var(--color-border)] last:border-0 ${flag ? 'bg-yellow-500/5' : ''}`}>
                <td className="px-6 py-2 font-medium text-[var(--color-text-strong)]">
                  <Link href={`/admin/companies/${s.id}`} className="hover:text-[var(--color-primary)] hover:underline">{s.name}</Link>
                </td>
                <td className="px-3 py-2 text-right font-mono text-[var(--color-text)]">{s.total}</td>
                <td className="px-3 py-2 text-right font-mono text-green-600 dark:text-green-400">{s.warehoused}</td>
                <td className="px-3 py-2 text-right font-mono text-[var(--color-text-muted)]">{s.received}</td>
                <td className={`px-3 py-2 text-right font-mono ${s.stale > 0 ? 'text-yellow-600 dark:text-yellow-400 font-semibold' : 'text-[var(--color-text-faint)]'}`}>
                  {s.stale}
                </td>
                <td className={`px-3 py-2 text-right font-mono ${s.discrepancies > 0 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-[var(--color-text-faint)]'}`}>
                  {s.discrepancies}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="px-6 py-2 border-t border-[var(--color-border)] bg-[var(--color-card-hover)]/40">
        <p className="text-[10px] text-[var(--color-text-muted)]">{t('reconcile_legend')}</p>
      </div>
    </div>
  )
}
