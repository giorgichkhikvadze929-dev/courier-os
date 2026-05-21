import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import Shell from '@/app/components/Shell'
import CompanyImportClient from './CompanyImportClient'
import RequestAccess from './RequestAccess'
import { getT } from '@/lib/i18n-server'

export default async function CompanyImportPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const role = session.user?.role as string
  if (!['COMPANY', 'ADMIN'].includes(role)) redirect('/login')

  const { t, lang } = await getT()
  const companyId = (session.user as { companyId?: string | null }).companyId

  // Admins see the upload UI directly (they don't need approval to use the company page).
  // Company users go through the gate.
  let uploadEnabled = role === 'ADMIN'
  let uploadRequested = false

  if (role === 'COMPANY' && companyId) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { uploadEnabled: true, uploadRequestedAt: true },
    })
    uploadEnabled = company?.uploadEnabled ?? false
    uploadRequested = !!company?.uploadRequestedAt
  }

  return (
    <Shell
      currentPath="/company/import"
      title={t('title_upload')}
      subtitle={t('title_upload_subtitle')}
    >
      {uploadEnabled ? (
        <CompanyImportClient lang={lang} />
      ) : (
        <RequestAccess
          pending={uploadRequested}
          labels={{
            title: t('upload_request_title'),
            description: t('upload_request_description'),
            button: t('upload_request_button'),
            pendingTitle: t('upload_pending_title'),
            pendingDescription: t('upload_pending_description'),
          }}
        />
      )}
    </Shell>
  )
}
