import { auth } from '@/auth'
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
  searchParams: Promise<{ expand?: string; type?: string }>
}) {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')

  const { t } = await getT()
  const sp = await searchParams
  const expanded = sp.expand === '1'
  const type: 'IMPORT' | 'ASSIGNMENT' = sp.type === 'ASSIGNMENT' ? 'ASSIGNMENT' : 'IMPORT'

  const [orders, importCount, assignmentCount] = await Promise.all([
    prisma.order.findMany({
      where:   { type },
      orderBy: { createdAt: 'desc' },
      include: {
        company: { select: { id: true, name: true } },
        courier: { select: { id: true, name: true } },
      },
    }),
    prisma.order.count({ where: { type: 'IMPORT' } }),
    prisma.order.count({ where: { type: 'ASSIGNMENT' } }),
  ])

  // Roll-up: by default the page shows ONE line summing every import. The user
  // clicks it to expand the full list. Date used is the most recent import.
  const rollup = {
    count:      orders.length,
    totalValue: orders.reduce((s, o) => s + o.totalValue, 0),
    latest:     orders[0]?.createdAt ?? null,
  }

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

  return (
    <Shell
      currentPath="/admin/orders"
      title={t('orders_title')}
      subtitle={`${orders.length} ${orders.length === 1 ? t('orders_count_one') : t('orders_count_many')}`}
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
      ) : !expanded ? (
        // Collapsed view — one summary line. Click to expand the full list.
        // Link preserves the active type so toggling doesn't reset to imports.
        <Link
          href={type === 'IMPORT' ? '/admin/orders?expand=1' : '/admin/orders?type=ASSIGNMENT&expand=1'}
          className="block bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] hover:border-[var(--color-border-strong)] transition-colors p-5"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-base font-semibold text-[var(--color-text-strong)]">
                {type === 'IMPORT' ? t('orders_rollup_title') : t('orders_rollup_assignment')}
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                {rollup.count} {rollup.count === 1 ? t('orders_count_one') : t('orders_count_many')}
                {rollup.latest && ` · ${new Date(rollup.latest).toLocaleString()}`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-[var(--color-text-strong)] font-mono">{money(rollup.totalValue)}</p>
              <p className="text-xs text-[var(--color-primary)] mt-1">{t('orders_open_all')}</p>
            </div>
          </div>
        </Link>
      ) : (
        <>
          {/* Expanded — show the full list. Link back to the collapsed view
              (preserves type). */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-[var(--color-text-muted)]">
              {rollup.count} {rollup.count === 1 ? t('orders_count_one') : t('orders_count_many')} · {money(rollup.totalValue)}
            </span>
            <Link
              href={type === 'IMPORT' ? '/admin/orders' : '/admin/orders?type=ASSIGNMENT'}
              className="text-xs font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]"
            >
              ← {t('orders_collapse')}
            </Link>
          </div>

          {/* Mobile cards. IMPORT shows file · date · value; ASSIGNMENT shows
              order # · courier · parcels · value · date. */}
          <div className="lg:hidden flex flex-col gap-3">
            {orders.map((o) => {
              if (type === 'IMPORT') {
                return (
                  <Link
                    key={o.id}
                    href={`/admin/orders/${o.id}`}
                    className="block bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] hover:border-[var(--color-border-strong)] transition-colors p-4"
                  >
                    <p className="text-sm font-semibold text-[var(--color-text-strong)] truncate">{fileLabel(o)}</p>
                    <div className="mt-2 flex items-baseline justify-between gap-3">
                      <span className="text-xs text-[var(--color-text-muted)]">{new Date(o.createdAt).toLocaleString()}</span>
                      <span className="text-base font-bold text-[var(--color-text-strong)] font-mono">{money(o.totalValue)}</span>
                    </div>
                  </Link>
                )
              }
              return (
                <Link
                  key={o.id}
                  href={`/admin/orders/${o.id}`}
                  className="block bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] hover:border-[var(--color-border-strong)] transition-colors p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs text-[var(--color-primary)] font-semibold">{o.orderNumber}</p>
                      <p className="text-sm font-medium text-[var(--color-text-strong)] mt-0.5 truncate">{o.courier?.name ?? '—'}</p>
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
                    <th className="text-right px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('orders_col_value')}</th>
                    <th className="text-left  px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('orders_col_date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-card-hover)]">
                      <td className="px-6 py-3">
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="font-medium text-[var(--color-text-strong)] hover:text-[var(--color-primary)]"
                        >
                          {fileLabel(o)}
                        </Link>
                      </td>
                      <td className="px-6 py-3 text-right text-[var(--color-text-strong)] font-mono">{money(o.totalValue)}</td>
                      <td className="px-6 py-3 text-[var(--color-text-muted)] text-xs">{new Date(o.createdAt).toLocaleString()}</td>
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
                    <tr key={o.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-card-hover)]">
                      <td className="px-6 py-3">
                        <Link href={`/admin/orders/${o.id}`} className="font-mono text-xs text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] font-semibold">{o.orderNumber}</Link>
                      </td>
                      <td className="px-6 py-3 text-[var(--color-text-strong)] font-medium">{o.courier?.name ?? '—'}</td>
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
