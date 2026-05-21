'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { bulkAssignToCourier, type BulkResult } from './actions'
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
  const sortState = { by: sortBy, dir: sortDir }
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<BulkResult | null>(null)
  const [chosenCourier, setChosenCourier] = useState('')

  // Only IN_WAREHOUSE deliveries are assignable per PRD flow
  const selectableIds = useMemo(
    () => deliveries.filter((d) => ['IN_WAREHOUSE', 'RECEIVED'].includes(d.status)).map((d) => d.id),
    [deliveries],
  )

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

  return (
    <>
      {selected.size > 0 && (
        <div className="sticky top-0 z-10 bg-[var(--color-primary-soft)]/40 border border-[var(--color-border)] rounded-2xl p-4 mb-4 flex flex-wrap items-center gap-3 shadow">
          <p className="text-sm font-semibold text-[var(--color-primary)]">
            {selected.size} selected
          </p>
          <div className="flex items-center gap-2">
            <select
              value={chosenCourier}
              onChange={(e) => setChosenCourier(e.target.value)}
              className="border border-[var(--color-border-strong)] rounded-xl px-3 py-2 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)]"
            >
              <option value="">Pick courier…</option>
              {couriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.load !== undefined ? ` — ${c.load} active` : ''}
                </option>
              ))}
            </select>
            <button
              onClick={handleManual}
              disabled={busy || !chosenCourier}
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            >
              {busy ? 'Working…' : 'Assign'}
            </button>
          </div>
          <button onClick={() => setSelected(new Set())} className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)]">
            Clear
          </button>
        </div>
      )}

      {outcome && (
        <div className="bg-green-500/10 border border-[var(--color-border)] rounded-2xl p-4 mb-4">
          <p className="text-sm font-semibold text-green-700 dark:text-green-300">
            {outcome.assigned} assigned · {outcome.skipped} skipped · {outcome.failed.length} failed
          </p>
          {outcome.failed.length > 0 && (
            <ul className="text-xs text-red-600 dark:text-red-300 mt-2 space-y-0.5">
              {outcome.failed.slice(0, 5).map((f) => <li key={f.id}>· {f.reason}</li>)}
            </ul>
          )}
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
    </>
  )
}
