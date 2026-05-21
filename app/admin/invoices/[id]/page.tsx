import { auth } from '@/auth'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import Shell from '@/app/components/Shell'
import InvoiceActions from './InvoiceActions'
import { getT } from '@/lib/i18n-server'
import { money } from '@/lib/format'

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

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')

  const { t, lang } = await getT()
  const { id } = await params

  const inv = await prisma.invoice.findUnique({
    where: { id },
    include: {
      company: { select: { id: true, name: true, email: true, phone: true, address: true } },
      items: { include: { delivery: { select: { trackingNumber: true, customerName: true, zone: true, packageType: true, deliveredAt: true } } }, orderBy: { createdAt: 'asc' } },
    },
  })
  if (!inv) notFound()

  const now = new Date()
  const isOverdue = inv.status === 'ISSUED' && inv.dueAt && inv.dueAt.getTime() < now.getTime()
  const displayStatus = isOverdue ? 'OVERDUE' : inv.status

  return (
    <Shell currentPath="/admin/invoices" title={`${t('inv_title_one')} ${inv.invoiceNumber}`} subtitle={inv.company.name}>
      <div className="mb-4">
        <Link href="/admin/invoices" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
          ← {t('inv_back')}
        </Link>
      </div>

      {/* Header summary card */}
      <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-6 mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-faint)]">{t('inv_col_number')}</p>
          <p className="font-mono text-[var(--color-primary)] font-semibold mt-1">{inv.invoiceNumber}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-3">{t('inv_issued_at')}: {fmtDate(inv.issuedAt)}</p>
          <p className="text-xs text-[var(--color-text-muted)]">{t('inv_due_at')}: {fmtDate(inv.dueAt)}</p>
          {inv.paidAt && <p className="text-xs text-green-700 dark:text-green-300">{t('inv_paid_at')}: {fmtDate(inv.paidAt)}</p>}
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-faint)]">{t('inv_company')}</p>
          <p className="font-semibold text-[var(--color-text-strong)] mt-1">{inv.company.name}</p>
          {inv.company.email && <p className="text-xs text-[var(--color-text-muted)] mt-1">{inv.company.email}</p>}
          {inv.company.phone && <p className="text-xs text-[var(--color-text-muted)]">{inv.company.phone}</p>}
          {inv.company.address && <p className="text-xs text-[var(--color-text-muted)] mt-1">{inv.company.address}</p>}
        </div>
        <div className="md:text-right">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-faint)]">{t('inv_col_status')}</p>
          <span className={`inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-full mt-1 ${STATUS_BADGE[displayStatus] ?? STATUS_BADGE.DRAFT}`}>
            {displayStatus}
          </span>
          <p className="mt-3 text-3xl font-bold text-[var(--color-text-strong)] tabular-nums">{money(inv.total)}</p>
          <p className="text-xs text-[var(--color-text-muted)]">
            {t('inv_subtotal')}: {money(inv.subtotal)} · {t('inv_tax')} ({(inv.taxRate * 100).toFixed(0)}%): {money(inv.tax)}
          </p>
        </div>
      </div>

      {/* Actions */}
      <InvoiceActions invoiceId={inv.id} status={inv.status} lang={lang} />

      {/* Line items */}
      <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] overflow-x-auto mt-4">
        <div className="px-6 py-3 border-b border-[var(--color-border)]">
          <p className="text-sm font-semibold text-[var(--color-text)]">{t('inv_line_items')} ({inv.items.length})</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-card-hover)]">
            <tr>
              <th className="text-left px-4 py-2 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('inv_line_desc')}</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide hidden md:table-cell">{t('inv_line_delivered_to')}</th>
              <th className="text-right px-4 py-2 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('inv_line_qty')}</th>
              <th className="text-right px-4 py-2 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('inv_line_price')}</th>
              <th className="text-right px-4 py-2 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('inv_line_amount')}</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.map((item) => (
              <tr key={item.id} className="border-b border-[var(--color-border)] last:border-0">
                <td className="px-4 py-2 text-xs">
                  {item.delivery ? (
                    <Link href={`/admin/deliveries/${item.deliveryId}`} className="text-[var(--color-primary)] hover:underline font-mono">{item.delivery.trackingNumber}</Link>
                  ) : (
                    <span className="font-mono text-[var(--color-text)]">{item.description}</span>
                  )}
                  <p className="text-[var(--color-text-muted)]">{item.description}</p>
                </td>
                <td className="px-4 py-2 text-xs text-[var(--color-text-muted)] hidden md:table-cell">{item.delivery?.customerName ?? '—'}</td>
                <td className="px-4 py-2 text-right tabular-nums">{item.quantity}</td>
                <td className="px-4 py-2 text-right tabular-nums">{money(item.unitPrice)}</td>
                <td className="px-4 py-2 text-right font-semibold tabular-nums">{money(item.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-[var(--color-card-hover)]">
            <tr>
              <td colSpan={3} />
              <td className="px-4 py-2 text-right text-xs uppercase tracking-wider font-semibold text-[var(--color-text-muted)]">{t('inv_subtotal')}</td>
              <td className="px-4 py-2 text-right tabular-nums font-semibold">{money(inv.subtotal)}</td>
            </tr>
            <tr>
              <td colSpan={3} />
              <td className="px-4 py-2 text-right text-xs uppercase tracking-wider font-semibold text-[var(--color-text-muted)]">{t('inv_tax')} ({(inv.taxRate * 100).toFixed(0)}%)</td>
              <td className="px-4 py-2 text-right tabular-nums">{money(inv.tax)}</td>
            </tr>
            <tr>
              <td colSpan={3} />
              <td className="px-4 py-2 text-right text-sm font-bold uppercase tracking-wider text-[var(--color-text-strong)]">{t('inv_total')}</td>
              <td className="px-4 py-2 text-right text-lg tabular-nums font-bold text-[var(--color-text-strong)]">{money(inv.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {inv.notes && (
        <div className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] p-5 mt-4">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-faint)] mb-1">{t('inv_notes')}</p>
          <p className="text-sm text-[var(--color-text)] whitespace-pre-wrap">{inv.notes}</p>
        </div>
      )}
    </Shell>
  )
}
