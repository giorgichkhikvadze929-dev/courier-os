'use client'

import { useState } from 'react'
import { flushSync } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { undoDenial } from './actions'
import { t as translate, tZone, tPackage, type Lang, type DictKey } from '@/lib/i18n'

// Deterministic date formatter (no locale-dependent separators) so server and
// client render identically and React doesn't throw a hydration mismatch.
function formatDeniedAt(iso: string): string {
  const d = new Date(iso)
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mi = String(d.getUTCMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

export type DeniedRow = {
  auditId: string
  deliveryId: string
  deniedAt: string
  actorName: string | null
  trackingNumber: string
  customerName: string
  customerPhone: string
  zone: string | null
  packageType: string | null
  reason: string | null
  senderLine: string | null
}

export default function DeniedPanel({ rows, lang = 'ge' }: { rows: DeniedRow[]; lang?: Lang }) {
  const t = (k: DictKey) => translate(k, lang)
  const router = useRouter()
  const [removed, setRemoved] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [banner, setBanner] = useState<string | null>(null)

  const visible = rows.filter((r) => !removed.has(r.auditId))

  async function handleUndo(row: DeniedRow) {
    if (busy) return
    setBusy(row.auditId)
    try {
      const r = await undoDenial(row.auditId)
      if (r.ok) {
        flushSync(() => setRemoved((prev) => new Set(prev).add(row.auditId)))
        // Build a feedback banner that confirms what happened — including
        // whether the sender was actually notified.
        const restoredLine = `${t('denied_restored')} ${row.trackingNumber}`
        const senderLine = r.senderNotified
          ? `${t('denied_sender_notified')}${r.senderCompany ? ` (${r.senderCompany})` : ''}`
          : t('denied_no_sender')
        setBanner(`${restoredLine} · ${senderLine}`)
        // Auto-dismiss banner after a few seconds.
        setTimeout(() => setBanner((b) => (b?.startsWith(restoredLine) ? null : b)), 6000)
        router.refresh()
      } else {
        setErrors((e) => ({ ...e, [row.auditId]: r.reason ?? 'Failed' }))
      }
    } finally { setBusy(null) }
  }

  return (
    <>
      {banner && (
        <div className="mb-4 bg-green-500/10 border border-[var(--color-border)] rounded-2xl px-4 py-3 flex items-center gap-3">
          <svg className="w-5 h-5 text-green-700 dark:text-green-300 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          <p className="text-sm font-semibold text-green-700 dark:text-green-300">{banner}</p>
        </div>
      )}
      {visible.length === 0 ? (
        <div className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] px-6 py-10 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">{t('denied_empty')}</p>
        </div>
      ) : (
        <DeniedTable {...{ visible, busy, errors, handleUndo, lang, t }} />
      )}
    </>
  )
}

function DeniedTable({
  visible, busy, errors, handleUndo, lang, t,
}: {
  visible: DeniedRow[]
  busy: string | null
  errors: Record<string, string>
  handleUndo: (row: DeniedRow) => void
  lang: Lang
  t: (k: DictKey) => string
}) {
  return (
    <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)]">
            <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('denied_col_tracking')}</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('denied_col_customer')}</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide hidden md:table-cell">{t('denied_col_sender')}</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide hidden lg:table-cell">{t('denied_col_zone')}</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide hidden lg:table-cell">{t('denied_col_pkg')}</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{t('denied_col_reason')}</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide hidden md:table-cell">{t('denied_col_when')}</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {visible.map((r) => (
            <tr key={r.auditId} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-card-hover)]">
              <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-faint)] line-through">
                {r.trackingNumber}
              </td>
              <td className="px-4 py-3">
                <p className="font-medium text-[var(--color-text-strong)]">{r.customerName}</p>
                <p className="text-xs text-[var(--color-text-faint)]">{r.customerPhone}</p>
              </td>
              <td className="px-4 py-3 text-[var(--color-text-muted)] text-xs hidden md:table-cell">
                {r.senderLine ?? '—'}
              </td>
              <td className="px-4 py-3 text-[var(--color-text-muted)] text-xs hidden lg:table-cell">
                {tZone(r.zone, lang)}
              </td>
              <td className="px-4 py-3 text-[var(--color-text-muted)] text-xs hidden lg:table-cell">
                {tPackage(r.packageType, lang)}
              </td>
              <td className="px-4 py-3 text-[var(--color-text-muted)] text-xs max-w-[260px] truncate" title={r.reason ?? undefined}>
                {r.reason ?? '—'}
              </td>
              <td className="px-4 py-3 text-[var(--color-text-faint)] text-xs hidden md:table-cell whitespace-nowrap">
                {formatDeniedAt(r.deniedAt)}
              </td>
              <td className="px-4 py-3 text-right whitespace-nowrap">
                {errors[r.auditId] ? (
                  <span className="text-xs text-[var(--color-danger)]">{errors[r.auditId]}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleUndo(r)}
                    disabled={busy === r.auditId}
                    className="text-xs font-semibold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 rounded-lg px-3 py-1.5"
                  >
                    {busy === r.auditId ? t('denied_btn_undoing') : t('denied_btn_undo')}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-app-elev)]">
        <p className="text-xs text-[var(--color-text-faint)]">
          {t('denied_undo_hint')} <Link href="/admin/verify" className="text-[var(--color-primary)] hover:underline">{t('denied_link_verify')}</Link>
        </p>
      </div>
    </div>
  )
}
