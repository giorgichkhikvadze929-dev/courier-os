import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import Shell from '@/app/components/Shell'
import { getT } from '@/lib/i18n-server'
import { tZone } from '@/lib/i18n'
import { money } from '@/lib/format'

/**
 * Per-tariff change history (PRD §4.1 — "tariff change history & log").
 *
 * URL: /admin/tariffs/history?company=<id>&zone=<ZONE>
 * Each row in the Tariff table is a snapshot; the latest by `effective` is the
 * active rate, the older rows are the change log.
 */
export default async function TariffHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; zone?: string }>
}) {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')

  const { t: tr, lang } = await getT()
  const sp = await searchParams
  if (!sp.company || !sp.zone) notFound()

  const [company, history] = await Promise.all([
    prisma.company.findUnique({ where: { id: sp.company }, select: { name: true } }),
    prisma.tariff.findMany({
      where: { companyId: sp.company, zone: sp.zone },
      orderBy: { effective: 'desc' },
    }),
  ])
  if (!company) notFound()

  const fmt = (d: Date) => new Date(d).toLocaleString()

  return (
    <Shell currentPath="/admin/tariffs">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/tariffs" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)]">← {tr('title_tariffs')}</Link>
        <span className="text-[var(--color-text-faint)]">/</span>
        <h1 className="text-lg font-bold text-[var(--color-text-strong)]">
          {company.name} <span className="text-[var(--color-text-muted)] font-normal">— {tZone(sp.zone, lang)}</span>
        </h1>
      </div>

      <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] overflow-hidden">
        <div className="px-6 py-3 border-b border-[var(--color-border)]">
          <p className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide">{tr('tariff_change_log')}</p>
        </div>
        {history.length === 0 ? (
          <p className="px-6 py-5 text-sm text-[var(--color-text-muted)]">{tr('tariff_no_history')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{tr('tariff_effective')}</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{tr('tariff_amount')}</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{tr('tariff_change')}</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{tr('label_note')}</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row, i) => {
                const prev = history[i + 1]
                const diff = prev ? row.amount - prev.amount : null
                return (
                  <tr key={row.id} className={`border-b border-[var(--color-border)] last:border-0 ${i === 0 ? 'bg-green-500/5' : ''}`}>
                    <td className="px-6 py-3 text-[var(--color-text)]">
                      <span className="text-xs text-[var(--color-text-muted)]">{fmt(row.effective)}</span>
                      {i === 0 && <span className="ml-2 text-[10px] font-semibold text-green-600 dark:text-green-400 uppercase">{tr('tariff_current')}</span>}
                    </td>
                    <td className="px-6 py-3 text-right font-mono text-[var(--color-text-strong)]">{money(row.amount)}</td>
                    <td className="px-6 py-3 text-right font-mono text-xs">
                      {diff === null
                        ? <span className="text-[var(--color-text-faint)]">—</span>
                        : diff > 0
                          ? <span className="text-red-600 dark:text-red-400">+{money(diff)}</span>
                          : diff < 0
                            ? <span className="text-green-600 dark:text-green-400">−{money(Math.abs(diff))}</span>
                            : <span className="text-[var(--color-text-faint)]">0.00 ₾</span>}
                    </td>
                    <td className="px-6 py-3 text-sm text-[var(--color-text)]">{row.note ?? <span className="text-[var(--color-text-faint)]">—</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </Shell>
  )
}
