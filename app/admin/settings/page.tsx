import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Shell from '@/app/components/Shell'
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

  return (
    <Shell currentPath="/admin/settings" title={t('title_settings')} subtitle={t('title_settings_subtitle')}>
      <div className="mt-2">
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

      <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-6 mt-6">
        <p className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide mb-3">{t('settings_section_build')}</p>
        <dl className="text-sm space-y-1.5">
          <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">{t('settings_stack')}</dt><dd className="text-[var(--color-text-strong)]">Next.js 16 · Prisma 7 · SQLite · Auth.js v5</dd></div>
          <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">{t('settings_roles')}</dt><dd className="text-[var(--color-text-strong)]">ADMIN · COMPANY · COURIER</dd></div>
          <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">{t('settings_status_flow')}</dt><dd className="text-[var(--color-text-strong)]">RECEIVED → IN_WAREHOUSE → ASSIGNED → IN_TRANSIT → DELIVERED / FAILED / REFUSED / RETURNED</dd></div>
        </dl>
      </div>
    </Shell>
  )
}
