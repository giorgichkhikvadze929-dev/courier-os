import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import Shell from '@/app/components/Shell'
import { StatusBadge } from '@/app/components/StatusBadge'
import { IconUpload, IconPlus, IconSearch, IconChart, IconBuilding, IconCash } from '@/app/components/Icons'
import { getT } from '@/lib/i18n-server'

export default async function AdminPage() {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')

  const { t, lang } = await getT()
  const startOfDay = new Date(new Date().setHours(0, 0, 0, 0))

  const [
    deliveryCount, receivedCount, inWarehouseCount, inTransitCount,
    deliveredToday, problemCount, courierCount, companyCount,
    recentDeliveries, workloadGroups, couriers,
  ] = await Promise.all([
    prisma.delivery.count(),
    prisma.delivery.count({ where: { status: 'RECEIVED' } }),
    prisma.delivery.count({ where: { status: 'IN_WAREHOUSE' } }),
    prisma.delivery.count({ where: { status: { in: ['ASSIGNED', 'IN_TRANSIT'] } } }),
    prisma.delivery.count({ where: { status: 'DELIVERED', deliveredAt: { gte: startOfDay } } }),
    prisma.delivery.count({ where: { status: { in: ['FAILED', 'REFUSED', 'RETURNED'] } } }),
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
    }),
    prisma.user.findMany({ where: { role: 'COURIER', active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ])

  const workloadByCourier: Record<string, number> = {}
  for (const g of workloadGroups) if (g.courierId) workloadByCourier[g.courierId] = g._count._all
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
        <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">{t('workload_title')}</h2>
        <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-5">
          {couriers.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">{t('workload_no_couriers')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {couriers.map((c) => {
                const load = workloadByCourier[c.id] ?? 0
                const pct = Math.round((load / maxLoad) * 100)
                return (
                  <li key={c.id} className="flex items-center gap-3">
                    <span className="text-sm text-[var(--color-text)] w-40 truncate">{c.name}</span>
                    <div className="flex-1 h-2 bg-[var(--color-card-hover)] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${load === 0 ? 'bg-[var(--color-border-strong)]' : 'bg-[var(--color-primary)]'}`} style={{ width: `${load === 0 ? 0 : Math.max(8, pct)}%` }} />
                    </div>
                    <span className="text-xs font-mono text-[var(--color-text-muted)] w-10 text-right">{load}</span>
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
        <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] overflow-hidden">
          {recentDeliveries.length === 0 ? (
            <p className="px-6 py-5 text-sm text-[var(--color-text-muted)]">{t('no_deliveries')}</p>
          ) : (
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
          )}
        </div>
      </div>
    </Shell>
  )
}
