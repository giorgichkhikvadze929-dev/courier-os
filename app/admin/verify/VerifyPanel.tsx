'use client'

import { useState, useRef, useEffect } from 'react'
import { flushSync } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { verifyDelivery, verifyMany, verifyAllPending, flagDiscrepancy, denyDelivery, denyMany } from './actions'
import { StatusBadge } from '@/app/components/StatusBadge'
import ColumnHeader from '@/app/components/ColumnHeader'
import { t as translate, tZone, type Lang, type DictKey } from '@/lib/i18n'

type Row = {
  id: string
  trackingNumber: string
  customerName: string
  customerPhone: string
  dropoffAddress: string
  zone: string | null
  packageType: string | null
  status: string
  company: { name: string } | null
}

export default function VerifyPanel({
  rows,
  lang = 'ge',
  totalPending = rows.length,
}: {
  rows: Row[]
  lang?: Lang
  totalPending?: number
}) {
  const t = (k: DictKey) => translate(k, lang)
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [denyMode, setDenyMode] = useState(false)
  const [denyReason, setDenyReason] = useState('')
  // Optimistically hide rows that were just verified or denied so the UI updates
  // instantly even before the server-side revalidation lands.
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set())

  const [lastAction, setLastAction] = useState<'verified' | 'denied' | null>(null)

  // Live session counters so the user can SEE numbers move with every click.
  const [verifiedCount, setVerifiedCount] = useState(0)
  const [deniedCount,   setDeniedCount]   = useState(0)
  // "Verify all pending" — two-click confirmation so we don't promote thousands by accident.
  const [confirmingAll, setConfirmingAll] = useState(false)
  const [verifyAllBusy, setVerifyAllBusy] = useState(false)

  async function handleVerifyAll() {
    if (verifyAllBusy) return
    if (!confirmingAll) {
      setConfirmingAll(true)
      // Auto-cancel the "are you sure" prompt after 5s.
      setTimeout(() => setConfirmingAll(false), 5000)
      return
    }
    setVerifyAllBusy(true)
    try {
      const r = await verifyAllPending()
      setVerifiedCount((c) => c + r.verified)
      setLastAction('verified')
      setResult(`${t('verify_result_verified')} ${r.verified}`)
      setRemovedIds(new Set(rows.map((row) => row.id)))  // hide all visible rows
      setSelected(new Set())
      setConfirmingAll(false)
      router.refresh()
    } finally { setVerifyAllBusy(false) }
  }
  const sessionTotal = verifiedCount + deniedCount
  const remainingInQueue = Math.max(0, totalPending - sessionTotal)

  const visibleRows = rows.filter((r) => !removedIds.has(r.id))
  const allSelected = selected.size > 0 && visibleRows.every((r) => selected.has(r.id))

  function toggle(id: string) {
    const n = new Set(selected)
    if (n.has(id)) n.delete(id); else n.add(id)
    setSelected(n)
  }
  function toggleAll() {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(visibleRows.map((r) => r.id)))
  }

  async function bulkVerify() {
    if (selected.size === 0) return
    setBusy(true)
    setResult(null)
    const ids = Array.from(selected)
    try {
      const r = await verifyMany(ids)
      // Optimistically hide the rows we just acted on so the list shrinks immediately.
      setRemovedIds((prev) => {
        const n = new Set(prev)
        for (const id of ids) n.add(id)
        return n
      })
      setVerifiedCount((c) => c + r.verified)
      setResult(`${t('verify_result_verified')} ${r.verified} · ${t('verify_result_skipped')} ${r.skipped}`)
      setLastAction('verified')
      setSelected(new Set())
      router.refresh()
    } finally { setBusy(false) }
  }

  async function bulkDeny() {
    if (selected.size === 0 || !denyReason.trim()) return
    setBusy(true)
    setResult(null)
    const ids = Array.from(selected)
    try {
      const r = await denyMany(ids, denyReason.trim())
      // Drop denied rows from the list right away — they're now FAILED, not RECEIVED.
      setRemovedIds((prev) => {
        const n = new Set(prev)
        for (const id of ids) n.add(id)
        return n
      })
      setDeniedCount((c) => c + r.denied)
      setResult(`${t('verify_result_denied')} ${r.denied} · ${t('verify_result_skipped')} ${r.skipped}`)
      setLastAction('denied')
      setSelected(new Set())
      setDenyMode(false)
      setDenyReason('')
      router.refresh()
    } finally { setBusy(false) }
  }

  return (
    <>
      {/* "Verify all pending" — promotes the entire RECEIVED queue in one click. */}
      {remainingInQueue > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 bg-[var(--color-primary-soft)]/30 border border-[var(--color-primary)]/30 rounded-2xl px-4 py-3">
          <div className="flex-1 min-w-[200px]">
            <p className="text-sm font-semibold text-[var(--color-text-strong)]">{t('verify_all_title')}</p>
            <p className="text-xs text-[var(--color-text-muted)]">{t('verify_all_hint')}</p>
          </div>
          <button
            onClick={handleVerifyAll}
            disabled={verifyAllBusy}
            className={`text-sm font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-50 ${
              confirmingAll
                ? 'bg-[var(--color-warning)] hover:opacity-90 text-white'
                : 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white'
            }`}
          >
            {verifyAllBusy
              ? t('verify_btn_verifying')
              : confirmingAll
                ? `${t('verify_all_confirm')} ${remainingInQueue.toLocaleString()}?`
                : `${t('verify_all_btn')} (${remainingInQueue.toLocaleString()})`}
          </button>
          {confirmingAll && !verifyAllBusy && (
            <button
              onClick={() => setConfirmingAll(false)}
              className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)] border border-[var(--color-border-strong)] rounded-xl px-3 py-2"
            >
              {t('verify_label_cancel')}
            </button>
          )}
        </div>
      )}

      {/* Prominent live stats bar — proves to the user that verify/deny actually worked. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatTile
          label={t('verify_stat_pending')}
          value={remainingInQueue.toLocaleString()}
          tone="neutral"
          delta={sessionTotal > 0 ? `−${sessionTotal}` : undefined}
        />
        <StatTile
          label={t('verify_stat_showing')}
          value={visibleRows.length.toLocaleString()}
          tone="neutral"
        />
        <StatTile
          label={t('verify_stat_verified_session')}
          value={verifiedCount.toLocaleString()}
          tone="success"
          flash={lastAction === 'verified'}
        />
        <StatTile
          label={t('verify_stat_denied_session')}
          value={deniedCount.toLocaleString()}
          tone="danger"
          flash={lastAction === 'denied'}
        />
      </div>

      {selected.size > 0 && (
        <div className="sticky top-0 z-10 bg-cyan-500/15 border border-[var(--color-border)] rounded-2xl p-4 mb-4 shadow">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold text-cyan-700 dark:text-cyan-300">{selected.size} {t('verify_label_selected')}</p>
            {!denyMode && (
              <>
                <button
                  onClick={bulkVerify}
                  disabled={busy}
                  className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
                >
                  {busy ? t('verify_btn_verifying') : t('verify_btn_mark')}
                </button>
                <button
                  onClick={() => setDenyMode(true)}
                  disabled={busy}
                  className="bg-[var(--color-danger)] hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
                >
                  {t('verify_btn_deny')}
                </button>
                <button onClick={() => setSelected(new Set())} className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)]">
                  {t('verify_label_clear')}
                </button>
              </>
            )}
          </div>

          {denyMode && (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  value={denyReason}
                  onChange={(e) => setDenyReason(e.target.value)}
                  placeholder={t('verify_deny_reason_required')}
                  className="flex-1 min-w-[280px] border border-[var(--color-border-strong)] rounded-xl px-3 py-2 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-danger)]"
                  autoFocus
                />
                <button
                  onClick={bulkDeny}
                  disabled={busy || !denyReason.trim()}
                  className="bg-[var(--color-danger)] hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
                >
                  {busy ? t('verify_btn_denying') : `${t('verify_btn_deny')} ${selected.size}`}
                </button>
                <button
                  onClick={() => { setDenyMode(false); setDenyReason('') }}
                  className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)] border border-[var(--color-border-strong)] rounded-xl px-3 py-2"
                >
                  {t('verify_label_cancel')}
                </button>
              </div>

              {/* Sender summary so admin sees who the parcels go back to before pressing Deny */}
              <div className="mt-3 text-xs text-[var(--color-text-muted)] border-t border-[var(--color-border)] pt-3">
                <p className="font-semibold text-[var(--color-text-strong)] mb-1">{t('verify_return_to_sender')}:</p>
                <ul className="space-y-0.5 max-h-32 overflow-y-auto pr-2">
                  {visibleRows.filter((r) => selected.has(r.id)).slice(0, 8).map((r) => (
                    <li key={r.id}>
                      <span className="font-mono text-[var(--color-primary)]">{r.trackingNumber}</span>
                      {' → '}
                      <span>{r.company?.name ?? t('verify_no_sender')}</span>
                    </li>
                  ))}
                  {selected.size > 8 && (
                    <li className="text-[var(--color-text-faint)]">… +{selected.size - 8}</li>
                  )}
                </ul>
              </div>
            </>
          )}
        </div>
      )}

      {result && (
        <div className={`border border-[var(--color-border)] rounded-2xl p-4 mb-4 flex flex-wrap items-center justify-between gap-3 ${lastAction === 'denied' ? 'bg-orange-500/10' : 'bg-green-500/10'}`}>
          <p className={`text-sm font-semibold ${lastAction === 'denied' ? 'text-orange-700 dark:text-orange-300' : 'text-green-700 dark:text-green-300'}`}>
            {result}
          </p>
          {lastAction === 'verified' && (
            <Link
              href="/admin/deliveries?status=IN_WAREHOUSE&view=active"
              className="text-xs font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] underline"
            >
              {t('verify_link_view_warehouse')} →
            </Link>
          )}
          {lastAction === 'denied' && (
            <Link
              href="/admin/denied"
              className="text-xs font-semibold text-orange-700 dark:text-orange-300 hover:underline"
            >
              {t('verify_link_view_denied')} →
            </Link>
          )}
        </div>
      )}

      {/* Mobile / tablet card list — same data as the table but stacked,
          so each parcel + its action menu is readable on a phone. Hidden
          at lg+; the table below takes over there. */}
      <div className="lg:hidden flex flex-col gap-3 mb-3">
        {visibleRows.length === 0 ? (
          <p className="px-6 py-5 text-sm text-[var(--color-text-muted)] bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)]">{t('verify_no_pending')}</p>
        ) : (
          visibleRows.map((d) => (
            <div key={d.id} className={`bg-[var(--color-card)] rounded-2xl shadow-sm border ${selected.has(d.id) ? 'border-cyan-400 bg-cyan-500/5' : 'border-[var(--color-border)]'} p-4`}>
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selected.has(d.id)}
                  onChange={() => toggle(d.id)}
                  className="mt-1 rounded flex-shrink-0 w-4 h-4"
                  aria-label={`Select ${d.trackingNumber}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs text-[var(--color-primary)] font-semibold">{d.trackingNumber}</p>
                  <p className="text-sm font-medium text-[var(--color-text-strong)] mt-0.5 truncate">{d.customerName}</p>
                  <p className="text-xs text-[var(--color-text-muted)] font-mono">{d.customerPhone}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                    {d.company?.name && (
                      <span className="text-[var(--color-text-muted)]">{d.company.name}</span>
                    )}
                    {d.zone && (
                      <span className="text-[var(--color-text-faint)]">· {tZone(d.zone, lang)}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
                <details className="inline-block group">
                  <summary className="cursor-pointer list-none inline-flex items-center gap-2">
                    <span className="text-xs font-semibold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded-lg px-3 py-1.5">{t('verify_btn_verify_short')}</span>
                    <span className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)] underline">{t('verify_btn_options')}</span>
                  </summary>
                  <div className="mt-2 bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-3">
                    <RowVerify
                      deliveryId={d.id}
                      onActed={(id) => {
                        flushSync(() => {
                          setRemovedIds((prev) => new Set(prev).add(id))
                          setVerifiedCount((c) => c + 1)
                          setLastAction('verified')
                          setResult(`${t('verify_result_verified')} 1`)
                        })
                        router.refresh()
                      }}
                      labelInputPlaceholder={t('verify_placeholder')}
                      labelButton={t('verify_btn_verify_short')}
                    />
                    <div className="border-t border-[var(--color-border)] pt-2 mb-2">
                      <RowFlag
                        deliveryId={d.id}
                        onActed={() => router.refresh()}
                        labelInputPlaceholder={t('verify_discrepancy_placeholder')}
                        labelButton={t('verify_btn_flag')}
                      />
                    </div>
                    <div className="border-t border-[var(--color-border)] pt-2">
                      <RowDeny
                        deliveryId={d.id}
                        onActed={(id) => {
                          flushSync(() => {
                            setRemovedIds((prev) => new Set(prev).add(id))
                            setDeniedCount((c) => c + 1)
                            setLastAction('denied')
                            setResult(`${t('verify_result_denied')} 1`)
                          })
                          router.refresh()
                        }}
                        labelInputPlaceholder={t('verify_deny_reason')}
                        labelButton={t('verify_btn_deny')}
                      />
                    </div>
                  </div>
                </details>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop table — unchanged behaviour, lg+ only. */}
      <div className="hidden lg:block bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] overflow-x-auto">
        {visibleRows.length === 0 ? (
          <p className="px-6 py-5 text-sm text-[var(--color-text-muted)]">{t('verify_no_pending')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="px-4 py-3 w-8">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded" aria-label="Select all" />
                </th>
                <th className="text-left px-4 py-3">
                  <TrackingHeader t={t} />
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide hidden md:table-cell">Sender</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide hidden md:table-cell">Zone</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide hidden lg:table-cell">Pkg</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((d) => (
                <tr key={d.id} className={`border-b border-[var(--color-border)] last:border-0 ${selected.has(d.id) ? 'bg-cyan-500/10' : 'hover:bg-[var(--color-card-hover)]'}`}>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggle(d.id)} className="rounded" aria-label={`Select ${d.trackingNumber}`} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--color-primary)] font-semibold">{d.trackingNumber}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-[var(--color-text-strong)]">{d.customerName}</p>
                    <p className="text-xs text-[var(--color-text-faint)]">{d.customerPhone}</p>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)] hidden md:table-cell">{d.company?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)] text-xs hidden md:table-cell">{tZone(d.zone, lang)}</td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)] text-xs hidden lg:table-cell">{d.packageType ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <details className="inline-block group">
                      <summary className="cursor-pointer list-none inline-flex items-center gap-2">
                        <span className="text-xs font-semibold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded-lg px-3 py-1.5">{t('verify_btn_verify_short')}</span>
                        <span className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)] underline">{t('verify_btn_options')}</span>
                      </summary>
                      <div className="absolute right-4 mt-1 w-72 bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl shadow-lg p-3 z-20 text-left">
                        <RowVerify
                          deliveryId={d.id}
                          onActed={(id) => {
                            flushSync(() => {
                              setRemovedIds((prev) => new Set(prev).add(id))
                              setVerifiedCount((c) => c + 1)
                              setLastAction('verified')
                              setResult(`${t('verify_result_verified')} 1`)
                            })
                            router.refresh()
                          }}
                          labelInputPlaceholder={t('verify_placeholder')}
                          labelButton={t('verify_btn_verify_short')}
                        />
                        <div className="border-t border-[var(--color-border)] pt-2 mb-2">
                          <RowFlag
                            deliveryId={d.id}
                            onActed={() => router.refresh()}
                            labelInputPlaceholder={t('verify_discrepancy_placeholder')}
                            labelButton={t('verify_btn_flag')}
                          />
                        </div>
                        <div className="border-t border-[var(--color-border)] pt-2">
                          <RowDeny
                            deliveryId={d.id}
                            onActed={(id) => {
                              flushSync(() => {
                                setRemovedIds((prev) => new Set(prev).add(id))
                                setDeniedCount((c) => c + 1)
                                setLastAction('denied')
                                setResult(`${t('verify_result_denied')} 1`)
                              })
                              router.refresh()
                            }}
                            labelInputPlaceholder={t('verify_deny_reason')}
                            labelButton={t('verify_btn_deny_parcel')}
                          />
                        </div>
                        <Link href={`/admin/deliveries/${d.id}`} className="block mt-2 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)] text-center">{t('verify_view_full')}</Link>
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

// ─── Tracking column header w/ quick-filter ─────────────────────────────
// On the verify page, this column header doubles as a page-switcher so admins
// can jump from the verify queue to "In stock" (IN_WAREHOUSE) or "All items".
// Uses ColumnHeader so the popover renders via portal — escapes the table's
// `overflow-x-auto` clipping.

function TrackingHeader({ t }: { t: (k: DictKey) => string }) {
  return (
    <ColumnHeader
      basePath="/admin/verify"
      query={{}}
      label="Tracking"
      filter={{
        paramKey: '_view',                 // synthetic key — we use option.href below, not paramKey
        currentValue: '_verify_current',   // marks "Awaiting verify" as the active option
        options: [
          { value: '_in_stock',         label: t('quick_in_stock'),    href: '/admin/deliveries?status=IN_WAREHOUSE&view=active' },
          { value: '_verify_current',   label: t('quick_verify'),      href: '/admin/verify' },
        ],
        allLabel: t('quick_all_items'),
        allHref: '/admin/deliveries',
      }}
    />
  )
}

// ─── Stat tile ─────────────────────────────────────────────────────────
// A big, impossible-to-miss live metric. The `flash` prop briefly highlights
// the tile after the corresponding action so the user *sees* it move.

function StatTile({
  label,
  value,
  tone,
  delta,
  flash,
}: {
  label: string
  value: string
  tone: 'neutral' | 'success' | 'danger'
  delta?: string
  flash?: boolean
}) {
  const [pulsing, setPulsing] = useState(false)
  // Re-pulse whenever the value changes after a flash trigger.
  useEffect(() => {
    if (!flash) return
    setPulsing(true)
    const timer = setTimeout(() => setPulsing(false), 700)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flash, value])

  const ringTone =
    tone === 'success' ? 'ring-green-500/70 bg-green-500/10' :
    tone === 'danger'  ? 'ring-orange-500/70 bg-orange-500/10' :
                         'ring-cyan-500/70 bg-cyan-500/10'

  return (
    <div
      className={`relative rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 transition-all duration-300 ${pulsing ? `ring-4 ${ringTone} scale-[1.02]` : ''}`}
    >
      <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-faint)]">{label}</p>
      <p className={`mt-1 text-2xl md:text-3xl font-bold tabular-nums ${
        tone === 'success' ? 'text-green-700 dark:text-green-300' :
        tone === 'danger'  ? 'text-orange-700 dark:text-orange-300' :
                             'text-[var(--color-text-strong)]'
      }`}>
        {value}
      </p>
      {delta && (
        <p className="mt-0.5 text-xs font-semibold text-[var(--color-text-muted)]">{delta}</p>
      )}
    </div>
  )
}

// ─── Per-row sub-components ─────────────────────────────────────────────
// Each one is a tiny client form with a button onClick handler that:
//   1. Reads the input value via ref
//   2. Calls the parent's onActed (which flushSync's the row removal)
//   3. Awaits the server action
// We deliberately avoid <form action={...}> + onSubmit because in React 19
// the form-action transition can defer state updates past the await, leaving
// the row visible until revalidation completes. flushSync inside onClick
// guarantees the row hides synchronously.

function RowVerify({
  deliveryId,
  onActed,
  labelInputPlaceholder,
  labelButton,
}: {
  deliveryId: string
  onActed: (id: string) => void
  labelInputPlaceholder: string
  labelButton: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [submitting, setSubmitting] = useState(false)
  return (
    <div className="flex flex-col gap-2 mb-2">
      <input ref={inputRef} placeholder={labelInputPlaceholder} className="border border-[var(--color-border-strong)] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)]" />
      <button
        type="button"
        disabled={submitting}
        onClick={async () => {
          if (submitting) return
          setSubmitting(true)
          // Hide first, run after.
          onActed(deliveryId)
          const fd = new FormData()
          if (inputRef.current?.value) fd.set('note', inputRef.current.value)
          try { await verifyDelivery(deliveryId, fd) } finally { setSubmitting(false) }
        }}
        className="text-xs font-semibold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 rounded-lg px-3 py-1.5"
      >
        {labelButton}
      </button>
    </div>
  )
}

function RowFlag({
  deliveryId,
  onActed,
  labelInputPlaceholder,
  labelButton,
}: {
  deliveryId: string
  onActed: () => void
  labelInputPlaceholder: string
  labelButton: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [submitting, setSubmitting] = useState(false)
  return (
    <div className="flex flex-col gap-2">
      <input ref={inputRef} required placeholder={labelInputPlaceholder} className="border border-[var(--color-border-strong)] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)]" />
      <button
        type="button"
        disabled={submitting}
        onClick={async () => {
          if (submitting) return
          const note = inputRef.current?.value?.trim()
          if (!note) return
          setSubmitting(true)
          const fd = new FormData()
          fd.set('note', note)
          try { await flagDiscrepancy(deliveryId, fd); onActed() } finally { setSubmitting(false) }
        }}
        className="text-xs font-semibold text-[var(--color-warning)] border border-[var(--color-border-strong)] rounded-lg px-3 py-1.5 hover:bg-orange-500/10 disabled:opacity-50"
      >
        {labelButton}
      </button>
    </div>
  )
}

function RowDeny({
  deliveryId,
  onActed,
  labelInputPlaceholder,
  labelButton,
}: {
  deliveryId: string
  onActed: (id: string) => void
  labelInputPlaceholder: string
  labelButton: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [submitting, setSubmitting] = useState(false)
  return (
    <div className="flex flex-col gap-2">
      <input ref={inputRef} required placeholder={labelInputPlaceholder} className="border border-[var(--color-border-strong)] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-danger)]" />
      <button
        type="button"
        disabled={submitting}
        onClick={async () => {
          if (submitting) return
          const reason = inputRef.current?.value?.trim()
          if (!reason) return
          setSubmitting(true)
          // Hide first, then run server action.
          onActed(deliveryId)
          const fd = new FormData()
          fd.set('reason', reason)
          try { await denyDelivery(deliveryId, fd) } finally { setSubmitting(false) }
        }}
        className="text-xs font-semibold text-white bg-[var(--color-danger)] hover:opacity-90 disabled:opacity-50 rounded-lg px-3 py-1.5"
      >
        {labelButton}
      </button>
    </div>
  )
}
