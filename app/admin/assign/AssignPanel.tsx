'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { applyAssignmentPlan } from './actions'
import { tZone, tPriority, t as translate, type Lang, type DictKey } from '@/lib/i18n'
import { money } from '@/lib/format'

export type ZoneBucket = {
  zone: string | null
  suggestedCourierId: string
  zoneExperience: Record<string, number>
  parcels: BucketParcel[]
}

export type BucketParcel = {
  id: string
  trackingNumber: string
  customerName: string
  customerPhone: string
  dropoffAddress: string
  city: string | null
  priority: string
  codAmount: number | null
}

export type CourierOption = {
  id: string
  name: string
  currentLoad: number
}

/**
 * Bulk-assign panel — one card per zone bucket.
 *
 * For each zone the admin picks a courier (pre-filled with the smart-suggested
 * one) and either assigns the whole bucket in one click, or expands the bucket
 * to opt out specific parcels.
 */
export default function AssignPanel({
  buckets,
  couriers,
  lang = 'ge',
}: {
  buckets: ZoneBucket[]
  couriers: CourierOption[]
  lang?: Lang
}) {
  const t = (k: DictKey) => translate(k, lang)
  const router = useRouter()
  const [lastResult, setLastResult] = useState<{ count: number; zone: string } | null>(null)

  if (couriers.length === 0) {
    return (
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl px-5 py-6">
        <p className="text-sm font-semibold text-[var(--color-text-strong)]">{t('assign_no_couriers')}</p>
      </div>
    )
  }

  if (buckets.length === 0) {
    return (
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl px-6 py-10 text-center">
        <p className="text-sm text-[var(--color-text-muted)]">{t('assign_nothing')}</p>
      </div>
    )
  }

  // Total across all buckets.
  const total = buckets.reduce((s, b) => s + b.parcels.length, 0)

  async function assignAll() {
    const plan = buckets
      .filter((b) => b.suggestedCourierId)
      .flatMap((b) => b.parcels.map((p) => ({ deliveryId: p.id, courierId: b.suggestedCourierId })))
    if (plan.length === 0) return
    const r = await applyAssignmentPlan(plan)
    setLastResult({ count: r.assigned, zone: t('assign_auto_balance_label') })
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Top action bar */}
      <div className="flex flex-wrap items-center gap-3 justify-between bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-[var(--color-text-strong)]">{t('assign_ready_title')}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{t('assign_ready_hint')}</p>
        </div>
        <button
          onClick={assignAll}
          className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
        >
          ⚡ {t('assign_auto_balance_btn')} ({total})
        </button>
      </div>

      {lastResult && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-2xl px-5 py-3">
          <p className="text-sm font-semibold text-green-700 dark:text-green-300">
            {lastResult.count} {t('assign_session_done')}
          </p>
        </div>
      )}

      {buckets.map((b, i) => (
        <ZoneBucketCard
          key={b.zone ?? `nozone-${i}`}
          bucket={b}
          couriers={couriers}
          t={t}
          lang={lang}
          onAssigned={(n, zoneLabel) => { setLastResult({ count: n, zone: zoneLabel }); router.refresh() }}
        />
      ))}
    </div>
  )
}

function ZoneBucketCard({
  bucket, couriers, t, lang, onAssigned,
}: {
  bucket: ZoneBucket
  couriers: CourierOption[]
  t: (k: DictKey) => string
  lang: Lang
  onAssigned: (n: number, zoneLabel: string) => void
}) {
  const zoneLabel = bucket.zone ? tZone(bucket.zone, lang) : t('assign_unzoned')
  const [courierId, setCourierId] = useState(bucket.suggestedCourierId)
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  // Rank couriers by zone experience desc, then current load asc.
  const ranked = [...couriers].sort((a, b) => {
    const expDiff = (bucket.zoneExperience[b.id] ?? 0) - (bucket.zoneExperience[a.id] ?? 0)
    if (expDiff !== 0) return expDiff
    return a.currentLoad - b.currentLoad
  })

  const includedParcels = bucket.parcels.filter((p) => !excluded.has(p.id))
  const includedCod = includedParcels.reduce((s, p) => s + (p.codAmount ?? 0), 0)

  async function assignBucket() {
    if (busy || !courierId || includedParcels.length === 0) return
    setBusy(true)
    try {
      const r = await applyAssignmentPlan(
        includedParcels.map((p) => ({ deliveryId: p.id, courierId })),
      )
      onAssigned(r.assigned, zoneLabel)
    } finally {
      setBusy(false)
    }
  }

  function toggleParcel(id: string) {
    setExcluded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-[var(--color-border)]">
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-[var(--color-text-strong)]">{zoneLabel}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {includedParcels.length} {t('parcel_word_plural')}
            {includedCod > 0 && (
              <span className="ml-1 text-yellow-700 dark:text-yellow-400 font-semibold tabular-nums">
                · {money(includedCod)} COD
              </span>
            )}
            {excluded.size > 0 && ` · ${excluded.size} ${t('assign_excluded')}`}
          </p>
        </div>

        <select
          value={courierId}
          onChange={(e) => setCourierId(e.target.value)}
          className="border border-[var(--color-border-strong)] rounded-xl px-3 py-2 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] min-w-[200px] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        >
          <option value="">— {t('assign_pick')} —</option>
          {ranked.map((c) => {
            const exp = bucket.zoneExperience[c.id] ?? 0
            const suffix = exp > 0
              ? ` · ${exp}× ${t('dd_in_zone')}`
              : ''
            return (
              <option key={c.id} value={c.id}>
                {c.name} ({c.currentLoad}){suffix}
              </option>
            )
          })}
        </select>

        <button
          onClick={assignBucket}
          disabled={busy || !courierId || includedParcels.length === 0}
          className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors whitespace-nowrap"
        >
          {busy ? t('assign_assigning') : `${t('assign_assign_all')} ${includedParcels.length}`}
        </button>
      </div>

      <details open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
        <summary className="cursor-pointer list-none px-5 py-2 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-card-hover)]/30">
          {open ? t('assign_collapse') : t('assign_view_parcels')} ({bucket.parcels.length})
        </summary>
        <div className="border-t border-[var(--color-border)] max-h-80 overflow-y-auto">
          {bucket.parcels.map((p) => {
            const isExcluded = excluded.has(p.id)
            return (
              <label
                key={p.id}
                className={`flex items-center gap-3 px-5 py-2 border-b border-[var(--color-border)] last:border-0 cursor-pointer hover:bg-[var(--color-card-hover)]/40 ${isExcluded ? 'opacity-50' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={!isExcluded}
                  onChange={() => toggleParcel(p.id)}
                  className="rounded"
                />
                <span className="font-mono text-xs text-[var(--color-primary)] font-semibold whitespace-nowrap">{p.trackingNumber}</span>
                <span className="text-xs text-[var(--color-text-strong)] flex-1 truncate">{p.customerName}</span>
                <span className="text-xs text-[var(--color-text-muted)] flex-1 truncate hidden sm:block">{p.dropoffAddress}</span>
                {p.codAmount != null && p.codAmount > 0 && (
                  <span className="text-xs font-bold text-yellow-700 dark:text-yellow-300 tabular-nums whitespace-nowrap">
                    {money(p.codAmount)}
                  </span>
                )}
                {p.priority !== 'NORMAL' && (
                  <span className="text-[10px] font-semibold text-[var(--color-warning)] uppercase tracking-wide whitespace-nowrap">
                    {tPriority(p.priority, lang)}
                  </span>
                )}
              </label>
            )
          })}
        </div>
      </details>
    </div>
  )
}
