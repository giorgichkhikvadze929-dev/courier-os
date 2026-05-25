import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import Shell from '@/app/components/Shell'
import { StatusBadge, PriorityBadge, ALL_STATUSES } from '@/app/components/StatusBadge'
import { getT } from '@/lib/i18n-server'
import { tStatus, tZone } from '@/lib/i18n'
import FilterPanel from '@/app/components/FilterPanel'
import Pagination from '@/app/components/Pagination'
import AutoRefresh from '@/app/components/AutoRefresh'
import { getActiveSession } from '@/lib/impersonation'
import { money } from '@/lib/format'

const DEFAULT_PAGE_SIZE = 20

export default async function CompanyParcelsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; from?: string; to?: string; page?: string; pageSize?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')
  const role = session.user?.role as string
  if (!['COMPANY', 'ADMIN'].includes(role)) redirect('/login')

  const { t, lang } = await getT()
  // Apply impersonation — when admin "previews as" a company user, query
  // their company's parcels, not none.
  const activeSession = await getActiveSession()
  const companyId = activeSession?.user.companyId ?? (session.user as { companyId?: string | null }).companyId
  const sp = await searchParams
  const { q, status, from, to } = sp
  const page = Math.max(1, Number(sp.page) || 1)
  const pageSize = Math.min(250, Math.max(5, Number(sp.pageSize) || DEFAULT_PAGE_SIZE))

  const fromDate = from ? new Date(from) : undefined
  const toDate = to ? new Date(`${to}T23:59:59.999`) : undefined

  const where = {
    ...(companyId ? { companyId } : {}),
    ...(status ? { status } : {}),
    ...(fromDate || toDate ? {
      createdAt: {
        ...(fromDate ? { gte: fromDate } : {}),
        ...(toDate   ? { lte: toDate }   : {}),
      },
    } : {}),
    ...(q ? {
      OR: [
        { trackingNumber: { contains: q } },
        { customerName: { contains: q } },
        { customerPhone: { contains: q } },
      ],
    } : {}),
  }

  const [total, deliveries] = await Promise.all([
    prisma.delivery.count({ where }),
    prisma.delivery.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { courier: { select: { name: true } } },
    }),
  ])

  const resultWord = total === 1 ? t('results_word') : t('results_word_plural')

  return (
    <Shell
      currentPath="/company/parcels"
      title={t('title_my_parcels')}
      subtitle={`${total.toLocaleString()} ${resultWord}`}
      actions={(() => {
        const qs = new URLSearchParams(
          Object.entries({ q, status, from, to })
            .filter(([, v]) => !!v) as [string, string][],
        ).toString()
        const qsuffix = qs ? `?${qs}` : ''
        return (
          <>
            <a href={`/company/export${qsuffix}`} className="inline-flex items-center gap-2 bg-[var(--color-card-hover)] hover:bg-[var(--color-border)] text-[var(--color-text)] text-sm font-semibold px-4 py-2 rounded-lg border border-[var(--color-border)] transition-colors">
              {t('btn_export_excel')}
            </a>
            <a href={`/company/export/pdf${qsuffix}`} className="inline-flex items-center gap-2 bg-[var(--color-card-hover)] hover:bg-[var(--color-border)] text-[var(--color-text)] text-sm font-semibold px-4 py-2 rounded-lg border border-[var(--color-border)] transition-colors">
              {t('btn_export_pdf')}
            </a>
          </>
        )
      })()}
    >
      <AutoRefresh intervalMs={30_000} />
      <FilterPanel
        activeCount={[q, status, from, to].filter(Boolean).length}
        labels={{ filters: t('filters_title'), show: t('filters_show'), hide: t('filters_hide'), active: t('filters_active') }}
      >
        <form className="flex flex-wrap gap-2 items-end">
          <input type="hidden" name="page" value="1" />
          <input type="hidden" name="pageSize" value={String(pageSize)} />
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">{t('btn_search')}</label>
            <input
              name="q"
              defaultValue={q ?? ''}
              placeholder={t('label_search_placeholder')}
              className="border border-[var(--color-border-strong)] rounded-xl px-4 py-2 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] w-56"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">{t('label_status')}</label>
            <select name="status" defaultValue={status ?? ''} className="border border-[var(--color-border-strong)] rounded-xl px-4 py-2 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
              <option value="">{t('label_all_statuses')}</option>
              {ALL_STATUSES.map((s) => <option key={s} value={s}>{tStatus(s, lang)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">{t('label_from')}</label>
            <input type="date" name="from" defaultValue={from ?? ''} className="border border-[var(--color-border-strong)] rounded-xl px-3 py-2 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">{t('label_to')}</label>
            <input type="date" name="to" defaultValue={to ?? ''} className="border border-[var(--color-border-strong)] rounded-xl px-3 py-2 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
          </div>
          <button type="submit" className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">{t('btn_filter')}</button>
          {(q || status || from || to) && (
            <Link href="/company/parcels" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)] border border-[var(--color-border-strong)] rounded-xl px-4 py-2 inline-flex items-center">{t('btn_clear')}</Link>
          )}
        </form>
      </FilterPanel>

      {deliveries.length === 0 ? (
        <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] px-6 py-8 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">{t('no_parcels')}</p>
        </div>
      ) : (
        <>
          {/* Mobile cards (< md) */}
          <div className="md:hidden flex flex-col gap-3">
            {deliveries.map((d) => (
              <Link
                key={d.id}
                href={`/company/parcels/${d.id}`}
                className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] p-4 hover:border-[var(--color-border-strong)] transition-colors block"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-mono text-xs text-[var(--color-primary)] font-semibold truncate">{d.trackingNumber}</span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[var(--color-text-strong)]">{d.customerName}</p>
                    <p className="text-xs text-[var(--color-text-faint)] mt-0.5 mb-2">{d.customerPhone}</p>
                  </div>
                  {d.codAmount != null && d.codAmount > 0 && (
                    <div className="text-right flex-shrink-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-yellow-700/70 dark:text-yellow-400/70">COD</p>
                      <p className="text-base font-bold text-yellow-700 dark:text-yellow-300 tabular-nums">{money(d.codAmount)}</p>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  <StatusBadge status={d.status} lang={lang} />
                  <PriorityBadge priority={d.priority} lang={lang} />
                  {d.zone && (
                    <span className="inline-flex items-center text-xs text-[var(--color-text-muted)] bg-[var(--color-card-hover)] rounded-full px-2.5 py-0.5">
                      {tZone(d.zone, lang)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 pt-3 border-t border-[var(--color-border)]">
                  <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] font-semibold">{t('label_courier')}</span>
                  <span className="text-xs font-medium">
                    {d.courier?.name ?? (
                      <span className="text-yellow-600 dark:text-yellow-400">{t('label_unassigned')}</span>
                    )}
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop table (≥ md) */}
          <div className="hidden md:block bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('label_tracking')}</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('label_customer')}</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('label_status')}</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('label_priority')}</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('label_zone')}</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">COD</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide hidden lg:table-cell">{t('label_courier')}</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((d) => (
                  <tr key={d.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-card-hover)]">
                    <td className="px-6 py-3 font-mono text-xs text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] font-semibold">
                      <Link href={`/company/parcels/${d.id}`}>{d.trackingNumber}</Link>
                    </td>
                    <td className="px-6 py-3">
                      <p className="font-medium text-[var(--color-text-strong)]">{d.customerName}</p>
                      <p className="text-xs text-[var(--color-text-faint)]">{d.customerPhone}</p>
                    </td>
                    <td className="px-6 py-3"><StatusBadge status={d.status} lang={lang} /></td>
                    <td className="px-6 py-3"><PriorityBadge priority={d.priority} lang={lang} /></td>
                    <td className="px-6 py-3 text-xs text-[var(--color-text-muted)]">{tZone(d.zone, lang)}</td>
                    <td className="px-6 py-3 text-right tabular-nums">
                      {d.codAmount != null && d.codAmount > 0
                        ? <span className="text-sm font-semibold text-yellow-700 dark:text-yellow-300">{money(d.codAmount)}</span>
                        : <span className="text-xs text-[var(--color-text-faint)]">—</span>}
                    </td>
                    <td className="px-6 py-3 text-[var(--color-text-muted)] hidden lg:table-cell">{d.courier?.name ?? <span className="text-yellow-600 dark:text-yellow-400">{t('label_unassigned')}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Pagination
        basePath="/company/parcels"
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
