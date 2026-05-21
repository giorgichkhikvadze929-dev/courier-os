'use client'

import { useState, type ReactNode } from 'react'

type Labels = {
  filters: string
  show: string
  hide: string
  active: string  // e.g. "active" — used as `${count} ${active}`
}

/**
 * Collapsible filter panel.
 * - Header is always visible: filter icon + label + active-count badge + chevron.
 * - Body (the children — typically a <form> or form fields) collapses on click.
 * - Defaults open if any filter is currently active (defaultOpen prop), otherwise collapsed.
 *
 * Pages should pass `activeCount` derived server-side from current searchParams,
 * so the panel auto-opens when the user lands with active filters.
 */
export default function FilterPanel({
  activeCount = 0,
  defaultOpen,
  labels,
  children,
}: {
  activeCount?: number
  defaultOpen?: boolean
  labels: Labels
  children: ReactNode
}) {
  const [open, setOpen] = useState<boolean>(defaultOpen ?? activeCount > 0)

  return (
    <div className="bg-[var(--color-card)] rounded-xl shadow-sm border border-[var(--color-border)] overflow-hidden mb-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 py-3 hover:bg-[var(--color-card-hover)] transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <svg className="w-4 h-4 text-[var(--color-text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M7 12h10M11 18h2" />
          </svg>
          <span className="text-sm font-semibold text-[var(--color-text-strong)]">{labels.filters}</span>
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-[var(--color-primary)] text-white text-[10px] font-bold leading-none">
              {activeCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-text-muted)] hidden sm:inline">
            {open ? labels.hide : labels.show}
          </span>
          <svg
            className={`w-4 h-4 text-[var(--color-text-muted)] transition-transform ${open ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </button>
      {open && (
        <div className="px-5 py-4 border-t border-[var(--color-border)] bg-[var(--color-app-elev)]">
          {children}
        </div>
      )}
    </div>
  )
}
