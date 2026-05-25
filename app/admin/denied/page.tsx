import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import Shell from '@/app/components/Shell'
import Pagination from '@/app/components/Pagination'
import DeniedPanel, { type DeniedRow } from './DeniedPanel'
import { getT } from '@/lib/i18n-server'

const DEFAULT_PAGE_SIZE = 50

type DeliverySnapshot = {
  status?: string
  trackingNumber?: string
  companyId?: string | null
  problemFlag?: string | null
  customerName?: string
  customerPhone?: string
  dropoffAddress?: string
  zone?: string | null
  packageType?: string | null
}

export default async function DeniedPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>
}) {
  const session = await getSession()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')

  const { t, lang } = await getT()
  const sp = await searchParams

  const page = Math.max(1, Number(sp.page) || 1)
  const pageSize = Math.min(250, Math.max(10, Number(sp.pageSize) || DEFAULT_PAGE_SIZE))

  // Pull DELETE audit entries for Delivery — these are our denials.
  // We oversize the page to compensate for "already restored" filtering below.
  const PAD = 2
  const [entries, totalRaw] = await Promise.all([
    prisma.auditLog.findMany({
      where: { entity: 'Delivery', action: 'DELETE' },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize * PAD,
      include: { actor: { select: { name: true } } },
    }),
    prisma.auditLog.count({ where: { entity: 'Delivery', action: 'DELETE' } }),
  ])

  // Filter out entries whose delivery has been restored (a row exists with that id again).
  const ids = entries.map((e) => e.entityId).filter((x): x is string => !!x)
  const stillExists = ids.length > 0
    ? new Set(
        (await prisma.delivery.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((d) => d.id),
      )
    : new Set<string>()

  const rows: DeniedRow[] = entries
    .filter((e) => e.entityId && !stillExists.has(e.entityId))
    .slice(0, pageSize)
    .map((e) => {
      let snap: DeliverySnapshot = {}
      try { if (e.before) snap = JSON.parse(e.before) } catch {}
      // Pull reason out of the audit note: "...DELETED. Reason: <reason>. Return to sender — ..."
      const reasonMatch = e.note?.match(/Reason:\s*([^.]+)/)
      const reason = reasonMatch?.[1]?.trim() ?? null
      return {
        auditId:        e.id,
        deliveryId:     e.entityId!,
        deniedAt:       e.createdAt.toISOString(),
        actorName:      e.actor?.name ?? null,
        trackingNumber: snap.trackingNumber ?? '—',
        customerName:   snap.customerName ?? '—',
        customerPhone:  snap.customerPhone ?? '',
        zone:           snap.zone ?? null,
        packageType:    snap.packageType ?? null,
        reason,
        senderLine:     extractSenderLine(e.note ?? ''),
      }
    })

  const total = totalRaw  // approximate — exact would require counting distinct unrestored, expensive
  const subtitle = `${rows.length} ${t('denied_subtitle_word')} · ${total.toLocaleString()} ${t('denied_total_word')}`

  return (
    <Shell currentPath="/admin/denied" title={t('denied_title')} subtitle={subtitle}>
      <DeniedPanel rows={rows} lang={lang} />
      <Pagination
        basePath="/admin/denied"
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

function extractSenderLine(note: string): string | null {
  const m = note.match(/Return to sender — (.+)$/)
  return m?.[1]?.trim() ?? null
}
