'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'

/**
 * Column header that shows: label + sort indicator + (optional) filter dropdown.
 *
 * Sort: click the label → cycle unsorted → asc → desc → unsorted.
 * Filter: click the funnel icon → popover with one link per option.
 *   Picking an option sets `?<filter.paramKey>=<value>` + preserves other params + resets page.
 *   Picking "All" clears the filter.
 *
 * Popover is rendered via React portal into document.body so it escapes any
 * `overflow: hidden` / `overflow-x: auto` on the surrounding table container.
 */
export type ColumnFilter = {
  paramKey: string                  // URL param key, e.g. 'status'
  currentValue?: string             // currently selected raw value, if any
  currentLabel?: string             // human-friendly label of current value
  options: Array<{ value: string; label: string; href?: string }> // optional href overrides paramKey-based URL
  allLabel: string                  // e.g. "All statuses"
  allHref?: string                  // optional explicit href for the "All" option
}

export default function ColumnHeader({
  basePath,
  query,
  field,
  current,
  label,
  align = 'left',
  filter,
  sortStyle = 'arrow',
}: {
  basePath: string
  query: Record<string, string | undefined>
  field?: string
  current?: { by?: string; dir?: 'asc' | 'desc' }
  label: string
  align?: 'left' | 'right' | 'center'
  filter?: ColumnFilter
  sortStyle?: 'arrow' | 'alpha'
}) {
  const isActive = !!field && current?.by === field
  const nextDir: 'asc' | 'desc' | undefined = !isActive
    ? 'asc'
    : current?.dir === 'asc'
      ? 'desc'
      : undefined

  function sortHref(): string {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(query)) {
      if (v != null && v !== '' && k !== 'sortBy' && k !== 'sortDir' && k !== 'page') {
        params.set(k, String(v))
      }
    }
    if (nextDir && field) {
      params.set('sortBy', field)
      params.set('sortDir', nextDir)
    }
    const qs = params.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }

  function filterHref(value: string | null): string {
    if (!filter) return basePath
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(query)) {
      if (v == null || v === '') continue
      if (k === filter.paramKey || k === 'page') continue
      params.set(k, String(v))
    }
    if (value) params.set(filter.paramKey, value)
    const qs = params.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }

  const filterActive = !!filter?.currentValue
  const alignClass = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'

  return (
    <div className={`inline-flex items-center gap-1 ${alignClass}`}>
      {field ? (
        <Link
          href={sortHref()}
          className={`inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition-colors ${
            isActive ? 'text-[var(--color-text-strong)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
          aria-sort={isActive ? (current?.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
        >
          <span>{label}</span>
          {sortStyle === 'alpha'
            ? <AlphaGlyph active={isActive} dir={current?.dir} />
            : <SortGlyph  active={isActive} dir={current?.dir} />
          }
        </Link>
      ) : (
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{label}</span>
      )}

      {filter && (
        <FilterPopover
          label={label}
          filter={filter}
          filterActive={filterActive}
          buildHref={filterHref}
        />
      )}
    </div>
  )
}

// ─── Filter popover (portal-based so it escapes table overflow) ──────────

function FilterPopover({
  label,
  filter,
  filterActive,
  buildHref,
}: {
  label: string
  filter: ColumnFilter
  filterActive: boolean
  buildHref: (value: string | null) => string
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const [mounted, setMounted] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Detect client side so createPortal is safe.
  useEffect(() => { setMounted(true) }, [])

  const placePopover = useCallback(() => {
    const btn = triggerRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const POPOVER_WIDTH = 224  // ~14rem
    // Right-align with the trigger; clamp into viewport.
    let left = rect.right - POPOVER_WIDTH
    if (left < 8) left = 8
    if (left + POPOVER_WIDTH > window.innerWidth - 8) {
      left = window.innerWidth - POPOVER_WIDTH - 8
    }
    setPos({ left, top: rect.bottom + 4 })
  }, [])

  function toggleOpen() {
    if (open) {
      setOpen(false)
      return
    }
    placePopover()
    setOpen(true)
  }

  // Close on outside click, Escape, or window resize/scroll.
  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      const target = e.target as Node
      if (popoverRef.current?.contains(target)) return
      if (triggerRef.current?.contains(target)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    function onResize() { placePopover() }
    function onScroll() { setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open, placePopover])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleOpen}
        className={`w-6 h-6 inline-flex items-center justify-center rounded hover:bg-[var(--color-card-hover)] ${
          filterActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-faint)]'
        }`}
        aria-label={`Filter by ${label}`}
        aria-expanded={open}
      >
        <FilterGlyph active={filterActive} />
      </button>

      {mounted && open && pos && createPortal(
        <div
          ref={popoverRef}
          style={{ position: 'fixed', left: pos.left, top: pos.top, width: 224, zIndex: 9999 }}
          className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl shadow-2xl overflow-hidden text-left"
        >
          <div className="max-h-72 overflow-y-auto">
            <Link
              href={filter.allHref ?? buildHref(null)}
              onClick={() => setOpen(false)}
              className={`block px-3 py-2 text-sm hover:bg-[var(--color-card-hover)] ${
                !filterActive ? 'font-semibold text-[var(--color-text-strong)] bg-[var(--color-primary-soft)]/30' : 'text-[var(--color-text-muted)]'
              }`}
            >
              {filter.allLabel}
            </Link>
            <div className="border-t border-[var(--color-border)]" />
            {filter.options.map((opt) => {
              const selected = filter.currentValue === opt.value
              return (
                <Link
                  key={opt.value}
                  href={opt.href ?? buildHref(opt.value)}
                  onClick={() => setOpen(false)}
                  className={`block px-3 py-2 text-sm hover:bg-[var(--color-card-hover)] ${
                    selected ? 'font-semibold text-[var(--color-primary)] bg-[var(--color-primary-soft)]/30' : 'text-[var(--color-text)]'
                  }`}
                >
                  {opt.label}
                </Link>
              )
            })}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

// ─── Visual glyphs ─────────────────────────────────────────────────────────

function SortGlyph({ active, dir }: { active: boolean; dir?: 'asc' | 'desc' }) {
  if (!active) {
    return (
      <svg className="w-3.5 h-3.5 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 9l4-4 4 4M8 15l4 4 4-4" />
      </svg>
    )
  }
  if (dir === 'asc') {
    return (
      <svg className="w-3.5 h-3.5 text-[var(--color-primary)]" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 6l6 8H6z" />
      </svg>
    )
  }
  return (
    <svg className="w-3.5 h-3.5 text-[var(--color-primary)]" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 18l6-8H6z" />
    </svg>
  )
}

function AlphaGlyph({ active, dir }: { active: boolean; dir?: 'asc' | 'desc' }) {
  if (!active) {
    return (
      <span className="text-[10px] font-bold tracking-tight opacity-50 px-1 py-0.5 rounded border border-current">
        A↕Z
      </span>
    )
  }
  return (
    <span className="text-[10px] font-bold tracking-tight px-1 py-0.5 rounded bg-[var(--color-primary)] text-white">
      {dir === 'asc' ? 'A→Z' : 'Z→A'}
    </span>
  )
}

function FilterGlyph({ active }: { active: boolean }) {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5h18l-7 9v6l-4-2v-4z" />
    </svg>
  )
}
