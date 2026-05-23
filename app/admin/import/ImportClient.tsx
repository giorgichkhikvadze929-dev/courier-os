'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import type { ReactElement } from 'react'
import * as XLSX from 'xlsx'
import { parseRows, type ParseResult, type ImportRow, type CanonicalRow } from '@/lib/import'
import { commitImport, type ImportOutcome } from './actions'
import { t as translate, type Lang, type DictKey } from '@/lib/i18n'
import { loadImportDraft, clearImportDraft, useAutoSaveDraft } from '@/lib/import-draft'

// Send rows in chunks so we never hit the server-action body size limit,
// no matter how large the source file is.
const CHUNK_SIZE = 2_500
const DRAFT_KEY = 'import-draft:admin'

const CANONICAL_FIELDS = [
  '', 'customerName', 'customerPhone', 'customerEmail',
  'dropoffAddress', 'zone', 'city', 'postalCode', 'codAmount', 'notes',
  'packageType', 'priority', 'weightKg', 'sizeCm',
]

type Company = { id: string; name: string }
type Override = Partial<Record<keyof CanonicalRow, string>>

type AdminImportDraft = {
  fileName: string | null
  rawRows: Record<string, unknown>[]
  headers: string[]
  mapping: Record<string, string>
  overrides: Record<number, Override>
  companyId: string
}

