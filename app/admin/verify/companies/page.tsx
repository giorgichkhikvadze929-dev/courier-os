import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import Shell from '@/app/components/Shell'
import ReconciliationPanel from '../ReconciliationPanel'
import { getT } from '@/lib/i18n-server'

/**
 * Full per-company reconciliation page. The shortened version lives on
 * /admin/verify (top 10 with a "Show all →" link). This page renders every
 * company that had any parcel activity in the last 30 days.
 */
export default async function VerifyAllCompaniesPage() {
  const session = await getSession()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')

  const { t, lang } = await getT()

  return (
    <Shell
      currentPath="/admin/verify"
      breadcrumb={{ href: '/admin/verify', label: t('reconcile_back') }}
      title={t('reconcile_all_title')}
    >
      <ReconciliationPanel lang={lang} />
    </Shell>
  )
}
