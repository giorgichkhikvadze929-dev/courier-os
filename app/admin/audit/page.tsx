import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import Shell from '@/app/components/Shell'
import Link from 'next/link'
import { getT } from '@/lib/i18n-server'
import FilterPanel from '@/app/components/FilterPanel'
import Pagination from '@/app/components/Pagination'

const DEFAULT_PAGE_SIZE = 20

const ACTION_COLOR: Record<string, string> = {
  CREATE:             'bg-green-500/15 text-green-700 dark:text-green-300',
  UPDATE:             'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  DELETE:             'bg-red-500/15 text-red-700 dark:text-red-300',
  STATUS_CHANGE:      'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  ASSIGN:             'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
  ASSIGN_PICKUP:      'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
  VERIFY:             'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
  TARIFF_CHANGE:      'bg-purple-500/15 text-purple-700 dark:text-purple-300',
  IMPORT:             'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  LOGIN:              'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  IMPERSONATE_START:  'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300',
  IMPERSONATE_STOP:   'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300',
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string; action?: string; page?: string; pageSize?: string }>
}) {
  const session = await getSession()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')

  const { t } = await getT()
  const sp = await searchParams
  const page = Math.max(1, Number(sp.page) || 1)
  const pageSize = Math.min(250, Math.max(5, Number(sp.pageSize) || DEFAULT_PAGE_SIZE))

  const where = {
    ...(sp.entity ? { entity: sp.entity } : {}),
    ...(sp.action ? { action: sp.action } : {}),
  }

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { actor: { select: { name: true, role: true } } },
    }),
  ])

  const ENTITIES = ['Delivery', 'Company', 'Tariff', 'User']
  const ACTIONS  = Object.keys(ACTION_COLOR)

  return (
    <Shell
      currentPath="/admin/audit"
      title={t('title_audit')}
      subtitle={`${total.toLocaleString()} ${t('audit_count')}`}
    >
      <FilterPanel
        activeCount={[sp.entity, sp.action].filter(Boolean).length}
        labels={{ filters: t('filters_title'), show: t('filters_show'), hide: t('filters_hide'), active: t('filters_active') }}
      >
        <form className="flex flex-wrap gap-2">
          <input type="hidden" name="page" value="1" />
          <input type="hidden" name="pageSize" value={String(pageSize)} />
          <select name="entity" defaultValue={sp.entity ?? ''} className="border border-[var(--color-border-strong)] rounded-xl px-4 py-2 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
            <option value="">{t('label_all_entities')}</option>
            {ENTITIES.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
          <select name="action" defaultValue={sp.action ?? ''} className="border border-[var(--color-border-strong)] rounded-xl px-4 py-2 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
            <option value="">{t('label_all_actions')}</option>
            {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <button type="submit" className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">{t('btn_filter')}</button>
          {(sp.entity || sp.action) && (
            <Link href="/admin/audit" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)] border border-[var(--color-border-strong)] rounded-xl px-4 py-2 inline-flex items-center">{t('btn_clear')}</Link>
          )}
        </form>
      </FilterPanel>

      <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] overflow-hidden">
        {logs.length === 0 ? (
          <p className="px-6 py-5 text-sm text-[var(--color-text-muted)]">{t('audit_no_entries')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('label_when')}</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('label_action')}</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('label_entity')}</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide hidden md:table-cell">ID</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide hidden lg:table-cell">{t('label_actor')}</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('label_note')}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-card-hover)]">
                  <td className="px-6 py-3 text-xs text-[var(--color-text-muted)] whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-full ${ACTION_COLOR[log.action] ?? 'bg-slate-500/15 text-slate-700 dark:text-slate-300'}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-[var(--color-text-strong)] font-medium">{log.entity}</td>
                  <td className="px-6 py-3 font-mono text-xs text-[var(--color-text-faint)] hidden md:table-cell">{log.entityId ? log.entityId.slice(-8) : '—'}</td>
                  <td className="px-6 py-3 text-xs text-[var(--color-text-muted)] hidden lg:table-cell">{log.actor ? `${log.actor.name} (${log.actor.role})` : '—'}</td>
                  <td className="px-6 py-3 text-xs text-[var(--color-text)] truncate max-w-[260px]">{log.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Pagination
        basePath="/admin/audit"
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
