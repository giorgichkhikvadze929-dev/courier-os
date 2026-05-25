import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import Shell from '@/app/components/Shell'
import { getT } from '@/lib/i18n-server'
import { approveUpload, revokeUpload } from './actions'

export default async function CompaniesPage() {
  const session = await getSession()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')

  const { t } = await getT()
  // Two fast queries instead of `findMany` with `_count` subqueries — Prisma
  // turns the latter into one correlated COUNT per row, which was 137 extra
  // round-trips for the 137 companies we have today.
  const [companyRows, deliveriesByCompany] = await Promise.all([
    prisma.company.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.delivery.groupBy({
      by:     ['companyId'],
      where:  { companyId: { not: null } },
      _count: { _all: true },
    }),
  ])
  const countByCompany = new Map<string, number>()
  for (const g of deliveriesByCompany) if (g.companyId) countByCompany.set(g.companyId, g._count._all)

  // Attach the count back so the existing JSX (`c._count.deliveries`) keeps
  // working without further surgery.
  const companies = companyRows.map((c) => ({
    ...c,
    _count: { deliveries: countByCompany.get(c.id) ?? 0 },
  }))

  return (
    <Shell
      currentPath="/admin/companies"
      title={t('title_companies')}
      subtitle={`${companies.length} ${companies.length === 1 ? t('companies_count') : t('companies_count_plural')}`}
      actions={
        <Link
          href="/admin/companies/new"
          className="inline-flex items-center gap-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          {t('companies_btn_new')}
        </Link>
      }
    >
      {companies.length === 0 ? (
        <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-10 text-center">
          <p className="text-[var(--color-text-muted)] text-sm">{t('companies_no_yet')}</p>
          <Link href="/admin/companies/new" className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] text-sm font-medium mt-2 inline-block">
            {t('companies_create_first')}
          </Link>
        </div>
      ) : (
        <>
        {/* Mobile/tablet card list */}
        <div className="lg:hidden flex flex-col gap-3">
          {companies.map((c) => {
            const uploadState: 'enabled' | 'pending' | 'disabled' = c.uploadEnabled
              ? 'enabled'
              : c.uploadRequestedAt ? 'pending' : 'disabled'
            const stateClass = uploadState === 'enabled'
              ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300'
              : uploadState === 'pending'
                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300'
            const stateLabel = uploadState === 'enabled'
              ? t('upload_status_enabled')
              : uploadState === 'pending'
                ? t('upload_status_pending')
                : t('upload_status_disabled')
            return (
              <div key={c.id} className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[var(--color-text-strong)] truncate">{c.name}</p>
                    {c.contact && <p className="text-xs text-[var(--color-text-muted)] truncate">{c.contact}</p>}
                    {c.phone && <p className="text-xs text-[var(--color-text-muted)] font-mono">{c.phone}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[var(--color-text-muted)]">{t('nav_deliveries')}</p>
                    <p className="text-lg font-bold text-[var(--color-text-strong)]">{c._count.deliveries}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-full ${stateClass}`}>{stateLabel}</span>
                  <span className={`inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-full ${c.active ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'}`}>{c.active ? t('label_active') : t('label_inactive')}</span>
                </div>
                <div className="mt-3 pt-3 border-t border-[var(--color-border)] flex flex-wrap items-center gap-3">
                  <Link href={`/admin/companies/${c.id}`} className="text-sm font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]">{t('btn_edit')}</Link>
                  {uploadState === 'pending' && (
                    <form action={approveUpload.bind(null, c.id)}>
                      <button className="text-sm font-semibold text-[var(--color-success)] hover:underline">{t('upload_btn_approve')}</button>
                    </form>
                  )}
                  {uploadState === 'enabled' && (
                    <form action={revokeUpload.bind(null, c.id)}>
                      <button className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-danger)]">{t('upload_btn_revoke')}</button>
                    </form>
                  )}
                  {uploadState === 'disabled' && (
                    <form action={approveUpload.bind(null, c.id)}>
                      <button className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-success)]">{t('upload_btn_approve')}</button>
                    </form>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Desktop table */}
        <div className="hidden lg:block bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('label_name')}</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide hidden md:table-cell">{t('label_contact')}</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide hidden lg:table-cell">{t('label_phone')}</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('nav_deliveries')}</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('upload_status_label')}</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('label_status')}</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => {
                const uploadState: 'enabled' | 'pending' | 'disabled' = c.uploadEnabled
                  ? 'enabled'
                  : c.uploadRequestedAt ? 'pending' : 'disabled'
                const stateClass = uploadState === 'enabled'
                  ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300'
                  : uploadState === 'pending'
                    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300'
                const stateLabel = uploadState === 'enabled'
                  ? t('upload_status_enabled')
                  : uploadState === 'pending'
                    ? t('upload_status_pending')
                    : t('upload_status_disabled')
                return (
                  <tr key={c.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-card-hover)]">
                    <td className="px-6 py-3 font-semibold text-[var(--color-text-strong)]">{c.name}</td>
                    <td className="px-6 py-3 text-[var(--color-text-muted)] hidden md:table-cell">{c.contact ?? '—'}</td>
                    <td className="px-6 py-3 text-[var(--color-text-muted)] hidden lg:table-cell">{c.phone ?? '—'}</td>
                    <td className="px-6 py-3 text-[var(--color-text-strong)] font-semibold">{c._count.deliveries}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-full ${stateClass}`}>
                          {stateLabel}
                        </span>
                        {uploadState === 'pending' && (
                          <form action={approveUpload.bind(null, c.id)}>
                            <button className="text-xs font-semibold text-[var(--color-success)] hover:underline">
                              {t('upload_btn_approve')}
                            </button>
                          </form>
                        )}
                        {uploadState === 'enabled' && (
                          <form action={revokeUpload.bind(null, c.id)}>
                            <button className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-danger)]">
                              {t('upload_btn_revoke')}
                            </button>
                          </form>
                        )}
                        {uploadState === 'disabled' && (
                          <form action={approveUpload.bind(null, c.id)}>
                            <button className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-success)]">
                              {t('upload_btn_approve')}
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-full ${c.active ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'}`}>
                        {c.active ? t('label_active') : t('label_inactive')}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <Link href={`/admin/companies/${c.id}`} className="text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] font-medium">
                        {t('btn_edit')}
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
    </Shell>
  )
}
