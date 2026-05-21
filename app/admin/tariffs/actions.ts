'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { audit } from '@/lib/audit'

async function requireAdmin() {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')
  return session
}

/**
 * Set / update a tariff for (company, zone). Creates a new effective row dated NOW.
 * History is preserved (older rows are not deleted).
 */
export async function upsertTariff(formData: FormData): Promise<void> {
  const session = await requireAdmin()
  const actorId = (session.user as { id?: string }).id ?? null

  const companyId = formData.get('companyId') as string
  const zone      = formData.get('zone')      as string
  const amount    = Number(formData.get('amount') ?? 0)
  const note      = (formData.get('note') as string | null)?.trim() || null

  if (!companyId || !zone || !Number.isFinite(amount)) return

  const before = await prisma.tariff.findFirst({
    where: { companyId, zone },
    orderBy: { effective: 'desc' },
  })

  const created = await prisma.tariff.create({
    data: { companyId, zone, amount, effective: new Date(), note },
  })

  await audit({
    actorId,
    action: 'TARIFF_CHANGE',
    entity: 'Tariff',
    entityId: created.id,
    before,
    after: created,
    note: `${zone} → $${amount.toFixed(2)}`,
  })

  revalidatePath('/admin/tariffs')
}
