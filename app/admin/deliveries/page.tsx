import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import Shell from '@/app/components/Shell'
import BulkPanel from './BulkPanel'
import SortPicker from './SortPicker'
import Pagination from '@/app/components/Pagination'
import ActiveFilterChips, { type Chip } from '@/app/components/ActiveFilterChips'
import { IconUpload } from '@/app/components/Icons'
import { ZONES } from '@/app/components/StatusBadge'
import { getT } from '@/lib/i18n-server'
import { tStatus, tZone, tPriority, tPackage } from '@/lib/i18n'

const PRIORITIES   = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const
const PACKAGE_TYPES = ['SMALL', 'MEDIUM', 'LARGE', 'FRAGILE', 'DOCUMENT'] as const
const DEFAULT_PAGE_SIZE = 20

const ACTIVE_STATUSES    = ['RECEIVED', 'IN_WAREHOUSE', 'ASSIGNED', 'IN_TRANSIT'] as const
const COMPLETED_STATUSES = ['DELIVERED', 'FAILED', 'REFUSED', 'RETURNED'] as const

type SortField =
  | 'trackingNumber' | 'customerName' | 'customerPhone'
  | 'status' | 'priority' | 'zone' | 'packageType'
  | 'codAmount' | 'createdAt'
const SORT_FIELDS: Record<SortField, string> = {
  trackingNumber: 'trackingNumber',
  customerName:   'customerName',
  customerPhone:  'customerPhone',
  status:         'status',
  priority:       'priority',
  zone:           'zone',
  packageType:    'packageType',
  codAmount:      'codAmount',
  createdAt:      'createdAt',
}