export default function ImportClient({ companies, lang = 'ge' }: { companies: Company[]; lang?: Lang }) {
  const t = (k: DictKey) => translate(k, lang)

  const [fileName, setFileName] = useState<string | null>(null)
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [overrides, setOverrides] = useState<Record<number, Override>>({})
  const [companyId, setCompanyId] = useState<string>('')
  const [skipDup, setSkipDup] = useState(true)
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [errorsOnly, setErrorsOnly] = useState(false)
  const [restoredAt, setRestoredAt] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const dragCounterRef = useRef(0)

  // Restore any in-progress draft from a previous session so refresh / accidental
  // navigation doesn't lose user work. Runs once on mount.
  useEffect(() => {
    const draft = loadImportDraft<AdminImportDraft>(DRAFT_KEY)
    if (!draft) return
    if ((draft.rawRows?.length ?? 0) === 0 && !draft.fileName) return
    setFileName(draft.fileName ?? null)
    setRawRows(draft.rawRows ?? [])
    setHeaders(draft.headers ?? [])
    setMapping(draft.mapping ?? {})
    setOverrides(draft.overrides ?? {})
    setCompanyId(draft.companyId ?? '')
    setRestoredAt(draft.savedAt)
  }, [])

  // Auto-save the in-progress draft as the user edits.
  useAutoSaveDraft<AdminImportDraft>(DRAFT_KEY, {
    fileName, rawRows, headers, mapping, overrides, companyId,
  })

  function discardDraft() {
    clearImportDraft(DRAFT_KEY)
    setFileName(null)
    setRawRows([])
    setHeaders([])
    setMapping({})
    setOverrides({})
    setCompanyId('')
    setOutcome(null)
    setRestoredAt(null)
  }

  // Prevent the browser from navigating to a dropped file when the user misses the dropzone.
  useEffect(() => {
    const onDrag = (e: DragEvent) => { e.preventDefault() }
    const onDrop = (e: DragEvent) => { e.preventDefault() }
    window.addEventListener('dragover', onDrag)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onDrag)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  // Apply column-mapping + per-row edits, then re-parse
  const result: ParseResult | null = useMemo(() => {
    if (rawRows.length === 0) return null
    const renamed = rawRows.map((r, idx) => {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(r)) {
        const target = mapping[k]
        out[target || k] = v
      }
      const ov = overrides[idx + 2]
      return ov ? { ...out, ...ov } : out
    })
    const parsed = parseRows(renamed)
    return { ...parsed, headers, mapping }
  }, [rawRows, mapping, overrides, headers])

  async function ingestFile(f: File) {
    const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      setParseError(t('import_unsupported_type'))
      return
    }
    setFileName(f.name)
    setOutcome(null)
    setOverrides({})
    setParseError(null)
    try {
      const buf = await f.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
      setRawRows(json)
      const initialHeaders = Object.keys(json[0] ?? {})
      setHeaders(initialHeaders)
      const parsed = parseRows(json)
      setMapping(parsed.mapping)
    } catch (err) {
      setParseError(err instanceof Error ? err.message : t('import_read_error'))
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) await ingestFile(f)
  }

  // Use a counter so dragLeave fires only when leaving the actual zone (not its children).
  function handleDragEnter(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current += 1
    if (dragCounterRef.current === 1) setDragOver(true)
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current -= 1
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0
      setDragOver(false)
    }
  }

  async function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current = 0
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) await ingestFile(f)
  }

  function openFileDialog() {
    fileInputRef.current?.click()
  }

  function changeMapping(rawHeader: string, canonical: string) {
    setMapping({ ...mapping, [rawHeader]: canonical })
  }

  function setCell(rowNumber: number, field: keyof CanonicalRow, value: string) {
    setOverrides((prev) => ({ ...prev, [rowNumber]: { ...(prev[rowNumber] ?? {}), [field]: value } }))
  }

  async function commit() {
    if (!result) return
    setBusy(true)
    setOutcome(null)
    setProgress(null)

    // Build the canonical rows once.
    const renamed = rawRows.map((r, idx) => {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(r)) {
        const target = mapping[k]
        out[target || k] = v
      }
      const ov = overrides[idx + 2]
      return ov ? { ...out, ...ov } : out
    })

    // Chunk rows so each server-action call stays well under the body-size limit.
    const total = renamed.length
    setProgress({ done: 0, total })
    const aggregate: ImportOutcome = { created: 0, skipped: 0, failed: 0, duplicatesInDb: 0, errors: [] }

    // One file = one Order across all chunks. First successful chunk returns
    // its orderId; later chunks pass it back so the server reuses it instead
    // of creating a new order per chunk.
    let orderId: string | undefined
    try {
      for (let i = 0; i < renamed.length; i += CHUNK_SIZE) {
        const chunk = renamed.slice(i, i + CHUNK_SIZE)
        try {
          const o = await commitImport(JSON.stringify(chunk), {
            skipDuplicates: skipDup,
            companyId: companyId || undefined,
            // Pass the source filename so the resulting Order in /admin/orders
            // shows up labelled with the file name (matches the company side).
            filename: fileName || undefined,
            orderId,
          })
          if (o.orderId) orderId = o.orderId
          aggregate.created        += o.created
          aggregate.skipped        += o.skipped
          aggregate.failed         += o.failed
          aggregate.duplicatesInDb += o.duplicatesInDb
          // Offset rowNumber so error references stay correct relative to the source file.
          aggregate.errors.push(...o.errors.map((e) => ({ ...e, rowNumber: e.rowNumber + i })))
        } catch (err) {
          // The whole chunk failed — typically a server overload / network error.
          aggregate.failed += chunk.length
          aggregate.errors.push({
            rowNumber: i + 2,
            reason: `Chunk ${i / CHUNK_SIZE + 1} failed — ${err instanceof Error ? err.message : 'unknown error'}`,
          })
        }
        setProgress({ done: Math.min(i + chunk.length, total), total })
      }
      setOutcome(aggregate)
      // Submit landed — wipe the saved draft so the next page load starts fresh
      // instead of restoring an already-imported batch.
      if (aggregate.failed === 0) {
        clearImportDraft(DRAFT_KEY)
        setRestoredAt(null)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {restoredAt && (
        <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-2xl px-4 py-3 flex flex-wrap items-center gap-3">
          <svg className="w-5 h-5 text-cyan-700 dark:text-cyan-300 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 1 3 6.7L3 21M3 21v-6h6" />
          </svg>
          <p className="text-sm font-semibold text-cyan-700 dark:text-cyan-300 flex-1">
            {t('import_restored_title')}
            {fileName && <span className="ml-1 text-cyan-600 dark:text-cyan-400 font-normal">— {fileName} ({rawRows.length} {t('parcel_word_plural')})</span>}
          </p>
          <button
            type="button"
            onClick={discardDraft}
            className="text-xs font-semibold text-cyan-700 dark:text-cyan-300 hover:underline"
          >
            {t('import_restored_discard')}
          </button>
        </div>
      )}
      {/* Upload */}
      <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-6">
        <p className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide mb-3">{t('import_step1')}</p>
        <div
          role="button"
          tabIndex={0}
          onClick={openFileDialog}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFileDialog() } }}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`block border-2 border-dashed rounded-2xl px-6 py-12 text-center cursor-pointer transition-colors ${
            dragOver
              ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]/40 scale-[1.01]'
              : 'border-[var(--color-border-strong)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]/30'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFile}
            className="hidden"
          />
          <div className="flex flex-col items-center gap-2 pointer-events-none">
            {fileName ? (
              <>
                <svg className="w-8 h-8 text-[var(--color-primary)]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
                <p className="text-sm font-semibold text-[var(--color-text-strong)] break-all px-4">{fileName}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{t('import_drop_replace')}</p>
              </>
            ) : (
              <>
                <svg className="w-10 h-10 text-[var(--color-text-faint)]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                </svg>
                <p className="text-base font-semibold text-[var(--color-text-strong)]">
                  {dragOver ? t('import_drop_dragging') : t('import_drop_title')}
                </p>
                <p className="text-sm text-[var(--color-text-muted)]">{t('import_drop_or')} <span className="text-[var(--color-primary)] font-semibold">{t('import_drop_browse')}</span></p>
              </>
            )}
          </div>
        </div>
        {parseError && (
          <div className="mt-3 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-600 dark:text-red-300">
            {parseError}
          </div>
        )}
        <p className="text-xs text-[var(--color-text-faint)] mt-3">{t('import_size_hint')}</p>
      </div>

      {result && result.totalRows > 0 && (
        <>
          {/* Summary — just total + duplicates now that we don't gate on
              "valid" rows. Everything else gets imported as-is and the
              admin fixes details later in the delivery editor. */}
          <div className="grid grid-cols-2 gap-3">
            <Stat label={t('import_stat_total')}      value={result.totalRows}      color="text-[var(--color-text-strong)]" />
            <Stat label={t('import_stat_duplicates')} value={result.duplicateRows} color="text-yellow-600 dark:text-yellow-400" />
          </div>

          {/* Editable preview */}
          <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] overflow-hidden">
            <div className="px-6 py-3 border-b border-[var(--color-border)] flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--color-text)]">{t('import_preview_title')}</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{t('import_preview_hint')}</p>
              </div>
              {result.errorRows > 0 && (
                <label className="flex items-center gap-2 text-xs text-[var(--color-text)] bg-[var(--color-card-hover)] px-3 py-1.5 rounded-lg cursor-pointer">
                  <input type="checkbox" checked={errorsOnly} onChange={(e) => setErrorsOnly(e.target.checked)} className="rounded" />
                  {t('import_show_errors_only')} ({result.errorRows})
                </label>
              )}
            </div>
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-xs">
                <thead className="bg-[var(--color-card-hover)] sticky top-0 z-10">
                  <tr>
                    <th className="text-left px-2 py-2 font-semibold text-[var(--color-text-muted)] w-10">{t('import_col_row')}</th>
                    <th className="text-left px-2 py-2 font-semibold text-[var(--color-text-muted)]">{t('import_col_customer')}</th>
                    <th className="text-left px-2 py-2 font-semibold text-[var(--color-text-muted)]">{t('import_col_phone')} *</th>
                    <th className="text-left px-2 py-2 font-semibold text-[var(--color-text-muted)]">{t('import_col_dropoff')} *</th>
                    <th className="text-left px-2 py-2 font-semibold text-[var(--color-text-muted)]">{t('import_col_zone')}</th>
                    <th className="text-left px-2 py-2 font-semibold text-[var(--color-text-muted)]">COD</th>
                    <th className="text-left px-2 py-2 font-semibold text-[var(--color-text-muted)]">{t('dd_notes')}</th>
                    <th className="text-left px-2 py-2 font-semibold text-red-600 dark:text-red-400">{t('import_col_status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(errorsOnly ? result.rows.filter((r) => r.errors.length > 0) : result.rows).slice(0, 100).map((r: ImportRow) => (
                    <tr key={r.rowNumber} className={`border-b border-[var(--color-border)] ${r.errors.length > 0 ? 'bg-red-500/10' : ''}`}>
                      <td className="px-2 py-1 text-[var(--color-text-faint)]">{r.rowNumber}</td>
                      <Cell value={r.data.customerName ?? ''}   onChange={(v) => setCell(r.rowNumber, 'customerName', v)}   missing={!r.data.customerName} />
                      <Cell value={r.data.customerPhone ?? ''}  onChange={(v) => setCell(r.rowNumber, 'customerPhone', v)}  missing={!r.data.customerPhone} mono />
                      <Cell value={r.data.dropoffAddress ?? ''} onChange={(v) => setCell(r.rowNumber, 'dropoffAddress', v)} missing={!r.data.dropoffAddress} wide />
                      <SelectCell value={r.data.zone ?? ''}        onChange={(v) => setCell(r.rowNumber, 'zone', v)}        options={['', 'TBILISI', 'ABKHAZIA', 'ADJARA', 'GURIA', 'IMERETI', 'KAKHETI', 'KVEMO_KARTLI', 'MTSKHETA_MTIANETI', 'RACHA_LECHKHUMI', 'SAMEGRELO', 'SAMTSKHE_JAVAKHETI', 'SHIDA_KARTLI']} missing={!r.data.zone} />
                      <Cell value={r.data.codAmount != null ? String(r.data.codAmount) : ''} onChange={(v) => setCell(r.rowNumber, 'codAmount', v)} small />
                      <Cell value={r.data.notes ?? ''} onChange={(v) => setCell(r.rowNumber, 'notes', v)} wide />
                      <td className="px-2 py-1 text-red-600 dark:text-red-400">{r.errors.join(', ') || <span className="text-green-600 dark:text-green-400">{t('import_status_ok')}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {result.totalRows > 100 && (
              <p className="px-6 py-2 text-xs text-[var(--color-text-faint)] border-t border-[var(--color-border)]">
                {t('import_showing_first').replace('{total}', result.totalRows.toLocaleString())}
              </p>
            )}
          </div>

          <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-6">
            <p className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide mb-4">{t('import_step3_title')}</p>
            <div className="flex flex-col gap-3 mb-4">
              <div>
                <label className="block text-sm text-[var(--color-text)] mb-1">{t('import_sender_company')}</label>
                <select
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="w-full border border-[var(--color-border-strong)] rounded-xl px-3 py-2 text-sm bg-[var(--color-card)] text-[var(--color-text-strong)]"
                >
                  <option value="">{t('import_no_company')}</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
                <input type="checkbox" checked={skipDup} onChange={(e) => setSkipDup(e.target.checked)} className="rounded" />
                {t('import_skip_dupes')}
              </label>
            </div>
            <button
              onClick={commit}
              disabled={busy || result.totalRows === 0}
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl px-6 py-2.5 text-sm transition-colors"
            >
              {busy
                ? (progress ? `${t('import_importing_pct')} ${progress.done.toLocaleString()} / ${progress.total.toLocaleString()}…` : `${t('import_importing_pct')}…`)
                : `${t('import_import_btn')} ${result.totalRows.toLocaleString()} ${t('import_valid_rows_word')}`}
            </button>
            {busy && progress && (
              <div className="mt-3 w-full bg-[var(--color-card-hover)] rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-[var(--color-primary)] transition-all"
                  style={{ width: `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%` }}
                />
              </div>
            )}
          </div>

          {outcome && (
            <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-6">
              <p className="text-sm font-semibold text-green-700 dark:text-green-300 mb-3">{t('import_complete')}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <Stat label={t('import_stat_created')}    value={outcome.created}         color="text-green-600 dark:text-green-400" />
                <Stat label={t('import_stat_skipped')}    value={outcome.skipped}         color="text-[var(--color-text-muted)]" />
                <Stat label={t('import_stat_db_dupes')}   value={outcome.duplicatesInDb}  color="text-yellow-600 dark:text-yellow-400" />
                <Stat label={t('import_stat_failed')}     value={outcome.failed}          color="text-red-600 dark:text-red-400" />
              </div>
              {outcome.errors.length > 0 && (
                <div className="bg-red-500/10 border border-[var(--color-border)] rounded-xl p-3 max-h-40 overflow-y-auto">
                  <p className="text-xs font-semibold text-red-600 dark:text-red-300 mb-2">{t('import_failed_rows')}</p>
                  <ul className="text-xs text-red-600 dark:text-red-300 space-y-1">
                    {outcome.errors.map((e, i) => (
                      <li key={i}>#{e.rowNumber}: {e.reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Cell({
  value, onChange, missing, mono, wide, small,
}: {
  value: string
  onChange: (v: string) => void
  missing?: boolean
  mono?: boolean
  wide?: boolean
  small?: boolean
}) {
  return (
    <td className="px-1 py-1">
      <input
        defaultValue={value}
        onBlur={(e) => onChange(e.target.value)}
        className={`w-full border rounded px-2 py-1 text-xs bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] ${
          missing ? 'border-red-400' : 'border-[var(--color-border)]'
        } ${mono ? 'font-mono' : ''} ${wide ? 'min-w-[180px]' : ''} ${small ? 'max-w-[80px]' : ''}`}
        placeholder={missing ? 'required' : ''}
      />
    </td>
  )
}

function SelectCell({
  value, onChange, options, missing,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  missing?: boolean
}) {
  return (
    <td className="px-1 py-1">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full border rounded px-2 py-1 text-xs bg-[var(--color-card)] text-[var(--color-text-strong)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] ${
          missing ? 'border-red-400 bg-red-500/5' : 'border-[var(--color-border)]'
        }`}
      >
        {options.map((o) => <option key={o || 'none'} value={o}>{o || '—'}</option>)}
      </select>
    </td>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] px-5 py-4">
      <p className="text-xs font-medium text-[var(--color-text-muted)]">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value}</p>
    </div>
  )
}

