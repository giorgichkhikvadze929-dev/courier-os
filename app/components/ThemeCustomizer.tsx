'use client'

import { useEffect, useState } from 'react'

/**
 * Theme color customizer.
 *
 * Lets the admin pick any hex color for the four semantic roles —
 * primary (brand), success (delivered), warning (in-transit / refused),
 * danger (failed). The choice is stored in `localStorage` under
 * `cos-brand` as JSON, and applied to the `:root` element on every page
 * load via the theme-init script in `app/layout.tsx`.
 *
 * Per-browser; not synced across devices. Reset restores the values that
 * ship in `globals.css`.
 */

type Brand = { primary: string; success: string; warning: string; danger: string }

const DEFAULTS: Brand = {
  primary: '#3B82F6',
  success: '#16A34A',
  warning: '#EA580C',
  danger:  '#DC2626',
}

const STORAGE_KEY = 'cos-brand'

function applyToRoot(brand: Partial<Brand>) {
  const r = document.documentElement
  if (brand.primary) {
    r.style.setProperty('--color-primary', brand.primary)
    r.style.setProperty('--color-primary-hover', brand.primary)
  }
  if (brand.success) r.style.setProperty('--color-success', brand.success)
  if (brand.warning) r.style.setProperty('--color-warning', brand.warning)
  if (brand.danger)  r.style.setProperty('--color-danger',  brand.danger)
}

type Labels = {
  title: string
  hint: string
  primary: string
  success: string
  warning: string
  danger: string
  save: string
  reset: string
  saved: string
}

export default function ThemeCustomizer({ labels }: { labels: Labels }) {
  const [brand, setBrand] = useState<Brand>(DEFAULTS)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Brand>
        setBrand({ ...DEFAULTS, ...parsed })
      }
    } catch {}
  }, [])

  function update<K extends keyof Brand>(key: K, value: string) {
    const next = { ...brand, [key]: value }
    setBrand(next)
    applyToRoot({ [key]: value })
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(brand))
      setSavedAt(Date.now())
      setTimeout(() => setSavedAt(null), 2000)
    } catch {}
  }

  function reset() {
    setBrand(DEFAULTS)
    applyToRoot(DEFAULTS)
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
    // Force reload so the CSS variables fall back to the stylesheet
    // defaults (which differ between light and dark mode).
    window.location.reload()
  }

  const fields: Array<{ key: keyof Brand; label: string; description: string }> = [
    { key: 'primary', label: labels.primary, description: 'Buttons, links, focus rings' },
    { key: 'success', label: labels.success, description: 'Delivered, active, positive' },
    { key: 'warning', label: labels.warning, description: 'In transit, refused, attention' },
    { key: 'danger',  label: labels.danger,  description: 'Failed, destructive actions' },
  ]

  return (
    <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-6">
      <div className="flex items-start justify-between gap-3 mb-1">
        <p className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide">{labels.title}</p>
        {savedAt && <span className="text-xs font-medium text-[var(--color-success)]">✓ {labels.saved}</span>}
      </div>
      <p className="text-xs text-[var(--color-text-muted)] mb-4">{labels.hint}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields.map((f) => (
          <label key={f.key} className="flex items-center gap-3 bg-[var(--color-bg)] rounded-xl border border-[var(--color-border)] p-3 cursor-pointer hover:border-[var(--color-border-strong)] transition-colors">
            <input
              type="color"
              value={brand[f.key]}
              onChange={(e) => update(f.key, e.target.value)}
              className="w-10 h-10 rounded-lg border border-[var(--color-border-strong)] cursor-pointer bg-transparent"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--color-text-strong)] leading-tight">{f.label}</p>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 leading-snug">{f.description}</p>
              <p className="text-[11px] font-mono text-[var(--color-text-faint)] mt-0.5">{brand[f.key].toUpperCase()}</p>
            </div>
          </label>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        <button
          type="button"
          onClick={save}
          className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          {labels.save}
        </button>
        <button
          type="button"
          onClick={reset}
          className="border border-[var(--color-border-strong)] text-[var(--color-text)] hover:bg-[var(--color-card-hover)] text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          {labels.reset}
        </button>
      </div>
    </div>
  )
}
