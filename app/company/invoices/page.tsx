import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import Shell from '@/app/components/Shell'
import Pagination from '@/app/components/Pagination'
import { getT } from '@/lib/i18n-server'
import { money } from '@/lib/format'

const DEFAULT_PAGE_SIZE = 50

const STATUS_BADGE: Record<string, string> = {
  DRAFT:     'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  ISSUED:    'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  PAID:      'bg-green-500/15 text-green-700 dark:text-green-300',
  OVERDUE:   'bg-red-500/15 text-red-700 dark:text-red-300',
  CANCELLED: 'bg-slate-500/15 text-slate-500 line-through',
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return '—'
  return d.toISOString().slice(0, 10)
}

export default async function CompanyInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')
  const role = session.user?.role as string
  if (!['COMPANY', 'ADMIN'].includes(role)) redirect('/login')

  const companyId = (session.user as { companyId?: string | null }).companyId
  if (!companyId) {
    return (
      <Shell currentPath="/company/invoices" title="Invoices">
        <div className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] px-6 py-10 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">No company linked to this account — invoices unavailable.</p>
        </div>
      </Shell>
    )
  }

  const { t } = await getT()
  const sp = await searchParams
  const page = Math.max(1, Number(sp.page) || 1)
  const pageSize = Math.min(250, Math.max(10, Number(sp.pageSize) || DEFAULT_PAGE_SIZE))

  const where = { companyId }
  const now = new Date()

  const [total, rows, sumOpen] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { items: true } } },
    }),
    prisma.invoice.aggregate({ where: { ...where, status: 'ISSUED' }, _sum: { total: true } }),
  ])

  return (
    <Shell currentPath="/company/invoices" title={t('inv_title')} subtitle={`${total.toLocaleString()} ${t('inv_subtitle')}`}>
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl px-4 py-3 mb-4">
        <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
          {t('inv_stat_outstanding')}: {money(sumOpen._sum.total ?? 0)}
        </p>
      </div>

      <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] overflow-x-auto">
        {rows.length === 0 ? (
          <p className="px-6 py-10 text-sm text-[var(--color-text-muted)] text-center">{t('inv_empty')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('inv_col_number')}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide hidden md:table-cell">{t('inv_col_period')}</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('inv_col_parcels')}</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('inv_col_total')}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('inv_col_status')}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide hidden lg:table-cell">{t('inv_col_due')}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((inv) => {
                const isOverdue = inv.status === 'ISSUED' && inv.dueAt && inv.dueAt.getTime() < now.getTime()
                const displayStatus = isOverdue ? 'OVERDUE' : inv.status
                return (
                  <tr key={inv.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-card-hover)]">
                    <td className="px-4 py-3 font-mono text-xs text-[var(--color-primary)] font-semibold whitespace-nowrap">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)] text-xs hidden md:table-cell whitespace-nowrap">
                      {fmtDate(inv.periodStart)} → {fmtDate(inv.periodEnd)}
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--color-text)] tabular-nums">{inv._count.items}</td>
                    <td className="px-4 py-3 text-right text-[var(--color-text-strong)] font-semibold tabular-nums">{money(inv.total)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_BADGE[displayStatus] ?? STATUS_BADGE.DRAFT}`}>
                        {displayStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-faint)] text-xs whitespace-nowrap hidden lg:table-cell">{fmtDate(inv.dueAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/company/invoices/${inv.id}`} className="text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] font-medium">{t('btn_view')}</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <Pagination
        basePath="/company/invoices"
        query={sp as Record<string, string | undefined>}
        page={page}
        pageSize={pageSize}
        total={total}
        labels={{
          prev: t('page_prev'),
          next: t('page_next'),
          page: t('page_label'),
          of:   t('page_of'),
          perPage: t('page_per_page'),
          showing: t('page_showing'),
        }}
      />
    </Shell>
  )
}