/**
 * Audit the parsed file and surface concrete fixes the user can apply
 * to clean up the Excel before importing.
 */
function IssueSummary({
  result, mapping, t,
}: {
  result: ParseResult
  mapping: Record<string, string>
  t: (k: DictKey) => string
}) {
  // DB-required columns. The importer auto-resolves zone/city and uses defaults
  // or sender-column fallback for everything else, so only these two truly need
  // to be mapped (or filled per-row by the admin).
  const REQUIRED = ['customerPhone', 'dropoffAddress'] as const
  const mappedCanonicals = new Set(Object.values(mapping).filter(Boolean))
  const missingHeaders = REQUIRED.filter((c) => !mappedCanonicals.has(c))

  // Per-error-type counts.
  const counts: Record<string, number> = {}
  for (const r of result.rows) {
    for (const e of r.errors) counts[e] = (counts[e] ?? 0) + 1
  }

  const issues: { severity: 'error' | 'warn' | 'info'; message: string }[] = []

  if (missingHeaders.length > 0) {
    issues.push({
      severity: 'error',
      message: `Required column${missingHeaders.length === 1 ? '' : 's'} not detected — please map: ${missingHeaders.join(', ')}`,
    })
  }
  for (const [reason, n] of Object.entries(counts)) {
    issues.push({
      severity: reason.startsWith('Missing') ? 'error' : reason.includes('uplicate') ? 'warn' : 'warn',
      message: `${reason} — ${n.toLocaleString()} row${n === 1 ? '' : 's'}`,
    })
  }
  if (result.duplicateRows > 0 && !counts['Duplicate row (same phone + address)']) {
    issues.push({ severity: 'warn', message: `${result.duplicateRows.toLocaleString()} duplicate row${result.duplicateRows === 1 ? '' : 's'} within file` })
  }

  if (issues.length === 0) {
    return (
      <div className="bg-green-500/10 border border-green-500/30 rounded-2xl px-5 py-4 flex items-center gap-3">
        <svg className="w-5 h-5 text-[var(--color-success)] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
        <p className="text-sm font-medium text-green-700 dark:text-green-300">
          {t('import_clean').replace('{n}', result.totalRows.toLocaleString())}
        </p>
      </div>
    )
  }

  const STYLE: Record<'error' | 'warn' | 'info', string> = {
    error: 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300',
    warn:  'bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-300',
    info:  'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300',
  }
  const ICON: Record<'error' | 'warn' | 'info', ReactElement> = {
    error: <svg className="w-4 h-4 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"/></svg>,
    warn:  <svg className="w-4 h-4 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>,
    info:  <svg className="w-4 h-4 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>,
  }

  return (
    <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-[var(--color-text-strong)]">{t('import_what_to_fix')}</p>
        <span className="text-xs text-[var(--color-text-muted)]">{issues.length} {issues.length === 1 ? t('import_issue_singular') : t('import_issue_plural')}</span>
      </div>
      <ul className="flex flex-col gap-2">
        {issues.map((issue, i) => (
          <li key={i} className={`border rounded-lg px-3 py-2 flex items-start gap-2 text-sm ${STYLE[issue.severity]}`}>
            {ICON[issue.severity]}
            <span>{issue.message}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-[var(--color-text-muted)] mt-3">
        {t('import_fix_in_preview')}
      </p>
    </div>
  )
}
