import { auth } from '@/auth'
import { NextResponse } from 'next/server'

const ROLE_HOME: Record<string, string> = {
  ADMIN:   '/admin',
  COMPANY: '/company',
  COURIER: '/courier',
}

export default auth((req) => {
  const { nextUrl, auth: session } = req
  const isLoggedIn = !!session?.user
  const role = session?.user?.role as string | undefined
  const path = nextUrl.pathname

  // Not logged in → login (except for public routes)
  const isPublic =
    path === '/login' ||
    path === '/signup' ||
    path === '/track' || path.startsWith('/track/') ||
    path === '/auth/callback'   // Supabase OAuth return — never block this

  if (!isLoggedIn) {
    if (isPublic) return
    return NextResponse.redirect(new URL('/login', nextUrl))
  }
  // Logged-in users can also use /track (no redirect to their role home).
  if (path === '/track' || path.startsWith('/track/')) return

  const home = role ? (ROLE_HOME[role] ?? '/login') : '/login'

  // Root or login → home for role
  if (path === '/' || path === '/login') {
    return NextResponse.redirect(new URL(home, nextUrl))
  }

  // Cross-role access control. Admin can access everything; others limited to their tree.
  if (path.startsWith('/admin')   && role !== 'ADMIN') {
    return NextResponse.redirect(new URL(home, nextUrl))
  }
  if (path.startsWith('/company') && role !== 'COMPANY' && role !== 'ADMIN') {
    return NextResponse.redirect(new URL(home, nextUrl))
  }
  if (path.startsWith('/courier') && role !== 'COURIER' && role !== 'ADMIN') {
    return NextResponse.redirect(new URL(home, nextUrl))
  }
})

export const config = {
  // Bypass auth for: API routes, Next.js internal assets, and any static file in
  // /public (anything ending with a recognised file extension like .xlsx, .png,
  // .csv, fonts, etc.). Page paths never end in these extensions, so this is safe.
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:xlsx|xls|csv|svg|png|jpg|jpeg|gif|ico|webp|woff|woff2|ttf|otf|pdf|txt)$).*)',
  ],
}
