import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import Shell from '@/app/components/Shell'
import WizardSteps from '../WizardSteps'
import { getT } from '@/lib/i18n-server'

/**
 * Step 3 — Assign courier. Shows the active couriers as picker cards
 * (avatar + name + current active load). Clicking a card sets the
 * courier in the URL and moves the wizard to step 4 (Review & Save).
 */
export default async function CourierStep({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string; courier?: string }>
}) {
  const session = await getSession()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')

  const { t, lang } = await getT()
  const sp = await searchParams
  const ids = (sp.ids ?? '').split(',').filter(Boolean)
  if (ids.length === 0) redirect('/admin/deliveries')

  const [couriers, workload] = await Promise.all([
    prisma.user.findMany({
      where:   { role: 'COURIER', active: true },
      orderBy: { name: 'asc' },
      select:  { id: true, name: true, email: true },
    }),
    prisma.delivery.groupBy({
      by: ['courierId'],
      where: { courierId: { not: null }, status: { in: ['ASSIGNED', 'IN_TRANSIT'] } },
      _count: { _all: true },
    }),
  ])

  const loadByCourier: Record<string, number> = {}
  for (const w of workload) if (w.courierId) loadByCourier[w.courierId] = w._count._all

  const idsParam = `ids=${encodeURIComponent(ids.join(','))}`

  return (
    <Shell currentPath="/admin/deliveries" title={t('wizard_title_courier')} subtitle={t('wizard_subtitle_courier')}>
      <WizardSteps current="courier" ids={ids} courier={sp.courier ?? null} lang={lang} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {couriers.map((c) => {
          const load = loadByCourier[c.id] ?? 0
          const initials = (c.name ?? '?').split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase()
          const isPicked = sp.courier === c.id
          return (
            <Link
              key={c.id}
              href={`/admin/deliveries/review?${idsParam}&courier=${encodeURIComponent(c.id)}`}
              className={`bg-[var(--color-card)] rounded-2xl shadow-sm border p-5 flex items-center gap-4 transition-all ${
                isPicked
                  ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/30'
                  : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)] hover:shadow-md'
              }`}
            >
              <div className="w-12 h-12 rounded-full bg-[var(--color-primary-soft)]/60 text-[var(--color-primary)] font-bold flex items-center justify-center flex-shrink-0 text-base">
                {initials || '?'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--color-text-strong)] truncate">{c.name}</p>
                <p className="text-xs text-[var(--color-text-muted)] truncate">{c.email}</p>
                <p className="text-xs mt-1">
                  <span className={`font-mono font-semibold ${load === 0 ? 'text-green-600 dark:text-green-400' : load < 10 ? 'text-[var(--color-text-strong)]' : 'text-orange-600 dark:text-orange-400'}`}>{load}</span>
                  <span className="text-[var(--color-text-muted)]"> {t('wizard_active_parcels')}</span>
                </p>
              </div>
              <span className="text-[var(--color-primary)] font-semibold text-lg flex-shrink-0">→</span>
            </Link>
          )
        })}
      </div>

      {couriers.length === 0 && (
        <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-10 text-center mb-6">
          <p className="text-sm text-[var(--color-text-muted)]">{t('wizard_no_couriers')}</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <Link href={`/admin/deliveries/details?${idsParam}`} className="inline-flex items-center gap-2 border border-[var(--color-border-strong)] text-[var(--color-text)] hover:bg-[var(--color-card-hover)] text-sm font-semibold px-5 py-3 rounded-xl transition-colors">
          ← {t('wizard_back')}
        </Link>
      </div>
    </Shell>
  )
}
