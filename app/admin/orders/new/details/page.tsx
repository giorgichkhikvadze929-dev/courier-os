import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import Shell from '@/app/components/Shell'
import WizardSteps from '../WizardSteps'
import { getT } from '@/lib/i18n-server'
import { tZone } from '@/lib/i18n'
import { money } from '@/lib/format'

/**
 * Step 2 — Order details. Reads the selected parcel ids from the URL
 * and renders a clean review card so the admin can sanity-check what's
 * in the bundle before assigning a courier. No edits here yet (the data
 * model doesn't need any per-bundle metadata at this stage), just a
 * Next/Back rhythm consistent with the rest of the wizard.
 */
export default async function OrderDetailsStep({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string; courier?: string }>
}) {
  const session = await getSession()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')

  const { t, lang } = await getT()
  const sp = await searchParams
  const ids = (sp.ids ?? '').split(',').filter(Boolean)
  if (ids.length === 0) redirect('/admin/orders/new')

  const parcels = await prisma.delivery.findMany({
    where:  { id: { in: ids } },
    select: {
      id: true, trackingNumber: true, customerName: true, customerPhone: true,
      dropoffAddress: true, zone: true, codAmount: true, status: true,
    },
  })

  const totalCod = parcels.reduce((s, p) => s + (p.codAmount ?? 0), 0)
  const tail = `?ids=${encodeURIComponent(ids.join(','))}${sp.courier ? `&courier=${encodeURIComponent(sp.courier)}` : ''}`

  return (
    <Shell currentPath="/admin/orders/new" title={t('wizard_title_details')} subtitle={t('wizard_subtitle_details')}>
      <WizardSteps current="details" ids={ids} courier={sp.courier ?? null} lang={lang} />

      <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-base font-semibold text-[var(--color-text-strong)]">{t('wizard_details_card_title')}</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{parcels.length} {parcels.length === 1 ? t('parcel_word') : t('parcel_word_plural')}{totalCod > 0 ? ` · ${t('bulk_total_cod')} ${money(totalCod)}` : ''}</p>
          </div>
        </div>
        <ul className="divide-y divide-[var(--color-border)]">
          {parcels.map((p) => (
            <li key={p.id} className="px-6 py-3 flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-[var(--color-primary-soft)]/40 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-[var(--color-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 16v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3M21 12V5a2 2 0 00-2-2H10a2 2 0 00-2 2v7M3 8h13M16 12h5M21 12l-3-3M21 12l-3 3"/>
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--color-text-strong)] truncate">{p.customerName}</p>
                <p className="font-mono text-xs text-[var(--color-primary)] mt-0.5">{p.trackingNumber}</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1 truncate">
                  {p.dropoffAddress}{p.zone ? ` · ${tZone(p.zone, lang)}` : ''}
                </p>
              </div>
              {p.codAmount != null && p.codAmount > 0 && (
                <span className="font-mono text-sm font-semibold text-yellow-700 dark:text-yellow-300 flex-shrink-0">{money(p.codAmount)}</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Link href="/admin/orders/new" className="inline-flex items-center gap-2 border border-[var(--color-border-strong)] text-[var(--color-text)] hover:bg-[var(--color-card-hover)] text-sm font-semibold px-5 py-3 rounded-xl transition-colors">
          ← {t('wizard_back')}
        </Link>
        <Link href={`/admin/orders/new/courier${tail}`} className="inline-flex items-center gap-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm font-semibold px-5 py-3 rounded-xl transition-colors">
          {t('wizard_next_courier')} →
        </Link>
      </div>
    </Shell>
  )
}
