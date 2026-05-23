'use client'

import { useEffect, useState, type ReactNode } from 'react'

/**
 * Click target — the CourierOS logo + brand block.
 * On click, toggles `html.sidebar-collapsed` and persists to localStorage.
 * Renders the same children regardless of state (the *visual* collapse is CSS-only,
 * controlled by the class on <html>).
 */
export default function SidebarToggle({
  ariaLabel,
  children,
}: {
  ariaLabel?: string
  children: ReactNode
}) {
  const [collapsed, setCollapsed] = useState<boolean>(false)

  useEffect(() => {
    setCollapsed(document.documentElement.classList.contains('sidebar-collapsed'))
  }, [])

  function toggle() {
    const next = !document.documentElement.classList.contains('sidebar-collapsed')
    document.documentElement.classList.toggle('sidebar-collapsed', next)
    setCollapsed(next)
    // Cookie-based persistence so the server can render the right state on
    // first paint (no flash, no inline script).
    const ONE_YEAR = 60 * 60 * 24 * 365
    document.cookie = `sidebar-collapsed=${next ? '1' : '0'}; path=/; max-age=${ONE_YEAR}; samesite=lax`
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={ariaLabel ?? 'Toggle sidebar'}
      aria-pressed={collapsed}
      className="w-full flex items-center gap-3 hover:bg-[var(--color-card-hover)] rounded-lg -mx-1 px-1 py-1 transition-colors"
    >
      {children}
    </button>
  )
}
