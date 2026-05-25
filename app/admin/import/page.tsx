import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import Shell from '@/app/components/Shell'
import prisma from '@/lib/prisma'
import ImportClient from './ImportClient'
import { getT } from '@/lib/i18n-server'

export default async function ImportPage() {
  const session = await getSession()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')

  const { t, lang } = await getT()
  const companies = await prisma.company.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  })

  return (
    <Shell currentPath="/admin/import">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text-strong)]">{t('title_import')}</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{t('title_import_subtitle')}</p>
      </div>
      <ImportClient companies={companies} lang={lang} />
    </Shell>
  )
}
