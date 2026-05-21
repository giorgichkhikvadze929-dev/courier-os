'use client'

import { createBrowserClient } from '@supabase/ssr'

/**
 * Supabase client for use in client components / browser.
 *
 * We only use this to kick off the Google OAuth flow. Application state still
 * lives in our Prisma + NextAuth stack — Supabase Auth is only the OAuth
 * roundtrip provider here.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
