import { t as translate, type Lang, type DictKey } from '@/lib/i18n'

/**
 * "What goes in an Excel file?" reference panel for import flows.
 *
 * Two modes:
 *   - mode="info"   — quiet guidance shown near the dropzone before upload.
 *   - mode="error"  — prominent red callout shown when the preview has errors.
 *                    Same content, escalated styling, plus a "fix these" hint.
 *
 * Always includes download buttons for the sample Excel files served from /public.
 */
export default function ImportRequirements({
  lang = 'ge',
  mode = 'info',
  errorCount = 0,
}: {
  lang?: Lang
  mode?: 'info' | 'error'
  errorCount?: number
}) {
  const t = (k: DictKey) => translate(k, lang)

  // Required fields — what the DB literally needs to write a row.
  const requiredFields: { code: string; label: string; desc: string; example: string }[] = [
    { code: 'customerPhone',   label: t('req_customerPhone_label'),   desc: t('req_customerPhone_desc'),   example: '+995555010101 · 568777173/598717729' },
    { code: 'dropoffAddress',  label: t('req_dropoffAddress_label'),  desc: t('req_dropoffAddress_desc'),  example: 'თბილისი, რუსთაველის გამზ. 12, ბ. 5' },
  ]

  // Optional fields — the team's official Excel has these, plus customerEmail
  // which isn't in the file but is kept available because it's useful when
  // sending tracking notifications and never blocks an import.
  const autoFields: { code: string; label: string; example: string }[] = [
    { code: 'customerName', label: t('req_customerName_label'), example: 'თამთა ასმათი · Nino Beridze' },
    { code: 'zone',         label: t('req_zone_label'),         example: 'ხელვაჩაური → ADJARA · წალენჯიხა → SAMEGRELO' },
    { code: 'codAmount',    label: t('req_codAmount_label'),    example: '35' },
    { code: 'notes',        label: t('req_notes_label'),        example: 'მტვრევადი · მე-3 სართული' },
    { code: 'customerEmail',label: t('req_customerEmail_label'),example: 'nino@example.ge' },
  ]

  const isError = mode === 'error'

  return (
    <div
      className={`rounded-2xl border p-5 ${
        isError
          ? 'bg-red-500/10 border-red-500/40'
          : 'bg-[var(--color-card)] border-[var(--color-border)]'
      }`}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        {isError ? (
          <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 9v4M12 17h.01M3.42 19a2 2 0 001.74 3h13.68a2 2 0 001.74-3l-6.84-12a2 2 0 00-3.48 0z" />
          </svg>
        ) : (
          <svg className="w-5 h-5 text-[var(--color-primary)] flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
          </svg>
        )}
        <div className="flex-1">
          <p className={`text-sm font-semibold ${isError ? 'text-red-700 dark:text-red-300' : 'text-[var(--color-text-strong)]'}`}>
            {isError
              ? `${errorCount} ${errorCount === 1 ? t('req_error_one') : t('req_error_many')} — ${t('req_title_error')}`
              : t('req_title_info')}
          </p>
          <p className={`text-xs mt-0.5 ${isError ? 'text-red-700/80 dark:text-red-300/80' : 'text-[var(--color-text-muted)]'}`}>
            {t('req_subtitle')}
          </p>
        </div>
      </div>

      {/* Required fields — just the two the DB actually demands. */}
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-faint)] mb-2 mt-3">
        {t('req_section_required')}
      </p>
      <div className="space-y-1.5 mb-4">
        {requiredFields.map((f) => (
          <div key={f.code} className="grid grid-cols-[auto_1fr] gap-3 text-xs">
            <code className="font-mono font-semibold text-[var(--color-text-strong)] bg-[var(--color-card-hover)] px-2 py-0.5 rounded self-start">
              {f.code}<span className="text-red-500 ml-0.5">*</span>
            </code>
            <div>
              <span className="text-[var(--color-text)]">{f.label}</span>
              <span className="text-[var(--color-text-muted)]"> — {f.desc}</span>
              <span className="block text-[var(--color-text-faint)] mt-0.5 italic">
                {t('req_example')}: <span className="font-mono">{f.example}</span>
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Everything else — auto-detected from the file. Collapsed by default
          so the panel doesn't look intimidating. */}
      <details className="text-xs mb-4">
        <summary className="cursor-pointer text-[var(--color-text-muted)] hover:text-[var(--color-text)] py-1">
          {t('req_section_auto')} ({autoFields.length})
        </summary>
        <div className="mt-2 space-y-1.5 pl-2">
          {autoFields.map((f) => (
            <div key={f.code} className="grid grid-cols-[auto_1fr] gap-3">
              <code className="font-mono text-[var(--color-text-muted)] bg-[var(--color-card-hover)]/60 px-2 py-0.5 rounded self-start">
                {f.code}
              </code>
              <div>
                <span className="text-[var(--color-text-muted)]">{f.label}</span>
                <span className="block text-[var(--color-text-faint)] mt-0.5 italic">
                  {t('req_example')}: <span className="font-mono">{f.example}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </details>

      {/* Sample download buttons */}
      <div className="flex flex-wrap gap-2 pt-3 border-t border-[var(--color-border)]">
        <a
          href="/sample-import.xlsx"
          download
          className="inline-flex items-center gap-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-semibold rounded-lg px-3 py-2 transition-colors"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          {t('req_download_sample')} (5 {t('parcel_word_plural')})
        </a>
        <a
          href="/sample-5k.xlsx"
          download
          className="inline-flex items-center gap-2 bg-[var(--color-card-hover)] hover:bg-[var(--color-card)] text-[var(--color-text)] border border-[var(--color-border-strong)] text-xs font-semibold rounded-lg px-3 py-2 transition-colors"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          {t('req_download_bulk')} (5,000 {t('parcel_word_plural')})
        </a>
      </div>
    </div>
  )
}
