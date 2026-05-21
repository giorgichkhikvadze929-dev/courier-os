import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import Shell from '@/app/components/Shell'
import { StatusBadge, PriorityBadge, ZONE_LABEL } from '@/app/components/StatusBadge'
import { resolveTariff } from '@/lib/tariff'
import { assignSingle, assignPickupCourier } from '../actions'
import { getT } from '@/lib/i18n-server'

export default async function AdminDeliveryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')

  const { t } = await getT()
  const { id } = await params
  const delivery = await prisma.delivery.findUnique({
    where: { id },
    include: {
      courier: { select: { id: true, name: true, phone: true } },
      pickupCourier: { select: { id: true, name: true, phone: true } },
      company: { select: { id: true, name: true } },
      history: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!delivery) notFound()

  const [tariff, couriers, workload, zoneHistory] = await Promise.all([
    resolveTariff(delivery.companyId, delivery.zone),
    prisma.user.findMany({ where: { role: 'COURIER', active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.delivery.groupBy({
      by: ['courierId'],
      where: { courierId: { not: null }, status: { in: ['ASSIGNED', 'IN_TRANSIT'] } },
      _count: { _all: true },
    }),
    // How many DELIVERED parcels each courier has handled in this zone.
    // Used to prefer couriers who know the area (PRD §4.1: "geographic zone + workload").
    delivery.zone ? prisma.delivery.groupBy({
      by: ['courierId'],
      where: { courierId: { not: null }, status: 'DELIVERED', zone: delivery.zone },
      _count: { _all: true },
    }) : Promise.resolve([] as Array<{ courierId: string | null; _count: { _all: number } }>),
  ])
  const loadByCourier: Record<string, number> = {}
  for (const w of workload) if (w.courierId) loadByCourier[w.courierId] = w._count._all
  const zoneExperience: Record<string, number> = {}
  for (const z of zoneHistory) if (z.courierId) zoneExperience[z.courierId] = z._count._all
  // Semi-automatic suggestion (PRD §4.1): primary sort by zone familiarity descending,
  // secondary sort by current workload ascending.
  const sortedCouriers = [...couriers].sort((a, b) => {
    const expDiff = (zoneExperience[b.id] ?? 0) - (zoneExperience[a.id] ?? 0)
    if (expDiff !== 0) return expDiff
    return (loadByCourier[a.id] ?? 0) - (loadByCourier[b.id] ?? 0)
  })
  const canAssign = ['RECEIVED', 'IN_WAREHOUSE', 'ASSIGNED'].includes(delivery.status)
  const fmt = (d: Date | null) => d ? new Date(d).toLocaleString() : '—'

  return (
    <Shell currentPath="/admin/deliveries">
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/admin/deliveries" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)]">← {t('dd_back_deliveries')}</Link>
          <span className="text-[var(--color-text-faint)]">/</span>
          <span className="font-mono text-sm text-[var(--color-text-muted)]">{delivery.trackingNumber}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={`/admin/deliveries/${id}/order-card`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[var(--color-primary-soft)] hover:bg-[var(--color-primary-soft)]/70 text-[var(--color-primary)] text-sm font-semibold px-4 py-2 rounded-lg border border-[var(--color-primary)]/30 transition-colors"
          >
            🖨 {t('dd_print_order_card')}
          </a>
          <Link
            href={`/admin/deliveries/${id}/edit`}
            className="inline-flex items-center gap-2 bg-[var(--color-card-hover)] hover:bg-[var(--color-border)] text-[var(--color-text)] text-sm font-semibold px-4 py-2 rounded-lg border border-[var(--color-border)] transition-colors"
          >
            {t('dd_edit_fields')}
          </Link>
        </div>
      </div>

      <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-5 sm:p-6 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div className="min-w-0">
            <p className="font-mono text-xs text-[var(--color-text-faint)]">{delivery.trackingNumber}</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-strong)] mt-1 leading-tight">{delivery.customerName}</h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              <a href={`tel:${delivery.customerPhone}`} className="hover:underline">{delivery.customerPhone}</a>
              {delivery.customerEmail && <>{' · '}<a href={`mailto:${delivery.customerEmail}`} className="hover:underline">{delivery.customerEmail}</a></>}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <PriorityBadge priority={delivery.priority} />
            <StatusBadge status={delivery.status} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide">{t('dd_dropoff')}</p>
            <p className="text-sm text-[var(--color-text-strong)] mt-0.5">{delivery.dropoffAddress}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide">{t('import_col_zone')}</p>
            <p className="text-sm text-[var(--color-text-strong)] mt-0.5">{delivery.zone ? ZONE_LABEL[delivery.zone] ?? delivery.zone : '—'}</p>
          </div>
          {delivery.codAmount != null && (
            <div>
              <p className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide">COD</p>
              <p className="text-sm text-[var(--color-text-strong)] mt-0.5">${delivery.codAmount.toFixed(2)}</p>
            </div>
          )}
          {tariff && (
            <div>
              <p className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide">{t('dd_tariff')}</p>
              <p className="text-sm text-[var(--color-text-strong)] mt-0.5">${tariff.amount.toFixed(2)} <span className="text-xs text-[var(--color-text-faint)]">({delivery.zone ? ZONE_LABEL[delivery.zone] : ''})</span></p>
            </div>
          )}
          {delivery.packageType && (
            <div>
              <p className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide">{t('dd_package_type')}</p>
              <p className="text-sm text-[var(--color-text-strong)] mt-0.5">{delivery.packageType}</p>
            </div>
          )}
          {delivery.notes && (
            <div className="col-span-2">
              <p className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide">{t('dd_notes')}</p>
              <p className="text-sm text-[var(--color-text)] mt-0.5">{delivery.notes}</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-5">
          <p className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide mb-3">{t('dd_assignment')}</p>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--color-text-muted)]">{t('dd_sender')}</dt>
              <dd className="font-medium text-[var(--color-text-strong)]">{delivery.company?.name ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-text-muted)]">{t('dd_pickup_courier')}</dt>
              <dd className="font-medium text-[var(--color-text-strong)]">{delivery.pickupCourier?.name ?? '—'}</dd>
            </div>
            {delivery.pickupCollectedAt && (
              <div className="flex justify-between">
                <dt className="text-[var(--color-text-muted)]">{t('dd_pickup_collected')}</dt>
                <dd className="text-[var(--color-text)] text-xs">{fmt(delivery.pickupCollectedAt)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-[var(--color-text-muted)]">{t('dd_courier')}</dt>
              <dd className="font-medium text-[var(--color-text-strong)]">{delivery.courier?.name ?? '—'}</dd>
            </div>
            {delivery.courier?.phone && (
              <div className="flex justify-between">
                <dt className="text-[var(--color-text-muted)]">{t('dd_courier_phone')}</dt>
                <dd className="text-[var(--color-text)]">{delivery.courier.phone}</dd>
              </div>
            )}
            {delivery.verifiedAt && (
              <div className="flex justify-between">
                <dt className="text-[var(--color-text-muted)]">{t('dd_verified')}</dt>
                <dd className="text-[var(--color-text)] text-xs">{fmt(delivery.verifiedAt)}</dd>
              </div>
            )}
          </dl>

          {delivery.status === 'RECEIVED' && (
            <form action={assignPickupCourier.bind(null, delivery.id)} className="mt-4 pt-4 border-t border-[var(--color-border)] flex flex-col gap-2">
              <p className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide">{t('dd_assign_pickup')}</p>
              <select
                name="pickupCourierId"
                defaultValue={delivery.pickupCourierId ?? ''}
                className="w-full border border-[var(--color-border-strong)] rounded-xl px-3 py-2 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-yellow-400"
              >
                <option value="">{t('dd_pick_courier_ph')}</option>
                {sortedCouriers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {loadByCourier[c.id] ?? 0} {t('dd_active_word')}
                  </option>
                ))}
              </select>
              <button type="submit" className="bg-yellow-600 hover:bg-yellow-500 text-white font-semibold rounded-xl py-2 text-sm transition-colors">
                {delivery.pickupCourierId ? t('dd_reassign_btn') : t('dd_assign_pickup_btn')}
              </button>
            </form>
          )}

          {canAssign && (
            <form action={assignSingle.bind(null, delivery.id)} className="mt-4 pt-4 border-t border-[var(--color-border)] flex flex-col gap-2">
              <p className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide">{t('dd_assign_courier')} <span className="font-normal text-[var(--color-text-muted)]">{t('dd_assign_zone_hint')}</span></p>
              <select
                name="courierId"
                required
                defaultValue={delivery.courierId ?? ''}
                className="w-full border border-[var(--color-border-strong)] rounded-xl px-3 py-2 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              >
                <option value="">{t('dd_pick_courier_ph')}</option>
                {sortedCouriers.map((c) => {
                  const load = loadByCourier[c.id] ?? 0
                  const exp = zoneExperience[c.id] ?? 0
                  const suffix = exp > 0
                    ? ` · ${exp}× ${t('dd_in_zone')}`
                    : (load === 0 ? ` · ${t('dd_best_fit')}` : '')
                  return (
                    <option key={c.id} value={c.id}>
                      {c.name} — {load} {t('dd_active_word')}{suffix}
                    </option>
                  )
                })}
              </select>
              <button type="submit" className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-semibold rounded-xl py-2 text-sm transition-colors">
                {delivery.courierId ? t('dd_reassign_btn') : t('dd_assign_btn')}
              </button>
            </form>
          )}
        </div>

        <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-5">
          <p className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide mb-3">{t('dd_timeline')}</p>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">{t('dd_created')}</dt><dd className="text-[var(--color-text)] text-xs">{fmt(delivery.createdAt)}</dd></div>
            <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">{t('dd_picked_up')}</dt><dd className="text-[var(--color-text)] text-xs">{fmt(delivery.pickedUpAt)}</dd></div>
            <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">{t('dd_delivered')}</dt><dd className="text-[var(--color-text)] text-xs">{fmt(delivery.deliveredAt)}</dd></div>
            {delivery.failedAt && <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">{t('dd_failed')}</dt><dd className="text-red-600 dark:text-red-400 text-xs">{fmt(delivery.failedAt)}</dd></div>}
            {delivery.refusedAt && <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">{t('dd_refused')}</dt><dd className="text-purple-600 dark:text-purple-400 text-xs">{fmt(delivery.refusedAt)}</dd></div>}
            {delivery.returnedAt && <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">{t('dd_returned')}</dt><dd className="text-yellow-600 dark:text-yellow-400 text-xs">{fmt(delivery.returnedAt)}</dd></div>}
          </dl>
        </div>
      </div>

      {delivery.problemFlag && (
        <div className="bg-red-500/10 border border-[var(--color-border)] rounded-2xl p-5 mb-4">
          <p className="text-xs font-semibold text-red-600 dark:text-red-300 uppercase tracking-wide mb-2">{t('dd_problem_flag')}</p>
          <p className="text-sm text-red-700 dark:text-red-200">{delivery.problemFlag}</p>
        </div>
      )}

      {delivery.courierComment && (
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-5 mb-4">
          <p className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide mb-2">{t('dd_courier_comment')}</p>
          <p className="text-sm text-[var(--color-text)]">{delivery.courierComment}</p>
        </div>
      )}

      {(delivery.proofNote || delivery.proofSignedBy) && (
        <div className="bg-green-500/10 border border-[var(--color-border)] rounded-2xl p-5 mb-4">
          <p className="text-xs font-semibold text-green-700 dark:text-green-300 uppercase tracking-wide mb-2">{t('dd_proof')}</p>
          {delivery.proofSignedBy && <p className="text-sm text-green-700 dark:text-green-200"><span className="font-medium">{t('dd_signed_by')}</span> {delivery.proofSignedBy}</p>}
          {delivery.proofNote && <p className="text-sm text-green-700 dark:text-green-300 mt-1">{delivery.proofNote}</p>}
        </div>
      )}

      {delivery.history.length > 0 && (
        <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-5">
          <p className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide mb-4">{t('dd_history')}</p>
          <ol className="relative border-l border-[var(--color-border)] ml-2 space-y-4">
            {delivery.history.map((h) => (
              <li key={h.id} className="ml-4">
                <div className="absolute -left-1.5 w-3 h-3 bg-[var(--color-primary)] rounded-full border-2 border-[var(--color-card)]" />
                <p className="text-xs text-[var(--color-text-faint)]">{fmt(h.createdAt)}</p>
                <p className="text-sm font-semibold text-[var(--color-text-strong)]">{h.status.replace(/_/g, ' ')}</p>
                {h.note && <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{h.note}</p>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </Shell>
  )
}
