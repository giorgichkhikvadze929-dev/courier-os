'use server'

import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'
import { signIn } from '@/auth'

export type SignupResult =
  | { ok: true }
  | { ok: false; reason: string }

/**
 * Self-service sign-up with email + password.
 *
 * Policy:
 *   - role defaults to COURIER (least-privileged role that does real work)
 *   - new accounts are inactive — an admin must flip `active = true` in the
 *     /admin/users panel before the user can actually sign in. This prevents
 *     drive-by sign-ups from immediately having access to the app.
 */
export async function signupWithEmail(formData: FormData): Promise<SignupResult> {
  const name = (formData.get('name') as string | null)?.trim()
  const email = (formData.get('email') as string | null)?.trim().toLowerCase()
  const password = (formData.get('password') as string | null) ?? ''

  if (!name)                 return { ok: false, reason: 'Name is required' }
  if (!email)                return { ok: false, reason: 'Email is required' }
  if (!email.includes('@'))  return { ok: false, reason: 'Enter a valid email address' }
  if (password.length < 8)   return { ok: false, reason: 'Password must be at least 8 characters' }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return { ok: false, reason: 'An account with that email already exists' }

  const passwordHash = await bcrypt.hash(password, 10)
  await prisma.user.create({
    data: {
      name,
      email,
      password: passwordHash,
      role: 'COURIER',
      provider: 'credentials',
      active: false, // requires admin approval before they can log in
    },
  })

  return { ok: true }
}
