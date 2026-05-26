'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { paletteSearch, type PaletteHit } from './search'
import { t as translate, type Lang, type DictKey } from '@/lib/i18n'

/**
 * ⌘K / Ctrl+K command palette.
 *
 * Listens globally for the shortcut, pops a centered overlay with a
 * search input. Debounced server call hits paletteSearch() which
 * returns up to 5 matches per entity type (deliveries, orders,
 * companies, couriers). Result rows are keyboard-navigable.
 *
 * The empty state advertises the shortcut so admins discover it.
 */
const TYPE_LABEL: Record<PaletteHit['type'], string> = {
  delivery: 'Delivery',
  order:    'Order',
  company:  'Company',
  courier:  'Courier',
}

const TYPE_COLOR: Record<PaletteHit['type'], string> = {
  delivery: 'text-blue-600 dark:text-blue-300',
  order:    'text-violet-600 dark:text-violet-300',
  company:  'text-emerald-600 dark:text-emerald-300',
  courier:  'text-orange-600 dark:text-orange-300',
}

export default function CommandPalette({ lang = 'ge' }: { lang?: Lang }) {
  const t = (k: DictKey) => translate(k, lang)
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<PaletteHit[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [pending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  // Global ⌘K / Ctrl+K to open. Escape closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'
      if (cmdK) { e.preventDefault(); setOpen((v) => !v) }
      if (e.key === 'Escape' && open) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Focus input + reset state when opening.
  useEffect(() => {
    if (open) { setQ(''); setHits([]); setActiveIdx(0); requestAnimationFrame(() => inputRef.current?.focus()) }
  }, [open])

  // Debounced search.
  useEffect(() => {
    if (!open) return
    if (q.trim().length < 2) { setHits([]); return }
    const id = setTimeout(() => {
      startTransition(async () => {
        const r = await paletteSearch(q)
        setHits(r)
        setActiveIdx(0)
      })
    }, 150)
    return () => clearTimeout(id)
  }, [q, open])

  function go(hit: PaletteHit) {
    setOpen(false)
    router.push(hit.href)
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, Math.max(0, hits.length - 1))) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && hits[activeIdx]) go(hits[activeIdx])
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center pt-[10vh]"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl mx-4 bg-[var(--color-card)] rounded-2xl shadow-2xl border border-[var(--color-border)] overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center gap-3">
          <svg className="w-5 h-5 text-[var(--color-text-faint)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onInputKey}
            placeholder={t('palette_placeholder')}
            className="flex-1 bg-transparent text-base text-[var(--color-text-strong)] placeholder:text-[var(--color-text-faint)] focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center px-2 py-1 text-[10px] font-mono font-semibold text-[var(--color-text-muted)] bg-[var(--color-card-hover)] border border-[var(--color-border)] rounded">ESC</kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {q.trim().length < 2 ? (
            <p className="px-5 py-8 text-sm text-[var(--color-text-muted)] text-center">{t('palette_hint')}</p>
          ) : pending && hits.length === 0 ? (
            <p className="px-5 py-8 text-sm text-[var(--color-text-muted)] text-center">{t('palette_searching')}</p>
          ) : hits.length === 0 ? (
            <p className="px-5 py-8 text-sm text-[var(--color-text-muted)] text-center">{t('palette_no_results')}</p>
          ) : (
            <ul>
              {hits.map((h, i) => (
                <li key={`${h.type}-${h.id}`}>
                  <button
                    onClick={() => go(h)}
                    onMouseEnter={() => setActiveIdx(i)}
                    className={`w-full text-left flex items-center gap-3 px-5 py-3 transition-colors ${
                      activeIdx === i ? 'bg-[var(--color-primary-soft)]/40' : 'hover:bg-[var(--color-card-hover)]'
                    }`}
                  >
                    <span className={`text-[10px] font-bold uppercase tracking-wider min-w-[64px] ${TYPE_COLOR[h.type]}`}>{TYPE_LABEL[h.type]}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-[var(--color-text-strong)] truncate">{h.primary}</span>
                      {h.secondary && <span className="block text-xs text-[var(--color-text-muted)] truncate">{h.secondary}</span>}
                    </span>
                    <span className="text-[var(--color-text-faint)] text-sm">↵</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-5 py-2.5 border-t border-[var(--color-border)] flex items-center justify-between text-[11px] text-[var(--color-text-faint)]">
          <span>{t('palette_footer_help')}</span>
          <span className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 font-mono font-semibold bg-[var(--color-card-hover)] border border-[var(--color-border)] rounded">↑</kbd>
            <kbd className="px-1.5 py-0.5 font-mono font-semibold bg-[var(--color-card-hover)] border border-[var(--color-border)] rounded">↓</kbd>
            <kbd className="px-1.5 py-0.5 font-mono font-semibold bg-[var(--color-card-hover)] border border-[var(--color-border)] rounded">↵</kbd>
          </span>
        </div>
      </div>
    </div>
  )
}
