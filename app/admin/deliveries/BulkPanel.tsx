'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { bulkAssignToCourier, type BulkResult } from './actions'
import { verifyMany, denyMany } from '@/app/admin/verify/actions'
import { StatusBadge, PriorityBadge } from '@/app/components/StatusBadge'
import ColumnHeader, { type ColumnFilter } from '@/app/components/ColumnHeader'
import { tZone, tPackage, t as translate, type Lang, type DictKey } from '@/lib/i18n'
import { money } from '@/lib/format'

type Delivery = {
  id: string
  trackingNumber: string
  status: string
  priority: string
  customerName: string
  customerPhone: string
  dropoffAddress: string
  zone: string | null
  packageType: string | null
  codAmount: number | null
  courier: { name: string } | null
}

type Courier = { id: string; name: string; load?: number }

export default function BulkPanel({
  deliveries,
  couriers,
  lang = 'ge',
  sortBy,
  sortDir,
  searchParams = {},
  trackingFilter,
  statusFilter,
  priorityFilter,
  zoneFilter,
  packageFilter,
}: {
  deliveries: Delivery[]
  couriers: Courier[]
  lang?: Lang
  view?: 'active' | 'completed'
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  searchParams?: Record<string, string | undefined>
  // Per-column filter definitions (computed server-side and passed in).
  trackingFilter?: ColumnFilter   // quick-filter preset: All / In stock / Verify
  statusFilter?: ColumnFilter
  priorityFilter?: ColumnFilter
  zoneFilter?: ColumnFilter
  packageFilter?: ColumnFilter
}) {
  const t = (k: DictKey) => translate(k, lang)
  const router = useRouter()
  const sortState = { by: sortBy, dir: sortDir }
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<BulkResult | null>(null)
  const [verifyOutcome, setVerifyOutcome] = useState<{ verified: number; skipped: number } | null>(null)
  const [denyOutcome, setDenyOutcome] = useState<{ denied: number; skipped: number } | null>(null)
  const [chosenCourier, setChosenCourier] = useState('')
  const [denyReason, setDenyReason] = useState('')
  const [showDenyInput, setShowDenyInput] = useState(false)

  // Selectable = actionable status. The exact action available depends on
  // what the selected items are: RECEIVED → verify/deny, IN_WAREHOUSE →
  // assign-to-courier.
  const selectableIds = useMemo(
    () => deliveries.filter((d) => ['IN_WAREHOUSE', 'RECEIVED'].includes(d.status)).map((d) => d.id),
    [deliveries],
  )

  // Which actions to expose for the current selection.
  const selectionMode = useMemo(() => {
    if (selected.size === 0) return null as 'verify' | 'assign' | 'mixed' | null
    const statuses = new Set<string>()
    for (const d of deliveries) if (selected.has(d.id)) statuses.add(d.status)
    if (statuses.size === 1 && statuses.has('RECEIVED'))     return 'verify' as const
    if (statuses.size === 1 && statuses.has('IN_WAREHOUSE')) return 'assign' as const
    return 'mixed' as const
  }, [selected, deliveries])

  // Selected items (resolved against the current page's rows). Used for the
  // cart summary line + expandable item list.
  const selectedRows = useMemo(
    () => deliveries.filter((d) => selected.has(d.id)),
    [deliveries, selected],
  )
  const totalCod = selectedRows.reduce((s, d) => s + (d.codAmount ?? 0), 0)
  const [cartOpen, setCartOpen] = useState(false)

  const allSelected = selected.size > 0 && selectableIds.every((id) => selected.has(id))

  function toggle(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelected(next)
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(selectableIds))
  }

  async function handleManual() {
    if (selected.size === 0 || !chosenCourier) return
    setBusy(true)
    setOutcome(null)
    try {
      const r = await bulkAssignToCourier(Array.from(selected), chosenCourier)
      setOutcome(r)
      setSelected(new Set())
    } finally { setBusy(false) }
  }

  async function handleVerify() {
    if (selected.size === 0) return
    setBusy(true)
    setVerifyOutcome(null)
    try {
      const r = await verifyMany(Array.from(selected))
      setVerifyOutcome(r)
      setSelected(new Set())
    } finally { setBusy(false) }
  }

  async function handleDeny() {
    if (selected.size === 0 || !denyReason.trim()) return
    setBusy(true)
    setDenyOutcome(null)
    try {
      const r = await denyMany(Array.from(selected), denyReason.trim())
      setDenyOutcome(r)
      setSelected(new Set())
      setDenyReason('')
      setShowDenyInput(false)
    } finally { setBusy(false) }
  }

  return (
    <>
      {/* Sticky action bar shown whenever any rows are selected. /admin/deliveries
          is the plain list view — bulk verify/deny/assign all surface here.
          The cart-style right-rail lives on the Create-Order wizard now. */}
      {selected.size > 0 && (
        <div className="sticky top-0 z-10 bg-[var(--color-primary-soft)]/40 border border-[var(--color-border)] rounded-2xl mb-4 shadow">
          {/* Cart header row */}
          <div className="p-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setCartOpen((v) => !v)}
            className="flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]"
            title={cartOpen ? t('bulk_hide_items') : t('bulk_show_items')}
          >
            <span>{selected.size} {t('bulk_selected')}</span>
            {totalCod > 0 && (
              <span className="text-[var(--color-text-muted)] font-normal">· COD {money(totalCod)}</span>
            )}
            <svg className={`w-4 h-4 transition-transform ${cartOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
          </button>

          {/* RECEIVED selection → verify or deny. */}
          {selectionMode === 'verify' && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleVerify}
                disabled={busy}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
              >
                {busy ? '…' : `${t('bulk_verify')} (${selected.size})`}
              </button>
              {!showDenyInput && (
                <button
                  onClick={() => setShowDenyInput(true)}
                  disabled={busy}
                  className="border border-red-500/50 text-red-600 dark:text-red-300 hover:bg-red-500/10 disabled:opacity-50 text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
                >
                  {t('bulk_deny')}
                </button>
              )}
              {showDenyInput && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={denyReason}
                    onChange={(e) => setDenyReason(e.target.value)}
                    placeholder={t('verify_deny_reason')}
                    className="border border-[var(--color-border-strong)] rounded-xl px-3 py-2 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] w-56"
                  />
                  <button
                    onClick={handleDeny}
                    disabled={busy || !denyReason.trim()}
                    className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
                  >
                    {busy ? '…' : t('bulk_deny')}
                  </button>
                  <button
                    onClick={() => { setShowDenyInput(false); setDenyReason('') }}
                    className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)]"
                  >
                    {t('btn_cancel')}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* IN_WAREHOUSE selection → assign to courier (cart-style action). */}
          {selectionMode === 'assign' && (
            <div className="flex items-center gap-2">
              <select
                value={chosenCourier}
                onChange={(e) => setChosenCourier(e.target.value)}
                className="border border-[var(--color-border-strong)] rounded-xl px-3 py-2 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)]"
              >
                <option value="">{t('bulk_pick_courier')}</option>
                {couriers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.load !== undefined ? ` — ${c.load} ${t('bulk_active')}` : ''}
                  </option>
                ))}
              </select>
              <button
                onClick={handleManual}
                disabled={busy || !chosenCourier}
                className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
              >
                {busy ? '…' : `${t('bulk_create_order')} (${selected.size})`}
              </button>
            </div>
          )}

          {/* Mixed selection: no single action makes sense. */}
          {selectionMode === 'mixed' && (
            <p className="text-xs text-[var(--color-text-muted)]">{t('bulk_mixed_hint')}</p>
          )}

          <button onClick={() => setSelected(new Set())} className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)] ml-auto">
            {t('btn_clear')}
          </button>
          </div>

          {/* Expandable cart contents — shows the selected parcels with
              tracking + customer + COD so the admin can sanity-check the
              "order" they're about to send out before clicking Create. */}
          {cartOpen && selectedRows.length > 0 && (
            <div className="border-t border-[var(--color-border)] max-h-64 overflow-y-auto bg-[var(--color-card)] rounded-b-2xl">
              <ul className="divide-y divide-[var(--color-border)]">
                {selectedRows.map((d) => (
                  <li key={d.id} className="px-4 py-2 flex items-center gap-3 text-xs">
                    <span className="font-mono text-[var(--color-primary)] font-semibold flex-shrink-0">{d.trackingNumber}</span>
                    <span className="text-[var(--color-text-strong)] truncate flex-1">{d.customerName}</span>
                    {d.zone && <span className="text-[var(--color-text-muted)] flex-shrink-0">{tZone(d.zone, lang)}</span>}
                    {d.codAmount != null && d.codAmount > 0 && (
                      <span className="font-mono text-yellow-700 dark:text-yellow-300 flex-shrink-0">{money(d.codAmount)}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => toggle(d.id)}
                      className="text-[var(--color-text-muted)] hover:text-red-600 dark:hover:text-red-300"
                      title={t('btn_remove')}
                    >×</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {outcome && (
        <div className="bg-green-500/10 border border-[var(--color-border)] rounded-2xl p-4 mb-4">
          <p className="text-sm font-semibold text-green-700 dark:text-green-300">
            {outcome.assigned} {t('bulk_assigned')} · {outcome.skipped} {t('bulk_skipped')} · {outcome.failed.length} {t('bulk_failed')}
          </p>
          {outcome.failed.length > 0 && (
            <ul className="text-xs text-red-600 dark:text-red-300 mt-2 space-y-0.5">
              {outcome.failed.slice(0, 5).map((f) => <li key={f.id}>· {f.reason}</li>)}
            </ul>
          )}
        </div>
      )}

      {verifyOutcome && (
        <div className="bg-green-500/10 border border-[var(--color-border)] rounded-2xl p-4 mb-4">
          <p className="text-sm font-semibold text-green-700 dark:text-green-300">
            {verifyOutcome.verified} {t('bulk_verified')} · {verifyOutcome.skipped} {t('bulk_skipped')}
          </p>
        </div>
      )}

      {denyOutcome && (
        <div className="bg-red-500/10 border border-[var(--color-border)] rounded-2xl p-4 mb-4">
          <p className="text-sm font-semibold text-red-700 dark:text-red-300">
            {denyOutcome.denied} {t('bulk_denied')} · {denyOutcome.skipped} {t('bulk_skipped')}
          </p>
        </div>
      )}

      {deliveries.length === 0 ? (
        <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] px-6 py-8 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">No deliveries found.</p>
        </div>
      ) : (
        <>
          {/* Mobile card view (< md) */}
          <div className="md:hidden flex flex-col gap-3">
            {deliveries.map((d) => {
              const canSelect = ['IN_WAREHOUSE', 'RECEIVED'].includes(d.status)
              const isSelected = selected.has(d.id)
              return (
                <div
                  key={d.id}
                  className={`bg-[var(--color-card)] rounded-2xl border p-4 transition-colors ${
                    isSelected ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]/30' : 'border-[var(--color-border)]'
                  }`}
                >
                  {/* Top row: checkbox + tracking + view link */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        disabled={!canSelect}
                        checked={isSelected}
                        onChange={() => toggle(d.id)}
                        className="rounded disabled:opacity-30 flex-shrink-0 w-4 h-4"
                        aria-label={`Select ${d.trackingNumber}`}
                      />
                      <Link
                        href={`/admin/deliveries/${d.id}`}
                        className="font-mono text-xs text-[var(--color-primary)] font-semibold truncate"
                      >
                        {d.trackingNumber}
                      </Link>
                    </div>
                    <Link
                      href={`/admin/deliveries/${d.id}`}
                      className="text-xs font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] flex-shrink-0"
                    >
                      View →
                    </Link>
                  </div>

                  {/* Customer + price */}
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold text-[var(--color-text-strong)] leading-tight">{d.customerName}</p>
                      <p className="text-xs text-[var(--color-text-faint)] mt-0.5">{d.customerPhone}</p>
                    </div>
                    {d.codAmount != null && d.codAmount > 0 && (
                      <div className="text-right flex-shrink-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-yellow-700/70 dark:text-yellow-400/70">COD</p>
                        <p className="text-base font-bold text-yellow-700 dark:text-yellow-300 tabular-nums">{money(d.codAmount)}</p>
                      </div>
                    )}
                  </div>

                  {/* Address */}
                  <p className="text-xs text-[var(--color-text-muted)] mb-3 leading-snug">
                    {d.dropoffAddress}
                  </p>

                  {/* Status + priority badges */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <StatusBadge status={d.status} lang={lang} />
                    <PriorityBadge priority={d.priority} lang={lang} />
                    {d.zone && (
                      <span className="inline-flex items-center text-xs text-[var(--color-text-muted)] bg-[var(--color-card-hover)] rounded-full px-2.5 py-0.5">
                        {tZone(d.zone, lang)}
                      </span>
                    )}
                    {d.packageType && (
                      <span className="inline-flex items-center text-xs text-[var(--color-text-muted)] bg-[var(--color-card-hover)] rounded-full px-2.5 py-0.5">
                        {tPackage(d.packageType, lang)}
                      </span>
                    )}
                  </div>

                  {/* Courier */}
                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-[var(--color-border)]">
                    <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] font-semibold">Courier</span>
                    <span className="text-xs font-medium">
                      {d.courier?.name ?? (
                        <span className="text-yellow-600 dark:text-yellow-400">{t('dd_courier_unassigned')}</span>
                      )}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop table view (≥ md) */}
          <div className="hidden md:block bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="px-4 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="rounded"
                      aria-label="Select all assignable"
                    />
                  </th>
                  <th className="text-left px-4 py-3">
                    <ColumnHeader basePath="/admin/deliveries" query={searchParams} field="trackingNumber" current={sortState} label="Tracking" filter={trackingFilter} />
                  </th>
                  <th className="text-left px-4 py-3">
                    <ColumnHeader basePath="/admin/deliveries" query={searchParams} field="customerName" current={sortState} label="Customer" sortStyle="alpha" />
                  </th>
                  {/* Status / Priority / Zone / Pkg are categorical enums — alphabetic
                      sort would be meaningless (e.g. priority HIGH→LOW→NORMAL→URGENT).
                      Drop the sort arrow; the funnel filter remains. */}
                  <th className="text-left px-4 py-3">
                    <ColumnHeader basePath="/admin/deliveries" query={searchParams} label="Status" filter={statusFilter} />
                  </th>
                  <th className="text-left px-4 py-3">
                    <ColumnHeader basePath="/admin/deliveries" query={searchParams} label="Priority" filter={priorityFilter} />
                  </th>
                  <th className="text-left px-4 py-3">
                    <ColumnHeader basePath="/admin/deliveries" query={searchParams} label="Zone" filter={zoneFilter} />
                  </th>
                  <th className="text-left px-4 py-3 hidden lg:table-cell">
                    <ColumnHeader basePath="/admin/deliveries" query={searchParams} label="Pkg" filter={packageFilter} />
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">COD</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Courier</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((d) => {
                  const canSelect = ['IN_WAREHOUSE', 'RECEIVED'].includes(d.status)
                  return (
                    <tr key={d.id} className={`border-b border-[var(--color-border)] last:border-0 ${selected.has(d.id) ? 'bg-[var(--color-primary-soft)]/40' : 'hover:bg-[var(--color-card-hover)]'}`}>
                      <td className="px-4 py-3 align-top">
                        <input
                          type="checkbox"
                          disabled={!canSelect}
                          checked={selected.has(d.id)}
                          onChange={() => toggle(d.id)}
                          className="rounded disabled:opacity-30"
                          aria-label={`Select ${d.trackingNumber}`}
                        />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--color-primary)] font-semibold">{d.trackingNumber}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[var(--color-text-strong)]">{d.customerName}</p>
                        <p className="text-xs text-[var(--color-text-faint)]">{d.customerPhone}</p>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={d.status} lang={lang} /></td>
                      <td className="px-4 py-3"><PriorityBadge priority={d.priority} lang={lang} /></td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)] text-xs">{tZone(d.zone, lang)}</td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)] text-xs hidden lg:table-cell">{tPackage(d.packageType, lang)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {d.codAmount != null && d.codAmount > 0
                          ? <span className="text-sm font-semibold text-yellow-700 dark:text-yellow-300">{money(d.codAmount)}</span>
                          : <span className="text-xs text-[var(--color-text-faint)]">—</span>}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)]">{d.courier?.name ?? <span className="text-yellow-600 dark:text-yellow-400">{t('dd_courier_unassigned')}</span>}</td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/admin/deliveries/${d.id}`} className="text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] font-medium">{t('dd_view')}</Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* The lg+ right-rail cart used to live here. It moved to the
          Create-Order wizard (/admin/orders/new). /admin/deliveries is
          back to being a plain list view + sticky-top bulk actions. */}
      {false && (
        <aside className="hidden">
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
            {/* Card 1 — Selected items */}
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
                {selectedRows.map((d) => (
                  <li key={d.id} className="px-5 py-3 flex items-start gap-3 hover:bg-[var(--color-card-hover)] transition-colors">
                    <div className="w-10 h-10 rounded-lg bg-[var(--color-primary-soft)]/40 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-[var(--color-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16 16v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3M21 12V5a2 2 0 00-2-2H10a2 2 0 00-2 2v7M3 8h13M16 12h5M21 12l-3-3M21 12l-3 3"/>
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[var(--color-text-strong)] truncate">{d.customerName}</p>
                      <p className="font-mono text-[11px] text-[var(--color-primary)] mt-0.5">{d.trackingNumber}</p>
                      <p className="text-[11px] text-[var(--color-text-muted)] truncate mt-0.5">
                        {d.zone ? tZone(d.zone, lang) : '—'}
                        {d.codAmount != null && d.codAmount > 0 && (
                          <span className="ml-2 font-mono text-yellow-700 dark:text-yellow-300">{money(d.codAmount)}</span>
                        )}
                      </p>
                    </div>
                    <button type="button" onClick={() => toggle(d.id)} className="text-[var(--color-text-faint)] hover:text-red-600 dark:hover:text-red-300 text-xl leading-none flex-shrink-0" title={t('btn_remove')}>×</button>
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

            {/* Card 2 — Action */}
            <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-5 flex-shrink-0">
              {selectionMode === 'assign' && (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-faint)] mb-3">{t('bulk_assign_next_title')}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mb-3 leading-relaxed">{t('bulk_assign_next_hint')}</p>
                  <button
                    onClick={() => {
                      const ids = Array.from(selected).join(',')
                      router.push(`/admin/orders/new/details?ids=${encodeURIComponent(ids)}`)
                    }}
                    disabled={busy}
                    className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 text-white text-sm font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    {t('bulk_next_details')} <span aria-hidden>→</span>
                  </button>
                </>
              )}
              {selectionMode === 'verify' && (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-faint)] mb-3">{t('bulk_verify_title')}</p>
                  <button
                    onClick={handleVerify}
                    disabled={busy}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold py-3 rounded-xl transition-colors mb-2"
                  >
                    {busy ? '…' : `${t('bulk_verify')} (${selected.size})`}
                  </button>
                  {!showDenyInput ? (
                    <button onClick={() => setShowDenyInput(true)} disabled={busy} className="w-full border border-red-500/50 text-red-600 dark:text-red-300 hover:bg-red-500/10 text-sm font-semibold py-3 rounded-xl transition-colors">
                      {t('bulk_deny')}
                    </button>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <input type="text" value={denyReason} onChange={(e) => setDenyReason(e.target.value)} placeholder={t('verify_deny_reason')} className="w-full border border-[var(--color-border-strong)] rounded-xl px-3 py-2 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)]" />
                      <button onClick={handleDeny} disabled={busy || !denyReason.trim()} className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">
                        {busy ? '…' : t('bulk_deny')}
                      </button>
                      <button onClick={() => { setShowDenyInput(false); setDenyReason('') }} className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)]">{t('btn_cancel')}</button>
                    </div>
                  )}
                </>
              )}
              {selectionMode === 'mixed' && (
                <p className="text-xs text-[var(--color-text-muted)] text-center py-2">{t('bulk_mixed_hint')}</p>
              )}
            </div>
          </>
        )}
      </aside>
      )}
    </>
  )
}
