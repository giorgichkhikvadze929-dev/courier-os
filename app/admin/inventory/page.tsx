import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import Shell from '@/app/components/Shell'
import FilterPanel from '@/app/components/FilterPanel'
import Pagination from '@/app/components/Pagination'
import { getT } from '@/lib/i18n-server'

const DEFAULT_PAGE_SIZE = 20

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; lowStock?: string; page?: string; pageSize?: string }>
}) {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')

  const { t } = await getT()
  const sp = await searchParams
  const { q, lowStock } = sp
  const page = Math.max(1, Number(sp.page) || 1)
  const pageSize = Math.min(250, Math.max(5, Number(sp.pageSize) || DEFAULT_PAGE_SIZE))

  const where = {
    ...(q ? {
      OR: [
        { name: { contains: q } },
        { sku: { contains: q } },
        { location: { contains: q } },
      ],
    } : {}),
    ...(lowStock === '1' ? { quantity: { lt: 10 } } : {}),
  }

  const [total, items, totalsAgg, lowStockCount] = await Promise.all([
    prisma.inventoryItem.count({ where }),
    prisma.inventoryItem.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.inventoryItem.aggregate({ _sum: { quantity: true }, _count: true }),
    prisma.inventoryItem.count({ where: { quantity: { lt: 10 } } }),
  ])

  const activeFilterCount = [q, lowStock === '1' ? '1' : null].filter(Boolean).length

  return (
    <Shell
      currentPath="/admin/inventory"
      title={t('inventory_title')}
      subtitle={`${total.toLocaleString()} ${t('inventory_records')}`}
      actions={
        <Link
          href="/admin/inventory/new"
          className="inline-flex items-center gap-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          + {t('inventory_new')}
        </Link>
      }
    >
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] px-5 py-4">
          <p className="text-xs font-medium text-[var(--color-text-muted)]">{t('inventory_total_items')}</p>
          <p className="text-3xl font-bold text-[var(--color-text-strong)] mt-1">{totalsAgg._count.toLocaleString()}</p>
        </div>
        <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] px-5 py-4">
          <p className="text-xs font-medium text-[var(--color-text-muted)]">{t('inventory_total_qty')}</p>
          <p className="text-3xl font-bold text-[var(--color-text-strong)] mt-1">{(totalsAgg._sum.quantity ?? 0).toLocaleString()}</p>
        </div>
        <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] px-5 py-4">
          <p className="text-xs font-medium text-[var(--color-text-muted)]">{t('inventory_low_stock')}</p>
          <p className={`text-3xl font-bold mt-1 ${lowStockCount > 0 ? 'text-[var(--color-warning)]' : 'text-[var(--color-text-strong)]'}`}>
            {lowStockCount.toLocaleString()}
          </p>
        </div>
      </div>

      <FilterPanel
        activeCount={activeFilterCount}
        labels={{ filters: t('filters_title'), show: t('filters_show'), hide: t('filters_hide'), active: t('filters_active') }}
      >
        <form className="flex flex-wrap gap-2 items-end">
          <input type="hidden" name="page" value="1" />
          <input type="hidden" name="pageSize" value={String(pageSize)} />
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-faint)] mb-1">{t('btn_search')}</label>
            <input
              name="q"
              defaultValue={q ?? ''}
              placeholder={t('label_search_placeholder')}
              className="border border-[var(--color-border-strong)] rounded-xl px-4 py-2 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] w-56"
            />
          </div>
          <label className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text)] bg-[var(--color-card-hover)] rounded-xl cursor-pointer h-10">
            <input type="checkbox" name="lowStock" value="1" defaultChecked={lowStock === '1'} className="rounded" />
            {t('inventory_only_low_stock')}
          </label>
          <button type="submit" className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors h-10">
            {t('btn_filter')}
          </button>
          {activeFilterCount > 0 && (
            <Link href="/admin/inventory" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)] border border-[var(--color-border-strong)] rounded-xl px-4 py-2 inline-flex items-center h-10">
              {t('btn_clear')}
            </Link>
          )}
        </form>
      </FilterPanel>

      {items.length === 0 ? (
        <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-10 text-center">
          <p className="text-[var(--color-text-muted)] text-sm">{t('inventory_empty')}</p>
          <Link href="/admin/inventory/new" className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] text-sm font-medium mt-2 inline-block">
            {t('inventory_create_first')}
          </Link>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden flex flex-col gap-3">
            {items.map((it) => (
              <Link
                key={it.id}
                href={`/admin/inventory/${it.id}`}
                className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] p-4 hover:border-[var(--color-border-strong)] transition-colors block"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="font-semibold text-[var(--color-text-strong)]">{it.name}</p>
                  <span className={`text-2xl font-bold ${it.quantity < 10 ? 'text-[var(--color-warning)]' : 'text-[var(--color-text-strong)]'}`}>
                    {it.quantity}
                  </span>
                </div>
                {it.sku && <p className="text-xs font-mono text-[var(--color-text-faint)]">{it.sku}</p>}
                {it.location && <p className="text-xs text-[var(--color-text-muted)] mt-1">{it.location}</p>}
              </Link>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('label_name')}</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('inventory_sku')}</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('inventory_quantity')}</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide hidden lg:table-cell">{t('inventory_location')}</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide hidden lg:table-cell">{t('inventory_updated')}</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-card-hover)]">
                    <td className="px-6 py-3 font-semibold text-[var(--color-text-strong)]">{it.name}</td>
                    <td className="px-6 py-3 font-mono text-xs text-[var(--color-text-muted)]">{it.sku ?? '—'}</td>
                    <td className={`px-6 py-3 font-semibold ${it.quantity < 10 ? 'text-[var(--color-warning)]' : 'text-[var(--color-text-strong)]'}`}>
                      {it.quantity.toLocaleString()}
                    </td>
                    <td className="px-6 py-3 text-[var(--color-text-muted)] hidden lg:table-cell">{it.location ?? '—'}</td>
                    <td className="px-6 py-3 text-xs text-[var(--color-text-faint)] hidden lg:table-cell">{new Date(it.updatedAt).toLocaleString()}</td>
                    <td className="px-6 py-3 text-right">
                      <Link href={`/admin/inventory/${it.id}`} className="text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] font-medium">
                        {t('btn_open')}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Pagination
        basePath="/admin/inventory"
        query={sp as Record<string, string | undefined>}
        page={page}
        pageSize={pageSize}
        total={total}
        labels={{
          prev: t('page_prev'),
          next: t('page_next'),
          page: t('page_label'),
          of: t('page_of'),
          perPage: t('page_per_page'),
          showing: t('page_showing'),
        }}
      />
    </Shell>
  )
}
