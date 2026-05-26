import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import Shell from '@/app/components/Shell'
import Pagination from '@/app/components/Pagination'
import WizardSteps from './WizardSteps'
import OrderPicker from './OrderPicker'
import { getT } from '@/lib/i18n-server'

/**
 * Create-Order wizard, step 1: Select parcels.
 *
 * Reads the warehouse parcels available for assignment (status =
 * IN_WAREHOUSE) and renders a 2-column layout: table on the left,
 * cart on the right. The cart's "Next: Order details" CTA carries
 * the selected ids into step 2 via the URL.
 *
 * Deliberately narrower than /admin/deliveries: only IN_WAREHOUSE
 * status, no view tabs, no verify/deny action. This page exists for
 * one thing — building a delivery bundle to hand off to a courier.
 */
const DEFAULT_PAGE_SIZE = 20

export default async function CreateOrderSelectStep({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string; q?: string }>
}) {
  const session = await getSession()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')

  const { t, lang } = await getT()
  const sp = await searchParams

  const page     = Math.max(1, Number(sp.page) || 1)
  const pageSize = Math.min(100, Math.max(10, Number(sp.pageSize) || DEFAULT_PAGE_SIZE))
  const q        = sp.q?.trim() || null

  const where = {
    status: 'IN_WAREHOUSE' as const,
    ...(q ? {
      OR: [
        { trackingNumber: { contains: q } },
        { customerName:   { contains: q } },
        { customerPhone:  { contains: q } },
      ],
    } : {}),
  }

  const [rows, total] = await Promise.all([
    prisma.delivery.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, trackingNumber: true, customerName: true, customerPhone: true,
        dropoffAddress: true, zone: true, priority: true, codAmount: true,
      },
    }),
    prisma.delivery.count({ where }),
  ])

  return (
    <Shell
      currentPath="/admin/orders/new"
      breadcrumb={{ href: '/admin/orders', label: t('wizard_back_to_orders') }}
      title={t('wizard_title_select')}
      subtitle={t('wizard_subtitle_select')}
    >
      <WizardSteps current="select" lang={lang} />

      <OrderPicker rows={rows} lang={lang} q={q} total={total} />

      <Pagination
        basePath="/admin/orders/new"
        query={sp as Record<string, string | undefined>}
        page={page}
        pageSize={pageSize}
        total={total}
        labels={{
          prev: t('page_prev'),
          next: t('page_next'),
          page: t('page_label'),
          of:   t('page_of'),
          perPage: t('page_per_page'),
          showing: t('page_showing'),
        }}
      />
    </Shell>
  )
}
