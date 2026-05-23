'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useTransition } from 'react'

/**
 * Always-visible sort picker for the deliveries list. Renders a select that
 * encodes both field and direction as "field:dir". When the user changes the
 * selection, we patch the URL's `sort` param and let Next re-render the page.
 * No filter context is lost.
 */
export default function SortPicker({
  current,
  labels,
}: {
  current: string
  labels: {
    label: string
    newest:    string
    oldest:    string
    nameAZ:    string
    nameZA:    string
    valueHigh: string
    valueLow:  string
    status:    string
    priority:  string
    zone:      string
  }
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = new URLSearchParams(params.toString())
    next.set('sort', e.target.value)
    next.delete('sortBy')   // remove legacy param
    next.delete('sortDir')
    next.set('page', '1')
    startTransition(() => {
      router.push(`${pathname}?${next.toString()}`)
    })
  }

  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="text-[var(--color-text-muted)] font-medium">{labels.label}</span>
      <select
        value={current}
        onChange={onChange}
        disabled={pending}
        className="border border-[var(--color-border-strong)] rounded-xl px-3 py-1.5 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:opacity-60"
      >
        <option value="createdAt:desc">{labels.newest}</option>
        <option value="createdAt:asc">{labels.oldest}</option>
        <option value="customerName:asc">{labels.nameAZ}</option>
        <option value="customerName:desc">{labels.nameZA}</option>
        <option value="codAmount:desc">{labels.valueHigh}</option>
        <option value="codAmount:asc">{labels.valueLow}</option>
        <option value="status:asc">{labels.status}</option>
        <option value="priority:desc">{labels.priority}</option>
        <option value="zone:asc">{labels.zone}</option>
      </select>
    </label>
  )
}
