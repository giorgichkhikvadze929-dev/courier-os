'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { markInvoicePaid, cancelInvoice } from '../actions'
import { t as translate, type Lang, type DictKey } from '@/lib/i18n'

export default function InvoiceActions({ invoiceId, status, lang = 'ge' }: { invoiceId: string; status: string; lang?: Lang }) {
  const t = (k: DictKey) => translate(k, lang)
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [err, setErr] = useState<string | null>(null)

  if (status === 'CANCELLED' || status === 'PAID') {
    return (
      <p className="text-xs text-[var(--color-text-muted)] italic">
        {status === 'PAID' ? t('invoice_paid_full') : t('invoice_cancelled_full')}
      </p>
    )
  }

  async function handleMarkPaid() {
    if (busy) return
    setBusy(true); setErr(null)
    try {
      const r = await markInvoicePaid(invoiceId)
      if (r.ok) router.refresh()
      else setErr(r.reason ?? t('invoice_failed'))
    } finally { setBusy(false) }
  }

  async function handleCancel() {
    if (busy || !cancelReason.trim()) return
    setBusy(true); setErr(null)
    try {
      const r = await cancelInvoice(invoiceId, cancelReason.trim())
      if (r.ok) router.refresh()
      else setErr(r.reason ?? t('invoice_failed'))
    } finally { setBusy(false) }
  }

  return (
    <div className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] p-4 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleMarkPaid}
        disabled={busy}
        className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl"
      >
        {busy ? t('invoice_working') : t('invoice_mark_paid')}
      </button>

      {!confirmCancel ? (
        <button
          type="button"
          onClick={() => setConfirmCancel(true)}
          className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-danger)] border border-[var(--color-border-strong)] rounded-xl px-4 py-2"
        >
          {t('invoice_cancel_btn')}
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder={t('invoice_cancel_reason_ph')}
            className="border border-[var(--color-border-strong)] rounded-xl px-3 py-2 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] min-w-[280px]"
            autoFocus
          />
          <button
            type="button"
            onClick={handleCancel}
            disabled={busy || !cancelReason.trim()}
            className="bg-[var(--color-danger)] hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl px-4 py-2"
          >
            {t('invoice_confirm_cancel')}
          </button>
          <button
            type="button"
            onClick={() => { setConfirmCancel(false); setCancelReason('') }}
            className="text-sm text-[var(--color-text-muted)] border border-[var(--color-border-strong)] rounded-xl px-3 py-2"
          >
            {t('invoice_keep')}
          </button>
        </div>
      )}

      {err && <p className="text-xs font-semibold text-red-700 dark:text-red-300 ml-2">{err}</p>}
    </div>
  )
}
