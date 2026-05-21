import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import Shell from '@/app/components/Shell'
import { ZONES } from '@/app/components/StatusBadge'
import { upsertTariff } from './actions'
import { getT } from '@/lib/i18n-server'
import { tZone } from '@/lib/i18n'

export default async function TariffsPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>
}) {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')

  const { t: tr, lang } = await getT()
  const sp = await searchParams
  const companies = await prisma.company.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  })

  // Latest active tariff per (company, zone)
  const allTariffs = await prisma.tariff.findMany({
    orderBy: { effective: 'desc' },
  })
  const latest = new Map<string, { amount: number; effective: Date; note: string | null }>()
  for (const t of allTariffs) {
    const key = `${t.companyId}::${t.zone}`
    if (!latest.has(key)) latest.set(key, { amount: t.amount, effective: t.effective, note: t.note })
  }

  const focusedCompany = sp.company && companies.some((c) => c.id === sp.company)
    ? companies.find((c) => c.id === sp.company)!
    : null

  return (
    <Shell currentPath="/admin/tariffs" title={tr('title_tariffs')} subtitle={tr('title_tariffs_subtitle')}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-6">
          <p className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide mb-3">{tr('tariffs_set')}</p>
          <form action={upsertTariff} className="flex flex-col gap-3">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">{tr('label_company')}</label>
              <select name="companyId" required defaultValue={focusedCompany?.id ?? ''} className="w-full border border-[var(--color-border-strong)] rounded-xl px-3 py-2 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
                <option value="">{tr('label_pick_company')}</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">{tr('label_zone')}</label>
              <select name="zone" required className="w-full border border-[var(--color-border-strong)] rounded-xl px-3 py-2 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
                {ZONES.map((z) => <option key={z} value={z}>{tZone(z, lang)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">{tr('label_amount')} ($)</label>
              <input name="amount" type="number" step="0.01" min="0" required className="w-full border border-[var(--color-border-strong)] rounded-xl px-3 py-2 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">{tr('label_note')} <span className="text-[var(--color-text-faint)] font-normal">{tr('label_optional')}</span></label>
              <input name="note" className="w-full border border-[var(--color-border-strong)] rounded-xl px-3 py-2 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
            </div>
            <button type="submit" className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-semibold rounded-xl py-2 text-sm transition-colors">
              {tr('btn_save')}
            </button>
            <p className="text-xs text-[var(--color-text-faint)]">{tr('tariffs_history_hint')}</p>
          </form>
        </div>

        <div className="lg:col-span-2 bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] overflow-hidden">
          <div className="px-6 py-3 border-b border-[var(--color-border)]">
            <p className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide">{tr('tariffs_active')}</p>
          </div>
          {companies.length === 0 ? (
            <p className="px-6 py-5 text-sm text-[var(--color-text-muted)]">{tr('workload_no_couriers')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{tr('label_company')}</th>
                  {ZONES.map((z) => (
                    <th key={z} className="text-right px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{tZone(z, lang)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-card-hover)]">
                    <td className="px-6 py-3 font-medium text-[var(--color-text-strong)]">{c.name}</td>
                    {ZONES.map((z) => {
                      const row = latest.get(`${c.id}::${z}`)
                      return (
                        <td key={z} className="px-6 py-3 text-right font-mono">
                          {row ? (
                            <Link
                              href={`/admin/tariffs/history?company=${c.id}&zone=${z}`}
                              className="text-[var(--color-text-strong)] hover:text-[var(--color-primary)] hover:underline"
                              title={tr('tariff_view_history')}
                            >
                              ${row.amount.toFixed(2)}
                            </Link>
                          ) : <span className="text-[var(--color-text-faint)]">—</span>}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Shell>
  )
}
