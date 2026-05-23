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
export default async function AdminOrdersPage() {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')

  const { t } = await getT()
  // For now the Orders list only surfaces IMPORT orders — the
  // outbound/ASSIGNMENT tab was removed per UX direction. Assignment orders
  // still get created behind the scenes by the bulk-assign action so the data
  // is there if we resurface them later.
  const type = 'IMPORT' as const

  const orders = await prisma.order.findMany({
    where:   { type },
    orderBy: { createdAt: 'desc' },
    include: {
      company: { select: { id: true, name: true } },
      courier: { select: { id: true, name: true } },
    },
  })

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
      {orders.length === 0 ? (
        <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-10 text-center">
          <p className="text-[var(--color-text-muted)] text-sm">{t('orders_empty')}</p>
        </div>
      ) : (
        <>
          {/* Mobile cards — minimal 3-field layout: file · date · value */}
          <div className="lg:hidden flex flex-col gap-3">
            {orders.map((o) => (
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
            ))}
          </div>

          {/* Desktop table — file · value · date */}
          <div className="hidden lg:block bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] overflow-hidden">
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
          </div>
        </>
      )}
    </Shell>
  )
}
