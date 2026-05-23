import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Shell from '@/app/components/Shell'
import prisma from '@/lib/prisma'
import { getT } from '@/lib/i18n-server'
import { money } from '@/lib/format'

/**
 * Admin Orders list — every batch ever committed by the importer.
 * One row per Order; an Order groups every parcel that came in on the same
 * upload.
 */
export default async function AdminOrdersPage() {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')

  const { t } = await getT()
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    include: { company: { select: { id: true, name: true } } },
  })

  return (
    <Shell
      currentPath="/admin/orders"
      title={t('orders_title')}
      subtitle={`${orders.length} ${orders.length === 1 ? t('orders_count_one') : t('orders_count_many')} · ${t('orders_subtitle')}`}
    >
      {orders.length === 0 ? (
        <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-10 text-center">
          <p className="text-[var(--color-text-muted)] text-sm">{t('orders_empty')}</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="lg:hidden flex flex-col gap-3">
            {orders.map((o) => (
              <Link
                key={o.id}
                href={`/admin/orders/${o.id}`}
                className="block bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] hover:border-[var(--color-border-strong)] transition-colors p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs text-[var(--color-primary)] font-semibold">{o.orderNumber}</p>
                    <p className="text-sm font-medium text-[var(--color-text-strong)] mt-0.5 truncate">{o.company.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">{new Date(o.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-faint)]">{t('orders_col_parcels')}</p>
                    <p className="text-lg font-bold text-[var(--color-text-strong)]">{o.parcelCount}</p>
                    {o.totalValue > 0 && (
                      <p className="text-xs text-[var(--color-text-muted)] font-mono mt-0.5">{money(o.totalValue)}</p>
                    )}
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
                  <th className="text-left  px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('orders_col_number')}</th>
                  <th className="text-left  px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('orders_col_company')}</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('orders_col_parcels')}</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('orders_col_value')}</th>
                  <th className="text-left  px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('orders_col_date')}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-card-hover)]">
                    <td className="px-6 py-3">
                      <Link href={`/admin/orders/${o.id}`} className="font-mono text-xs text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] font-semibold">{o.orderNumber}</Link>
                    </td>
                    <td className="px-6 py-3 text-[var(--color-text-strong)] font-medium">{o.company.name}</td>
                    <td className="px-6 py-3 text-right text-[var(--color-text-strong)] font-mono">{o.parcelCount}</td>
                    <td className="px-6 py-3 text-right text-[var(--color-text-strong)] font-mono">{o.totalValue > 0 ? money(o.totalValue) : '—'}</td>
                    <td className="px-6 py-3 text-[var(--color-text-muted)] text-xs">{new Date(o.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Shell>
  )
}
