import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import Shell from '@/app/components/Shell'
import Pagination from '@/app/components/Pagination'
import { getT } from '@/lib/i18n-server'
import { setUserActive } from './actions'
import { startImpersonation } from './impersonate'

const DEFAULT_PAGE_SIZE = 50

const ROLE_BADGE: Record<string, string> = {
  ADMIN:   'bg-blue-100   text-blue-700   dark:bg-blue-500/20   dark:text-blue-300',
  COMPANY: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300',
  COURIER: 'bg-green-100  text-green-700  dark:bg-green-500/20  dark:text-green-300',
}

/** Avatar color derived from the user id so it's stable across renders. */
const AVATAR_PALETTE = [
  'bg-rose-500',     'bg-orange-500',  'bg-amber-500',
  'bg-lime-500',     'bg-emerald-500', 'bg-teal-500',
  'bg-cyan-500',     'bg-sky-500',     'bg-indigo-500',
  'bg-violet-500',   'bg-fuchsia-500', 'bg-pink-500',
]
function avatarColor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]
}
function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? '').join('') || '?'
}

const ALL_ROLES = ['ADMIN', 'COMPANY', 'COURIER'] as const

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; q?: string; active?: string; companyId?: string; page?: string; pageSize?: string }>
}) {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')

  const { t } = await getT()
  const sp = await searchParams
  const page = Math.max(1, Number(sp.page) || 1)
  const pageSize = Math.min(250, Math.max(10, Number(sp.pageSize) || DEFAULT_PAGE_SIZE))

  // Build the WHERE clause from the search params.
  const where = {
    ...(sp.role && (ALL_ROLES as readonly string[]).includes(sp.role) ? { role: sp.role } : {}),
    ...(sp.active === 'true'  ? { active: true }  : {}),
    ...(sp.active === 'false' ? { active: false } : {}),
    ...(sp.companyId ? { companyId: sp.companyId } : {}),
    ...(sp.q ? {
      OR: [
        { name:  { contains: sp.q } },
        { email: { contains: sp.q } },
        { phone: { contains: sp.q } },
      ],
    } : {}),
  }

  // Counts per role for the chip strip (respects search/active filters, ignores role itself).
  const chipWhere = {
    ...(sp.active === 'true'  ? { active: true }  : {}),
    ...(sp.active === 'false' ? { active: false } : {}),
    ...(sp.companyId ? { companyId: sp.companyId } : {}),
    ...(sp.q ? {
      OR: [
        { name:  { contains: sp.q } },
        { email: { contains: sp.q } },
        { phone: { contains: sp.q } },
      ],
    } : {}),
  }

  const [total, users, roleCounts, allCount, activeCount, inactiveCount, companies] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { company: { select: { name: true } } },
    }),
    prisma.user.groupBy({ by: ['role'], where: chipWhere, _count: { _all: true } }),
    prisma.user.count({ where: chipWhere }),
    prisma.user.count({ where: { ...where, active: true } }),
    prisma.user.count({ where: { ...where, active: false } }),
    prisma.company.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ])

  const countByRole: Record<string, number> = {}
  for (const r of roleCounts) countByRole[r.role] = r._count._all

  const roleLabel = (role: string): string => {
    if (role === 'ADMIN')   return t('role_ADMIN')
    if (role === 'COMPANY') return t('role_COMPANY')
    if (role === 'COURIER') return t('role_COURIER')
    return role
  }

  // Helper: build a chip href preserving everything except `role`.
  function chipHref(targetRole: string | null): string {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(sp)) {
      if (v != null && v !== '' && k !== 'role' && k !== 'page') params.set(k, String(v))
    }
    if (targetRole) params.set('role', targetRole)
    const qs = params.toString()
    return qs ? `/admin/users?${qs}` : '/admin/users'
  }

  return (
    <Shell
      currentPath="/admin/settings"
      breadcrumb={{ href: '/admin/settings', label: t('back_to_settings') }}
      title={t('title_users')}
      subtitle={`${total.toLocaleString()} ${t('users_count')}`}
      actions={
        <Link
          href="/admin/users/new"
          className="inline-flex items-center gap-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          {t('users_btn_new')}
        </Link>
      }
    >
      {/* Role chips — All / Admin / Company / Courier with live counts */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Link
          href={chipHref(null)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${
            !sp.role ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]' : 'border-[var(--color-border-strong)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          {t('label_all')} ({allCount})
        </Link>
        {ALL_ROLES.map((role) => (
          <Link
            key={role}
            href={chipHref(role)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${
              sp.role === role ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]' : 'border-[var(--color-border-strong)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            {roleLabel(role)} ({countByRole[role] ?? 0})
          </Link>
        ))}
      </div>

      {/* Search + active + company filter */}
      <form className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] px-5 py-3 mb-4 flex flex-wrap items-end gap-2">
        {sp.role && <input type="hidden" name="role" value={sp.role} />}
        <div>
          <label className="block text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-faint)] mb-1">{t('btn_search')}</label>
          <input
            name="q"
            defaultValue={sp.q ?? ''}
            placeholder={t('users_search_placeholder')}
            className="border border-[var(--color-border-strong)] rounded-xl px-3 py-2 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] w-64"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-faint)] mb-1">{t('label_status')}</label>
          <select name="active" defaultValue={sp.active ?? ''} className="border border-[var(--color-border-strong)] rounded-xl px-3 py-2 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)]">
            <option value="">{t('label_all')}</option>
            <option value="true">{t('label_active')} ({activeCount})</option>
            <option value="false">{t('label_inactive')} ({inactiveCount})</option>
          </select>
        </div>
        {(sp.role === 'COMPANY' || !sp.role) && companies.length > 0 && (
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-faint)] mb-1">{t('label_company')}</label>
            <select name="companyId" defaultValue={sp.companyId ?? ''} className="border border-[var(--color-border-strong)] rounded-xl px-3 py-2 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)]">
              <option value="">{t('label_all')}</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        <button type="submit" className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm font-semibold px-4 py-2 rounded-xl h-10">
          {t('btn_filter')}
        </button>
        {(sp.q || sp.active || sp.companyId || sp.role) && (
          <Link href="/admin/users" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)] border border-[var(--color-border-strong)] rounded-xl px-3 py-2 inline-flex items-center h-10">
            {t('btn_clear')}
          </Link>
        )}
      </form>

      {/* Mobile/tablet card list — lg:hidden so it disappears at desktop (1024+) */}
      <div className="lg:hidden flex flex-col gap-3">
        {users.length === 0 ? (
          <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-6 text-center">
            <p className="text-sm text-[var(--color-text-muted)]">{t('users_empty')}</p>
          </div>
        ) : (
          users.map((u) => (
            <div key={u.id} className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-4">
              <div className="flex items-start gap-3">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full ${avatarColor(u.id)} text-white text-sm font-bold flex-shrink-0`}>
                  {initials(u.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[var(--color-text-strong)] leading-tight truncate">{u.name}</p>
                  <p className="font-mono text-[11px] text-[var(--color-text-faint)] truncate">{u.email}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className={`inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-full ${ROLE_BADGE[u.role] ?? 'bg-[var(--color-card-hover)] text-[var(--color-text-muted)]'}`}>
                      {roleLabel(u.role)}
                    </span>
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full ${u.active ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${u.active ? 'bg-green-500' : 'bg-red-500'}`}></span>
                      {u.active ? t('label_active') : t('label_inactive')}
                    </span>
                  </div>
                  {(u.company?.name || u.phone) && (
                    <div className="mt-2 text-xs text-[var(--color-text-muted)] space-y-0.5">
                      {u.company?.name && <p>{t('label_company')}: <span className="text-[var(--color-text)]">{u.company.name}</span></p>}
                      {u.phone && <p>{t('label_phone')}: <span className="text-[var(--color-text)] font-mono">{u.phone}</span></p>}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-[var(--color-border)] flex flex-wrap items-center gap-3">
                <Link href={`/admin/users/${u.id}`} className="text-sm font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]">
                  {t('btn_edit')}
                </Link>
                {u.active && u.role !== 'ADMIN' && (
                  <form action={startImpersonation.bind(null, u.id)}>
                    <button type="submit" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] font-medium">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      {t('users_preview_as')}
                    </button>
                  </form>
                )}
                <form action={setUserActive.bind(null, u.id)} className="ml-auto">
                  <input type="hidden" name="active" value={u.active ? 'false' : 'true'} />
                  <button type="submit" className={`text-xs font-semibold hover:underline ${u.active ? 'text-[var(--color-text-muted)] hover:text-[var(--color-danger)]' : 'text-[var(--color-success)] hover:text-green-600'}`}>
                    {u.active ? t('label_deactivate') : t('label_activate')}
                  </button>
                </form>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop table — shown only at lg+ where there's enough width for all 6 columns */}
      <div className="hidden lg:block bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] overflow-hidden">
        {users.length === 0 ? (
          <p className="px-6 py-10 text-sm text-[var(--color-text-muted)] text-center">{t('users_empty')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('label_name')}</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('label_role')}</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide hidden md:table-cell">{t('label_company')}</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide hidden md:table-cell">{t('label_phone')}</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('label_status')}</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-card-hover)]/40">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex items-center justify-center w-9 h-9 rounded-full ${avatarColor(u.id)} text-white text-sm font-bold flex-shrink-0`}>
                        {initials(u.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-[var(--color-text-strong)] leading-tight">{u.name}</p>
                        <p className="font-mono text-[11px] text-[var(--color-text-faint)] truncate max-w-[200px]">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-full ${ROLE_BADGE[u.role] ?? 'bg-[var(--color-card-hover)] text-[var(--color-text-muted)]'}`}>
                      {roleLabel(u.role)}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-[var(--color-text-muted)] hidden md:table-cell">{u.company?.name ?? '—'}</td>
                  <td className="px-6 py-3 text-[var(--color-text-muted)] hidden md:table-cell">{u.phone ?? '—'}</td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full ${u.active ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.active ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        {u.active ? t('label_active') : t('label_inactive')}
                      </span>
                      <form action={setUserActive.bind(null, u.id)}>
                        <input type="hidden" name="active" value={u.active ? 'false' : 'true'} />
                        <button
                          type="submit"
                          className={`text-xs font-semibold hover:underline ${
                            u.active ? 'text-[var(--color-text-muted)] hover:text-[var(--color-danger)]' : 'text-[var(--color-success)] hover:text-green-600'
                          }`}
                        >
                          {u.active ? t('label_deactivate') : t('label_activate')}
                        </button>
                      </form>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      {u.active && u.role !== 'ADMIN' && (
                        <form action={startImpersonation.bind(null, u.id)}>
                          <button
                            type="submit"
                            className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] font-medium transition-colors"
                            title={t('users_preview_hint')}
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                            {t('users_preview_as')}
                          </button>
                        </form>
                      )}
                      <Link href={`/admin/users/${u.id}`} className="text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] font-medium">
                        {t('btn_edit')}
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Pagination
        basePath="/admin/users"
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
