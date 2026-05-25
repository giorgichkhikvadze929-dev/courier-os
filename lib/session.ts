import { cache } from 'react'
import { auth } from '@/auth'

/**
 * Per-request cached session.
 *
 * Every server-rendered page calls auth() at the top to gate access, and then
 * <Shell> renders below it and ALSO needs the session for the sidebar. Without
 * caching, that's two JWT decodes per request — and on Vercel + Supabase that
 * was visibly slowing down sidebar nav clicks.
 *
 * Wrap auth() in React `cache()` so all callers within one render pass share
 * the same decoded session. Pages should import this instead of calling
 * auth() directly.
 */
export const getSession = cache(async () => auth())
