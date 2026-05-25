import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Shell from '@/app/components/Shell'
import prisma from '@/lib/prisma'
import { createUser } from '../actions'
import { getT } from '@/lib/i18n-server'

const ROLES = ['ADMIN', 'COMPANY', 'COURIER']

export default async function NewUserPage() {
  const session = await getSession()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')

  const { t } = await getT()

  const companies = await prisma.company.findMany({
    where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true },
  })

  return (
    <Shell currentPath="/admin/users">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/users" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)]">← {t('title_users')}</Link>
        <span className="text-[var(--color-text-faint)]">/</span>
        <h1 className="text-lg font-bold text-[var(--color-text-strong)]">{t('user_new_title')}</h1>
      </div>

      <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-6 max-w-xl">
        <form action={createUser} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">{t('user_full_name')}</label>
              <input name="name" required className="w-full border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" placeholder="John Doe" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">{t('user_username_email')}</label>
              <input name="email" required className="w-full border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" placeholder="johndoe" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">{t('user_password')}</label>
              <input name="password" type="password" required className="w-full border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" placeholder="••••••••" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">{t('user_role')}</label>
              <select name="role" required defaultValue="COURIER" className="w-full border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">{t('user_phone')}</label>
              <input name="phone" className="w-full border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" placeholder="+995 555 000 000" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">{t('user_company_optional')}</label>
              <select name="companyId" className="w-full border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
                <option value="">— —</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" className="flex-1 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-semibold rounded-xl py-2.5 text-sm transition-colors">
              {t('user_create_btn')}
            </button>
            <Link href="/admin/users" className="flex-1 text-center border border-[var(--color-border-strong)] rounded-xl py-2.5 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-card-hover)] transition-colors">
              {t('btn_cancel')}
            </Link>
          </div>
        </form>
      </div>
    </Shell>
  )
}
