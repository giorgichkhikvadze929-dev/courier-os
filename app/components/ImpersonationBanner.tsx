import { stopImpersonation } from '@/app/admin/users/impersonate'
import { t as translate, type Lang, type DictKey } from '@/lib/i18n'

/**
 * Sticky purple banner shown across every page when an admin is "previewing
 * as" another user. The Return button is the only exit path back to the admin
 * identity — designed so the admin can never forget they're in preview mode.
 */
export default function ImpersonationBanner({
  asUserName,
  asUserRole,
  realAdminName,
  lang = 'ge',
}: {
  asUserName: string
  asUserRole: string
  realAdminName: string | null
  lang?: Lang
}) {
  const t = (k: DictKey) => translate(k, lang)
  const ROLE_ICON: Record<string, string> = {
    ADMIN: '👤',
    COMPANY: '🏢',
    COURIER: '🚚',
  }
  const icon = ROLE_ICON[asUserRole] ?? '·'

  return (
    <div className="sticky top-0 z-40 bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-lg">
      <div className="px-4 py-2 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="text-lg flex-shrink-0">🎭</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight">
              {t('impersonate_banner')} <span className="font-bold">{icon} {asUserName}</span>
            </p>
            {realAdminName && (
              <p className="text-[11px] text-white/80 leading-tight truncate">
                {realAdminName} → {asUserName}
              </p>
            )}
          </div>
        </div>
        <form action={stopImpersonation}>
          <button
            type="submit"
            className="bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-lg border border-white/30 transition-colors whitespace-nowrap"
          >
            {t('impersonate_return')}
          </button>
        </form>
      </div>
    </div>
  )
}
