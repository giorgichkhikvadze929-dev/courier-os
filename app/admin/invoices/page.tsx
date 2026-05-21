import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import Shell from '@/app/components/Shell'
import Pagination from '@/app/components/Pagination'
import GenerateInvoicePanel from './GenerateInvoicePanel'
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
  return d.toISOString().slice(0, 10)  // YYYY-MM-DD, deterministic
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; companyId?: string; page?: string; pageSize?: string }>
}) {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')

  const { t } = await getT()
  const sp = await searchParams
  const page = Math.max(1, Number(sp.page) || 1)
  const pageSize = Math.min(250, Math.max(10, Number(sp.pageSize) || DEFAULT_PAGE_SIZE))

  const where = {
    ...(sp.status    ? { status: sp.status }       : {}),
    ...(sp.companyId ? { companyId: sp.companyId } : {}),
  }

  // Mark overdue on read so the UI is honest without a separate cron job.
  // (Not persisted — just a display state when an ISSUED invoice is past its dueAt.)
  const now = new Date()

  const [total, rows, companies, sumPaid, sumOpen] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        company: { select: { id: true, name: true } },
        _count:  { select: { items: true } },
      },
    }),
    prisma.company.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.invoice.aggregate({ where: { status: 'PAID' },   _sum: { total: true } }),
    prisma.invoice.aggregate({ where: { status: 'ISSUED' }, _sum: { total: true } }),
  ])

  const STATUSES = ['DRAFT', 'ISSUED', 'PAID', 'OVERDUE', 'CANCELLED']

  return (
    <Shell currentPath="/admin/invoices" title={t('inv_title')} subtitle={`${total.toLocaleString()} ${t('inv_subtitle')}`}>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <StatTile label={t('inv_stat_total')}     value={total.toLocaleString()} tone="neutral" />
        <StatTile label={t('inv_stat_outstanding')} value={money(sumOpen._sum.total ?? 0)} tone="warning" />
        <StatTile label={t('inv_stat_paid')}        value={money(sumPaid._sum.total ?? 0)} tone="success" />
      </div>

      {/* Generate-invoice panel (client component for the form) */}
      <GenerateInvoicePanel companies={companies} />

      {/* Filter form */}
      <form className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] px-5 py-3 my-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-faint)] mb-1">{t('label_status')}</label>
          <select name="status" defaultValue={sp.status ?? ''} className="border border-[var(--color-border-strong)] rounded-xl px-3 py-2 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)]">
            <option value="">{t('label_all_statuses')}</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-faint)] mb-1">{t('inv_company')}</label>
          <select name="companyId" defaultValue={sp.companyId ?? ''} className="border border-[var(--color-border-strong)] rounded-xl px-3 py-2 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)]">
            <option value="">{t('label_all')}</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <button type="submit" className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm font-semibold px-4 py-2 rounded-xl h-10">
          {t('btn_filter')}
        </button>
        {(sp.status || sp.companyId) && (
          <Link href="/admin/invoices" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)] border border-[var(--color-border-strong)] rounded-xl px-3 py-2 inline-flex items-center h-10">
            {t('btn_clear')}
          </Link>
        )}
      </form>

      {/* Table */}
      <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] overflow-x-auto">
        {rows.length === 0 ? (
          <p className="px-6 py-10 text-sm text-[var(--color-text-muted)] text-center">{t('inv_empty')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('inv_col_number')}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('inv_col_company')}</th>
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
                    <td className="px-4 py-3 text-[var(--color-text-strong)]">{inv.company.name}</td>
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
                      <Link href={`/admin/invoices/${inv.id}`} className="text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] font-medium">{t('btn_view')}</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <Pagination
        basePath="/admin/invoices"
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

function StatTile({ label, value, tone }: { label: string; value: string; tone: 'success' | 'warning' | 'neutral' }) {
  const cls =
    tone === 'success' ? 'text-green-700 dark:text-green-300' :
    tone === 'warning' ? 'text-yellow-700 dark:text-yellow-300' :
                         'text-[var(--color-text-strong)]'
  return (
    <div className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-faint)]">{label}</p>
      <p className={`mt-1 text-2xl md:text-3xl font-bold tabular-nums ${cls}`}>{value}</p>
    </div>
  )
}
