import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import Shell from '@/app/components/Shell'
import Pagination from '@/app/components/Pagination'
import VerifyPanel from './VerifyPanel'
import ReconciliationPanel from './ReconciliationPanel'
import { getT } from '@/lib/i18n-server'

const DEFAULT_PAGE_SIZE = 50

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>
}) {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')

  const { t, lang } = await getT()
  const sp = await searchParams

  const page = Math.max(1, Number(sp.page) || 1)
  const pageSize = Math.min(250, Math.max(10, Number(sp.pageSize) || DEFAULT_PAGE_SIZE))

  const [rows, totalPending] = await Promise.all([
    prisma.delivery.findMany({
      where: { status: 'RECEIVED' },
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, trackingNumber: true, status: true,
        customerName: true, customerPhone: true, dropoffAddress: true,
        zone: true, packageType: true,
        company: { select: { name: true } },
      },
    }),
    prisma.delivery.count({ where: { status: 'RECEIVED' } }),
  ])

  const parcelWord = totalPending === 1 ? t('parcel_word') : t('parcel_word_plural')
  const subtitle = totalPending > rows.length
    ? `${t('page_showing')} ${rows.length} ${t('page_of')} ${totalPending.toLocaleString()} · ${totalPending.toLocaleString()} ${parcelWord} ${t('verify_subtitle')}`
    : `${totalPending.toLocaleString()} ${parcelWord} ${t('verify_subtitle')}`

  return (
    <Shell
      currentPath="/admin/verify"
      title={t('title_verify')}
      subtitle={subtitle}
    >
      <ReconciliationPanel lang={lang} limit={10} />
      <VerifyPanel rows={rows} lang={lang} totalPending={totalPending} />
      <Pagination
        basePath="/admin/verify"
        query={sp as Record<string, string | undefined>}
        page={page}
        pageSize={pageSize}
        total={totalPending}
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
