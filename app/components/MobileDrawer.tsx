'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'

type NavItem = { href: string; label: string; icon: ReactNode; active: boolean }

/**
 * Mobile-only drawer (slide-in from left).
 * - Hamburger button that the parent places in the mobile header.
 * - Backdrop closes on click, ESC closes, route nav closes (Link click).
 * - Body scroll locked while open.
 */
export default function MobileDrawer({
  nav,
  brandLabel,
  brandSubtitle,
  userBlock,
}: {
  nav: NavItem[]
  brandLabel: string
  brandSubtitle: string
  userBlock: ReactNode
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="-ml-1 p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)] rounded-lg hover:bg-[var(--color-card-hover)] transition-colors"
      >
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      </button>

      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-200 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        style={{
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 200ms ease-out',
        }}
        className="fixed inset-y-0 left-0 w-80 max-w-[88vw] bg-[var(--color-app-elev)] border-r border-[var(--color-border)] z-50 flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="px-5 h-16 flex items-center justify-between border-b border-[var(--color-border)] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-primary)] flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[var(--color-text-strong)] leading-tight">{brandLabel}</p>
              <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] truncate">{brandSubtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="-mr-1 p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)] rounded-lg hover:bg-[var(--color-card-hover)]"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-3 text-base font-medium transition-colors min-h-[44px] ${
                item.active
                  ? 'bg-[var(--color-primary)] text-white shadow-sm shadow-blue-900/30'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-card)]'
              }`}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* User block */}
        <div className="border-t border-[var(--color-border)] px-3 py-3 flex-shrink-0">
          {userBlock}
        </div>
      </aside>
    </>
  )
}
