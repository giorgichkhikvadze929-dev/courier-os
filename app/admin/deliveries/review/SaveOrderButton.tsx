'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { bulkAssignToCourier } from '../actions'
import { t as translate, type Lang, type DictKey } from '@/lib/i18n'

/**
 * Final Save Order button. Runs bulkAssignToCourier (creates the
 * ASSIGNMENT order + flips the parcels to ASSIGNED) and forwards to
 * /admin/orders?type=ASSIGNMENT so the admin lands on the new order
 * in context.
 */
export default function SaveOrderButton({
  ids,
  courierId,
  lang = 'ge',
}: {
  ids: string[]
  courierId: string
  lang?: Lang
}) {
  const t = (k: DictKey) => translate(k, lang)
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setBusy(true)
    setError(null)
    try {
      const r = await bulkAssignToCourier(ids, courierId)
      if (r.assigned > 0) {
        router.push('/admin/orders?type=ASSIGNMENT')
      } else if (r.failed.length > 0) {
        setError(r.failed[0].reason)
      } else {
        setError(t('wizard_save_skipped'))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={busy}
        className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
          <polyline points="17 21 17 13 7 13 7 21"/>
          <polyline points="7 3 7 8 15 8"/>
        </svg>
        {busy ? '…' : t('wizard_save_order')}
      </button>
      {error && (
        <p className="text-xs text-[var(--color-danger)] mt-3">{error}</p>
      )}
    </>
  )
}
