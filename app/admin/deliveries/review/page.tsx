import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import Shell from '@/app/components/Shell'
import WizardSteps from '../WizardSteps'
import SaveOrderButton from './SaveOrderButton'
import { getT } from '@/lib/i18n-server'
import { tZone } from '@/lib/i18n'
import { money } from '@/lib/format'

/**
 * Step 4 — Review & Save. Final summary of the bundle (parcels +
 * courier + totals). The Save Order button runs bulkAssignToCourier
 * server-side and redirects to /admin/orders so the admin sees the new
 * ASSIGNMENT order in context.
 */
export default async function ReviewStep({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string; courier?: string }>
}) {
  const session = await getSession()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')

  const { t, lang } = await getT()
  const sp = await searchParams
  const ids     = (sp.ids ?? '').split(',').filter(Boolean)
  const courier = sp.courier ?? ''
  if (ids.length === 0) redirect('/admin/deliveries')
  if (!courier) redirect(`/admin/deliveries/courier?ids=${encodeURIComponent(ids.join(','))}`)

  const [parcels, courierRow, activeLoad] = await Promise.all([
    prisma.delivery.findMany({
      where:  { id: { in: ids } },
      select: { id: true, trackingNumber: true, customerName: true, dropoffAddress: true, zone: true, codAmount: true },
    }),
    prisma.user.findUnique({ where: { id: courier }, select: { id: true, name: true, email: true } }),
    prisma.delivery.count({ where: { courierId: courier, status: { in: ['ASSIGNED', 'IN_TRANSIT'] } } }),
  ])

  if (!courierRow) redirect(`/admin/deliveries/courier?ids=${encodeURIComponent(ids.join(','))}`)

  const totalCod = parcels.reduce((s, p) => s + (p.codAmount ?? 0), 0)
  const initials = (courierRow.name ?? '?').split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase()
  const tail = `?ids=${encodeURIComponent(ids.join(','))}&courier=${encodeURIComponent(courier)}`

  return (
    <Shell currentPath="/admin/deliveries" title={t('wizard_title_review')} subtitle={t('wizard_subtitle_review')}>
      <WizardSteps current="review" ids={ids} courier={courier} lang={lang} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        {/* Bundle parcel list — takes 2/3 */}
        <div className="lg:col-span-2 bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--color-border)]">
            <p className="text-base font-semibold text-[var(--color-text-strong)]">{t('wizard_review_parcels_title')}</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{parcels.length} {parcels.length === 1 ? t('parcel_word') : t('parcel_word_plural')}{totalCod > 0 ? ` · ${t('bulk_total_cod')} ${money(totalCod)}` : ''}</p>
          </div>
          <ul className="divide-y divide-[var(--color-border)] max-h-[500px] overflow-y-auto">
            {parcels.map((p) => (
              <li key={p.id} className="px-6 py-3 flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-[var(--color-primary-soft)]/40 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-[var(--color-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 16v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3M21 12V5a2 2 0 00-2-2H10a2 2 0 00-2 2v7M3 8h13M16 12h5M21 12l-3-3M21 12l-3 3"/>
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--color-text-strong)] truncate">{p.customerName}</p>
                  <p className="font-mono text-xs text-[var(--color-primary)] mt-0.5">{p.trackingNumber}</p>
                  <p className="text-[11px] text-[var(--color-text-muted)] truncate mt-0.5">{p.dropoffAddress}{p.zone ? ` · ${tZone(p.zone, lang)}` : ''}</p>
                </div>
                {p.codAmount != null && p.codAmount > 0 && (
                  <span className="font-mono text-xs font-semibold text-yellow-700 dark:text-yellow-300 flex-shrink-0">{money(p.codAmount)}</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Courier card + Save button — right column */}
        <aside className="flex flex-col gap-5">
          <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-faint)] mb-3">{t('wizard_review_courier_title')}</p>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-[var(--color-primary)] text-white font-bold flex items-center justify-center text-lg shadow shadow-blue-900/30">
                {initials || '?'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold text-[var(--color-text-strong)] truncate">{courierRow.name}</p>
                <p className="text-xs text-[var(--color-text-muted)] truncate">{courierRow.email}</p>
                <p className="text-xs mt-1">
                  <span className="font-mono font-semibold text-[var(--color-text-strong)]">{activeLoad}</span>
                  <span className="text-[var(--color-text-muted)]"> {t('wizard_active_parcels')}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-6">
            <dl className="text-sm space-y-2 mb-4">
              <div className="flex justify-between">
                <dt className="text-[var(--color-text-muted)]">{t('bulk_total_items')}</dt>
                <dd className="font-semibold text-[var(--color-text-strong)] font-mono">{parcels.length}</dd>
              </div>
              {totalCod > 0 && (
                <div className="flex justify-between">
                  <dt className="text-[var(--color-text-muted)]">{t('bulk_total_cod')}</dt>
                  <dd className="font-semibold text-yellow-700 dark:text-yellow-300 font-mono">{money(totalCod)}</dd>
                </div>
              )}
            </dl>
            <SaveOrderButton ids={ids} courierId={courier} lang={lang} />
          </div>
        </aside>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Link href={`/admin/deliveries/courier?ids=${encodeURIComponent(ids.join(','))}&courier=${encodeURIComponent(courier)}`} className="inline-flex items-center gap-2 border border-[var(--color-border-strong)] text-[var(--color-text)] hover:bg-[var(--color-card-hover)] text-sm font-semibold px-5 py-3 rounded-xl transition-colors">
          ← {t('wizard_back')}
        </Link>
      </div>
    </Shell>
  )
}
