'use client'

import { useEffect, useState } from 'react'

/**
 * Light/dark mode toggle.
 *
 * Persistence: writes a `theme` cookie that the root layout reads on every
 * request to apply the `dark` class server-side. We don't rely on
 * localStorage anymore — the cookie is the source of truth (no flash, no
 * inline script needed).
 */

const ONE_YEAR = 60 * 60 * 24 * 365

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=${ONE_YEAR}; samesite=lax`
}

export default function ThemeToggle() {
  const [mode, setMode] = useState<'light' | 'dark' | null>(null)

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark')
    setMode(isDark ? 'dark' : 'light')
  }, [])

  function toggle() {
    const next = mode === 'dark' ? 'light' : 'dark'
    setMode(next)
    document.documentElement.classList.toggle('dark', next === 'dark')
    setCookie('theme', next)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}
      className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)] rounded-lg hover:bg-[var(--color-card-hover)] transition-colors"
    >
      {mode === 'dark' ? (
        // Sun icon
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4"/>
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
        </svg>
      ) : (
        // Moon icon
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      )}
    </button>
  )
}
