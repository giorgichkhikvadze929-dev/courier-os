import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import Shell from '@/app/components/Shell'
import { ZONE_LABEL, ZONES } from '@/app/components/StatusBadge'
import { tariffMatrix } from '@/lib/tariff'
import { updateCompany, deactivateCompany } from '../actions'
import { getT } from '@/lib/i18n-server'

export default async function EditCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')

  const { t } = await getT()
  const { id } = await params
  const [company, recentDeliveries, tariffs] = await Promise.all([
    prisma.company.findUnique({ where: { id }, include: { _count: { select: { deliveries: true, users: true } } } }),
    prisma.delivery.findMany({ where: { companyId: id }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, trackingNumber: true, status: true, customerName: true } }),
    tariffMatrix(id),
  ])
  if (!company) notFound()

  return (
    <Shell currentPath="/admin/companies">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/companies" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)]">← {t('title_companies')}</Link>
        <span className="text-[var(--color-text-faint)]">/</span>
        <h1 className="text-lg font-bold text-[var(--color-text-strong)]">{company.name}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-6">
          <p className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide mb-4">{t('company_profile')}</p>
          <form action={updateCompany.bind(null, id)} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">{t('company_name_required').replace(' *', '')}</label>
              <input name="name" required defaultValue={company.name} className="w-full border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">{t('company_contact')}</label>
                <input name="contact" defaultValue={company.contact ?? ''} className="w-full border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">{t('company_phone')}</label>
                <input name="phone" defaultValue={company.phone ?? ''} className="w-full border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">{t('company_email')}</label>
              <input name="email" type="email" defaultValue={company.email ?? ''} className="w-full border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">{t('company_address')}</label>
              <input name="address" defaultValue={company.address ?? ''} className="w-full border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">{t('user_status')}</label>
              <select name="active" defaultValue={company.active ? 'true' : 'false'} className="w-full border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
                <option value="true">{t('user_active')}</option>
                <option value="false">{t('user_inactive')}</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="flex-1 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-semibold rounded-xl py-2.5 text-sm transition-colors">
                {t('user_save_changes')}
              </button>
              <Link href="/admin/companies" className="flex-1 text-center border border-[var(--color-border-strong)] rounded-xl py-2.5 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-card-hover)] transition-colors">
                {t('btn_cancel')}
              </Link>
            </div>
          </form>
        </div>

        <div className="flex flex-col gap-4">
          <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-5">
            <p className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide mb-2">{t('company_stats')}</p>
            <dl className="text-sm space-y-1.5">
              <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">{t('company_deliveries_count')}</dt><dd className="font-semibold text-[var(--color-text-strong)]">{company._count.deliveries}</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">{t('company_linked_users')}</dt><dd className="font-semibold text-[var(--color-text-strong)]">{company._count.users}</dd></div>
            </dl>
          </div>

          <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide">{t('company_tariffs')}</p>
              <Link href={`/admin/tariffs?company=${id}`} className="text-xs text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]">{t('company_manage')}</Link>
            </div>
            <dl className="text-sm space-y-1.5">
              {ZONES.map((z) => (
                <div key={z} className="flex justify-between">
                  <dt className="text-[var(--color-text-muted)]">{ZONE_LABEL[z]}</dt>
                  <dd className="font-semibold text-[var(--color-text-strong)]">{tariffs[z] != null ? `$${tariffs[z].toFixed(2)}` : '—'}</dd>
                </div>
              ))}
            </dl>
          </div>

          {recentDeliveries.length > 0 && (
            <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-5">
              <p className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide mb-2">{t('company_recent_deliveries')}</p>
              <ul className="text-sm space-y-1">
                {recentDeliveries.map((d) => (
                  <li key={d.id} className="flex justify-between gap-2">
                    <Link href={`/admin/deliveries/${d.id}`} className="font-mono text-xs text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] truncate">{d.trackingNumber}</Link>
                    <span className="text-xs text-[var(--color-text-muted)] truncate">{d.customerName}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {company.active && (
        <div className="mt-4 bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-5 max-w-xl">
          <h3 className="text-sm font-semibold text-[var(--color-danger)] mb-1">{t('company_deactivate_title')}</h3>
          <p className="text-xs text-[var(--color-text-muted)] mb-3">{t('company_deactivate_hint')}</p>
          <form action={deactivateCompany.bind(null, id)}>
            <button type="submit" className="text-sm font-semibold text-[var(--color-danger)] border border-[var(--color-border-strong)] rounded-xl px-4 py-2 hover:bg-red-500/10 transition-colors">
              {t('company_deactivate_btn')}
            </button>
          </form>
        </div>
      )}
    </Shell>
  )
}
