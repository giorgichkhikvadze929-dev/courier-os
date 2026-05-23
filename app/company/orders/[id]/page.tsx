import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import Shell from '@/app/components/Shell'
import prisma from '@/lib/prisma'
import { getT } from '@/lib/i18n-server'
import { StatusBadge } from '@/app/components/StatusBadge'
import { money } from '@/lib/format'

/**
 * Company-side single-order detail. Same shape as the admin view but with the
 * company's parcels linking to /company/parcels/[id] (read-only view), not
 * /admin/deliveries/[id].
 */
export default async function CompanyOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect('/login')
  const role = session.user?.role as string
  if (!['COMPANY', 'ADMIN'].includes(role)) redirect('/login')

  const { t, lang } = await getT()
  const { id } = await params
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      deliveries: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!order) notFound()

  // Hard guard: a company user can only see their own orders.
  const companyId = (session.user as { companyId?: string | null }).companyId
  if (role === 'COMPANY' && order.companyId !== companyId) {
    redirect('/company/orders')
  }

  return (
    <Shell
      currentPath="/company/orders"
      breadcrumb={{ href: '/company/orders', label: t('order_back_to_list') }}
      title={`${t('order_detail_title')} ${order.orderNumber}`}
      subtitle={new Date(order.createdAt).toLocaleString()}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] overflow-hidden">
          <div className="px-6 py-3 border-b border-[var(--color-border)]">
            <p className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide">{t('order_parcels_section')} ({order.deliveries.length})</p>
          </div>
          <ul className="divide-y divide-[var(--color-border)]">
            {order.deliveries.map((d) => (
              <li key={d.id}>
                <Link href={`/company/parcels/${d.id}`} className="flex items-center gap-3 px-6 py-3 hover:bg-[var(--color-card-hover)] transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs text-[var(--color-primary)] font-semibold">{d.trackingNumber}</p>
                    <p className="text-sm text-[var(--color-text-strong)] truncate">{d.customerName}</p>
                    <p className="text-xs text-[var(--color-text-muted)] truncate">{d.dropoffAddress}</p>
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
        </div>

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
