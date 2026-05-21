import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import Shell from '@/app/components/Shell'
import AutoRefresh from '@/app/components/AutoRefresh'
import { ZONE_LABEL } from '@/app/components/StatusBadge'
import { getT } from '@/lib/i18n-server'
import { markPickedUpAt } from '../actions'

/**
 * Pickup task list — parcels the company has uploaded but not yet brought to
 * the warehouse. The pickup courier visits the sender, collects each parcel
 * and taps "Delivered to warehouse" once it's physically on our shelf.
 */
export default async function PickupTasksPage() {
  const session = await auth()
  if (!session || !['COURIER', 'ADMIN'].includes(session.user?.role as string)) redirect('/login')

  const { t } = await getT()
  const courierId = (session.user as { id?: string }).id

  const tasks = await prisma.delivery.findMany({
    where: {
      pickupCourierId: courierId,
      status: 'RECEIVED',
      pickupCollectedAt: null,
    },
    orderBy: [{ pickupAssignedAt: 'asc' }],
    include: { company: { select: { name: true, address: true, phone: true } } },
  })

  return (
    <Shell currentPath="/courier/pickups">
      <AutoRefresh intervalMs={30_000} />
      <div className="mb-4">
        <h1 className="text-xl font-bold text-[var(--color-text-strong)]">{t('pickup_tasks_title')}</h1>
        <p className="text-sm text-[var(--color-text-muted)]">{tasks.length} {tasks.length === 1 ? t('pickup_task_word') : t('pickup_task_word_plural')}</p>
      </div>

      {tasks.length === 0 ? (
        <div className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] p-8 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">{t('pickup_no_tasks')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {tasks.map((d) => (
            <div key={d.id} className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs text-[var(--color-text-faint)]">{d.trackingNumber}</p>
                  <p className="text-base font-bold text-[var(--color-text-strong)]">{d.company?.name ?? '—'}</p>
                  {d.company?.address && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.company.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-[var(--color-primary)] hover:underline mt-0.5"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      {d.company.address}
                    </a>
                  )}
                  {d.company?.phone && (
                    <a href={`tel:${d.company.phone}`} className="block text-sm text-[var(--color-primary)] hover:underline mt-0.5">📞 {d.company.phone}</a>
                  )}
                </div>
                {d.zone && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] bg-[var(--color-card-hover)] px-2 py-1 rounded">
                    {ZONE_LABEL[d.zone] ?? d.zone}
                  </span>
                )}
              </div>

              <div className="text-xs text-[var(--color-text-muted)] mb-3">
                <span className="font-semibold">{t('pickup_recipient_hint')}</span> {d.customerName} · {d.customerPhone}
              </div>

              <form action={markPickedUpAt.bind(null, d.id)}>
                <button
                  type="submit"
                  className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl py-3 text-sm transition-colors"
                >
                  ✓ {t('pickup_mark_done')}
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </Shell>
  )
}
