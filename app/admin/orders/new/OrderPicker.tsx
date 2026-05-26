'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { PriorityBadge } from '@/app/components/StatusBadge'
import { tZone, t as translate, type Lang, type DictKey } from '@/lib/i18n'
import { money } from '@/lib/format'

type Row = {
  id:             string
  trackingNumber: string
  customerName:   string
  customerPhone:  string
  dropoffAddress: string
  zone:           string | null
  priority:       string
  codAmount:      number | null
}

/**
 * Step 1 UI: search box + 2-column grid (table on left, cart on right).
 *
 * The cart card is always visible; it shows an empty-state when no rows
 * are ticked, then morphs into a parcel list with totals + a "Next:
 * Order details" CTA that hands off to step 2 via URL.
 */
export default function OrderPicker({
  rows,
  lang = 'ge',
  q,
  total,
}: {
  rows:  Row[]
  lang?: Lang
  q?:    string | null
  total: number
}) {
  const t = (k: DictKey) => translate(k, lang)
  const router = useRouter()

  const [selected, setSelected] = useState<Set<string>>(new Set())

  const selectedRows = useMemo(() => rows.filter((r) => selected.has(r.id)), [rows, selected])
  const totalCod = selectedRows.reduce((s, r) => s + (r.codAmount ?? 0), 0)
  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.has(r.id))

  function toggle(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelected(next)
  }

  function toggleAll() {
    const next = new Set(selected)
    if (allOnPageSelected) { for (const r of rows) next.delete(r.id) }
    else                   { for (const r of rows) next.add(r.id) }
    setSelected(next)
  }

  function goToDetails() {
    const ids = Array.from(selected).join(',')
    router.push(`/admin/orders/new/details?ids=${encodeURIComponent(ids)}`)
  }

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-6 lg:items-start">
      <div className="min-w-0">
        {/* Search card — mirrors the mockup's "Search Inventory" panel */}
        <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-5 sm:p-6 mb-6">
          <h2 className="text-lg font-semibold text-[var(--color-text-strong)] mb-4">{t('wizard_select_search_title')}</h2>
          <form className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[14rem]">
              <label className="block text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-faint)] mb-1">{t('btn_search')}</label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-faint)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35"/></svg>
                <input
                  name="q"
                  defaultValue={q ?? ''}
                  placeholder={t('wizard_select_search_placeholder')}
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-[var(--color-card)] border border-[var(--color-border-strong)] rounded-xl text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
            </div>
            <button type="submit" className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors h-10">
              {t('btn_filter')}
            </button>
          </form>
        </div>

        {/* Table card */}
        <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] overflow-hidden">
          {rows.length === 0 ? (
            <p className="px-6 py-10 text-sm text-[var(--color-text-muted)] text-center">{t('wizard_select_empty')}</p>
          ) : (
            <>
              <div className="px-6 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
                <p className="text-sm text-[var(--color-text-muted)]">
                  {total.toLocaleString()} {total === 1 ? t('parcel_word') : t('parcel_word_plural')}
                </p>
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-xs font-semibold text-[var(--color-primary)] hover:underline"
                >
                  {allOnPageSelected ? t('wizard_select_unselect_all') : t('wizard_select_select_all')}
                </button>
              </div>
              <ul className="divide-y divide-[var(--color-border)]">
                {rows.map((r) => {
                  const isSelected = selected.has(r.id)
                  return (
                    <li key={r.id}>
                      <label className={`flex items-center gap-3 px-6 py-3 cursor-pointer transition-colors ${isSelected ? 'bg-[var(--color-primary-soft)]/40' : 'hover:bg-[var(--color-card-hover)]'}`}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggle(r.id)}
                          className="rounded w-4 h-4 flex-shrink-0"
                        />
                        <div className="w-10 h-10 rounded-lg bg-[var(--color-primary-soft)]/40 flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5 text-[var(--color-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M16 16v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3M21 12V5a2 2 0 00-2-2H10a2 2 0 00-2 2v7M3 8h13M16 12h5M21 12l-3-3M21 12l-3 3"/>
                          </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-[var(--color-text-strong)] truncate">{r.customerName}</p>
                          <p className="font-mono text-xs text-[var(--color-primary)] mt-0.5">{r.trackingNumber}</p>
                          <p className="text-xs text-[var(--color-text-muted)] truncate mt-0.5">{r.dropoffAddress}{r.zone ? ` · ${tZone(r.zone, lang)}` : ''}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <PriorityBadge priority={r.priority} lang={lang} />
                          {r.codAmount != null && r.codAmount > 0 && (
                            <span className="font-mono text-xs font-semibold text-yellow-700 dark:text-yellow-300">{money(r.codAmount)}</span>
                          )}
                        </div>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>
      </div>

      {/* Right rail: cart card — empty state on lg+, fills as items are ticked */}
      <aside className="hidden lg:flex flex-col gap-3 sticky top-4 self-start max-h-[calc(100vh-2rem)] mt-6 lg:mt-0">
        {selected.size === 0 ? (
          <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-6 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--color-primary-soft)]/40 flex items-center justify-center">
              <svg className="w-6 h-6 text-[var(--color-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.7 13.4a2 2 0 002 1.6h9.7a2 2 0 002-1.6L23 6H6"/>
              </svg>
            </div>
            <p className="text-sm font-semibold text-[var(--color-text-strong)] mb-1">{t('cart_empty_title')}</p>
            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{t('cart_empty_hint')}</p>
          </div>
        ) : (
          <>
            <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] flex flex-col overflow-hidden flex-1 min-h-0">
              <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between flex-shrink-0">
                <p className="text-base font-semibold text-[var(--color-text-strong)]">
                  {t('bulk_selected_items')} <span className="text-[var(--color-primary)]">({selected.size})</span>
                </p>
                <button onClick={() => setSelected(new Set())} className="text-xs font-semibold text-red-600 dark:text-red-300 hover:underline">
                  {t('bulk_clear_all')}
                </button>
              </div>
              <ul className="divide-y divide-[var(--color-border)] flex-1 overflow-y-auto">
                {selectedRows.map((r) => (
                  <li key={r.id} className="px-5 py-3 flex items-start gap-3 hover:bg-[var(--color-card-hover)] transition-colors">
                    <div className="w-10 h-10 rounded-lg bg-[var(--color-primary-soft)]/40 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-[var(--color-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16 16v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3M21 12V5a2 2 0 00-2-2H10a2 2 0 00-2 2v7M3 8h13M16 12h5M21 12l-3-3M21 12l-3 3"/>
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[var(--color-text-strong)] truncate">{r.customerName}</p>
                      <p className="font-mono text-[11px] text-[var(--color-primary)] mt-0.5">{r.trackingNumber}</p>
                      <p className="text-[11px] text-[var(--color-text-muted)] truncate mt-0.5">
                        {r.zone ? tZone(r.zone, lang) : '—'}
                        {r.codAmount != null && r.codAmount > 0 && (
                          <span className="ml-2 font-mono text-yellow-700 dark:text-yellow-300">{money(r.codAmount)}</span>
                        )}
                      </p>
                    </div>
                    <button type="button" onClick={() => toggle(r.id)} className="text-[var(--color-text-faint)] hover:text-red-600 dark:hover:text-red-300 text-xl leading-none flex-shrink-0" title={t('btn_remove')}>×</button>
                  </li>
                ))}
              </ul>
              <div className="px-5 py-3 border-t border-[var(--color-border)] flex-shrink-0 bg-[var(--color-card-hover)]/40 text-xs">
                <div className="flex justify-between mb-1">
                  <span className="text-[var(--color-text-muted)]">{t('bulk_total_items')}</span>
                  <span className="font-semibold text-[var(--color-text-strong)] font-mono">{selected.size}</span>
                </div>
                {totalCod > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">{t('bulk_total_cod')}</span>
                    <span className="font-semibold text-yellow-700 dark:text-yellow-300 font-mono">{money(totalCod)}</span>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={goToDetails}
              className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm font-semibold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 shadow shadow-blue-900/30"
            >
              {t('bulk_next_details')} <span aria-hidden>→</span>
            </button>
          </>
        )}
      </aside>

      {/* Mobile: sticky bottom CTA when items selected */}
      {selected.size > 0 && (
        <div className="lg:hidden fixed bottom-4 inset-x-4 z-30">
          <button
            onClick={goToDetails}
            className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm font-semibold py-3.5 rounded-xl shadow-lg shadow-blue-900/40 flex items-center justify-center gap-2"
          >
            {t('bulk_next_details')} ({selected.size}) <span aria-hidden>→</span>
          </button>
        </div>
      )}
    </div>
  )
}
