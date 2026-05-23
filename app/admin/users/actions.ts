'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import { audit } from '@/lib/audit'

async function requireAdmin() {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') {
    redirect('/login')
  }
  return session
}

const VALID_ROLES = ['ADMIN', 'COMPANY', 'COURIER'] as const
function sanitizeRole(raw: unknown): 'ADMIN' | 'COMPANY' | 'COURIER' {
  // Never trust the form value — a hand-crafted POST could send anything.
  // Fall back to COURIER (the safest default; no admin privileges).
  return VALID_ROLES.includes(raw as never) ? (raw as 'ADMIN' | 'COMPANY' | 'COURIER') : 'COURIER'
}

export async function createUser(formData: FormData): Promise<void> {
  const session = await requireAdmin()
  const actorId = (session.user as { id?: string }).id ?? null
  const name      = (formData.get('name') as string).trim()
  const email     = (formData.get('email') as string).trim().toLowerCase()
  const password  = formData.get('password') as string
  const role      = sanitizeRole(formData.get('role'))
  const phone     = (formData.get('phone') as string | null)?.trim() || null
  const companyId = (formData.get('companyId') as string | null)?.trim() || null

  const hashed = await bcrypt.hash(password, 10)
  const created = await prisma.user.create({
    data: {
      name, email, password: hashed, role, phone,
      companyId: role === 'COMPANY' ? companyId : null,
    },
  })
  await audit({ actorId, action: 'CREATE', entity: 'User', entityId: created.id, after: { name, email, role, companyId: created.companyId } })
  revalidatePath('/admin/users')
  redirect('/admin/users')
}

export async function updateUser(id: string, formData: FormData): Promise<void> {
  const session = await requireAdmin()
  const actorId = (session.user as { id?: string }).id ?? null
  const before = await prisma.user.findUnique({ where: { id }, select: { name: true, email: true, role: true, companyId: true, active: true } })
  const name      = (formData.get('name') as string).trim()
  const email     = (formData.get('email') as string).trim().toLowerCase()
  const role      = sanitizeRole(formData.get('role'))
  const phone     = (formData.get('phone') as string | null)?.trim() || null
  const companyId = (formData.get('companyId') as string | null)?.trim() || null
  const active    = formData.get('active') === 'true'
  const rawPw     = (formData.get('password') as string | null)?.trim()

  const data: Record<string, unknown> = {
    name, email, role, phone, active,
    companyId: role === 'COMPANY' ? companyId : null,
  }
  if (rawPw) data.password = await bcrypt.hash(rawPw, 10)

  const after = await prisma.user.update({ where: { id }, data, select: { name: true, email: true, role: true, companyId: true, active: true } })
  await audit({ actorId, action: 'UPDATE', entity: 'User', entityId: id, before, after, note: rawPw ? 'password changed' : undefined })
  revalidatePath('/admin/users')
  redirect('/admin/users')
}

export async function deactivateUser(id: string): Promise<void> {
  const session = await requireAdmin()
  const actorId = (session.user as { id?: string }).id ?? null
  await prisma.user.update({ where: { id }, data: { active: false } })
  await audit({ actorId, action: 'UPDATE', entity: 'User', entityId: id, after: { active: false }, note: 'Deactivated' })
  revalidatePath('/admin/users')
  redirect('/admin/users')
}

// Flip active status from the list page — one click, no edit screen needed.
// Accepts the *new* desired active value via FormData so this can be a
// server-action-form-action with no JS state.
export async function setUserActive(id: string, formData: FormData): Promise<void> {
  const session = await requireAdmin()
  const actorId = (session.user as { id?: string }).id ?? null
  const next = formData.get('active') === 'true'
  await prisma.user.update({ where: { id }, data: { active: next } })
  await audit({
    actorId,
    action: 'UPDATE',
    entity: 'User',
    entityId: id,
    after: { active: next },
    note: next ? 'Activated' : 'Deactivated',
  })
  revalidatePath('/admin/users')
}
