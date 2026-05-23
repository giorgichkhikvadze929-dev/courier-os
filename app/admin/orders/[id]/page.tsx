import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import Shell from '@/app/components/Shell'
import prisma from '@/lib/prisma'
import { getT } from '@/lib/i18n-server'
import { StatusBadge } from '@/app/components/StatusBadge'
import { money } from '@/lib/format'

/**
 * Admin Order detail. Works for both order types:
 *   IMPORT      — pulls parcels via the `importDeliveries` relation
 *                 (Delivery.orderId).
 *   ASSIGNMENT  — pulls parcels via `assignmentDeliveries`
 *                 (Delivery.assignmentOrderId).
 * The right list is loaded conditionally so we don't waste a query.
 */
export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')

  const { t, lang } = await getT()
  const { id } = await params

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      company: { select: { id: true, name: true } },
      courier: { select: { id: true, name: true } },
      importDeliveries: order_type_is_import_only_filter(),
      assignmentDeliveries: order_type_is_assignment_only_filter(),
    },
  })
  if (!order) notFound()

  const isImport = order.type === 'IMPORT'
  const deliveries = isImport ? order.importDeliveries : order.assignmentDeliveries
  const subject    = isImport ? (order.company?.name ?? '—') : (order.courier?.name ?? '—')

  return (
    <Shell
      currentPath="/admin/orders"
      breadcrumb={{ href: isImport ? '/admin/orders' : '/admin/orders?type=ASSIGNMENT', label: t('order_back_to_list') }}
      title={`${t('order_detail_title')} ${order.orderNumber}`}
      subtitle={`${subject} · ${new Date(order.createdAt).toLocaleString()}`}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Parcels — 2/3 of the width */}
        <div className="lg:col-span-2 bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] overflow-hidden">
          <div className="px-6 py-3 border-b border-[var(--color-border)]">
            <p className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide">{t('order_parcels_section')} ({deliveries.length})</p>
          </div>
          {deliveries.length === 0 ? (
            <p className="px-6 py-8 text-sm text-[var(--color-text-muted)] text-center">{t('orders_empty')}</p>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {deliveries.map((d) => (
                <li key={d.id}>
                  <Link href={`/admin/deliveries/${d.id}`} className="flex items-center gap-3 px-6 py-3 hover:bg-[var(--color-card-hover)] transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs text-[var(--color-primary)] font-semibold">{d.trackingNumber}</p>
                      <p className="text-sm text-[var(--color-text-strong)] truncate">{d.customerName}</p>
                      <p className="text-xs text-[var(--color-text-muted)] truncate">
                        {d.dropoffAddress}
                        {d.courier?.name && ` · ${d.courier.name}`}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <StatusBadge status={d.status} lang={lang} />
                      {d.codAmount != null && d.codAmount > 0 && (
                        <p className="text-xs font-mono text-[var(--color-text)] mt-1">{money(d.codAmount)}</p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
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

// Inline helpers to keep the Prisma include block readable.
function order_type_is_import_only_filter() {
  return {
    orderBy: { createdAt: 'asc' as const },
    include: { courier: { select: { name: true } } },
  }
}
function order_type_is_assignment_only_filter() {
  return {
    orderBy: { createdAt: 'asc' as const },
    include: { courier: { select: { name: true } } },
  }
}
