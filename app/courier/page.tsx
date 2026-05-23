import { auth } from '@/auth'
import { getActiveSession } from '@/lib/impersonation'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import Shell from '@/app/components/Shell'
import AutoRefresh from '@/app/components/AutoRefresh'
import { StatusBadge, PriorityBadge } from '@/app/components/StatusBadge'
import { getT } from '@/lib/i18n-server'
import { tZone } from '@/lib/i18n'
import { updateDeliveryStatus, returnToWarehouse } from './actions'
import InTransitActions from './components/InTransitActions'
import { money } from '@/lib/format'

export default async function CourierPage() {
  const session = await auth()
  if (!session || !['COURIER', 'ADMIN'].includes(session.user?.role as string)) redirect('/login')

  // Use the impersonated identity when an admin is "previewing as" a courier —
  // queries filter by the courier's user id, not the admin's.
  const activeSession = await getActiveSession()
  const { t, lang } = await getT()
  const courierId = activeSession?.user.id ?? (session.user as { id?: string }).id
  const startOfDay = new Date(new Date().setHours(0, 0, 0, 0))

  const [active, deliveredToday, problemToday, deliveries, codSum] = await Promise.all([
    prisma.delivery.count({ where: { courierId, status: { in: ['ASSIGNED', 'IN_TRANSIT'] } } }),
    prisma.delivery.count({ where: { courierId, status: 'DELIVERED', deliveredAt: { gte: startOfDay } } }),
    prisma.delivery.count({ where: { courierId, status: { in: ['FAILED', 'REFUSED'] }, updatedAt: { gte: startOfDay } } }),
    // Include FAILED/REFUSED so the courier can return them to the warehouse
    // straight from the dashboard. They drop off the list once status flips to
    // IN_WAREHOUSE (admin then re-assigns) or DELIVERED.
    prisma.delivery.findMany({
      where: { courierId, status: { in: ['ASSIGNED', 'IN_TRANSIT', 'FAILED', 'REFUSED'] } },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: 50,
    }),
    // Total cash the courier is expected to collect from their open deliveries.
    prisma.delivery.aggregate({
      where: { courierId, status: { in: ['ASSIGNED', 'IN_TRANSIT'] } },
      _sum: { codAmount: true },
    }),
  ])
  const totalCash = codSum._sum.codAmount ?? 0

  const PRIORITY_ORDER = ['URGENT', 'HIGH', 'NORMAL', 'LOW']
  const sorted = [...deliveries].sort(
    (a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority)
  )

  return (
    <Shell currentPath="/courier">
      <AutoRefresh intervalMs={30_000} />
      <div>
        <h1 className="text-xl font-bold text-[var(--color-text-strong)]">{t('title_courier_dashboard')}</h1>
        <p className="text-sm text-[var(--color-text-muted)]">{session.user?.name}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] px-5 py-4">
          <p className="text-xs font-medium text-[var(--color-text-muted)]">{t('label_active')}</p>
          <p className="text-3xl font-bold text-[var(--color-primary)] mt-0.5">{active}</p>
        </div>
        <div className="bg-yellow-500/10 rounded-2xl border border-yellow-500/30 px-5 py-4">
          <p className="text-xs font-medium text-yellow-700 dark:text-yellow-300">{t('courier_cash_to_collect')}</p>
          <p className="text-3xl font-bold text-yellow-700 dark:text-yellow-300 mt-0.5 tabular-nums">{money(totalCash)}</p>
        </div>
        <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] px-5 py-4">
          <p className="text-xs font-medium text-[var(--color-text-muted)]">{t('label_delivered_today')}</p>
          <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-0.5">{deliveredToday}</p>
        </div>
        <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] px-5 py-4">
          <p className="text-xs font-medium text-[var(--color-text-muted)]">{t('label_problems_today')}</p>
          <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-0.5">{problemToday}</p>
        </div>
      </div>

      <div className="mt-6">
        <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">
          {t('nav_my_deliveries')} ({sorted.length})
        </h2>
        {sorted.length === 0 ? (
          <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-8 text-center">
            <p className="text-[var(--color-text-muted)] text-sm">{t('no_active')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sorted.map((d) => (
              <div
                key={d.id}
                className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] hover:border-[var(--color-border-strong)] hover:shadow transition-all overflow-hidden"
              >
                <Link href={`/courier/deliveries/${d.id}`} className="block p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <PriorityBadge priority={d.priority} lang={lang} />
                      <StatusBadge status={d.status} lang={lang} />
                    </div>
                    <span className="font-mono text-xs text-[var(--color-text-faint)]">{d.trackingNumber}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[var(--color-text-strong)]">{d.customerName}</p>
                      <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{d.customerPhone}</p>
                    </div>
                    {d.codAmount != null && d.codAmount > 0 && (
                      <div className="text-right flex-shrink-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-yellow-700/70 dark:text-yellow-400/70">COD</p>
                        <p className="text-xl font-bold text-yellow-700 dark:text-yellow-300 tabular-nums">{money(d.codAmount)}</p>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 pt-3 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)] space-y-1">
                    <div className="flex gap-2">
                      <span className="font-medium text-[var(--color-text-faint)] w-14 flex-shrink-0">{t('label_to').toUpperCase()}</span>
                      <span>{d.dropoffAddress}</span>
                    </div>
                    {d.zone && (
                      <div className="flex gap-2">
                        <span className="font-medium text-[var(--color-text-faint)] w-14 flex-shrink-0">{t('label_zone').toUpperCase()}</span>
                        <span>{tZone(d.zone, lang)}</span>
                      </div>
                    )}
                  </div>
                  {d.notes && (
                    <p className="mt-2 text-xs text-yellow-700 dark:text-yellow-300 bg-yellow-500/10 rounded-lg px-3 py-1.5">{d.notes}</p>
                  )}
                </Link>
                {/* Inline actions per status — one tap from the list, no need
                    to drill into the detail page. Detail page still available
                    via the body link for proof-of-delivery notes etc. */}
                {d.status === 'ASSIGNED' && (
                  <form action={updateDeliveryStatus.bind(null, d.id)} className="border-t border-[var(--color-border)]">
                    <input type="hidden" name="status" value="IN_TRANSIT" />
                    <button
                      type="submit"
                      className="w-full inline-flex items-center justify-center gap-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-semibold text-sm py-3 transition-colors"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7M5.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM18.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                      </svg>
                      {t('dd_pickup_transit')}
                    </button>
                  </form>
                )}
                {d.status === 'IN_TRANSIT' && (
                  <InTransitActions
                    deliveryId={d.id}
                    labels={{
                      delivered:          t('dd_mark_delivered'),
                      failed:             t('label_failed'),
                      refused:            t('label_refused'),
                      addComment:         t('courier_add_comment'),
                      commentPlaceholder: t('courier_comment_placeholder'),
                    }}
                  />
                )}
                {(d.status === 'FAILED' || d.status === 'REFUSED') && (
                  <form action={returnToWarehouse.bind(null, d.id)} className="border-t border-[var(--color-border)]">
                    <input type="hidden" name="problemFlag" value={d.status === 'FAILED' ? 'Failed delivery' : 'Customer refused'} />
                    <button
                      type="submit"
                      className="w-full inline-flex items-center justify-center gap-2 bg-yellow-600 hover:bg-yellow-500 text-white font-semibold text-sm py-3 transition-colors"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M3 7v6h6" />
                        <path d="M21 17a9 9 0 00-15-6.7L3 13" />
                      </svg>
                      {t('dd_mark_returned')}
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Shell>
  )
}
