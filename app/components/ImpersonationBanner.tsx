import { stopImpersonation } from '@/app/admin/users/impersonate'
import { t as translate, type Lang, type DictKey } from '@/lib/i18n'

/**
 * Sticky amber banner shown across every page when an admin is "previewing as"
 * another user. The Return button is the only exit path back to the admin
 * identity. Uses the same SVG-icon + CSS-variable styling as the rest of the
 * site so the banner reads as part of the product, not a stuck-on decoration.
 */
export default function ImpersonationBanner({
  asUserName,
  realAdminName,
  lang = 'ge',
}: {
  asUserName: string
  asUserRole: string
  realAdminName: string | null
  lang?: Lang
}) {
  const t = (k: DictKey) => translate(k, lang)

  return (
    <div className="sticky top-0 z-40 bg-amber-500/15 backdrop-blur-sm border-b border-amber-500/40">
      <div className="px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <svg
            className="w-4 h-4 flex-shrink-0 text-amber-700 dark:text-amber-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-100 leading-tight">
              {t('impersonate_banner')}{' '}
              <span className="font-bold">{asUserName}</span>
            </p>
            {realAdminName && (
              <p className="text-[11px] text-amber-800/70 dark:text-amber-200/70 leading-tight truncate">
                {realAdminName} → {asUserName}
              </p>
            )}
          </div>
        </div>
        <form action={stopImpersonation}>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 bg-[var(--color-card)] hover:bg-[var(--color-card-hover)] text-[var(--color-text-strong)] text-xs font-semibold px-3 py-1.5 rounded-lg border border-[var(--color-border-strong)] transition-colors whitespace-nowrap"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            {t('impersonate_return')}
          </button>
        </form>
      </div>
    </div>
  )
}
