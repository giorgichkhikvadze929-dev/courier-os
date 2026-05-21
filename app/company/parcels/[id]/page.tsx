import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import Shell from '@/app/components/Shell'
import { StatusBadge, PriorityBadge, ZONE_LABEL } from '@/app/components/StatusBadge'
import { resolveTariff } from '@/lib/tariff'
import { getT } from '@/lib/i18n-server'

export default async function CompanyParcelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect('/login')
  const role = session.user?.role as string
  if (!['COMPANY', 'ADMIN'].includes(role)) redirect('/login')

  const { t } = await getT()
  const companyId = (session.user as { companyId?: string | null }).companyId
  const { id } = await params

  const delivery = await prisma.delivery.findUnique({
    where: { id },
    include: {
      courier: { select: { name: true, phone: true } },
      history: { orderBy: { createdAt: 'asc' } },
    },
  })

  if (!delivery) notFound()
  // Companies can only see their own
  if (role === 'COMPANY' && delivery.companyId !== companyId) notFound()

  const tariff = await resolveTariff(delivery.companyId, delivery.zone)
  const fmt = (d: Date | null) => d ? new Date(d).toLocaleString() : '—'

  return (
    <Shell currentPath="/company/parcels">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/company/parcels" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)]">← {t('dd_back_my_parcels')}</Link>
        <span className="text-[var(--color-text-faint)]">/</span>
        <span className="font-mono text-sm text-[var(--color-text-muted)]">{delivery.trackingNumber}</span>
      </div>

      <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-6 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <p className="font-mono text-sm text-[var(--color-text-faint)]">{delivery.trackingNumber}</p>
            <h1 className="text-xl font-bold text-[var(--color-text-strong)] mt-0.5">{delivery.customerName}</h1>
            <p className="text-sm text-[var(--color-text-muted)]">{delivery.customerPhone}{delivery.customerEmail ? ` · ${delivery.customerEmail}` : ''}</p>
          </div>
          <div className="flex items-center gap-2">
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
              <p className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide">{t('dd_cod_amount')}</p>
              <p className="text-sm text-[var(--color-text-strong)] mt-0.5">${delivery.codAmount.toFixed(2)}</p>
            </div>
          )}
          {tariff && (
            <div>
              <p className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide">{t('dd_delivery_fee')}</p>
              <p className="text-sm text-[var(--color-text-strong)] mt-0.5">${tariff.amount.toFixed(2)}</p>
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
          <p className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide mb-3">{t('dd_courier')}</p>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--color-text-muted)]">{t('dd_name')}</dt>
              <dd className="font-medium text-[var(--color-text-strong)]">{delivery.courier?.name ?? <span className="text-yellow-600 dark:text-yellow-400">{t('dd_courier_unassigned')}</span>}</dd>
            </div>
            {delivery.courier?.phone && (
              <div className="flex justify-between">
                <dt className="text-[var(--color-text-muted)]">{t('dd_phone')}</dt>
                <dd className="text-[var(--color-text)]">{delivery.courier.phone}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-5">
          <p className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide mb-3">{t('dd_timeline')}</p>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">{t('dd_created')}</dt><dd className="text-xs text-[var(--color-text)]">{fmt(delivery.createdAt)}</dd></div>
            <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">{t('dd_last_update')}</dt><dd className="text-xs text-[var(--color-text)]">{fmt(delivery.updatedAt)}</dd></div>
            {delivery.deliveredAt && <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">{t('dd_delivered')}</dt><dd className="text-xs text-green-700 dark:text-green-300 font-medium">{fmt(delivery.deliveredAt)}</dd></div>}
            {delivery.failedAt   && <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">{t('dd_failed')}</dt><dd className="text-xs text-red-600 dark:text-red-400">{fmt(delivery.failedAt)}</dd></div>}
            {delivery.refusedAt  && <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">{t('dd_refused')}</dt><dd className="text-xs text-purple-600 dark:text-purple-400">{fmt(delivery.refusedAt)}</dd></div>}
            {delivery.returnedAt && <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">{t('dd_returned')}</dt><dd className="text-xs text-yellow-600 dark:text-yellow-400">{fmt(delivery.returnedAt)}</dd></div>}
          </dl>
        </div>
      </div>

      {delivery.problemFlag && (
        <div className="bg-red-500/10 border border-[var(--color-border)] rounded-2xl p-5 mb-4">
          <p className="text-xs font-semibold text-red-600 dark:text-red-300 uppercase tracking-wide mb-2">{t('dd_problem')}</p>
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
          {delivery.proofSignedBy && <p className="text-sm text-green-700 dark:text-green-200">{t('dd_signed_by')} <span className="font-medium">{delivery.proofSignedBy}</span></p>}
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
