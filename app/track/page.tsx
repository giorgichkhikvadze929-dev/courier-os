import prisma from '@/lib/prisma'
import Link from 'next/link'
import { getT } from '@/lib/i18n-server'
import { tStatus, tZone, type Lang } from '@/lib/i18n'

/**
 * Simple public delivery tracker — anyone with a tracking number can look up
 * the current status + history without logging in. Intentionally exposes only
 * minimal info (status, timestamps, last-4 of phone) so the URL is shareable
 * without leaking customer detail.
 */
export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ n?: string }>
}) {
  const { t, lang } = await getT()
  const sp = await searchParams
  const tn = sp.n?.trim()

  const delivery = tn
    ? await prisma.delivery.findUnique({
        where: { trackingNumber: tn },
        select: {
          trackingNumber: true,
          status:         true,
          zone:           true,
          customerName:   true,
          customerPhone:  true,
          createdAt:      true,
          verifiedAt:     true,
          pickedUpAt:     true,
          deliveredAt:    true,
          failedAt:       true,
          history: {
            orderBy: { createdAt: 'asc' },
            select: { status: true, note: true, createdAt: true },
          },
        },
      })
    : null

  return (
    <main className="min-h-screen flex flex-col bg-[var(--color-app)] py-12">
      <div className="w-full max-w-2xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[var(--color-text-strong)]">{t('track_title')}</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">{t('track_subtitle')}</p>
        </div>

        <form action="/track" method="GET" className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] p-6 mb-6 shadow-sm">
          <label htmlFor="n" className="block text-xs uppercase tracking-wider font-semibold text-[var(--color-text-faint)] mb-2">
            {t('track_input_label')}
          </label>
          <div className="flex gap-2">
            <input
              id="n"
              name="n"
              defaultValue={tn ?? ''}
              placeholder="TRK-XXXXXXX-XXXXXXXX"
              className="flex-1 font-mono text-sm border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              autoComplete="off"
              required
            />
            <button
              type="submit"
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-semibold rounded-xl px-6 text-sm transition-colors"
            >
              {t('track_btn')}
            </button>
          </div>
        </form>

        {tn && !delivery && (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4 text-center">
            <p className="text-sm font-semibold text-orange-700 dark:text-orange-300">
              {t('track_not_found')} <span className="font-mono">{tn}</span>
            </p>
          </div>
        )}

        {delivery && (
          <div className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-4 pb-4 border-b border-[var(--color-border)]">
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-faint)]">
                  {t('track_tracking_label')}
                </p>
                <p className="font-mono text-lg font-bold text-[var(--color-text-strong)]">{delivery.trackingNumber}</p>
              </div>
              <CurrentStatus status={delivery.status} lang={lang} />
            </div>

            {/* Just-enough customer info — masked phone for privacy */}
            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-faint)] mb-0.5">
                  {t('track_recipient')}
                </p>
                <p className="text-[var(--color-text-strong)]">{maskName(delivery.customerName)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-faint)] mb-0.5">
                  {t('track_phone')}
                </p>
                <p className="text-[var(--color-text-strong)] font-mono">{maskPhone(delivery.customerPhone)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-faint)] mb-0.5">
                  {t('label_zone')}
                </p>
                <p className="text-[var(--color-text-strong)]">{tZone(delivery.zone, lang)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-faint)] mb-0.5">
                  {t('track_created')}
                </p>
                <p className="text-[var(--color-text-strong)] font-mono">{formatDate(delivery.createdAt)}</p>
              </div>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-faint)] mb-3">
                {t('track_timeline')}
              </p>
              <ol className="space-y-3">
                {delivery.history.map((h, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-2 h-2 mt-1.5 rounded-full bg-[var(--color-primary)]" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[var(--color-text-strong)]">{tStatus(h.status, lang)}</p>
                      {h.note && <p className="text-xs text-[var(--color-text-muted)]">{h.note}</p>}
                      <p className="text-xs text-[var(--color-text-faint)] font-mono mt-0.5">{formatDate(h.createdAt)}</p>
                    </div>
                  </li>
                ))}
                {delivery.history.length === 0 && (
                  <li className="text-sm text-[var(--color-text-muted)] italic">{t('track_no_history')}</li>
                )}
              </ol>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-[var(--color-text-faint)] mt-8">
          <Link href="/login" className="hover:text-[var(--color-text)] hover:underline">{t('track_signin')}</Link>
        </p>
      </div>
    </main>
  )
}

function CurrentStatus({ status, lang }: { status: string; lang: Lang }) {
  const color =
    status === 'DELIVERED'    ? 'bg-green-500/15 text-green-700 dark:text-green-300'
    : status === 'IN_TRANSIT' ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300'
    : status === 'ASSIGNED'   ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
    : status === 'IN_WAREHOUSE' ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300'
    : status === 'RECEIVED'   ? 'bg-slate-500/15 text-slate-700 dark:text-slate-300'
    : status === 'FAILED'     ? 'bg-red-500/15 text-red-700 dark:text-red-300'
    : status === 'REFUSED' || status === 'RETURNED' ? 'bg-orange-500/15 text-orange-700 dark:text-orange-300'
    : 'bg-[var(--color-card-hover)] text-[var(--color-text-muted)]'
  return (
    <span className={`inline-flex text-xs font-semibold px-3 py-1.5 rounded-full ${color}`}>
      {tStatus(status, lang)}
    </span>
  )
}

// Mask middle of a phone string so the URL/QR is shareable but the full number
// isn't exposed. "+995 555 010 101" → "+995…101"
function maskPhone(p: string): string {
  if (!p) return ''
  const cleaned = p.replace(/\s+/g, '')
  if (cleaned.length <= 5) return cleaned
  return `${cleaned.slice(0, 4)}…${cleaned.slice(-3)}`
}

// Show first word + initial of second. "Nino Beridze" → "Nino B."
function maskName(n: string): string {
  const parts = n.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[1][0]}.`
}

function formatDate(d: Date): string {
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mi = String(d.getUTCMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}
