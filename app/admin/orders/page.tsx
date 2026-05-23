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
  searchParams: Promise<{ type?: string }>
}) {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')

  const { t } = await getT()
  const sp = await searchParams
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
    // Fall back to notes — strip the "Backfilled — " prefix for cleanliness.
    return (o.notes ?? '').replace(/^Backfilled\s*[—-]\s*/, '') || '—'
  }

  return (
    <Shell
      currentPath="/admin/orders"
      title={t('orders_title')}
      subtitle={`${orders.length} ${orders.length === 1 ? t('orders_count_one') : t('orders_count_many')}`}
    >
      {/* Type tabs */}
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
          {/* Mobile cards */}
          <div className="lg:hidden flex flex-col gap-3">
            {orders.map((o) => {
              const subject = type === 'IMPORT' ? (o.company?.name ?? '—') : (o.courier?.name ?? '—')
              const file    = type === 'IMPORT' ? fileLabel(o) : null
              return (
                <Link
                  key={o.id}
                  href={`/admin/orders/${o.id}`}
                  className="block bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] hover:border-[var(--color-border-strong)] transition-colors p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs text-[var(--color-primary)] font-semibold">{o.orderNumber}</p>
                      <p className="text-sm font-medium text-[var(--color-text-strong)] mt-0.5 truncate">{subject}</p>
                      {file && file !== '—' && (
                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">{file}</p>
                      )}
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

          {/* Desktop table */}
          <div className="hidden lg:block bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left  px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('orders_col_number')}</th>
                  <th className="text-left  px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                    {type === 'IMPORT' ? t('orders_col_company') : t('orders_col_courier')}
                  </th>
                  {type === 'IMPORT' && (
                    <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('orders_col_file')}</th>
                  )}
                  <th className="text-right px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('orders_col_parcels')}</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('orders_col_value')}</th>
                  <th className="text-left  px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('orders_col_date')}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const subject = type === 'IMPORT' ? (o.company?.name ?? '—') : (o.courier?.name ?? '—')
                  return (
                    <tr key={o.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-card-hover)]">
                      <td className="px-6 py-3">
                        <Link href={`/admin/orders/${o.id}`} className="font-mono text-xs text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] font-semibold">{o.orderNumber}</Link>
                      </td>
                      <td className="px-6 py-3 text-[var(--color-text-strong)] font-medium">{subject}</td>
                      {type === 'IMPORT' && (
                        <td className="px-6 py-3 text-[var(--color-text-muted)] text-xs truncate max-w-[260px]">{fileLabel(o)}</td>
                      )}
                      <td className="px-6 py-3 text-right text-[var(--color-text-strong)] font-mono">{o.parcelCount}</td>
                      <td className="px-6 py-3 text-right text-[var(--color-text-strong)] font-mono">{o.totalValue > 0 ? money(o.totalValue) : '—'}</td>
                      <td className="px-6 py-3 text-[var(--color-text-muted)] text-xs">{new Date(o.createdAt).toLocaleString()}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Shell>
  )
}
