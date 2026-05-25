import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Shell from '@/app/components/Shell'
import { getT } from '@/lib/i18n-server'
import { createInventoryItem } from '../actions'

export default async function NewInventoryItemPage() {
  const session = await getSession()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')

  const { t } = await getT()

  return (
    <Shell currentPath="/admin/inventory">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/inventory" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)]">← {t('inventory_title')}</Link>
        <span className="text-[var(--color-text-faint)]">/</span>
        <h1 className="text-lg font-bold text-[var(--color-text-strong)]">{t('inventory_new')}</h1>
      </div>

      <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-6 max-w-xl">
        <form action={createInventoryItem} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">{t('label_name')} <span className="text-red-500">*</span></label>
              <input name="name" required className="w-full border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" placeholder={t('inventory_name_placeholder')} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">{t('inventory_sku')}</label>
              <input name="sku" className="w-full border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" placeholder="SKU-001" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">{t('inventory_quantity')}</label>
              <input name="quantity" type="number" min={0} defaultValue={0} className="w-full border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">{t('inventory_location')}</label>
              <input name="location" className="w-full border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" placeholder={t('inventory_location_placeholder')} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">{t('label_notes')}</label>
              <textarea name="notes" rows={3} className="w-full border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" className="flex-1 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-semibold rounded-xl py-2.5 text-sm transition-colors">
              {t('btn_create')}
            </button>
            <Link href="/admin/inventory" className="flex-1 text-center border border-[var(--color-border-strong)] rounded-xl py-2.5 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-card-hover)] transition-colors">
              {t('btn_cancel')}
            </Link>
          </div>
        </form>
      </div>
    </Shell>
  )
}
