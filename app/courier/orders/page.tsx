import { getSession } from '@/lib/session'
import { getActiveSession } from '@/lib/impersonation'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Shell from '@/app/components/Shell'
import prisma from '@/lib/prisma'
import { getT } from '@/lib/i18n-server'
import { money } from '@/lib/format'

/**
 * Courier Orders — the ASSIGNMENT orders this courier has been given.
 * Each entry is a bundle of parcels handed out together (status = ASSIGNED).
 * Click an order to see all parcels inside.
 *
 * Impersonation-aware: an admin previewing as a courier sees that courier's
 * orders via `getActiveSession`.
 */
export default async function CourierOrdersPage() {
  const baseSession = await getSession()
  if (!baseSession || !['COURIER', 'ADMIN'].includes(baseSession.user?.role as string)) redirect('/login')
  const session = await getActiveSession()
  const courierId = session?.user.id ?? (baseSession.user as { id?: string }).id
  if (!courierId) redirect('/login')

  const { t } = await getT()
  const orders = await prisma.order.findMany({
    where:   { type: 'ASSIGNMENT', courierId },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <Shell currentPath="/courier/orders" title={t('orders_title')} subtitle={`${orders.length} ${orders.length === 1 ? t('orders_count_one') : t('orders_count_many')}`}>
      {orders.length === 0 ? (
        <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-10 text-center">
          <p className="text-[var(--color-text-muted)] text-sm">{t('orders_empty')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((o) => (
            <Link
              key={o.id}
              href={`/courier/orders/${o.id}`}
              className="block bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] hover:border-[var(--color-border-strong)] transition-colors p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs text-[var(--color-primary)] font-semibold">{o.orderNumber}</p>
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
      )}
    </Shell>
  )
}
