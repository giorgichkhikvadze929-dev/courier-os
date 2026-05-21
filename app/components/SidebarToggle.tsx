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
    try { localStorage.setItem('sidebar-collapsed', next ? '1' : '0') } catch {}
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
