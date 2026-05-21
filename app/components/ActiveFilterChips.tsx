import Link from 'next/link'

/**
 * Server-renderable strip of active filter chips.
 *
 * Each chip shows the filter's label + the resolved value, plus a × link that
 * removes only that one filter and preserves all the others (and pageSize, but
 * resets to page=1).
 *
 * Usage on a server component:
 *   <ActiveFilterChips
 *     basePath="/admin/deliveries"
 *     query={sp}
 *     chips={[
 *       q && { key: 'q',       label: 'Search',   value: q },
 *       status && { key: 'status', label: 'Status', value: tStatus(status, lang) },
 *       ...
 *     ].filter(Boolean) as Chip[]}
 *     clearAllLabel="Clear all"
 *   />
 */
export type Chip = { key: string; label: string; value: string }

export default function ActiveFilterChips({
  basePath,
  query,
  chips,
  clearAllLabel = 'Clear all',
}: {
  basePath: string
  query: Record<string, string | undefined>
  chips: Chip[]
  clearAllLabel?: string
}) {
  if (chips.length === 0) return null

  // Build the URL that drops a given key from the current query.
  function hrefWithoutKey(removeKey: string): string {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(query)) {
      if (v == null || v === '') continue
      if (k === removeKey || k === 'page') continue
      params.set(k, String(v))
    }
    const qs = params.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      {chips.map((c) => (
        <span
          key={c.key}
          className="inline-flex items-center gap-1.5 bg-[var(--color-primary-soft)]/40 text-[var(--color-primary)] border border-[var(--color-primary)]/30 rounded-full pl-3 pr-1 py-1 text-xs font-semibold"
        >
          <span className="text-[var(--color-text-faint)] uppercase tracking-wider text-[10px]">
            {c.label}:
          </span>
          <span className="text-[var(--color-text-strong)] truncate max-w-[160px]" title={c.value}>
            {c.value}
          </span>
          <Link
            href={hrefWithoutKey(c.key)}
            className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full hover:bg-[var(--color-primary)]/20 text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
            aria-label={`Remove ${c.label} filter`}
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </Link>
        </span>
      ))}
      <Link
        href={basePath + (query.view === 'completed' ? '?view=completed' : '')}
        className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)] underline ml-1"
      >
        {clearAllLabel}
      </Link>
    </div>
  )
}
