'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useTransition } from 'react'

const SIZE_OPTIONS = [10, 20, 50, 100, 250]

export default function PageSizeSelector({
  pageSize,
  perPageLabel,
  pageLabel,
}: {
  pageSize: number
  perPageLabel: string
  pageLabel: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [, startTransition] = useTransition()

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = new URLSearchParams(params.toString())
    next.set('pageSize', e.target.value)
    next.set('page', '1')
    startTransition(() => router.push(`${pathname}?${next.toString()}`))
  }

  return (
    <select
      value={String(pageSize)}
      onChange={onChange}
      aria-label={perPageLabel}
      className="text-xs border border-[var(--color-border)] rounded-lg px-2 py-1.5 bg-[var(--color-card)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
    >
      {SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s} / {pageLabel.toLowerCase()}</option>)}
    </select>
  )
}
