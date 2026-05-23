import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Shell from '@/app/components/Shell'
import ThemeCustomizer from '@/app/components/ThemeCustomizer'
import prisma from '@/lib/prisma'
import { getT } from '@/lib/i18n-server'

export default async function SettingsPage() {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')

  const { t } = await getT()

  const [users, deliveries, couriers, companies] = await Promise.all([
    prisma.user.count(),
    prisma.delivery.count(),
    prisma.user.count({ where: { role: 'COURIER', active: true } }),
    prisma.company.count({ where: { active: true } }),
  ])

  const stats = [
    { label: t('settings_label_users'),      value: users },
    { label: t('settings_label_couriers'),   value: couriers },
    { label: t('settings_label_companies'),  value: companies },
    { label: t('settings_label_deliveries'), value: deliveries },
  ]

  // Settings is now the hub for admin-only config pages (users, tariffs,
  // regions). These used to live in the sidebar; consolidating them here keeps
  // the sidebar focused on day-to-day operations.
  const hubCards = [
    {
      href:  '/admin/users',
      title: t('settings_users_title'),
      hint:  t('settings_users_hint'),
      iconPath: 'M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M12 7a4 4 0 11-8 0 4 4 0 018 0z M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75',
    },
    {
      href:  '/admin/tariffs',
      title: t('settings_tariffs_title'),
      hint:  t('settings_tariffs_hint'),
      iconPath: 'M12 2v20 M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6',
    },
    {
      href:  '/admin/places',
      title: t('settings_regions_title'),
      hint:  t('settings_regions_hint'),
      iconPath: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z M12 13a3 3 0 100-6 3 3 0 000 6z',
    },
  ]

  return (
    <Shell currentPath="/admin/settings" title={t('title_settings')} subtitle={t('title_settings_subtitle')}>
      {/* Management hub — Users / Tariffs / Regions */}
      <div className="mt-2">
        <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">{t('settings_section_admin')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {hubCards.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="group bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] hover:border-[var(--color-primary)] transition-colors p-5 flex flex-col"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center flex-shrink-0">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                    <path d={c.iconPath} />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--color-text-strong)] leading-tight">{c.title}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-snug">{c.hint}</p>
                </div>
              </div>
              <p className="text-xs font-semibold text-[var(--color-primary)] mt-4 self-end group-hover:translate-x-0.5 transition-transform">{t('settings_open')}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* System stats */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">{t('settings_section_system')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] px-5 py-4">
              <p className="text-xs font-medium text-[var(--color-text-muted)]">{s.label}</p>
              <p className="text-2xl font-bold text-[var(--color-text-strong)] mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-6 mt-6">
        <p className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide mb-3">{t('settings_lang_section')}</p>
        <p className="text-sm text-[var(--color-text)]">{t('settings_lang_hint')}</p>
      </div>

      <div className="mt-6">
        <ThemeCustomizer
          labels={{
            title:   t('theme_section'),
            hint:    t('theme_hint'),
            primary: t('theme_primary'),
            success: t('theme_success'),
            warning: t('theme_warning'),
            danger:  t('theme_danger'),
            save:    t('theme_save'),
            reset:   t('theme_reset'),
            saved:   t('theme_saved'),
          }}
        />
      </div>

      <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-6 mt-6">
        <p className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide mb-3">{t('settings_section_build')}</p>
        <dl className="text-sm space-y-1.5">
          <div className="flex justify-between gap-4"><dt className="text-[var(--color-text-muted)]">{t('settings_stack')}</dt><dd className="text-[var(--color-text-strong)] text-right">Next.js 16 · Prisma 7 · Supabase Postgres · Auth.js v5</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-[var(--color-text-muted)]">{t('settings_roles')}</dt><dd className="text-[var(--color-text-strong)] text-right">ADMIN · COMPANY · COURIER</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-[var(--color-text-muted)]">{t('settings_status_flow')}</dt><dd className="text-[var(--color-text-strong)] text-right text-xs">RECEIVED → IN_WAREHOUSE → ASSIGNED → IN_TRANSIT → DELIVERED / FAILED / REFUSED / RETURNED</dd></div>
        </dl>
      </div>
    </Shell>
  )
}
