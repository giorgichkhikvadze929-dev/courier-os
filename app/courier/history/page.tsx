import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import Shell from '@/app/components/Shell'
import { StatusBadge } from '@/app/components/StatusBadge'
import { tStatus, tZone } from '@/lib/i18n'
import { getT } from '@/lib/i18n-server'
import FilterPanel from '@/app/components/FilterPanel'
import Pagination from '@/app/components/Pagination'

const DEFAULT_PAGE_SIZE = 20

export default async function CourierHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string; pageSize?: string }>
}) {
  const session = await auth()
  if (!session || !['COURIER', 'ADMIN'].includes(session.user?.role as string)) redirect('/login')

  const { t, lang } = await getT()
  const courierId = (session.user as { id?: string }).id
  const sp = await searchParams
  const { status, q } = sp
  const page = Math.max(1, Number(sp.page) || 1)
  const pageSize = Math.min(250, Math.max(5, Number(sp.pageSize) || DEFAULT_PAGE_SIZE))

  const FINAL_STATUSES = ['DELIVERED', 'FAILED', 'REFUSED', 'RETURNED'] as const

  const where = {
    courierId,
    status: status && FINAL_STATUSES.includes(status as typeof FINAL_STATUSES[number])
      ? status
      : { in: [...FINAL_STATUSES] },
    ...(q ? {
      OR: [
        { trackingNumber: { contains: q } },
        { customerName: { contains: q } },
        { customerPhone: { contains: q } },
      ],
    } : {}),
  }

  const [total, deliveries, totals] = await Promise.all([
    prisma.delivery.count({ where }),
    prisma.delivery.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.delivery.groupBy({
      by: ['status'],
      where: { courierId, status: { in: [...FINAL_STATUSES] } },
      _count: { _all: true },
    }),
  ])

  const counts: Record<string, number> = { DELIVERED: 0, FAILED: 0, REFUSED: 0, RETURNED: 0 }
  for (const tt of totals) counts[tt.status] = tt._count._all

  const fmt = (d: Date | null) => d ? new Date(d).toLocaleDateString() : '—'

  return (
    <Shell currentPath="/courier/history" title={t('title_courier_history')} subtitle={t('title_courier_history_sub')}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] px-5 py-4">
          <p className="text-xs font-medium text-[var(--color-text-muted)]">{tStatus('DELIVERED', lang)}</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-0.5">{counts.DELIVERED}</p>
        </div>
        <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] px-5 py-4">
          <p className="text-xs font-medium text-[var(--color-text-muted)]">{tStatus('FAILED', lang)}</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-0.5">{counts.FAILED}</p>
        </div>
        <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] px-5 py-4">
          <p className="text-xs font-medium text-[var(--color-text-muted)]">{tStatus('REFUSED', lang)}</p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-0.5">{counts.REFUSED}</p>
        </div>
        <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] px-5 py-4">
          <p className="text-xs font-medium text-[var(--color-text-muted)]">{tStatus('RETURNED', lang)}</p>
          <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-0.5">{counts.RETURNED}</p>
        </div>
      </div>

      <FilterPanel
        activeCount={[q, status].filter(Boolean).length}
        labels={{ filters: t('filters_title'), show: t('filters_show'), hide: t('filters_hide'), active: t('filters_active') }}
      >
        <form className="flex flex-wrap gap-2">
          <input type="hidden" name="page" value="1" />
          <input type="hidden" name="pageSize" value={String(pageSize)} />
          <input
            name="q"
            defaultValue={q ?? ''}
            placeholder={t('label_search_placeholder')}
            className="border border-[var(--color-border-strong)] rounded-xl px-4 py-2 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] w-56"
          />
          <select name="status" defaultValue={status ?? ''} className="border border-[var(--color-border-strong)] rounded-xl px-4 py-2 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
            <option value="">{t('label_all')}</option>
            {FINAL_STATUSES.map((s) => <option key={s} value={s}>{tStatus(s, lang)}</option>)}
          </select>
          <button type="submit" className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">{t('btn_filter')}</button>
          {(status || q) && (
            <Link href="/courier/history" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)] border border-[var(--color-border-strong)] rounded-xl px-4 py-2 inline-flex items-center">{t('btn_clear')}</Link>
          )}
        </form>
      </FilterPanel>

      {deliveries.length === 0 ? (
        <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] px-6 py-8 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">{t('label_no_history')}</p>
        </div>
      ) : (
        <>
          {/* Mobile cards (< md) */}
          <div className="md:hidden flex flex-col gap-3">
            {deliveries.map((d) => {
              const dt = d.deliveredAt ?? d.failedAt ?? d.refusedAt ?? d.returnedAt ?? d.updatedAt
              const note = d.problemFlag ?? d.courierComment ?? d.proofNote
              return (
                <Link
                  key={d.id}
                  href={`/courier/deliveries/${d.id}`}
                  className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] p-4 hover:border-[var(--color-border-strong)] transition-colors block"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-xs text-[var(--color-primary)] font-semibold truncate">{d.trackingNumber}</span>
                    <span className="text-xs text-[var(--color-text-muted)] flex-shrink-0">{fmt(dt)}</span>
                  </div>
                  <p className="font-semibold text-[var(--color-text-strong)] mb-2">{d.customerName}</p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <StatusBadge status={d.status} lang={lang} />
                    {d.zone && (
                      <span className="inline-flex items-center text-xs text-[var(--color-text-muted)] bg-[var(--color-card-hover)] rounded-full px-2.5 py-0.5">
                        {tZone(d.zone, lang)}
                      </span>
                    )}
                  </div>
                  {note && (
                    <p className="text-xs text-[var(--color-text)] mt-2 pt-2 border-t border-[var(--color-border)]">{note}</p>
                  )}
                </Link>
              )
            })}
          </div>

          {/* Desktop table (≥ md) */}
          <div className="hidden md:block bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('label_date')}</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('label_tracking')}</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('label_customer')}</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('label_status')}</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('label_zone')}</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide hidden lg:table-cell">{t('label_note')}</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((d) => {
                  const dt = d.deliveredAt ?? d.failedAt ?? d.refusedAt ?? d.returnedAt ?? d.updatedAt
                  return (
                    <tr key={d.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-card-hover)]">
                      <td className="px-6 py-3 text-xs text-[var(--color-text-muted)] whitespace-nowrap">{fmt(dt)}</td>
                      <td className="px-6 py-3 font-mono text-xs text-[var(--color-primary)] font-semibold">
                        <Link href={`/courier/deliveries/${d.id}`}>{d.trackingNumber}</Link>
                      </td>
                      <td className="px-6 py-3 text-[var(--color-text-strong)]">{d.customerName}</td>
                      <td className="px-6 py-3"><StatusBadge status={d.status} lang={lang} /></td>
                      <td className="px-6 py-3 text-xs text-[var(--color-text-muted)]">{tZone(d.zone, lang)}</td>
                      <td className="px-6 py-3 text-xs text-[var(--color-text)] hidden lg:table-cell truncate max-w-[280px]">{d.problemFlag ?? d.courierComment ?? d.proofNote ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Pagination
        basePath="/courier/history"
        query={sp as Record<string, string | undefined>}
        page={page}
        pageSize={pageSize}
        total={total}
        labels={{
          prev: t('page_prev'),
          next: t('page_next'),
          page: t('page_label'),
          of: t('page_of'),
          perPage: t('page_per_page'),
          showing: t('page_showing'),
        }}
      />
    </Shell>
  )
}
