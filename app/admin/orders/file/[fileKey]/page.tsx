import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import Shell from '@/app/components/Shell'
import prisma from '@/lib/prisma'
import { getT } from '@/lib/i18n-server'
import { money } from '@/lib/format'

/**
 * Per-file rollup detail. The /admin/orders Inbound tab now collapses each
 * uploaded Excel into ONE row (instead of one-per-company), and this page
 * is what you land on when you click that row: the same file's parcels,
 * grouped by company so you can see who got what.
 *
 * The route param is a URL-encoded file label — typically the original
 * spreadsheet filename. We match it against:
 *   - ImportBatch.filename (preferred, set on real imports), or
 *   - Order.notes (set by the backfill/collapse scripts) after stripping
 *     the standard prefixes.
 */
export default async function FileDetailPage({
  params,
}: {
  params: Promise<{ fileKey: string }>
}) {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')

  const { t } = await getT()
  const { fileKey } = await params
  const label = decodeURIComponent(fileKey)

  // Pull every IMPORT order with its company, then keep only the ones whose
  // computed "file label" matches the route param. importBatch isn't a real
  // relation in the schema (just an id) so we look it up in a second pass.
  const allImports = await prisma.order.findMany({
    where:   { type: 'IMPORT' },
    orderBy: { createdAt: 'desc' },
    include: {
      company: { select: { id: true, name: true } },
    },
  })

  const filenameById = new Map<string, string | null>()
  const batchIds = allImports.map((o) => o.importBatchId).filter((x): x is string => !!x)
  if (batchIds.length > 0) {
    const rows = await prisma.importBatch.findMany({
      where:  { id: { in: batchIds } },
      select: { id: true, filename: true },
    })
    for (const r of rows) filenameById.set(r.id, r.filename)
  }

  function fileLabel(o: typeof allImports[number]): string {
    if (o.importBatchId && filenameById.has(o.importBatchId)) {
      const fn = filenameById.get(o.importBatchId)
      if (fn) return fn
    }
    return (o.notes ?? '')
      .replace(/^Backfilled\s*[—-]\s*/, '')
      .replace(/^Source file:\s*/, '')
      || '—'
  }

  const matches = allImports.filter((o) => fileLabel(o) === label)
  if (matches.length === 0) notFound()

  // Totals across the whole file.
  const totalParcels = matches.reduce((s, o) => s + o.parcelCount, 0)
  const totalValue   = matches.reduce((s, o) => s + o.totalValue,  0)
  const earliest     = matches.reduce<Date>((d, o) => o.createdAt < d ? o.createdAt : d, matches[0].createdAt)
  const latest       = matches.reduce<Date>((d, o) => o.createdAt > d ? o.createdAt : d, matches[0].createdAt)

  // Sort companies by parcel count desc so the biggest senders show first.
  const sorted = [...matches].sort((a, b) => b.parcelCount - a.parcelCount)

  return (
    <Shell
      currentPath="/admin/orders"
      breadcrumb={{ href: '/admin/orders', label: t('order_back_to_list') }}
      title={label}
      subtitle={`${matches.length} ${matches.length === 1 ? t('orders_col_company').toLowerCase() : t('orders_col_company').toLowerCase()} · ${totalParcels} ${totalParcels === 1 ? t('parcel_word') : t('parcel_word_plural')}`}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Per-company list — 2/3 of the width */}
        <div className="lg:col-span-2">
          <p className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide mb-3">
            {t('order_file_companies')}
          </p>

          <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] overflow-hidden">
            <ul className="divide-y divide-[var(--color-border)]">
              {sorted.map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="flex items-center gap-3 px-6 py-3 hover:bg-[var(--color-card-hover)] transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[var(--color-text-strong)] truncate">
                        {o.company?.name ?? '—'}
                      </p>
                      <p className="font-mono text-xs text-[var(--color-primary)] mt-0.5">{o.orderNumber}</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-sm font-bold text-[var(--color-text-strong)] font-mono">
                        {o.parcelCount} <span className="text-xs font-normal text-[var(--color-text-muted)]">{o.parcelCount === 1 ? t('parcel_word') : t('parcel_word_plural')}</span>
                      </p>
                      {o.totalValue > 0 && (
                        <p className="text-xs text-[var(--color-text-muted)] font-mono mt-0.5">{money(o.totalValue)}</p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Summary sidebar */}
        <aside className="flex flex-col gap-4">
          <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-5">
            <p className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide mb-3">{t('order_summary')}</p>
            <dl className="text-sm space-y-2">
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--color-text-muted)]">{t('orders_col_company')}</dt>
                <dd className="font-semibold text-[var(--color-text-strong)] font-mono">{matches.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--color-text-muted)]">{t('order_total_parcels')}</dt>
                <dd className="font-semibold text-[var(--color-text-strong)] font-mono">{totalParcels}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--color-text-muted)]">{t('order_total_value')}</dt>
                <dd className="font-semibold text-[var(--color-text-strong)] font-mono">{money(totalValue)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--color-text-muted)]">{t('orders_col_date')}</dt>
                <dd className="font-semibold text-[var(--color-text-strong)] text-right text-xs">
                  {earliest.getTime() === latest.getTime()
                    ? earliest.toLocaleString()
                    : `${earliest.toLocaleDateString()} – ${latest.toLocaleDateString()}`}
                </dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </Shell>
  )
}
