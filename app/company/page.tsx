import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import Shell from '@/app/components/Shell'
import { StatusBadge, ZONES } from '@/app/components/StatusBadge'
import { tariffMatrix } from '@/lib/tariff'
import { getT } from '@/lib/i18n-server'
import { tZone } from '@/lib/i18n'

export default async function CompanyPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const role = session.user?.role as string
  if (!['COMPANY', 'ADMIN'].includes(role)) redirect('/login')

  const { t, lang } = await getT()

  const companyId = (session.user as { companyId?: string | null }).companyId
  if (!companyId && role !== 'ADMIN') {
    return (
      <Shell currentPath="/company">
        <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-8 text-center">
          <h1 className="text-xl font-bold text-[var(--color-text-strong)] mb-2">{t('label_company')}</h1>
          <p className="text-sm text-[var(--color-text-muted)]">No company linked to your account.</p>
        </div>
      </Shell>
    )
  }

  const startOfDay = new Date(new Date().setHours(0, 0, 0, 0))
  const startOf7 = new Date(Date.now() - 7 * 24 * 3600_000)

  const where = companyId ? { companyId } : {}

  const [
    total, received, inWarehouse, assigned, inTransit, deliveredToday, problems7d, recent, tariffs,
  ] = await Promise.all([
    prisma.delivery.count({ where }),
    prisma.delivery.count({ where: { ...where, status: 'RECEIVED' } }),
    prisma.delivery.count({ where: { ...where, status: 'IN_WAREHOUSE' } }),
    prisma.delivery.count({ where: { ...where, status: 'ASSIGNED' } }),
    prisma.delivery.count({ where: { ...where, status: 'IN_TRANSIT' } }),
    prisma.delivery.count({ where: { ...where, status: 'DELIVERED', deliveredAt: { gte: startOfDay } } }),
    prisma.delivery.count({ where: { ...where, status: { in: ['FAILED', 'REFUSED', 'RETURNED'] }, updatedAt: { gte: startOf7 } } }),
    prisma.delivery.findMany({ where, orderBy: { createdAt: 'desc' }, take: 8 }),
    companyId ? tariffMatrix(companyId) : Promise.resolve({} as Record<string, number>),
  ])

  const stats = [
    { label: t('label_total_parcels'),   value: total,           color: 'text-[var(--color-text-strong)]' },
    { label: t('label_received'),        value: received,        color: 'text-slate-500 dark:text-slate-300' },
    { label: t('label_in_warehouse'),    value: inWarehouse,     color: 'text-cyan-600 dark:text-cyan-400' },
    { label: t('label_assigned'),        value: assigned,        color: 'text-blue-600 dark:text-blue-400' },
    { label: t('label_in_transit'),      value: inTransit,       color: 'text-orange-600 dark:text-orange-400' },
    { label: t('label_delivered_today'), value: deliveredToday,  color: 'text-green-600 dark:text-green-400' },
    { label: t('label_problems_7d'),     value: problems7d,      color: 'text-red-600 dark:text-red-400' },
  ]

  return (
    <Shell currentPath="/company" title={t('title_company_dashboard')} subtitle={`${t('welcome_back')} ${session.user?.name}`}>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] px-5 py-4">
            <p className="text-xs font-medium text-[var(--color-text-muted)]">{s.label}</p>
            <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
        <div className="lg:col-span-2 bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] overflow-hidden">
          <div className="px-6 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
            <p className="text-sm font-semibold text-[var(--color-text)]">{t('recent_deliveries')}</p>
            <Link href="/company/parcels" className="text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]">{t('btn_view_all')} →</Link>
          </div>
          {recent.length === 0 ? (
            <p className="px-6 py-5 text-sm text-[var(--color-text-muted)]">{t('no_parcels')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('label_tracking')}</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('label_customer')}</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('label_status')}</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((d) => (
                  <tr key={d.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-card-hover)]">
                    <td className="px-6 py-3 font-mono text-xs text-[var(--color-primary)] font-semibold">
                      <Link href={`/company/parcels/${d.id}`}>{d.trackingNumber}</Link>
                    </td>
                    <td className="px-6 py-3 text-[var(--color-text-strong)]">{d.customerName}</td>
                    <td className="px-6 py-3"><StatusBadge status={d.status} lang={lang} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-5">
            <p className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide mb-3">{t('my_tariffs')}</p>
            <dl className="text-sm space-y-1.5">
              {ZONES.map((z) => (
                <div key={z} className="flex justify-between">
                  <dt className="text-[var(--color-text-muted)]">{tZone(z, lang)}</dt>
                  <dd className="font-semibold text-[var(--color-text-strong)]">{tariffs[z] != null ? `$${tariffs[z].toFixed(2)}` : '—'}</dd>
                </div>
              ))}
            </dl>
          </div>

          <Link href="/company/import" className="block bg-[var(--color-primary)] text-white rounded-2xl px-5 py-4 hover:bg-[var(--color-primary-hover)] transition-colors">
            <p className="font-semibold">{t('upload_excel_csv_title')}</p>
            <p className="text-xs opacity-90 mt-0.5">{t('upload_excel_csv_hint')}</p>
          </Link>

          <Link href="/company/export" className="block bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl px-5 py-4 hover:border-[var(--color-border-strong)] transition-colors">
            <p className="font-semibold text-[var(--color-text-strong)]">{t('export_deliveries')}</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{t('export_deliveries_hint')}</p>
          </Link>
        </div>
      </div>
    </Shell>
  )
}
