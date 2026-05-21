import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'

/**
 * Cookie that, when set, makes role-home pages query data as the target user
 * instead of the admin's own session. Only ADMIN can have this cookie applied.
 * Set/cleared via the server actions in app/admin/users/impersonate.ts.
 *
 * Read via lib/impersonation.ts helpers — auth() itself stays a thin re-export
 * of NextAuth so the middleware bundler can detect the export statically.
 */
export const IMPERSONATE_COOKIE = 'cos-impersonate-user-id'

// Google OAuth credentials are optional — if they're not set, the Google provider
// simply isn't enabled and the "Continue with Google" button will hit a failure
// page. This keeps local dev working before you've set up Google Cloud Console.
const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const googleEnabled = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET)

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email or Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const login = credentials?.email as string | undefined
        const password = credentials?.password as string | undefined
        if (!login || !password) return null

        const user = await prisma.user.findUnique({ where: { email: login } })
        if (!user || !user.active) return null
        // Google-only users have no local password — they must use the Google button.
        if (!user.password) return null

        const valid = await bcrypt.compare(password, user.password)
        if (!valid) return null

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          companyId: user.companyId ?? null,
        } as { id: string; name: string; email: string; role: string; companyId: string | null }
      },
    }),
    ...(googleEnabled
      ? [Google({
          clientId: GOOGLE_CLIENT_ID!,
          clientSecret: GOOGLE_CLIENT_SECRET!,
          allowDangerousEmailAccountLinking: true,
        })]
      : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Google sign-in: auto-provision a User row on first sign-in. New Google
      // users get role COURIER + active=false so an admin must approve them
      // before they can do anything in the app.
      if (account?.provider === 'google' && user.email) {
        const existing = await prisma.user.findUnique({ where: { email: user.email } })
        if (!existing) {
          const created = await prisma.user.create({
            data: {
              name: user.name ?? user.email,
              email: user.email,
              password: null,  // OAuth users don't have a local password
              role: 'COURIER',
              provider: 'google',
              active: false,
            },
          })
          // Hand the freshly-minted role + id back through the user object so jwt() picks them up.
          ;(user as { id?: string }).id = created.id
          ;(user as { role?: string }).role = created.role
          ;(user as { companyId?: string | null }).companyId = null
          // First sign-in: hold them at /login with an "awaiting approval" notice.
          return '/login?awaiting=1'
        }
        // Existing Google user — block sign-in if admin hasn't activated them yet.
        if (!existing.active) return '/login?awaiting=1'
        ;(user as { id?: string }).id = existing.id
        ;(user as { role?: string }).role = existing.role
        ;(user as { companyId?: string | null }).companyId = existing.companyId ?? null
      }
      return true
    },
    jwt({ token, user }) {
      if (user) {
        const u = user as { id: string; role: string; companyId: string | null }
        token.id = u.id
        token.role = u.role
        token.companyId = u.companyId
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        const t = token as { id?: string; role?: string; companyId?: string | null }
        ;(session.user as { id?: string }).id = t.id
        ;(session.user as { role?: string }).role = t.role
        ;(session.user as { companyId?: string | null }).companyId = t.companyId ?? null
      }
      return session
    },
  },
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
})
