import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import prisma from '@/lib/prisma'
import { encode } from 'next-auth/jwt'

/**
 * OAuth callback for Google sign-in via Supabase Auth.
 *
 * Flow:
 *   1. User clicks "Continue with Google" → Supabase Auth opens Google's
 *      account picker.
 *   2. After consent, Google → Supabase → here, with a `?code=...` param.
 *   3. We exchange that code for a Supabase session (verifies it really came
 *      from Google), then pull the user's email/name out of it.
 *   4. We upsert that email into our Prisma `User` table. New accounts get
 *      role=COURIER, active=false, provider='google' (admin must approve).
 *   5. We mint a NextAuth-compatible JWT cookie so the rest of the app
 *      (server actions, role-based redirects, etc.) keeps working unchanged.
 *
 * This is intentionally a one-way bridge — Supabase Auth handles only the
 * OAuth roundtrip; all app-level session state lives in NextAuth.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')

  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}`, url.origin))
  }
  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', url.origin))
  }

  // 1) Exchange the OAuth code for a Supabase session.
  const supabase = await createSupabaseServerClient()
  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeError || !data?.user?.email) {
    return NextResponse.redirect(new URL('/login?error=oauth_exchange_failed', url.origin))
  }

  const email = data.user.email.toLowerCase()
  const displayName =
    (data.user.user_metadata?.full_name as string | undefined) ??
    (data.user.user_metadata?.name as string | undefined) ??
    email

  // 2) Upsert the local User row.
  const existing = await prisma.user.findUnique({ where: { email } })
  let userRow
  let isNew = false
  if (existing) {
    userRow = existing
  } else {
    isNew = true
    userRow = await prisma.user.create({
      data: {
        email,
        name: displayName,
        password: null,        // Google-only users have no local password
        role: 'COURIER',       // safe default — admin can promote
        provider: 'google',
        active: false,          // requires admin approval before they can use the app
      },
    })
  }

  // 3) Bail out if the account isn't active yet — admin must approve first.
  if (!userRow.active) {
    // Clear the Supabase session cookie so they don't have a partial-auth state.
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/login?awaiting=1', url.origin))
  }

  // 4) Mint a NextAuth-compatible JWT and set it as a cookie. From this point
  //    on `auth()` in server components/actions returns the right session.
  const secret = process.env.AUTH_SECRET
  if (!secret) {
    return NextResponse.redirect(new URL('/login?error=missing_auth_secret', url.origin))
  }
  const isProd = process.env.NODE_ENV === 'production'
  const cookieName = isProd ? '__Secure-authjs.session-token' : 'authjs.session-token'

  const token = await encode({
    token: {
      sub: userRow.id,
      id: userRow.id,
      name: userRow.name,
      email: userRow.email,
      role: userRow.role,
      companyId: userRow.companyId ?? null,
    },
    secret,
    salt: cookieName,
    maxAge: 30 * 24 * 60 * 60, // 30 days, matches NextAuth's default
  })

  const response = NextResponse.redirect(
    new URL(isNew ? '/login?awaiting=1' : '/', url.origin),
  )
  response.cookies.set(cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  })
  return response
}