export default async function AdminDeliveriesPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: 'active' | 'completed'
    status?: string
    q?: string
    zone?: string
    priority?: string
    courier?: string
    packageType?: string
    sortBy?: string
    sortDir?: 'asc' | 'desc'
    sort?: string        // shorthand: "field:dir" — set by the sort dropdown
    page?: string
    pageSize?: string
  }>
}) {
  const session = await getSession()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')

  const { t, lang } = await getT()
  const sp = await searchParams
  const { status, q, zone, priority, courier, packageType } = sp

  const view: 'active' | 'completed' = sp.view === 'completed' ? 'completed' : 'active'

  const page = Math.max(1, Number(sp.page) || 1)
  const pageSize = Math.min(250, Math.max(5, Number(sp.pageSize) || DEFAULT_PAGE_SIZE))

  // The compact sort dropdown packs "field:dir" into a single `sort` param —
  // unpack it here. Fall back to the older sortBy / sortDir pair so older
  // bookmarks keep working.
  let rawSortBy = sp.sortBy
  let rawSortDir: string | undefined = sp.sortDir
  if (sp.sort && sp.sort.includes(':')) {
    const [f, d] = sp.sort.split(':')
    rawSortBy  = f
    rawSortDir = d
  }
  const sortBy: SortField | undefined = rawSortBy && (rawSortBy in SORT_FIELDS) ? rawSortBy as SortField : undefined
  const sortDir: 'asc' | 'desc' = rawSortDir === 'asc' ? 'asc' : 'desc'

  // ── WHERE: scoped to the active or completed bucket ──────────────
  const bucketStatuses = view === 'completed' ? COMPLETED_STATUSES : ACTIVE_STATUSES
  // If user picked a specific status, narrow within the bucket; else use bucket statuses
  const statusInBucket = status && (bucketStatuses as readonly string[]).includes(status)
    ? { status }
    : { status: { in: [...bucketStatuses] } }

  const where = {
    ...statusInBucket,
    ...(zone ? { zone } : {}),
    ...(priority ? { priority } : {}),
    ...(packageType ? { packageType } : {}),
    ...(courier ? { courierId: courier } : {}),
    ...(q ? {
      OR: [
        { trackingNumber: { contains: q } },
        { customerName: { contains: q } },
        { customerPhone: { contains: q } },
      ],
    } : {}),
  }

  // ── ORDER BY ─────────────────────────────────────────────────────
  // When user picks a sort, sort by that. Otherwise active uses
  // [status asc, createdAt desc] and completed uses [updatedAt desc].
  // For nullable columns (codAmount, zone) push nulls to the end so "highest
  // value" / "by zone" actually surface meaningful rows first.
  const NULLABLE_FIELDS = new Set(['codAmount', 'zone', 'packageType'])
  const orderBy = sortBy
    ? [NULLABLE_FIELDS.has(sortBy)
        ? { [sortBy]: { sort: sortDir, nulls: 'last' as const } }
        : { [sortBy]: sortDir }]
    : view === 'completed'
      ? [{ updatedAt: 'desc' as const }]
      : [{ status: 'asc' as const }, { createdAt: 'desc' as const }]

  const [
    activeCountTotal,
    completedCountTotal,
    total,
    deliveries,
    couriers,
    workload,
  ] = await Promise.all([
    prisma.delivery.count({ where: { status: { in: [...ACTIVE_STATUSES] } } }),
    prisma.delivery.count({ where: { status: { in: [...COMPLETED_STATUSES] } } }),
    prisma.delivery.count({ where }),
    prisma.delivery.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, trackingNumber: true, status: true, priority: true,
        customerName: true, customerPhone: true, dropoffAddress: true,
        zone: true, packageType: true, codAmount: true,
        courier: { select: { name: true } },
      },
    }),
    prisma.user.findMany({ where: { role: 'COURIER', active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.delivery.groupBy({
      by: ['courierId'],
      where: { courierId: { not: null }, status: { in: ['ASSIGNED', 'IN_TRANSIT'] } },
      _count: { _all: true },
    }),
  ])

  const loadByCourier: Record<string, number> = {}
  for (const w of workload) if (w.courierId) loadByCourier[w.courierId] = w._count._all
  const couriersWithLoad = couriers
    .map((c) => ({ id: c.id, name: c.name, load: loadByCourier[c.id] ?? 0 }))
    .sort((a, b) => a.load - b.load)

  const resultWord = total === 1 ? t('results_word') : t('results_word_plural')
  const activeFilterCount = [q, status, zone, priority, courier, packageType].filter(Boolean).length

  // Statuses to show in the status dropdown — only those in the current bucket
  const bucketStatusOptions = bucketStatuses

  // Helper: build a tab href that preserves filters but resets pagination + sort
  function tabHref(targetView: 'active' | 'completed') {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(sp)) {
      if (v != null && v !== '' && k !== 'view' && k !== 'page' && k !== 'sortBy' && k !== 'sortDir' && k !== 'status') {
        params.set(k, String(v))
      }
    }
    if (targetView === 'completed') params.set('view', 'completed')
    const qs = params.toString()
    return qs ? `/admin/deliveries?${qs}` : '/admin/deliveries'
  }

  return (
    <Shell
      currentPath="/admin/deliveries"
      title={t('title_deliveries')}
      subtitle={`${total.toLocaleString()} ${resultWord}`}
      actions={
        <Link href="/admin/import" className="inline-flex items-center gap-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          <IconUpload /> {t('nav_import')}
        </Link>
      }
    >
      {/* View tabs: Active vs Completed */}
      <div className="flex items-center gap-1 border-b border-[var(--color-border)] mb-4 overflow-x-auto">
        <Link
          href={tabHref('active')}
          className={`relative px-4 py-2.5 text-sm font-semibold transition-colors -mb-px border-b-2 ${
            view === 'active'
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          {t('view_active')}
          <span className={`ml-2 inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded-full text-[10px] font-bold ${
            view === 'active' ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-card-hover)] text-[var(--color-text-muted)]'
          }`}>
            {activeCountTotal.toLocaleString()}
          </span>
        </Link>
        <Link
          href={tabHref('completed')}
          className={`relative px-4 py-2.5 text-sm font-semibold transition-colors -mb-px border-b-2 ${
            view === 'completed'
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          {t('view_completed')}
          <span className={`ml-2 inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded-full text-[10px] font-bold ${
            view === 'completed' ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-card-hover)] text-[var(--color-text-muted)]'
          }`}>
            {completedCountTotal.toLocaleString()}
          </span>
        </Link>
      </div>

      {/* ── "Search Parcels" card — mirrors the mockup's "Search Inventory"
          section: a single card that bundles search + category chips
          (here, status quick-chips) + filter row inside clear borders. */}
      <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-5 sm:p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--color-text-strong)]">{t('search_parcels_title')}</h2>
          {activeFilterCount > 0 && (
            <Link href={`/admin/deliveries${view === 'completed' ? '?view=completed' : ''}`} className="text-xs font-semibold text-red-600 dark:text-red-300 hover:underline">
              {t('btn_clear')}
            </Link>
          )}
        </div>

      {/* Quick status chips — one click swaps the status filter. Shown in
          the Active tab; the Completed tab gets its own subset below. */}
      {view === 'active' && (
        <div className="flex flex-wrap gap-2 mb-4">
          {([
            { key: '',             label: t('label_all') },
            { key: 'RECEIVED',     label: tStatus('RECEIVED', lang) },
            { key: 'IN_WAREHOUSE', label: tStatus('IN_WAREHOUSE', lang) },
            { key: 'ASSIGNED',     label: tStatus('ASSIGNED', lang) },
            { key: 'IN_TRANSIT',   label: tStatus('IN_TRANSIT', lang) },
          ] as const).map((c) => {
            const params = new URLSearchParams()
            for (const [k, v] of Object.entries(sp)) {
              if (v != null && v !== '' && k !== 'status' && k !== 'page') params.set(k, String(v))
            }
            if (c.key) params.set('status', c.key)
            const qs = params.toString()
            const href = `/admin/deliveries${qs ? `?${qs}` : ''}`
            const isActive = (status ?? '') === c.key
            return (
              <Link
                key={c.key || 'all'}
                href={href}
                className={`text-xs font-semibold rounded-full px-3 py-1.5 border transition-colors ${
                  isActive
                    ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                    : 'bg-[var(--color-card)] text-[var(--color-text)] border-[var(--color-border-strong)] hover:border-[var(--color-primary)]'
                }`}
              >
                {c.label}
              </Link>
            )
          })}
        </div>
      )}
      {view === 'completed' && (
        <div className="flex flex-wrap gap-2 mb-3">
          {([
            { key: '',         label: t('label_all') },
            { key: 'DELIVERED',label: tStatus('DELIVERED', lang) },
            { key: 'FAILED',   label: tStatus('FAILED', lang) },
            { key: 'REFUSED',  label: tStatus('REFUSED', lang) },
            { key: 'RETURNED', label: tStatus('RETURNED', lang) },
          ] as const).map((c) => {
            const params = new URLSearchParams()
            for (const [k, v] of Object.entries(sp)) {
              if (v != null && v !== '' && k !== 'status' && k !== 'page') params.set(k, String(v))
            }
            params.set('view', 'completed')
            if (c.key) params.set('status', c.key)
            const qs = params.toString()
            const href = `/admin/deliveries?${qs}`
            const isActive = (status ?? '') === c.key
            return (
              <Link
                key={c.key || 'all'}
                href={href}
                className={`text-xs font-semibold rounded-full px-3 py-1.5 border transition-colors ${
                  isActive
                    ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                    : 'bg-[var(--color-card)] text-[var(--color-text)] border-[var(--color-border-strong)] hover:border-[var(--color-primary)]'
                }`}
              >
                {c.label}
              </Link>
            )
          })}
        </div>
      )}

      <p className="text-xs text-[var(--color-text-faint)] mb-4">
        {view === 'active' ? t('view_active_subtitle') : t('view_completed_subtitle')}
      </p>

      <ActiveFilterChips
        basePath="/admin/deliveries"
        query={sp as Record<string, string | undefined>}
        clearAllLabel={t('btn_clear')}
        chips={
          [
            q          ? { key: 'q',           label: t('btn_search'),          value: q } : null,
            status     ? { key: 'status',      label: t('label_status'),        value: tStatus(status, lang) } : null,
            priority   ? { key: 'priority',    label: t('label_priority'),      value: tPriority(priority, lang) } : null,
            zone       ? { key: 'zone',        label: t('label_zone'),          value: tZone(zone, lang) } : null,
            packageType? { key: 'packageType', label: t('package_type_label'),  value: tPackage(packageType, lang) } : null,
            courier    ? { key: 'courier',     label: t('label_courier'),       value: couriers.find((c) => c.id === courier)?.name ?? courier } : null,
          ].filter((x): x is Chip => x !== null)
        }
      />

      {/* Always-visible filter row — previously hidden behind a "Show
          filters" toggle that no one opened. Search + courier + zone are
          the three filters admins use most when triaging a backlog. */}
      <form className="flex flex-wrap gap-2 items-end mb-3 p-3 bg-[var(--color-card)] rounded-xl border border-[var(--color-border)]">
        <input type="hidden" name="view" value={view} />
        <input type="hidden" name="page" value="1" />
        <input type="hidden" name="pageSize" value={String(pageSize)} />
        {status      && <input type="hidden" name="status"      value={status} />}
        {priority    && <input type="hidden" name="priority"    value={priority} />}
        {packageType && <input type="hidden" name="packageType" value={packageType} />}

        <div>
          <label className="block text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-faint)] mb-1">{t('btn_search')}</label>
          <input
            name="q"
            defaultValue={q ?? ''}
            placeholder={t('label_search_placeholder')}
            className="border border-[var(--color-border-strong)] rounded-xl px-4 py-2 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] w-56"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-faint)] mb-1">{t('label_courier')}</label>
          <select name="courier" defaultValue={courier ?? ''} className="border border-[var(--color-border-strong)] rounded-xl px-4 py-2 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] h-10">
            <option value="">{t('label_all')}</option>
            {couriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-faint)] mb-1">{t('label_zone')}</label>
          <select name="zone" defaultValue={zone ?? ''} className="border border-[var(--color-border-strong)] rounded-xl px-4 py-2 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] h-10">
            <option value="">{t('label_all')}</option>
            {ZONES.map((z) => <option key={z} value={z}>{tZone(z, lang)}</option>)}
          </select>
        </div>
        <button type="submit" className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors h-10">
          {t('btn_filter')}
        </button>
      </form>
      </div>

      <div className="flex items-center justify-end gap-3 mb-3">
        <SortPicker
          current={sortBy ? `${sortBy}:${sortDir}` : 'createdAt:desc'}
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

      <BulkPanel
        deliveries={deliveries}
        couriers={couriersWithLoad}
        lang={lang}
        view={view}
        sortBy={sortBy}
        sortDir={sortDir}
        searchParams={sp as Record<string, string | undefined>}
        trackingFilter={{
          // Quick presets: clear (= all items), only in-stock, only awaiting verify.
          paramKey: 'status',
          currentValue: status,
          currentLabel:
            status === 'IN_WAREHOUSE' ? t('quick_in_stock') :
            status === 'RECEIVED'     ? t('quick_verify') :
            undefined,
          options: [
            { value: 'IN_WAREHOUSE', label: t('quick_in_stock') },
            { value: 'RECEIVED',    label: t('quick_verify') },
          ],
          allLabel: t('quick_all_items'),
        }}
        statusFilter={{
          paramKey: 'status',
          currentValue: status,
          currentLabel: status ? tStatus(status, lang) : undefined,
          options: bucketStatusOptions.map((s) => ({ value: s, label: tStatus(s, lang) })),
          allLabel: t('label_all_statuses'),
        }}
        priorityFilter={{
          paramKey: 'priority',
          currentValue: priority,
          currentLabel: priority ? tPriority(priority, lang) : undefined,
          options: PRIORITIES.map((p) => ({ value: p, label: tPriority(p, lang) })),
          allLabel: t('label_all'),
        }}
        zoneFilter={{
          paramKey: 'zone',
          currentValue: zone,
          currentLabel: zone ? tZone(zone, lang) : undefined,
          options: ZONES.map((z) => ({ value: z, label: tZone(z, lang) })),
          allLabel: t('label_all_zones'),
        }}
        packageFilter={{
          paramKey: 'packageType',
          currentValue: packageType,
          currentLabel: packageType ? tPackage(packageType, lang) : undefined,
          options: PACKAGE_TYPES.map((p) => ({ value: p, label: tPackage(p, lang) })),
          allLabel: t('package_all'),
        }}
      />

      <Pagination
        basePath="/admin/deliveries"
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
