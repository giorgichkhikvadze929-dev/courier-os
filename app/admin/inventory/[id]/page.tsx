import { getSession } from '@/lib/session'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import Shell from '@/app/components/Shell'
import { getT } from '@/lib/i18n-server'
import { updateInventoryItem, adjustQuantity, deleteInventoryItem } from '../actions'

export default async function InventoryItemPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')

  const { t } = await getT()
  const { id } = await params

  const item = await prisma.inventoryItem.findUnique({
    where: { id },
    include: { createdBy: { select: { name: true, email: true } } },
  })
  if (!item) notFound()

  // History — every audit entry for this inventory item, newest first
  const history = await prisma.auditLog.findMany({
    where: { entity: 'InventoryItem', entityId: id },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { actor: { select: { name: true, role: true } } },
  })

  const ACTION_COLOR: Record<string, string> = {
    CREATE: 'bg-green-500/15 text-green-700 dark:text-green-300',
    UPDATE: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
    DELETE: 'bg-red-500/15 text-red-700 dark:text-red-300',
  }

  return (
    <Shell currentPath="/admin/inventory">
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/admin/inventory" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)]">← {t('inventory_title')}</Link>
          <span className="text-[var(--color-text-faint)]">/</span>
          <span className="text-sm font-medium text-[var(--color-text-strong)]">{item.name}</span>
        </div>
        <form action={deleteInventoryItem.bind(null, id)}>
          <button className="text-sm text-[var(--color-danger)] border border-[var(--color-border)] rounded-xl px-4 py-2 hover:bg-red-500/10 transition-colors">
            {t('inventory_delete')}
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Edit form */}
        <div className="lg:col-span-2 bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-6">
          <p className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide mb-4">{t('inventory_details')}</p>
          <form action={updateInventoryItem.bind(null, id)} className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">{t('label_name')}</label>
              <input name="name" required defaultValue={item.name} className="w-full border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">{t('inventory_sku')}</label>
              <input name="sku" defaultValue={item.sku ?? ''} className="w-full border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">{t('inventory_quantity')}</label>
              <input name="quantity" type="number" min={0} defaultValue={item.quantity} className="w-full border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">{t('inventory_location')}</label>
              <input name="location" defaultValue={item.location ?? ''} className="w-full border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">{t('label_notes')}</label>
              <textarea name="notes" rows={3} defaultValue={item.notes ?? ''} className="w-full border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none" />
            </div>
            <div className="col-span-2">
              <button type="submit" className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-semibold rounded-xl py-2.5 px-5 text-sm transition-colors">
                {t('btn_save_changes')}
              </button>
            </div>
          </form>

          {/* Quick stock adjust */}
          <div className="mt-6 pt-6 border-t border-[var(--color-border)]">
            <p className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide mb-3">{t('inventory_quick_adjust')}</p>
            <form action={adjustQuantity.bind(null, id)} className="flex flex-wrap gap-2 items-end">
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">{t('inventory_delta')}</label>
                <input name="delta" type="number" placeholder="+10 / -5" required className="w-32 border border-[var(--color-border-strong)] rounded-xl px-3 py-2 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">{t('label_note')}</label>
                <input name="note" placeholder={t('inventory_adjust_note_placeholder')} className="w-full border border-[var(--color-border-strong)] rounded-xl px-3 py-2 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
              </div>
              <button type="submit" className="bg-[var(--color-warning)] hover:opacity-90 text-white font-semibold rounded-xl py-2 px-4 text-sm transition-colors">
                {t('inventory_apply')}
              </button>
            </form>
          </div>
        </div>

        {/* Sidebar — meta + history */}
        <div className="flex flex-col gap-4">
          <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-5">
            <p className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide mb-3">{t('inventory_meta')}</p>
            <dl className="text-sm space-y-2">
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--color-text-muted)]">{t('inventory_quantity')}</dt>
                <dd className={`font-bold text-2xl ${item.quantity < 10 ? 'text-[var(--color-warning)]' : 'text-[var(--color-text-strong)]'}`}>{item.quantity}</dd>
              </div>
              <div className="flex justify-between gap-3"><dt className="text-[var(--color-text-muted)]">{t('inventory_sku')}</dt><dd className="font-mono text-xs">{item.sku ?? '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-[var(--color-text-muted)]">{t('inventory_location')}</dt><dd>{item.location ?? '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-[var(--color-text-muted)]">{t('inventory_created_by')}</dt><dd>{item.createdBy?.name ?? '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-[var(--color-text-muted)]">{t('inventory_created_at')}</dt><dd className="text-xs">{new Date(item.createdAt).toLocaleString()}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-[var(--color-text-muted)]">{t('inventory_updated')}</dt><dd className="text-xs">{new Date(item.updatedAt).toLocaleString()}</dd></div>
            </dl>
          </div>
        </div>
      </div>

      {/* History panel — full width below */}
      <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-5 mt-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-[var(--color-text-strong)]">{t('history_title')}</p>
          <span className="text-xs text-[var(--color-text-muted)]">{history.length} {history.length === 1 ? t('history_entry') : t('history_entries')}</span>
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] py-4">{t('history_empty')}</p>
        ) : (
          <ol className="relative border-l border-[var(--color-border)] ml-2 space-y-4">
            {history.map((h) => (
              <li key={h.id} className="ml-4">
                <div className="absolute -left-1.5 w-3 h-3 bg-[var(--color-primary)] rounded-full border-2 border-[var(--color-card)]" />
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full ${ACTION_COLOR[h.action] ?? 'bg-slate-500/15 text-slate-700 dark:text-slate-300'}`}>
                    {h.action}
                  </span>
                  <p className="text-xs text-[var(--color-text-faint)]">{new Date(h.createdAt).toLocaleString()}</p>
                  {h.actor && <p className="text-xs text-[var(--color-text-muted)]">— {h.actor.name} ({h.actor.role})</p>}
                </div>
                {h.note && <p className="text-sm text-[var(--color-text)] mt-1">{h.note}</p>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </Shell>
  )
}
