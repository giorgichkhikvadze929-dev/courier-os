import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import Shell from '@/app/components/Shell'
import Pagination from '@/app/components/Pagination'
import VerifyPanel from './VerifyPanel'
import ReconciliationPanel from './ReconciliationPanel'
import SortPicker from '../deliveries/SortPicker'
import { getT } from '@/lib/i18n-server'

const DEFAULT_PAGE_SIZE = 50

type SortField = 'createdAt' | 'customerName' | 'trackingNumber' | 'zone'
const SORT_FIELDS: Record<SortField, boolean> = {
  createdAt: true, customerName: true, trackingNumber: true, zone: true,
}

/**
 * Verify queue. Mirrors the /admin/deliveries UX patterns now:
 *   - SortPicker dropdown above the list
 *   - Search input that matches on tracking number / customer / phone
 *   - Mobile cards (in VerifyPanel) + desktop table
 *   - Pagination
 *   - Reconciliation panel up top (top 10 + "Show all →")
 */
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string; sort?: string; q?: string }>
}) {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')

  const { t, lang } = await getT()
  const sp = await searchParams

  const page = Math.max(1, Number(sp.page) || 1)
  const pageSize = Math.min(250, Math.max(10, Number(sp.pageSize) || DEFAULT_PAGE_SIZE))

  // Unpack the SortPicker's "field:dir" param.
  let sortBy: SortField = 'createdAt'
  let sortDir: 'asc' | 'desc' = 'asc'
  if (sp.sort && sp.sort.includes(':')) {
    const [f, d] = sp.sort.split(':')
    if (f in SORT_FIELDS) sortBy = f as SortField
    sortDir = d === 'desc' ? 'desc' : 'asc'
  }

  const q = sp.q?.trim() || null

  const where = {
    status: 'RECEIVED' as const,
    ...(q ? {
      OR: [
        { trackingNumber: { contains: q } },
        { customerName:   { contains: q } },
        { customerPhone:  { contains: q } },
      ],
    } : {}),
  }

  const orderBy = sortBy === 'zone'
    ? [{ zone: { sort: sortDir, nulls: 'last' as const } }]
    : [{ [sortBy]: sortDir }]

  const [rows, totalPending] = await Promise.all([
    prisma.delivery.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, trackingNumber: true, status: true,
        customerName: true, customerPhone: true, dropoffAddress: true,
        zone: true, packageType: true,
        company: { select: { name: true } },
      },
    }),
    prisma.delivery.count({ where }),
  ])

  const parcelWord = totalPending === 1 ? t('parcel_word') : t('parcel_word_plural')
  const subtitle = totalPending > rows.length
    ? `${t('page_showing')} ${rows.length} ${t('page_of')} ${totalPending.toLocaleString()} · ${totalPending.toLocaleString()} ${parcelWord} ${t('verify_subtitle')}`
    : `${totalPending.toLocaleString()} ${parcelWord} ${t('verify_subtitle')}`

  return (
    <Shell
      currentPath="/admin/verify"
      title={t('title_verify')}
      subtitle={subtitle}
    >
      <ReconciliationPanel lang={lang} limit={10} />

      {/* Search + sort row — matches the /admin/deliveries pattern. */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <form className="flex gap-2 items-end">
          {sp.sort && <input type="hidden" name="sort" value={sp.sort} />}
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-faint)] mb-1">
              {t('btn_search')}
            </label>
            <input
              name="q"
              defaultValue={q ?? ''}
              placeholder={t('label_search_placeholder')}
              className="border border-[var(--color-border-strong)] rounded-xl px-4 py-2 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] w-56"
            />
          </div>
          <button type="submit" className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors h-10">
            {t('btn_filter')}
          </button>
          {q && (
            <Link href="/admin/verify" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)] border border-[var(--color-border-strong)] rounded-xl px-3 py-2 inline-flex items-center h-10">
              {t('btn_clear')}
            </Link>
          )}
        </form>
        <SortPicker
          current={`${sortBy}:${sortDir}`}
          labels={{
            label:     t('sort_label'),
            newest:    t('sort_newest'),
            oldest:    t('sort_oldest'),
            nameAZ:    t('sort_name_az'),
            nameZA:    t('sort_name_za'),
            valueHigh: t('sort_value_high'),
            valueLow:  t('sort_value_low'),
            status:    t('sort_status'),
            priority:  t('sort_priority'),
            zone:      t('sort_zone'),
          }}
        />
      </div>

      <VerifyPanel rows={rows} lang={lang} totalPending={totalPending} />
      <Pagination
        basePath="/admin/verify"
        query={sp as Record<string, string | undefined>}
        page={page}
        pageSize={pageSize}
        total={totalPending}
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
