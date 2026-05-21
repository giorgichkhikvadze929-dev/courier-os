import Link from 'next/link'

/**
 * Server-renderable sortable column header.
 *
 * Click to cycle: unsorted → asc → desc → unsorted.
 * Preserves every other URL param so filters / pagination stay intact.
 *
 * Usage inside a `<th>`:
 *   <SortableHeader basePath="/admin/deliveries" query={sp} field="customerName" current={{ by: sortBy, dir: sortDir }} label="Customer" />
 */
export default function SortableHeader({
  basePath,
  query,
  field,
  current,
  label,
  align = 'left',
}: {
  basePath: string
  query: Record<string, string | undefined>
  field: string
  current: { by?: string; dir?: 'asc' | 'desc' }
  label: string
  align?: 'left' | 'right' | 'center'
}) {
  const isActive = current.by === field
  const nextDir: 'asc' | 'desc' | undefined = !isActive
    ? 'asc'
    : current.dir === 'asc'
      ? 'desc'
      : undefined  // cycle off

  // Build the next URL with sortBy + sortDir; if cycling off, drop both
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v != null && v !== '' && k !== 'sortBy' && k !== 'sortDir' && k !== 'page') {
      params.set(k, String(v))
    }
  }
  if (nextDir) {
    params.set('sortBy', field)
    params.set('sortDir', nextDir)
  }
  const qs = params.toString()
  const href = qs ? `${basePath}?${qs}` : basePath

  const arrow = !isActive
    ? <ArrowUnsorted />
    : current.dir === 'asc'
      ? <ArrowUp />
      : <ArrowDown />

  const alignClass = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'

  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${alignClass} ${
        isActive ? 'text-[var(--color-text-strong)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
      }`}
      aria-sort={isActive ? (current.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <span>{label}</span>
      <span className="opacity-70">{arrow}</span>
    </Link>
  )
}

function ArrowUnsorted() {
  return (
    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 9l4-4 4 4M8 15l4 4 4-4" opacity="0.5" />
    </svg>
  )
}
function ArrowUp() {
  return (
    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 14l4-4 4 4" />
    </svg>
  )
}
function ArrowDown() {
  return (
    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 10l4 4 4-4" />
    </svg>
  )
}
