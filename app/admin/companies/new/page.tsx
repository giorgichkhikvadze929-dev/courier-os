import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Shell from '@/app/components/Shell'
import { createCompany } from '../actions'
import { getT } from '@/lib/i18n-server'

export default async function NewCompanyPage() {
  const session = await getSession()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')

  const { t } = await getT()

  return (
    <Shell currentPath="/admin/companies">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/companies" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)]">← {t('title_companies')}</Link>
        <span className="text-[var(--color-text-faint)]">/</span>
        <h1 className="text-lg font-bold text-[var(--color-text-strong)]">{t('company_new_title')}</h1>
      </div>

      <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-6 max-w-xl">
        <form action={createCompany} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">{t('company_name_required')}</label>
            <input name="name" required className="w-full border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" placeholder="Acme Trading" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">{t('company_contact')}</label>
              <input name="contact" className="w-full border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" placeholder="Giorgi Beridze" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">{t('company_phone')}</label>
              <input name="phone" className="w-full border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" placeholder="+995-555-1000" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">{t('company_email')}</label>
            <input name="email" type="email" className="w-full border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" placeholder="orders@acme.example" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">{t('company_address')}</label>
            <input name="address" className="w-full border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" placeholder="Rustaveli Ave 12, Tbilisi" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="flex-1 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-semibold rounded-xl py-2.5 text-sm transition-colors">
              {t('company_create_btn')}
            </button>
            <Link href="/admin/companies" className="flex-1 text-center border border-[var(--color-border-strong)] rounded-xl py-2.5 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-card-hover)] transition-colors">
              {t('btn_cancel')}
            </Link>
          </div>
        </form>
      </div>
    </Shell>
  )
}
