'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import { audit } from '@/lib/audit'
import { notify } from '@/lib/notifications'

async function requireAdmin() {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')
  return session
}

export async function createCompany(formData: FormData): Promise<void> {
  const session = await requireAdmin()
  const actorId = (session.user as { id?: string }).id ?? null
  const data = {
    name:    (formData.get('name') as string).trim(),
    contact: (formData.get('contact') as string | null)?.trim() || null,
    phone:   (formData.get('phone')   as string | null)?.trim() || null,
    email:   (formData.get('email')   as string | null)?.trim() || null,
    address: (formData.get('address') as string | null)?.trim() || null,
  }
  const created = await prisma.company.create({ data })
  await audit({ actorId, action: 'CREATE', entity: 'Company', entityId: created.id, after: created })
  revalidatePath('/admin/companies')
  redirect('/admin/companies')
}

export async function updateCompany(id: string, formData: FormData): Promise<void> {
  const session = await requireAdmin()
  const actorId = (session.user as { id?: string }).id ?? null
  const before = await prisma.company.findUnique({ where: { id } })
  const cycleRaw = (formData.get('billingCycle') as string | null) ?? 'MONTHLY'
  const billingCycle = ['MONTHLY', 'WEEKLY', 'OFF'].includes(cycleRaw) ? cycleRaw : 'MONTHLY'
  const anchorRaw = Number(formData.get('billingAnchorDay'))
  // MONTHLY: 1-28 (avoid month-end edge cases). WEEKLY: 0-6.
  const billingAnchorDay = Number.isFinite(anchorRaw)
    ? (billingCycle === 'WEEKLY' ? Math.max(0, Math.min(6, anchorRaw)) : Math.max(1, Math.min(28, anchorRaw)))
    : 1
  const data = {
    name:    (formData.get('name') as string).trim(),
    contact: (formData.get('contact') as string | null)?.trim() || null,
    phone:   (formData.get('phone')   as string | null)?.trim() || null,
    email:   (formData.get('email')   as string | null)?.trim() || null,
    address: (formData.get('address') as string | null)?.trim() || null,
    active:  formData.get('active') === 'true',
    billingCycle,
    billingAnchorDay,
  }
  const after = await prisma.company.update({ where: { id }, data })
  await audit({ actorId, action: 'UPDATE', entity: 'Company', entityId: id, before, after })
  revalidatePath('/admin/companies')
  redirect('/admin/companies')
}

export async function deactivateCompany(id: string): Promise<void> {
  const session = await requireAdmin()
  const actorId = (session.user as { id?: string }).id ?? null
  const before = await prisma.company.findUnique({ where: { id } })
  const after = await prisma.company.update({ where: { id }, data: { active: false } })
  await audit({ actorId, action: 'UPDATE', entity: 'Company', entityId: id, before, after, note: 'Deactivated' })
  revalidatePath('/admin/companies')
  redirect('/admin/companies')
}

/**
 * Approve a company's request to upload Excel batches.
 * Sets uploadEnabled = true, clears the pending timestamp.
 * Notifies all linked company users.
 */
export async function approveUpload(id: string): Promise<void> {
  const session = await requireAdmin()
  const actorId = (session.user as { id?: string }).id ?? null
  const before = await prisma.company.findUnique({ where: { id } })
  if (!before) return
  const after = await prisma.company.update({
    where: { id },
    data: { uploadEnabled: true, uploadRequestedAt: null },
  })
  await audit({
    actorId,
    action: 'UPDATE',
    entity: 'Company',
    entityId: id,
    before: { uploadEnabled: before.uploadEnabled, uploadRequestedAt: before.uploadRequestedAt },
    after:  { uploadEnabled: after.uploadEnabled,  uploadRequestedAt: after.uploadRequestedAt  },
    note: 'Approved Excel-upload access',
  })

  // Notify the company users
  const users = await prisma.user.findMany({ where: { companyId: id, active: true }, select: { id: true } })
  for (const u of users) {
    await notify(
      u.id,
      'Upload access approved',
      'You can now upload Excel/CSV batches for processing.',
      'SUCCESS',
      '/company/import',
    )
  }

  revalidatePath('/admin/companies')
  revalidatePath(`/admin/companies/${id}`)
  revalidatePath('/company/import')
}

/**
 * Revoke a company's upload access. They can re-request later.
 */
export async function revokeUpload(id: string): Promise<void> {
  const session = await requireAdmin()
  const actorId = (session.user as { id?: string }).id ?? null
  const before = await prisma.company.findUnique({ where: { id } })
  if (!before) return
  const after = await prisma.company.update({
    where: { id },
    data: { uploadEnabled: false, uploadRequestedAt: null },
  })
  await audit({
    actorId,
    action: 'UPDATE',
    entity: 'Company',
    entityId: id,
    before: { uploadEnabled: before.uploadEnabled, uploadRequestedAt: before.uploadRequestedAt },
    after:  { uploadEnabled: after.uploadEnabled,  uploadRequestedAt: after.uploadRequestedAt  },
    note: 'Revoked Excel-upload access',
  })

  const users = await prisma.user.findMany({ where: { companyId: id, active: true }, select: { id: true } })
  for (const u of users) {
    await notify(
      u.id,
      'Upload access revoked',
      'Your Excel-upload access has been revoked. Contact admin if needed.',
      'WARNING',
      '/company/import',
    )
  }

  revalidatePath('/admin/companies')
  revalidatePath(`/admin/companies/${id}`)
  revalidatePath('/company/import')
}
