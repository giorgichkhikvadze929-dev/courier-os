'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Inline primary-color picker, sits next to the dark/light toggle in the
 * topbar. One color only — the brand "highlight" used for the active sidebar
 * item, primary buttons, links, focus rings.
 *
 * Clicking the swatch opens a tiny popover containing:
 *   - 6 preset color chips for fast choices
 *   - a native <input type="color"> for fully custom hex
 *
 * Selection is applied immediately to the :root element and saved in
 * localStorage under `cos-brand`. The theme-init script in layout.tsx reads
 * it back on every page load so the color persists.
 */

const STORAGE_KEY = 'cos-brand'
const DEFAULT = '#3B82F6'

const PRESETS: Array<{ value: string; label: string }> = [
  { value: '#3B82F6', label: 'Blue' },
  { value: '#16A34A', label: 'Green' },
  { value: '#8B5CF6', label: 'Purple' },
  { value: '#EA580C', label: 'Orange' },
  { value: '#DB2777', label: 'Pink' },
  { value: '#0EA5E9', label: 'Sky' },
]

function apply(color: string) {
  const r = document.documentElement
  r.style.setProperty('--color-primary', color)
  r.style.setProperty('--color-primary-hover', color)
}

function save(color: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ primary: color }))
  } catch {}
}

export default function AccentPicker({ ariaLabel }: { ariaLabel?: string }) {
  const [color, setColor] = useState(DEFAULT)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as { primary?: string }
        if (parsed.primary) setColor(parsed.primary)
      }
    } catch {}
  }, [])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  function pick(value: string) {
    setColor(value)
    apply(value)
    save(value)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={ariaLabel ?? 'Change accent color'}
        title={ariaLabel ?? 'Change accent color'}
        onClick={() => setOpen((v) => !v)}
        className="p-2 rounded-lg hover:bg-[var(--color-card-hover)] transition-colors flex items-center justify-center"
      >
        <span
          aria-hidden="true"
          className="w-4 h-4 rounded-full border border-black/10 dark:border-white/20"
          style={{ background: color }}
        />
      </button>

      {open && (
        <div
          role="dialog"
          className="absolute right-0 mt-2 z-30 bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl shadow-lg p-3 w-56"
        >
          <div className="grid grid-cols-6 gap-2 mb-3">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                title={p.label}
                aria-label={p.label}
                onClick={() => pick(p.value)}
                className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${color.toLowerCase() === p.value.toLowerCase() ? 'border-[var(--color-text-strong)]' : 'border-transparent'}`}
                style={{ background: p.value }}
              />
            ))}
          </div>
          <label className="flex items-center justify-between gap-2 text-xs text-[var(--color-text-muted)]">
            <span>Custom</span>
            <input
              type="color"
              value={color}
              onChange={(e) => pick(e.target.value)}
              className="w-10 h-7 rounded border border-[var(--color-border-strong)] cursor-pointer bg-transparent"
            />
          </label>
          <p className="text-[10px] font-mono text-[var(--color-text-faint)] mt-2 text-right">{color.toUpperCase()}</p>
        </div>
      )}
    </div>
  )
}
