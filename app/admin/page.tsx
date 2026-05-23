import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import Shell from '@/app/components/Shell'
import { StatusBadge } from '@/app/components/StatusBadge'
import { IconUpload, IconPlus, IconSearch, IconChart, IconBuilding, IconCash } from '@/app/components/Icons'
import { getT } from '@/lib/i18n-server'
import { money } from '@/lib/format'

export default async function AdminPage() {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')

  const { t, lang } = await getT()
  const startOfDay = new Date(new Date().setHours(0, 0, 0, 0))

  // Roll the 11 status-and-money queries into 2 groupBy queries — one giving
  // count + sum per status across all deliveries, and one giving count + sum
  // per status for "delivered today" only. Cuts dashboard DB round-trips from
  // ~14 to ~6.
  const [
    statusGroups,          // count + sum(codAmount) grouped by status
    deliveredTodayAgg,     // count + sum(codAmount) for delivered today
    courierCount, companyCount,
    recentDeliveries,
    courierLoadGroups,     // active workload + carrying money per courier
    couriers,
  ] = await Promise.all([
    prisma.delivery.groupBy({
      by: ['status'],
      _count: { _all: true },
      _sum:   { codAmount: true },
    }),
    prisma.delivery.aggregate({
      where:  { status: 'DELIVERED', deliveredAt: { gte: startOfDay } },
      _count: { _all: true },
      _sum:   { codAmount: true },
    }),
    prisma.user.count({ where: { role: 'COURIER', active: true } }),
    prisma.company.count({ where: { active: true } }),
    prisma.delivery.findMany({
      take: 8, orderBy: { createdAt: 'desc' },
      include: { courier: { select: { name: true } }, company: { select: { name: true } } },
    }),
    prisma.delivery.groupBy({
      by: ['courierId'],
      where: { courierId: { not: null }, status: { in: ['ASSIGNED', 'IN_TRANSIT'] } },
      _count: { _all: true },
      _sum:   { codAmount: true },
    }),
    prisma.user.findMany({ where: { role: 'COURIER', active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ])

  // Unpack the status group into the named buckets the UI needs.
  const byStatus = new Map(statusGroups.map((g) => [g.status, g]))
  const countOf = (st: string) => byStatus.get(st)?._count._all ?? 0
  const sumOf   = (st: string) => byStatus.get(st)?._sum.codAmount ?? 0

  const deliveryCount    = statusGroups.reduce((s, g) => s + g._count._all, 0)
  const receivedCount    = countOf('RECEIVED')
  const inWarehouseCount = countOf('IN_WAREHOUSE')
  const inTransitCount   = countOf('ASSIGNED') + countOf('IN_TRANSIT')
  const problemCount     = countOf('FAILED') + countOf('REFUSED') + countOf('RETURNED')
  const deliveredToday   = deliveredTodayAgg._count._all

  const moneyInWarehouse    = sumOf('IN_WAREHOUSE')
  const moneyInTransit      = sumOf('ASSIGNED') + sumOf('IN_TRANSIT')
  const moneyDeliveredToday = deliveredTodayAgg._sum.codAmount ?? 0

  const workloadByCourier: Record<string, number> = {}
  const moneyByCourier:    Record<string, number> = {}
  for (const g of courierLoadGroups) {
    if (!g.courierId) continue
    workloadByCourier[g.courierId] = g._count._all
    moneyByCourier[g.courierId]    = g._sum.codAmount ?? 0
  }
  const maxLoad = Math.max(1, ...Object.values(workloadByCourier))

  const stats = [
    { label: t('label_total_deliveries'), value: deliveryCount,    color: 'text-[var(--color-text-strong)]' },
    { label: t('label_received'),         value: receivedCount,    color: 'text-slate-500 dark:text-slate-300' },
    { label: t('label_in_warehouse'),     value: inWarehouseCount, color: 'text-cyan-600 dark:text-cyan-400' },
    { label: t('label_in_transit'),       value: inTransitCount,   color: 'text-orange-600 dark:text-orange-400' },
    { label: t('label_delivered_today'),  value: deliveredToday,   color: 'text-green-600 dark:text-green-400' },
    { label: t('label_problems'),         value: problemCount,     color: 'text-red-600 dark:text-red-400' },
    { label: t('label_active_couriers'),  value: courierCount,     color: 'text-blue-600 dark:text-blue-400' },
    { label: t('label_active_companies'), value: companyCount,     color: 'text-purple-600 dark:text-purple-400' },
  ]

  return (
    <Shell currentPath="/admin">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-strong)]">{t('title_admin_dashboard')}</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">{t('welcome_back')} {session.user?.name}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        {stats.map((s) => (
          <div key={s.label} className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] px-5 py-4">
            <p className="text-xs font-medium text-[var(--color-text-muted)]">{s.label}</p>
            <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Link href="/admin/import"      className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-xl px-4 py-3 text-sm font-semibold inline-flex items-center gap-2 transition-colors"><IconUpload /> {t('nav_import')}</Link>
        <Link href="/admin/verify"      className="bg-[var(--color-card)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)] text-[var(--color-text)] rounded-xl px-4 py-3 text-sm font-semibold inline-flex items-center gap-2 transition-colors"><IconPlus /> {t('nav_verify')}</Link>
        <Link href="/admin/deliveries"  className="bg-[var(--color-card)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)] text-[var(--color-text)] rounded-xl px-4 py-3 text-sm font-semibold inline-flex items-center gap-2 transition-colors"><IconSearch /> {t('btn_search')}</Link>
        <Link href="/admin/companies"   className="bg-[var(--color-card)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)] text-[var(--color-text)] rounded-xl px-4 py-3 text-sm font-semibold inline-flex items-center gap-2 transition-colors"><IconBuilding /> {t('nav_companies')}</Link>
        <Link href="/admin/tariffs"     className="bg-[var(--color-card)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)] text-[var(--color-text)] rounded-xl px-4 py-3 text-sm font-semibold inline-flex items-center gap-2 transition-colors"><IconCash /> {t('nav_tariffs')}</Link>
        <Link href="/admin/audit"       className="bg-[var(--color-card)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)] text-[var(--color-text)] rounded-xl px-4 py-3 text-sm font-semibold inline-flex items-center gap-2 transition-colors"><IconChart /> {t('nav_audit')}</Link>
      </div>

      <div className="mt-6">
        <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">{t('money_flow_title')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] px-5 py-4">
            <p className="text-xs font-medium text-[var(--color-text-muted)]">{t('money_in_warehouse')}</p>
            <p className="text-2xl font-bold mt-1 text-cyan-600 dark:text-cyan-400 font-mono">{money(moneyInWarehouse)}</p>
          </div>
          <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] px-5 py-4">
            <p className="text-xs font-medium text-[var(--color-text-muted)]">{t('money_in_transit')}</p>
            <p className="text-2xl font-bold mt-1 text-orange-600 dark:text-orange-400 font-mono">{money(moneyInTransit)}</p>
          </div>
          <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] px-5 py-4">
            <p className="text-xs font-medium text-[var(--color-text-muted)]">{t('money_delivered_today')}</p>
            <p className="text-2xl font-bold mt-1 text-green-600 dark:text-green-400 font-mono">{money(moneyDeliveredToday)}</p>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">{t('workload_title')}</h2>
        <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-5">
          {couriers.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">{t('workload_no_couriers')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {couriers.map((c) => {
                const load = workloadByCourier[c.id] ?? 0
                const carried = moneyByCourier[c.id] ?? 0
                const pct = Math.round((load / maxLoad) * 100)
                return (
                  <li key={c.id} className="flex items-center gap-3">
                    <span className="text-sm text-[var(--color-text)] w-40 truncate">{c.name}</span>
                    <div className="flex-1 h-2 bg-[var(--color-card-hover)] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${load === 0 ? 'bg-[var(--color-border-strong)]' : 'bg-[var(--color-primary)]'}`} style={{ width: `${load === 0 ? 0 : Math.max(8, pct)}%` }} />
                    </div>
                    <span className="text-xs font-mono text-[var(--color-text-muted)] w-10 text-right">{load}</span>
                    <span className="text-xs font-mono text-[var(--color-text-strong)] w-28 text-right hidden sm:inline">{carried > 0 ? money(carried) : ''}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('recent_deliveries')}</h2>
          <Link href="/admin/deliveries" className="text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]">{t('btn_view_all')} →</Link>
        </div>

        {recentDeliveries.length === 0 ? (
          <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] overflow-hidden">
            <p className="px-6 py-5 text-sm text-[var(--color-text-muted)]">{t('no_deliveries')}</p>
          </div>
        ) : (
          <>
            {/* Mobile/tablet cards — no truncation, every row fully visible */}
            <div className="lg:hidden flex flex-col gap-2">
              {recentDeliveries.map((d) => (
                <Link key={d.id} href={`/admin/deliveries/${d.id}`} className="block bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] hover:border-[var(--color-border-strong)] transition-colors p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs text-[var(--color-primary)] font-semibold truncate">{d.trackingNumber}</p>
                      <p className="text-sm font-medium text-[var(--color-text-strong)] mt-0.5 truncate">{d.customerName}</p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-1 truncate">
                        {d.company?.name ?? '—'}{d.courier?.name ? ` · ${d.courier.name}` : ''}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <StatusBadge status={d.status} lang={lang} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden lg:block bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('label_tracking')}</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('label_customer')}</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('label_status')}</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide hidden md:table-cell">{t('label_company')}</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide hidden md:table-cell">{t('label_courier')}</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide hidden lg:table-cell">{t('label_dropoff')}</th>
                </tr>
              </thead>
              <tbody>
                {recentDeliveries.map((d) => (
                  <tr key={d.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-card-hover)]">
                    <td className="px-6 py-3">
                      <Link href={`/admin/deliveries/${d.id}`} className="font-mono text-xs text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] font-semibold">{d.trackingNumber}</Link>
                    </td>
                    <td className="px-6 py-3 text-[var(--color-text-strong)] font-medium">{d.customerName}</td>
                    <td className="px-6 py-3"><StatusBadge status={d.status} lang={lang} /></td>
                    <td className="px-6 py-3 text-[var(--color-text-muted)] hidden md:table-cell">{d.company?.name ?? '—'}</td>
                    <td className="px-6 py-3 text-[var(--color-text-muted)] hidden md:table-cell">{d.courier?.name ?? '—'}</td>
                    <td className="px-6 py-3 text-[var(--color-text-muted)] text-xs hidden lg:table-cell truncate max-w-[200px]">{d.dropoffAddress}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </>
        )}
      </div>
    </Shell>
  )
}
