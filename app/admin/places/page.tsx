import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import Shell from '@/app/components/Shell'
import Pagination from '@/app/components/Pagination'
import { ZONES } from '@/app/components/StatusBadge'
import { getT } from '@/lib/i18n-server'
import { tZone } from '@/lib/i18n'

const DEFAULT_PAGE_SIZE = 50

const TYPE_BADGE: Record<string, string> = {
  CITY:         'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  TOWN:         'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
  VILLAGE:      'bg-green-500/15 text-green-700 dark:text-green-300',
  DISTRICT:     'bg-purple-500/15 text-purple-700 dark:text-purple-300',
  MUNICIPALITY: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
}

export default async function PlacesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; region?: string; page?: string; pageSize?: string }>
}) {
  const session = await getSession()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')

  const { t, lang } = await getT()
  const sp = await searchParams
  const page = Math.max(1, Number(sp.page) || 1)
  const pageSize = Math.min(250, Math.max(10, Number(sp.pageSize) || DEFAULT_PAGE_SIZE))

  const where = {
    ...(sp.region ? { regionCode: sp.region } : {}),
    ...(sp.q ? {
      OR: [
        { name:         { contains: sp.q } },
        { nameKa:       { contains: sp.q } },
        { municipality: { contains: sp.q } },
        { postalCode:   { contains: sp.q } },
      ],
    } : {}),
  }

  const [total, rows, regionCounts] = await Promise.all([
    prisma.geoPlace.count({ where }),
    prisma.geoPlace.findMany({
      where,
      orderBy: [{ regionCode: 'asc' }, { name: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.geoPlace.groupBy({ by: ['regionCode'], _count: { _all: true } }),
  ])

  const countByRegion: Record<string, number> = {}
  for (const r of regionCounts) countByRegion[r.regionCode] = r._count._all

  return (
    <Shell currentPath="/admin/settings" breadcrumb={{ href: '/admin/settings', label: t('back_to_settings') }} title={t('places_title')} subtitle={`${total.toLocaleString()} ${t('places_subtitle')}`}>
      {/* Region chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Link
          href="/admin/places"
          className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${
            !sp.region ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]' : 'border-[var(--color-border-strong)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          {t('label_all')} ({Object.values(countByRegion).reduce((a, b) => a + b, 0)})
        </Link>
        {ZONES.map((z) => (
          <Link
            key={z}
            href={`/admin/places?region=${z}`}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${
              sp.region === z ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]' : 'border-[var(--color-border-strong)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            {tZone(z, lang)} ({countByRegion[z] ?? 0})
          </Link>
        ))}
      </div>

      {/* Search */}
      <form className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] px-5 py-3 mb-4 flex flex-wrap items-end gap-2">
        {sp.region && <input type="hidden" name="region" value={sp.region} />}
        <div>
          <label className="block text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-faint)] mb-1">{t('btn_search')}</label>
          <input
            name="q"
            defaultValue={sp.q ?? ''}
            placeholder={t('places_search_placeholder')}
            className="border border-[var(--color-border-strong)] rounded-xl px-3 py-2 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] w-64"
          />
        </div>
        <button type="submit" className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm font-semibold px-4 py-2 rounded-xl h-10">
          {t('btn_search')}
        </button>
        {(sp.q || sp.region) && (
          <Link href="/admin/places" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)] border border-[var(--color-border-strong)] rounded-xl px-3 py-2 inline-flex items-center h-10">
            {t('btn_clear')}
          </Link>
        )}
      </form>

      {/* Table */}
      <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] overflow-x-auto">
        {rows.length === 0 ? (
          <p className="px-6 py-10 text-sm text-[var(--color-text-muted)] text-center">{t('places_empty')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('places_col_name')}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide hidden md:table-cell">{t('places_col_ka')}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('places_col_region')}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide hidden lg:table-cell">{t('places_col_municipality')}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('places_col_type')}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('places_col_postal')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-card-hover)]">
                  <td className="px-4 py-3 font-medium text-[var(--color-text-strong)]">{p.name}</td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)] hidden md:table-cell">{p.nameKa ?? '—'}</td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)] text-xs">{tZone(p.regionCode, lang)}</td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)] text-xs hidden lg:table-cell">{p.municipality ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-full ${TYPE_BADGE[p.type] ?? TYPE_BADGE.CITY}`}>{p.type}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[var(--color-text)]">{p.postalCode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Pagination
        basePath="/admin/places"
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
