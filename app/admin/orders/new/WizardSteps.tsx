import Link from 'next/link'
import { t as translate, type Lang, type DictKey } from '@/lib/i18n'

export type StepKey = 'select' | 'details' | 'courier' | 'review'

/**
 * 4-step wizard ribbon used across the Create-Order flow:
 *   1. Select parcels   (/admin/orders/new)
 *   2. Order details    (/admin/orders/new/details?ids=…)
 *   3. Assign courier   (/admin/orders/new/courier?ids=…)
 *   4. Review & save    (/admin/orders/new/review?ids=…&courier=…)
 *
 * Each step renders as a numbered circle + label. The current step is
 * filled blue; completed steps are also blue; pending steps are grey.
 * All four are links so the user can jump back any time. `ids` and
 * `courier` flow through the URL so state survives navigation.
 */
export default function WizardSteps({
  current,
  ids,
  courier,
  lang = 'ge',
}: {
  current: StepKey
  ids?: string[]                  // selected parcel ids, carried in the URL
  courier?: string | null
  lang?: Lang
}) {
  const t = (k: DictKey) => translate(k, lang)

  const order: StepKey[] = ['select', 'details', 'courier', 'review']
  const idx = order.indexOf(current)

  const qs = new URLSearchParams()
  if (ids && ids.length > 0) qs.set('ids', ids.join(','))
  if (courier) qs.set('courier', courier)
  const tail = qs.toString() ? `?${qs.toString()}` : ''

  const steps: { key: StepKey; n: number; label: string; sub: string; href: string }[] = [
    { key: 'select',  n: 1, label: t('step_select'),  sub: t('step_select_sub'),  href: `/admin/orders/new${tail}` },
    { key: 'details', n: 2, label: t('step_details'), sub: t('step_details_sub'), href: `/admin/orders/new/details${tail}` },
    { key: 'courier', n: 3, label: t('step_assign'),  sub: t('step_assign_sub'),  href: `/admin/orders/new/courier${tail}` },
    { key: 'review',  n: 4, label: t('step_done'),    sub: t('step_done_sub'),    href: `/admin/orders/new/review${tail}` },
  ]

  return (
    <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-5 sm:p-6 mb-6 hidden md:block">
      <div className="flex items-center gap-3">
        {steps.map((s, i, arr) => {
          const stepIdx = order.indexOf(s.key)
          const state =
            stepIdx <  idx ? 'done' :
            stepIdx === idx ? 'current' :
            'pending'

          // Pending steps require data the user hasn't entered yet
          // (e.g. picking a courier). Rendering them as Links would
          // just trigger a redirect back to the current step — that
          // reads as "nothing happens" to the user. So we render
          // pending steps as inert text, and only DONE steps as
          // Links (so the user can step backwards). The current
          // step is also inert — there's no point linking to it.
          const interactive = state === 'done'
          const Inner = (
            <>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition-colors ${
                state === 'current' ? 'bg-[var(--color-primary)] text-white shadow shadow-blue-900/30' :
                state === 'done'    ? 'bg-[var(--color-primary)]/80 text-white group-hover:bg-[var(--color-primary)]' :
                                      'bg-[var(--color-card-hover)] text-[var(--color-text-faint)]'
              }`}>
                {state === 'done' ? '✓' : s.n}
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-semibold truncate ${
                  state === 'pending' ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text-strong)]'
                }`}>{s.label}</p>
                <p className="text-xs text-[var(--color-text-muted)] truncate">{s.sub}</p>
              </div>
            </>
          )

          return (
            <div key={s.key} className="flex items-center gap-3 flex-1 min-w-0">
              {interactive ? (
                <Link
                  href={s.href}
                  className="flex items-center gap-3 min-w-0 group"
                  title={s.label}
                >
                  {Inner}
                </Link>
              ) : (
                <div
                  className={`flex items-center gap-3 min-w-0 ${state === 'pending' ? 'opacity-60 cursor-not-allowed' : ''}`}
                  aria-current={state === 'current' ? 'step' : undefined}
                  title={state === 'pending' ? t('wizard_step_locked') : s.label}
                >
                  {Inner}
                </div>
              )}
              {i < arr.length - 1 && (
                <div className={`flex-1 h-px min-w-[1rem] ${
                  stepIdx < idx ? 'bg-[var(--color-primary)]/40' : 'bg-[var(--color-border)]'
                }`} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
