import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import Shell from '@/app/components/Shell'
import Pagination from '@/app/components/Pagination'
import { StatusBadge } from '@/app/components/StatusBadge'
import { getT } from '@/lib/i18n-server'
import { tZone, tPackage } from '@/lib/i18n'

const DEFAULT_PAGE_SIZE = 50

// Stable local date formatter — matches the deterministic format used elsewhere
// so there's no hydration mismatch between server and client.
function fmtDate(d: Date | null | undefined): string {
  if (!d) return '—'
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mi = String(d.getUTCMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

export default async function DonePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    courier?: string
    zone?: string
    page?: string
    pageSize?: string
  }>
}) {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')

  const { t, lang } = await getT()
  const sp = await searchParams
  const page = Math.max(1, Number(sp.page) || 1)
  const pageSize = Math.min(250, Math.max(10, Number(sp.pageSize) || DEFAULT_PAGE_SIZE))

  // Build WHERE clause — DELIVERED only, plus the simple admin filters.
  const where = {
    status: 'DELIVERED',
    ...(sp.zone    ? { zone: sp.zone }              : {}),
    ...(sp.courier ? { courierId: sp.courier }      : {}),
    ...(sp.q ? {
      OR: [
        { trackingNumber: { contains: sp.q } },
        { customerName:   { contains: sp.q } },
        { customerPhone:  { contains: sp.q } },
      ],
    } : {}),
  }

  // Time windows for the stats banner.
  const now = new Date()
  const startOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfWeek  = new Date(now); startOfWeek.setDate(now.getDate() - 6) // last 7 days inclusive
  const startOfWeekDay = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate())

  const [
    total,
    deliveredToday,
    deliveredThisWeek,
    rows,
    couriers,
  ] = await Promise.all([
    prisma.delivery.count({ where }),
    prisma.delivery.count({ where: { status: 'DELIVERED', deliveredAt: { gte: startOfDay } } }),
    prisma.delivery.count({ where: { status: 'DELIVERED', deliveredAt: { gte: startOfWeekDay } } }),
    prisma.delivery.findMany({
      where,
      orderBy: { deliveredAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, trackingNumber: true, status: true,
        customerName: true, customerPhone: true, dropoffAddress: true,
        zone: true, packageType: true,
        weightKg: true, sizeCm: true,
        deliveredAt: true, codAmount: true,
        courier: { select: { name: true } },
        company: { select: { name: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: 'COURIER', active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ])

  return (
    <Shell currentPath="/admin/done" title={t('done_title')} subtitle={`${total.toLocaleString()} ${t('done_subtitle')}`}>
      {/* Stats banner */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <StatTile label={t('done_stat_today')}       value={deliveredToday.toLocaleString()}      tone="success" />
        <StatTile label={t('done_stat_this_week')}   value={deliveredThisWeek.toLocaleString()}   tone="success" />
        <StatTile label={t('done_stat_total_match')} value={total.toLocaleString()}               tone="neutral" />
      </div>

      {/* Filter form — search + courier + zone */}
      <form className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] px-5 py-3 mb-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-faint)] mb-1">{t('btn_search')}</label>
          <input
            name="q"
            defaultValue={sp.q ?? ''}
            placeholder={t('label_search_placeholder')}
            className="border border-[var(--color-border-strong)] rounded-xl px-3 py-2 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] w-56"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-faint)] mb-1">{t('label_courier')}</label>
          <select name="courier" defaultValue={sp.courier ?? ''} className="border border-[var(--color-border-strong)] rounded-xl px-3 py-2 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)]">
            <option value="">{t('label_all')}</option>
            {couriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <button type="submit" className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm font-semibold px-4 py-2 rounded-xl h-10">
          {t('btn_filter')}
        </button>
        {(sp.q || sp.courier || sp.zone) && (
          <Link href="/admin/done" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)] border border-[var(--color-border-strong)] rounded-xl px-3 py-2 inline-flex items-center h-10">
            {t('btn_clear')}
          </Link>
        )}
      </form>

      {/* Mobile cards */}
      <div className="md:hidden flex flex-col gap-3">
        {rows.length === 0 ? (
          <div className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] px-6 py-10 text-center">
            <p className="text-sm text-[var(--color-text-muted)]">{t('done_empty')}</p>
          </div>
        ) : rows.map((d) => (
          <div key={d.id} className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <Link href={`/admin/deliveries/${d.id}`} className="font-mono text-xs text-[var(--color-primary)] font-semibold truncate">
                {d.trackingNumber}
              </Link>
              <Link href={`/admin/deliveries/${d.id}`} className="text-xs font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] flex-shrink-0">
                {t('btn_view')} →
              </Link>
            </div>
            <p className="text-base font-semibold text-[var(--color-text-strong)] leading-tight">{d.customerName}</p>
            <p className="text-xs text-[var(--color-text-faint)] mt-0.5">{d.customerPhone}</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-2 leading-snug">{d.dropoffAddress}</p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <StatusBadge status={d.status} lang={lang} />
              <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-card-hover)] rounded-full px-2.5 py-0.5">{tZone(d.zone, lang)}</span>
              <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-card-hover)] rounded-full px-2.5 py-0.5">{tPackage(d.packageType, lang)}</span>
            </div>
            <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-[var(--color-border)] text-xs">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] font-semibold">{t('done_col_delivered')}</p>
                <p className="text-[var(--color-text)] font-mono">{fmtDate(d.deliveredAt)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] font-semibold">{t('label_courier')}</p>
                <p className="text-[var(--color-text)]">{d.courier?.name ?? '—'}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] overflow-x-auto">
        {rows.length === 0 ? (
          <p className="px-6 py-10 text-sm text-[var(--color-text-muted)] text-center">{t('done_empty')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('done_col_tracking')}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('done_col_customer')}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide hidden lg:table-cell">{t('done_col_address')}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide hidden lg:table-cell">{t('done_col_zone')}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide hidden xl:table-cell">{t('done_col_pkg')}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('done_col_courier')}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide whitespace-nowrap">{t('done_col_delivered')}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-card-hover)]">
                  <td className="px-4 py-3 font-mono text-xs text-[var(--color-primary)] font-semibold whitespace-nowrap">{d.trackingNumber}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-[var(--color-text-strong)]">{d.customerName}</p>
                    <p className="text-xs text-[var(--color-text-faint)]">{d.customerPhone}</p>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)] text-xs hidden lg:table-cell max-w-[260px] truncate" title={d.dropoffAddress}>{d.dropoffAddress}</td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)] text-xs hidden lg:table-cell">{tZone(d.zone, lang)}</td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)] text-xs hidden xl:table-cell">{tPackage(d.packageType, lang)}</td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">{d.courier?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-[var(--color-text-faint)] text-xs font-mono whitespace-nowrap">{fmtDate(d.deliveredAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/deliveries/${d.id}`} className="text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] font-medium">{t('btn_view')}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Pagination
        basePath="/admin/done"
        query={sp as Record<string, string | undefined>}
        page={page}
        pageSize={pageSize}
        total={total}
        labels={{
          prev: t('page_prev'),
          next: t('page_next'),
          page: t('page_label'),
          of:   t('page_of'),
          perPage: t('page_per_page'),
          showing: t('page_showing'),
        }}
      />
    </Shell>
  )
}

function StatTile({ label, value, tone }: { label: string; value: string; tone: 'success' | 'neutral' }) {
  const valueClass = tone === 'success'
    ? 'text-green-700 dark:text-green-300'
    : 'text-[var(--color-text-strong)]'
  return (
    <div className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-faint)]">{label}</p>
      <p className={`mt-1 text-2xl md:text-3xl font-bold tabular-nums ${valueClass}`}>{value}</p>
    </div>
  )
}
