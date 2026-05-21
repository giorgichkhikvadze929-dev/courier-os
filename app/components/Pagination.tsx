import Link from 'next/link'
import PageSizeSelector from './PageSizeSelector'

type Labels = {
  prev: string
  next: string
  page: string  // "Page"
  of: string    // "of"
  perPage: string  // "per page"
  showing: string  // "Showing"
}

/**
 * Server-rendered pagination + page-size selector.
 * Uses URL searchParams (`page`, `pageSize`) so state survives reload + is shareable.
 *
 * @param basePath  current path (e.g. '/admin/deliveries')
 * @param query     current searchParams as a plain object — passed through so filters stay applied
 * @param page      current 1-based page number
 * @param pageSize  current per-page count
 * @param total     total result count after filters (NOT after pagination)
 */
export default function Pagination({
  basePath,
  query,
  page,
  pageSize,
  total,
  labels,
}: {
  basePath: string
  query: Record<string, string | undefined>
  page: number
  pageSize: number
  total: number
  labels: Labels
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1
  const to = Math.min(total, safePage * pageSize)

  const buildHref = (overrides: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams()
    // Preserve all current params except `page` (we always set that explicitly).
    for (const [k, v] of Object.entries(query)) {
      if (v != null && v !== '' && k !== 'page') params.set(k, String(v))
    }
    // Always carry the current pageSize so it doesn't reset to the default on navigation.
    if (!params.has('pageSize')) params.set('pageSize', String(pageSize))
    for (const [k, v] of Object.entries(overrides)) {
      if (v != null && v !== '') params.set(k, String(v))
    }
    const qs = params.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }

  // Build a compact list of page numbers: first, prev, current, next, last (with ellipses)
  const pageNumbers: (number | 'ellipsis')[] = []
  const push = (n: number) => { if (!pageNumbers.includes(n) && n >= 1 && n <= totalPages) pageNumbers.push(n) }
  push(1)
  if (safePage - 2 > 2) pageNumbers.push('ellipsis')
  for (let i = safePage - 1; i <= safePage + 1; i++) push(i)
  if (safePage + 2 < totalPages - 1) pageNumbers.push('ellipsis')
  push(totalPages)

  if (total === 0) {
    return null
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 px-1">
      {/* Showing X-Y of Z */}
      <p className="text-xs text-[var(--color-text-muted)] order-2 sm:order-1">
        {labels.showing} <span className="font-semibold text-[var(--color-text)]">{from.toLocaleString()}–{to.toLocaleString()}</span> {labels.of} <span className="font-semibold text-[var(--color-text)]">{total.toLocaleString()}</span>
      </p>

      {/* Page numbers + page size */}
      <div className="flex items-center gap-2 flex-wrap order-1 sm:order-2">
        <PageSizeSelector pageSize={pageSize} perPageLabel={labels.perPage} pageLabel={labels.page} />

        <div className="flex items-center gap-1">
          {/* Prev */}
          <NavButton href={buildHref({ page: safePage - 1 })} disabled={safePage <= 1} ariaLabel={labels.prev}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </NavButton>

          {/* Numbered pages */}
          <div className="hidden sm:flex items-center gap-0.5">
            {pageNumbers.map((p, i) => p === 'ellipsis' ? (
              <span key={`e-${i}`} className="px-1 text-[var(--color-text-faint)]">…</span>
            ) : (
              <PageBtn key={p} href={buildHref({ page: p })} active={p === safePage}>{p}</PageBtn>
            ))}
          </div>

          {/* Mobile: just current of total */}
          <span className="sm:hidden text-xs text-[var(--color-text-muted)] px-2">
            {labels.page} <span className="font-semibold text-[var(--color-text)]">{safePage}</span> {labels.of} <span className="font-semibold text-[var(--color-text)]">{totalPages}</span>
          </span>

          {/* Next */}
          <NavButton href={buildHref({ page: safePage + 1 })} disabled={safePage >= totalPages} ariaLabel={labels.next}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
          </NavButton>
        </div>
      </div>
    </div>
  )
}

function NavButton({ href, disabled, ariaLabel, children }: { href: string; disabled: boolean; ariaLabel: string; children: React.ReactNode }) {
  if (disabled) {
    return (
      <span aria-disabled className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--color-border)] text-[var(--color-text-faint)] opacity-40 cursor-not-allowed" aria-label={ariaLabel}>
        {children}
      </span>
    )
  }
  return (
    <Link href={href} aria-label={ariaLabel} className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-card-hover)] hover:border-[var(--color-border-strong)] transition-colors">
      {children}
    </Link>
  )
}

function PageBtn({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`inline-flex items-center justify-center min-w-[2rem] h-8 px-2 rounded-lg text-xs font-semibold transition-colors ${
        active
          ? 'bg-[var(--color-primary)] text-white'
          : 'text-[var(--color-text)] hover:bg-[var(--color-card-hover)]'
      }`}
    >
      {children}
    </Link>
  )
}
