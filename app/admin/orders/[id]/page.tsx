import { getSession } from '@/lib/session'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import Shell from '@/app/components/Shell'
import prisma from '@/lib/prisma'
import { getT } from '@/lib/i18n-server'
import { StatusBadge } from '@/app/components/StatusBadge'
import Pagination from '@/app/components/Pagination'
import SortPicker from '../../deliveries/SortPicker'
import { money } from '@/lib/format'

/**
 * Admin Order detail with the same organization patterns as /admin/deliveries:
 *   - Paginated parcel list (50 per page)
 *   - Sort dropdown above the list
 *   - Status filter row
 *
 * Works for both IMPORT and ASSIGNMENT orders. The right relation is queried
 * via Delivery.orderId vs Delivery.assignmentOrderId.
 */

type SortField = 'createdAt' | 'customerName' | 'status' | 'codAmount'
const SORT_FIELDS: Record<SortField, boolean> = {
  createdAt: true, customerName: true, status: true, codAmount: true,
}
const PAGE_SIZE_DEFAULT = 50

export default async function AdminOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ page?: string; pageSize?: string; sort?: string; status?: string }>
}) {
  const session = await getSession()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')

  const { t, lang } = await getT()
  const { id } = await params
  const sp = await searchParams

  // Sort param packs "field:dir" — same shape as the deliveries page.
  let sortBy: SortField = 'createdAt'
  let sortDir: 'asc' | 'desc' = 'asc'
  if (sp.sort && sp.sort.includes(':')) {
    const [f, d] = sp.sort.split(':')
    if (f in SORT_FIELDS) sortBy = f as SortField
    sortDir = d === 'desc' ? 'desc' : 'asc'
  }
  const page = Math.max(1, Number(sp.page) || 1)
  const pageSize = Math.min(250, Math.max(10, Number(sp.pageSize) || PAGE_SIZE_DEFAULT))
  const statusFilter = sp.status || null

  // Fetch the order header.
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      company: { select: { id: true, name: true } },
      courier: { select: { id: true, name: true } },
    },
  })
  if (!order) notFound()

  const isImport = order.type === 'IMPORT'
  const subject  = isImport ? (order.company?.name ?? '—') : (order.courier?.name ?? '—')

  // Build the parcels query — same filter shape regardless of order type;
  // we just swap which FK the deliveries are linked through.
  const where = {
    ...(isImport ? { orderId: id } : { assignmentOrderId: id }),
    ...(statusFilter ? { status: statusFilter } : {}),
  }

  const orderBy = sortBy === 'codAmount'
    ? [{ codAmount: { sort: sortDir, nulls: 'last' as const } }]
    : [{ [sortBy]: sortDir }]

  const [deliveries, total] = await Promise.all([
    prisma.delivery.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        courier: { select: { name: true } },
        // Source IMPORT order — only meaningful for ASSIGNMENT parcels.
        ...(isImport ? {} : { order: { select: { id: true, orderNumber: true } } }),
      },
    }),
    prisma.delivery.count({ where }),
  ])

  // Build a base href that preserves filters / sort for the pagination links.
  const baseQuery: Record<string, string> = {}
  if (sp.sort)   baseQuery.sort   = sp.sort
  if (statusFilter) baseQuery.status = statusFilter
  if (sp.pageSize) baseQuery.pageSize = sp.pageSize

  return (
    <Shell
      currentPath="/admin/orders"
      breadcrumb={{ href: isImport ? '/admin/orders' : '/admin/orders?type=ASSIGNMENT', label: t('order_back_to_list') }}
      title={`${t('order_detail_title')} ${order.orderNumber}`}
      subtitle={`${subject} · ${new Date(order.createdAt).toLocaleString()}`}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Parcels — 2/3 of the width */}
        <div className="lg:col-span-2">
          {/* Sort + count row */}
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <span className="text-xs text-[var(--color-text-muted)]">
              {t('order_parcels_section')} ({total}{total !== order.parcelCount && ` / ${order.parcelCount}`})
            </span>
            <SortPicker
              current={`${sortBy}:${sortDir}`}
              labels={{
                label:     t('sort_label'),
                newest:    t('sort_newest'),
                oldest:    t('sort_oldest'),
                nameAZ:    t('sort_name_az'),
                nameZA:    t('sort_name_za'),
                valueHigh: t('sort_value_high'),
                valueLow:  t('sort_value_low'),
                status:    t('sort_status'),
                priority:  t('sort_priority'),
                zone:      t('sort_zone'),
              }}
            />
          </div>

          {/* Parcels list */}
          <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] overflow-hidden">
            {deliveries.length === 0 ? (
              <p className="px-6 py-8 text-sm text-[var(--color-text-muted)] text-center">{t('orders_empty')}</p>
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {deliveries.map((d) => {
                  const sourceImport = !isImport && 'order' in d
                    ? (d as typeof d & { order: { id: string; orderNumber: string } | null }).order
                    : null
                  return (
                    <li key={d.id}>
                      <Link href={`/admin/deliveries/${d.id}`} className="flex items-center gap-3 px-6 py-3 hover:bg-[var(--color-card-hover)] transition-colors">
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-xs text-[var(--color-primary)] font-semibold">{d.trackingNumber}</p>
                          <p className="text-sm text-[var(--color-text-strong)] truncate">{d.customerName}</p>
                          <p className="text-xs text-[var(--color-text-muted)] truncate">
                            {d.dropoffAddress}
                            {d.courier?.name && ` · ${d.courier.name}`}
                          </p>
                          {sourceImport && (
                            <p className="text-[11px] text-[var(--color-text-faint)] mt-0.5">
                              {t('order_from_imports')}: <span className="font-mono text-[var(--color-primary)]">{sourceImport.orderNumber}</span>
                            </p>
                          )}
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <StatusBadge status={d.status} lang={lang} />
                          {d.codAmount != null && d.codAmount > 0 && (
                            <p className="text-xs font-mono text-[var(--color-text)] mt-1">{money(d.codAmount)}</p>
                          )}
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Pagination */}
          {total > pageSize && (
            <Pagination
              basePath={`/admin/orders/${id}`}
              query={baseQuery}
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
          )}
        </div>

        {/* Summary sidebar */}
        <aside className="flex flex-col gap-4">
          <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-5">
            <p className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide mb-3">{t('order_summary')}</p>
            <dl className="text-sm space-y-2">
              <div className="flex justify-between">
                <dt className="text-[var(--color-text-muted)]">{t('order_total_parcels')}</dt>
                <dd className="font-semibold text-[var(--color-text-strong)]">{order.parcelCount}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--color-text-muted)]">{t('order_total_value')}</dt>
                <dd className="font-semibold text-[var(--color-text-strong)] font-mono">{money(order.totalValue)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--color-text-muted)]">{isImport ? t('orders_col_company') : t('orders_col_courier')}</dt>
                <dd className="font-semibold text-[var(--color-text-strong)] text-right truncate">{subject}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--color-text-muted)]">{t('orders_col_date')}</dt>
                <dd className="font-semibold text-[var(--color-text-strong)] text-right text-xs">{new Date(order.createdAt).toLocaleString()}</dd>
              </div>
            </dl>
            {order.notes && (
              <p className="mt-3 pt-3 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)] italic">{order.notes}</p>
            )}
          </div>
        </aside>
      </div>
    </Shell>
  )
}
