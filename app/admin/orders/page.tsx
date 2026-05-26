import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Shell from '@/app/components/Shell'
import prisma from '@/lib/prisma'
import { getT } from '@/lib/i18n-server'
import { money } from '@/lib/format'

/**
 * Admin Orders list. Two flavours coexist:
 *   IMPORT     — one Excel batch (company → warehouse)
 *   ASSIGNMENT — one delivery bundle (warehouse → courier)
 *
 * Tab toggle at the top filters between them.
 */
export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const session = await getSession()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')

  const { t } = await getT()
  const sp = await searchParams
  const type: 'IMPORT' | 'ASSIGNMENT' = sp.type === 'ASSIGNMENT' ? 'ASSIGNMENT' : 'IMPORT'

  // Cap the orders query so we don't pull the entire history on every nav.
  // For IMPORT we roll up by file, so a couple hundred Orders is enough to
  // populate ~all the files anyone scrolls through. For ASSIGNMENT (one
  // bundle per courier per day) 300 covers a comfortable history too.
  const ORDERS_LIMIT = 300
  const [orders, importCount, assignmentCount] = await Promise.all([
    prisma.order.findMany({
      where:   { type },
      orderBy: { createdAt: 'desc' },
      take:    ORDERS_LIMIT,
      include: {
        company: { select: { id: true, name: true } },
        courier: { select: { id: true, name: true } },
      },
    }),
    prisma.order.count({ where: { type: 'IMPORT' } }),
    prisma.order.count({ where: { type: 'ASSIGNMENT' } }),
  ])

  // For IMPORT orders, fetch the filename from the ImportBatch they came
  // from. Backfilled orders won't have an importBatchId, in which case we
  // fall back to whatever text we wrote into `notes` at backfill time
  // (typically the original date string from the spreadsheet).
  const filenameById = new Map<string, string | null>()
  if (type === 'IMPORT') {
    const batchIds = orders.map((o) => o.importBatchId).filter((x): x is string => !!x)
    if (batchIds.length > 0) {
      const rows = await prisma.importBatch.findMany({
        where:  { id: { in: batchIds } },
        select: { id: true, filename: true },
      })
      for (const r of rows) filenameById.set(r.id, r.filename)
    }
  }

  function fileLabel(o: typeof orders[number]): string {
    if (o.importBatchId && filenameById.has(o.importBatchId)) {
      const fn = filenameById.get(o.importBatchId)
      if (fn) return fn
    }
    // Fall back to notes — strip prefixes used by backfill / collapse scripts
    // so the file name reads cleanly on its own.
    return (o.notes ?? '')
      .replace(/^Backfilled\s*[—-]\s*/, '')
      .replace(/^Source file:\s*/, '')
      || '—'
  }

  // Roll IMPORT orders up by source file. One uploaded Excel can fan out into
  // many per-company sub-orders (the importer keeps each company's share of
  // the file as its own Order so /company/orders shows only theirs); the
  // admin view rolls them back up so we see ONE row per file, not 137.
  type FileGroup = {
    label:        string
    fileKey:      string             // url-safe id used in the row's link
    parcelCount:  number
    totalValue:   number
    latestAt:     Date
    companies:    Set<string>
  }
  const fileGroups: FileGroup[] = (() => {
    if (type !== 'IMPORT') return []
    const map = new Map<string, FileGroup>()
    for (const o of orders) {
      const label = fileLabel(o)
      let g = map.get(label)
      if (!g) {
        g = {
          label,
          fileKey:    encodeURIComponent(label),
          parcelCount: 0,
          totalValue:  0,
          latestAt:    o.createdAt,
          companies:   new Set<string>(),
        }
        map.set(label, g)
      }
      g.parcelCount += o.parcelCount
      g.totalValue  += o.totalValue
      if (o.createdAt > g.latestAt) g.latestAt = o.createdAt
      if (o.companyId) g.companies.add(o.companyId)
    }
    return [...map.values()].sort((a, b) => b.latestAt.getTime() - a.latestAt.getTime())
  })()

  return (
    <Shell
      currentPath="/admin/orders"
      title={t('orders_title')}
      subtitle={`${orders.length} ${orders.length === 1 ? t('orders_count_one') : t('orders_count_many')}`}
      actions={
        <Link
          href="/admin/orders/new"
          className="inline-flex items-center gap-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {t('nav_create_order')}
        </Link>
      }
    >
      {/* Type tabs — Inbound (file imports) vs Outbound (courier bundles). */}
      <div className="border-b border-[var(--color-border)] flex gap-6 mb-5">
        <Link
          href="/admin/orders"
          className={`pb-3 text-sm font-semibold transition-colors border-b-2 -mb-px ${type === 'IMPORT' ? 'border-[var(--color-primary)] text-[var(--color-text-strong)]' : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
        >
          {t('orders_tab_import')} <span className="text-xs ml-1 px-2 py-0.5 bg-[var(--color-card-hover)] rounded-full">{importCount}</span>
        </Link>
        <Link
          href="/admin/orders?type=ASSIGNMENT"
          className={`pb-3 text-sm font-semibold transition-colors border-b-2 -mb-px ${type === 'ASSIGNMENT' ? 'border-[var(--color-primary)] text-[var(--color-text-strong)]' : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
        >
          {t('orders_tab_assignment')} <span className="text-xs ml-1 px-2 py-0.5 bg-[var(--color-card-hover)] rounded-full">{assignmentCount}</span>
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-10 text-center">
          <p className="text-[var(--color-text-muted)] text-sm">{t('orders_empty')}</p>
        </div>
      ) : (
        <>

          {/* Mobile cards. IMPORT shows ONE row per source file (rolled up
              across the per-company sub-orders); ASSIGNMENT shows one row
              per courier bundle. */}
          <div className="lg:hidden flex flex-col gap-3">
            {type === 'IMPORT' && fileGroups.map((g) => (
              <Link
                key={g.fileKey}
                href={`/admin/orders/file/${g.fileKey}`}
                className="block bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] hover:border-[var(--color-border-strong)] hover:shadow-md transition-all p-5"
              >
                <p className="text-sm font-semibold text-[var(--color-text-strong)] truncate">{g.label}</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">{g.companies.size} {t('orders_col_company').toLowerCase()} · {g.parcelCount} {g.parcelCount === 1 ? t('parcel_word') : t('parcel_word_plural')}</p>
                <div className="mt-2 flex items-baseline justify-between gap-3">
                  <span className="text-xs text-[var(--color-text-muted)]">{new Date(g.latestAt).toLocaleString()}</span>
                  <span className="text-base font-bold text-[var(--color-text-strong)] font-mono">{money(g.totalValue)}</span>
                </div>
              </Link>
            ))}
            {type !== 'IMPORT' && orders.map((o) => {
              // Wrap the card body in a Link to the order, but render the
              // courier name as an inline action (clicking it goes to the
              // filtered deliveries view instead of the order detail).
              return (
                <div key={o.id} className="block bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] hover:border-[var(--color-border-strong)] transition-colors">
                  <Link href={`/admin/orders/${o.id}`} className="block p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-xs text-[var(--color-primary)] font-semibold">{o.orderNumber}</p>
                        <p className="text-xs text-[var(--color-text-faint)] mt-1">{new Date(o.createdAt).toLocaleString()}</p>
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
                  {o.courier && (
                    <div className="border-t border-[var(--color-border)] px-4 py-2">
                      <Link
                        href={`/admin/deliveries?courier=${o.courier.id}`}
                        className="text-sm text-[var(--color-text-strong)] hover:text-[var(--color-primary)]"
                      >
                        {o.courier.name} →
                      </Link>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Desktop table. */}
          <div className="hidden lg:block bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] overflow-hidden">
            {type === 'IMPORT' ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="text-left  px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('orders_col_file')}</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('orders_col_company')}</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('orders_col_parcels')}</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('orders_col_value')}</th>
                    <th className="text-left  px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('orders_col_date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {fileGroups.map((g) => (
                    // Whole-row click via stretched link in the file cell.
                    // One row per uploaded file, regardless of how many
                    // company-slices it produced under the hood.
                    <tr key={g.fileKey} className="relative border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-card-hover)] cursor-pointer">
                      <td className="px-6 py-3">
                        <Link
                          href={`/admin/orders/file/${g.fileKey}`}
                          className="font-medium text-[var(--color-text-strong)] hover:text-[var(--color-primary)] before:absolute before:inset-0 before:content-['']"
                        >
                          {g.label}
                        </Link>
                      </td>
                      <td className="px-6 py-3 text-right text-[var(--color-text-strong)] font-mono">{g.companies.size}</td>
                      <td className="px-6 py-3 text-right text-[var(--color-text-strong)] font-mono">{g.parcelCount}</td>
                      <td className="px-6 py-3 text-right text-[var(--color-text-strong)] font-mono">{money(g.totalValue)}</td>
                      <td className="px-6 py-3 text-[var(--color-text-muted)] text-xs">{new Date(g.latestAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="text-left  px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('orders_col_number')}</th>
                    <th className="text-left  px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('orders_col_courier')}</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('orders_col_parcels')}</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('orders_col_value')}</th>
                    <th className="text-left  px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('orders_col_date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    // The whole row navigates to the order detail. The order
                    // number cell uses the "stretched link" pattern
                    // (before:absolute) so a click anywhere in the row goes
                    // to the order. The courier cell is rendered above that
                    // stretched area with `relative z-10` so its own link
                    // (filtered deliveries) still wins when clicked directly.
                    <tr key={o.id} className="relative border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-card-hover)] cursor-pointer">
                      <td className="px-6 py-3">
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="font-mono text-xs text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] font-semibold before:absolute before:inset-0 before:content-['']"
                        >
                          {o.orderNumber}
                        </Link>
                      </td>
                      <td className="px-6 py-3 text-[var(--color-text-strong)] font-medium relative z-10">
                        {o.courier
                          ? <Link href={`/admin/deliveries?courier=${o.courier.id}`} className="hover:text-[var(--color-primary)] hover:underline">{o.courier.name}</Link>
                          : '—'}
                      </td>
                      <td className="px-6 py-3 text-right text-[var(--color-text-strong)] font-mono">{o.parcelCount}</td>
                      <td className="px-6 py-3 text-right text-[var(--color-text-strong)] font-mono">{o.totalValue > 0 ? money(o.totalValue) : '—'}</td>
                      <td className="px-6 py-3 text-[var(--color-text-muted)] text-xs">{new Date(o.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </Shell>
  )
}
