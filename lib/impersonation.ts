import { cookies } from 'next/headers'
import { auth, IMPERSONATE_COOKIE } from '@/auth'
import prisma from '@/lib/prisma'

/**
 * Returns the effective session for the current request — applying admin
 * impersonation when the cookie is set.
 *
 * Use this from role-home pages (e.g. /courier, /company/parcels) so that
 * "Preview as user" actually shows the target user's data, while the admin's
 * real identity is still tracked in `impersonatedBy` for the banner.
 *
 * Non-admin sessions and admins without the cookie set get their own session
 * verbatim — no DB lookup, no overhead.
 */
export type ImpersonatedSession = {
  user: {
    id: string
    name: string | null
    email: string | null
    role: string
    companyId: string | null
  }
  impersonatedBy?: {
    id: string | null
    name: string | null
    email: string | null
  }
}

export async function getActiveSession(): Promise<ImpersonatedSession | null> {
  const session = await auth()
  if (!session?.user) return null

  const role = (session.user as { role?: string }).role ?? ''
  const sessionId = (session.user as { id?: string }).id ?? ''
  const sessionCompanyId = (session.user as { companyId?: string | null }).companyId ?? null
  const base: ImpersonatedSession = {
    user: {
      id: sessionId,
      name: session.user.name ?? null,
      email: session.user.email ?? null,
      role,
      companyId: sessionCompanyId,
    },
  }

  if (role !== 'ADMIN') return base

  const jar = await cookies()
  const targetId = jar.get(IMPERSONATE_COOKIE)?.value
  if (!targetId) return base

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, name: true, email: true, role: true, active: true, companyId: true },
  })
  if (!target || !target.active) return base

  return {
    user: {
      id: target.id,
      name: target.name,
      email: target.email,
      role: target.role,
      companyId: target.companyId ?? null,
    },
    impersonatedBy: {
      id: sessionId || null,
      name: session.user.name ?? null,
      email: session.user.email ?? null,
    },
  }
}
