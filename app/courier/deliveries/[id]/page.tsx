import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import Shell from '@/app/components/Shell'
import { StatusBadge, PriorityBadge, ZONE_LABEL } from '@/app/components/StatusBadge'
import { updateDeliveryStatus, returnToWarehouse } from '../../actions'
import { money } from '@/lib/format'
import { getT } from '@/lib/i18n-server'

export default async function CourierDeliveryPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || !['COURIER', 'ADMIN'].includes(session.user?.role as string)) redirect('/login')

  const { t } = await getT()
  const { id } = await params
  const courierId = (session.user as { id?: string }).id

  const delivery = await prisma.delivery.findUnique({
    where: { id },
    include: { history: { orderBy: { createdAt: 'asc' } } },
  })

  if (!delivery) notFound()
  const role = session.user?.role as string
  if (role === 'COURIER' && delivery.courierId !== courierId) notFound()

  // Allowed status transitions for couriers
  const NEXT: Record<string, { status: string; label: string; color: string }[]> = {
    ASSIGNED: [
      { status: 'IN_TRANSIT', label: t('dd_pickup_transit'),  color: 'bg-[var(--color-warning)] hover:bg-orange-400' },
    ],
    IN_TRANSIT: [
      { status: 'DELIVERED', label: t('dd_mark_delivered'),    color: 'bg-[var(--color-success)] hover:bg-green-500' },
      { status: 'FAILED',    label: t('dd_mark_failed'),       color: 'bg-[var(--color-danger)] hover:bg-red-500' },
      { status: 'REFUSED',   label: t('dd_customer_refused'),  color: 'bg-purple-600 hover:bg-purple-500' },
    ],
    FAILED: [
      { status: 'RETURNED',  label: t('dd_mark_returned'),     color: 'bg-yellow-600 hover:bg-yellow-500' },
    ],
    REFUSED: [
      { status: 'RETURNED',  label: t('dd_mark_returned'),     color: 'bg-yellow-600 hover:bg-yellow-500' },
    ],
  }

  const nextActions = NEXT[delivery.status] ?? []
  const fmt = (d: Date | null) => d ? new Date(d).toLocaleString() : '—'

  return (
    <Shell currentPath="/courier">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/courier" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)]">← {t('dd_back_my_deliveries')}</Link>
      </div>

      <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <PriorityBadge priority={delivery.priority} />
            <StatusBadge status={delivery.status} />
          </div>
          <span className="font-mono text-xs text-[var(--color-text-faint)]">{delivery.trackingNumber}</span>
        </div>

        <h1 className="text-lg font-bold text-[var(--color-text-strong)]">{delivery.customerName}</h1>
        <a href={`tel:${delivery.customerPhone}`} className="inline-flex items-center gap-1 text-sm text-[var(--color-primary)] font-medium hover:underline mt-0.5">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>
          {delivery.customerPhone}
        </a>
        {delivery.customerEmail && <p className="text-xs text-[var(--color-text-faint)] mt-0.5">{delivery.customerEmail}</p>}

        <div className="mt-4 space-y-3">
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(delivery.dropoffAddress)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-[var(--color-primary-soft)]/30 hover:bg-[var(--color-primary-soft)]/50 rounded-xl p-3 transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-[var(--color-primary)] uppercase tracking-wide">{t('dd_dropoff')}</p>
              <svg className="w-4 h-4 text-[var(--color-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
            <p className="text-sm text-[var(--color-text-strong)]">{delivery.dropoffAddress}</p>
            {delivery.zone && (
              <p className="text-xs text-[var(--color-text-muted)] mt-1">{t('dd_zone')} {ZONE_LABEL[delivery.zone] ?? delivery.zone}</p>
            )}
          </a>
          {delivery.codAmount != null && (
            <div className="bg-yellow-500/10 rounded-xl p-3">
              <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 uppercase tracking-wide mb-1">{t('dd_cod')}</p>
              <p className="text-lg font-bold text-[var(--color-text-strong)]">{money(delivery.codAmount)}</p>
            </div>
          )}
          {delivery.notes && (
            <div className="bg-[var(--color-card-hover)] rounded-xl p-3">
              <p className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide mb-1">{t('dd_notes')}</p>
              <p className="text-sm text-[var(--color-text)]">{delivery.notes}</p>
            </div>
          )}
        </div>
      </div>

      {delivery.status === 'DELIVERED' && (delivery.proofNote || delivery.proofSignedBy) && (
        <div className="bg-green-500/10 border border-[var(--color-border)] rounded-2xl p-4 mt-4">
          <p className="text-xs font-semibold text-green-700 dark:text-green-300 uppercase tracking-wide mb-1">{t('dd_proof')}</p>
          {delivery.proofSignedBy && <p className="text-sm text-green-700 dark:text-green-200">{t('dd_signed_by')} <span className="font-medium">{delivery.proofSignedBy}</span></p>}
          {delivery.proofNote && <p className="text-sm text-green-700 dark:text-green-300 mt-0.5">{delivery.proofNote}</p>}
        </div>
      )}

      {nextActions.length > 0 && (
        <div className="flex flex-col gap-3 mt-4">
          {nextActions.map((action) => (
            <form
              key={action.status}
              action={(action.status === 'RETURNED'
                ? returnToWarehouse
                : updateDeliveryStatus).bind(null, id)}
            >
              <input type="hidden" name="status" value={action.status} />

              {action.status === 'DELIVERED' && (
                <div className="flex flex-col gap-2 mb-3 bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] p-4">
                  <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('dd_proof')}</p>
                  <input
                    name="proofSignedBy"
                    placeholder={t('dd_signed_by_ph')}
                    className="w-full border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                  <textarea
                    name="proofNote"
                    placeholder={t('dd_proof_note_ph')}
                    rows={2}
                    className="w-full border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
                  />
                </div>
              )}
              {(action.status === 'FAILED' || action.status === 'REFUSED' || action.status === 'RETURNED') && (
                <div className="mb-2">
                  <input
                    name="problemFlag"
                    placeholder={
                      action.status === 'FAILED' ? t('dd_failed_reason_ph')
                      : action.status === 'REFUSED' ? t('dd_refused_reason_ph')
                      : t('dd_return_reason_ph')
                    }
                    className="w-full border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                </div>
              )}
              <input
                name="courierComment"
                placeholder={t('dd_comment_ph')}
                className="w-full border border-[var(--color-border-strong)] rounded-xl px-4 py-2 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] mb-2"
              />
              <button
                type="submit"
                className={`w-full text-white font-semibold rounded-2xl py-3.5 text-sm transition-colors ${action.color}`}
              >
                {action.label}
              </button>
            </form>
          ))}
        </div>
      )}

      <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-5 mt-4">
        <p className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide mb-4">{t('dd_timeline')}</p>
        <dl className="space-y-2 text-sm mb-4">
          <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">{t('dd_picked_up')}</dt><dd className="text-xs text-[var(--color-text)]">{fmt(delivery.pickedUpAt)}</dd></div>
          <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">{t('dd_delivered')}</dt><dd className="text-xs text-green-700 dark:text-green-300 font-medium">{fmt(delivery.deliveredAt)}</dd></div>
          {delivery.failedAt   && <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">{t('dd_failed')}</dt><dd className="text-xs text-red-600 dark:text-red-400">{fmt(delivery.failedAt)}</dd></div>}
          {delivery.refusedAt  && <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">{t('dd_refused')}</dt><dd className="text-xs text-purple-600 dark:text-purple-400">{fmt(delivery.refusedAt)}</dd></div>}
          {delivery.returnedAt && <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">{t('dd_returned')}</dt><dd className="text-xs text-yellow-600 dark:text-yellow-400">{fmt(delivery.returnedAt)}</dd></div>}
        </dl>
        {delivery.history.length > 0 && (
          <ol className="relative border-l border-[var(--color-border)] ml-2 space-y-3">
            {delivery.history.map((h) => (
              <li key={h.id} className="ml-4">
                <div className="absolute -left-1.5 w-3 h-3 bg-[var(--color-primary)] rounded-full border-2 border-[var(--color-card)]" />
                <p className="text-[10px] text-[var(--color-text-faint)]">{fmt(h.createdAt)}</p>
                <p className="text-sm font-semibold text-[var(--color-text-strong)]">{h.status.replace(/_/g, ' ')}</p>
                {h.note && <p className="text-xs text-[var(--color-text-muted)]">{h.note}</p>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </Shell>
  )
}
