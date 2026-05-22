import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import Shell from '@/app/components/Shell'
import { updateUser, deactivateUser } from '../actions'
import { getT } from '@/lib/i18n-server'
import { money } from '@/lib/format'

const ROLES = ['ADMIN', 'COMPANY', 'COURIER']

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')

  const { t } = await getT()
  const { id } = await params
  const [user, companies] = await Promise.all([
    prisma.user.findUnique({ where: { id } }),
    prisma.company.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ])
  if (!user) notFound()

  // Courier-only money breakdown — currently carrying, delivered, returned/failed.
  let courierMoney: { carrying: number; delivered: number; returned: number } | null = null
  if (user.role === 'COURIER') {
    const [carry, delivered, returned] = await Promise.all([
      prisma.delivery.aggregate({ where: { courierId: id, status: { in: ['ASSIGNED', 'IN_TRANSIT'] } }, _sum: { codAmount: true } }),
      prisma.delivery.aggregate({ where: { courierId: id, status: 'DELIVERED' }, _sum: { codAmount: true } }),
      prisma.delivery.aggregate({ where: { courierId: id, status: { in: ['FAILED', 'REFUSED', 'RETURNED'] } }, _sum: { codAmount: true } }),
    ])
    courierMoney = {
      carrying:  carry._sum.codAmount     ?? 0,
      delivered: delivered._sum.codAmount ?? 0,
      returned:  returned._sum.codAmount  ?? 0,
    }
  }

  return (
    <Shell currentPath="/admin/users">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/users" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)]">← {t('title_users')}</Link>
        <span className="text-[var(--color-text-faint)]">/</span>
        <h1 className="text-lg font-bold text-[var(--color-text-strong)]">{t('user_edit_prefix')} — {user.name}</h1>
      </div>

      {courierMoney && (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-3 max-w-3xl">
          <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] px-5 py-4">
            <p className="text-xs font-medium text-[var(--color-text-muted)]">{t('money_courier_carrying')}</p>
            <p className="text-2xl font-bold mt-1 text-orange-600 dark:text-orange-400 font-mono">{money(courierMoney.carrying)}</p>
          </div>
          <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] px-5 py-4">
            <p className="text-xs font-medium text-[var(--color-text-muted)]">{t('money_courier_delivered')}</p>
            <p className="text-2xl font-bold mt-1 text-green-600 dark:text-green-400 font-mono">{money(courierMoney.delivered)}</p>
          </div>
          <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] px-5 py-4">
            <p className="text-xs font-medium text-[var(--color-text-muted)]">{t('money_courier_returned')}</p>
            <p className="text-2xl font-bold mt-1 text-red-600 dark:text-red-400 font-mono">{money(courierMoney.returned)}</p>
          </div>
        </div>
      )}

      <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-6 max-w-xl">
        <form action={updateUser.bind(null, id)} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">{t('user_full_name')}</label>
              <input name="name" required defaultValue={user.name} className="w-full border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">{t('user_username_email')}</label>
              <input name="email" required defaultValue={user.email} className="w-full border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">{t('user_new_password')} <span className="text-[var(--color-text-faint)] font-normal">{t('user_password_keep_hint')}</span></label>
              <input name="password" type="password" className="w-full border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" placeholder="••••••••" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">{t('user_role')}</label>
              <select name="role" defaultValue={user.role} className="w-full border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">{t('user_status')}</label>
              <select name="active" defaultValue={user.active ? 'true' : 'false'} className="w-full border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
                <option value="true">{t('user_active')}</option>
                <option value="false">{t('user_inactive')}</option>
              </select>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">{t('user_phone')}</label>
              <input name="phone" defaultValue={user.phone ?? ''} className="w-full border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" placeholder="+995 555 000 000" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">{t('user_company_edit_hint')}</label>
              <select name="companyId" defaultValue={user.companyId ?? ''} className="w-full border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
                <option value="">— —</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" className="flex-1 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-semibold rounded-xl py-2.5 text-sm transition-colors">
              {t('user_save_changes')}
            </button>
            <Link href="/admin/users" className="flex-1 text-center border border-[var(--color-border-strong)] rounded-xl py-2.5 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-card-hover)] transition-colors">
              {t('btn_cancel')}
            </Link>
          </div>
        </form>
      </div>

      {user.active && (
        <div className="mt-4 bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-5 max-w-xl">
          <h3 className="text-sm font-semibold text-[var(--color-danger)] mb-1">{t('user_deactivate_title')}</h3>
          <p className="text-xs text-[var(--color-text-muted)] mb-3">{t('user_deactivate_hint')}</p>
          <form action={deactivateUser.bind(null, id)}>
            <button type="submit" className="text-sm font-semibold text-[var(--color-danger)] border border-[var(--color-border-strong)] rounded-xl px-4 py-2 hover:bg-red-500/10 transition-colors">
              {t('user_deactivate_btn')}
            </button>
          </form>
        </div>
      )}
    </Shell>
  )
}
