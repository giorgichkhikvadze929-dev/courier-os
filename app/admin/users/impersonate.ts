'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { auth, IMPERSONATE_COOKIE } from '@/auth'
import { audit } from '@/lib/audit'

/**
 * Admin "Preview as user" — sets the impersonation cookie so subsequent
 * `auth()` calls return the target user's session. The original admin
 * identity is preserved in the wrapper's `impersonatedBy` for the banner.
 *
 * Forbidden targets: ADMIN role (can't impersonate another admin),
 * inactive users, missing users.
 */
export async function startImpersonation(targetUserId: string): Promise<void> {
  const session = await auth()
  if (!session) redirect('/login')

  // The real (non-impersonated) admin identity. If we're already impersonating,
  // `impersonatedBy` carries the real admin id.
  const impersonatedBy = (session as unknown as { impersonatedBy?: { id?: string | null } }).impersonatedBy
  const realAdminId = impersonatedBy?.id ?? (session.user as { id?: string }).id ?? null

  // Whichever the "active" session shows, the *real* identity must be ADMIN
  // (you can only set impersonation while genuinely an admin).
  if (impersonatedBy) {
    // already impersonating — switch target only if currently still tied to admin via cookie
  } else if ((session.user as { role?: string }).role !== 'ADMIN') {
    redirect('/login')
  }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, role: true, active: true, name: true, email: true },
  })
  if (!target || !target.active || target.role === 'ADMIN') {
    redirect('/admin/users')
  }

  const jar = await cookies()
  jar.set(IMPERSONATE_COOKIE, target.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60, // 1 hour — auto-expires so admins don't get stuck impersonating
  })

  await audit({
    actorId: realAdminId,
    action: 'IMPERSONATE_START',
    entity: 'User',
    entityId: target.id,
    note: `Admin began previewing as ${target.name} (${target.email})`,
  })

  // Land on the target user's home so the admin sees what they would see.
  const home = target.role === 'COURIER' ? '/courier' : target.role === 'COMPANY' ? '/company' : '/admin'
  redirect(home)
}

/**
 * Clears the impersonation cookie and returns the admin to /admin.
 * Safe to call even if no impersonation is active.
 */
export async function stopImpersonation(): Promise<void> {
  const session = await auth()
  if (!session) redirect('/login')

  const impersonatedBy = (session as unknown as { impersonatedBy?: { id?: string | null } }).impersonatedBy
  const realAdminId = impersonatedBy?.id ?? null

  const jar = await cookies()
  jar.delete(IMPERSONATE_COOKIE)

  if (realAdminId) {
    await audit({
      actorId: realAdminId,
      action: 'IMPERSONATE_STOP',
      entity: 'User',
      entityId: (session.user as { id?: string }).id ?? null,
      note: 'Admin returned from preview',
    })
  }

  redirect('/admin/users')
}
