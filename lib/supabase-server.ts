import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Supabase client for use in server components / route handlers / server actions.
 * Reads/writes cookies via Next.js's `cookies()` helper so the Supabase session
 * (set during the OAuth roundtrip) is available to subsequent requests.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Called from a Server Component — safe to ignore; the middleware
            // refresh elsewhere handles session refresh.
          }
        },
      },
    },
  )
}
