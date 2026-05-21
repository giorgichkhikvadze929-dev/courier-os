'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { generateInvoiceForCompany } from './actions'

export default function GenerateInvoicePanel({ companies }: { companies: { id: string; name: string }[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [companyId, setCompanyId] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [taxRate, setTaxRate] = useState('0.18')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  async function submit() {
    if (!companyId) {
      setMsg({ kind: 'err', text: 'Pick a company.' })
      return
    }
    setBusy(true)
    setMsg(null)
    try {
      const r = await generateInvoiceForCompany({
        companyId,
        periodStart: periodStart || undefined,
        periodEnd:   periodEnd   || undefined,
        taxRate:     Number(taxRate) || 0,
      })
      if (r.ok) {
        setMsg({ kind: 'ok', text: `${r.invoiceNumber} — ${r.lineCount} parcels, total ${r.total.toFixed(2)}` })
        setCompanyId('')
        setPeriodStart('')
        setPeriodEnd('')
        router.refresh()
      } else {
        setMsg({ kind: 'err', text: r.reason })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 py-3 hover:bg-[var(--color-card-hover)]"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-[var(--color-text-strong)]">+ Generate invoice</span>
        <svg className={`w-4 h-4 text-[var(--color-text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="px-5 py-4 border-t border-[var(--color-border)] bg-[var(--color-app-elev)] flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-faint)] mb-1">Company *</label>
            <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="border border-[var(--color-border-strong)] rounded-xl px-3 py-2 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] min-w-[180px]">
              <option value="">— pick —</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-faint)] mb-1">Period start</label>
            <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="border border-[var(--color-border-strong)] rounded-xl px-3 py-2 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)]" />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-faint)] mb-1">Period end</label>
            <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="border border-[var(--color-border-strong)] rounded-xl px-3 py-2 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)]" />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-faint)] mb-1">Tax rate</label>
            <input type="number" step="0.01" min="0" max="1" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} className="border border-[var(--color-border-strong)] rounded-xl px-3 py-2 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] w-24" />
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 text-white text-sm font-semibold rounded-xl px-4 py-2 h-10"
          >
            {busy ? 'Generating…' : 'Generate'}
          </button>
          {msg && (
            <p className={`text-xs font-semibold ml-2 ${msg.kind === 'ok' ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
              {msg.text}
            </p>
          )}
          <p className="text-xs text-[var(--color-text-muted)] w-full mt-2">
            Bills every DELIVERED parcel for the company in the window that hasn&apos;t already been invoiced. Leave dates blank to bill everything not yet on an invoice.
          </p>
        </div>
      )}
    </div>
  )
}
