'use client'

import { useState, useRef, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { parseRows, type ParseResult, type ImportRow } from '@/lib/import'
import { uploadBatch, type CompanyUploadOutcome } from './actions'
import { t as translate, type Lang, type DictKey } from '@/lib/i18n'
import { loadImportDraft, clearImportDraft, useAutoSaveDraft } from '@/lib/import-draft'
import ImportRequirements from '@/app/components/ImportRequirements'

const DRAFT_KEY = 'import-draft:company'
// Chunk rows when sending to the server action so each call stays well under
// the React 19 server-action arg-size guards and the body-size limit.
const CHUNK_SIZE = 1_000

type CompanyImportDraft = {
  fileName: string | null
  rawRows: Record<string, unknown>[]
}

export default function CompanyImportClient({ lang = 'ge' }: { lang?: Lang } = {}) {
  const t = (k: DictKey) => translate(k, lang)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const dragCounterRef = useRef(0)

  // Block browser default (open file in new tab) if user misses the dropzone.
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

  const [fileName, setFileName] = useState<string | null>(null)
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([])
  const [result, setResult] = useState<ParseResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<CompanyUploadOutcome | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [restoredAt, setRestoredAt] = useState<number | null>(null)

  // Restore any in-progress draft from a previous session so refresh / accidental
  // navigation doesn't lose user work. Runs once on mount.
  useEffect(() => {
    const draft = loadImportDraft<CompanyImportDraft>(DRAFT_KEY)
    if (!draft) return
    if ((draft.rawRows?.length ?? 0) === 0 && !draft.fileName) return
    setFileName(draft.fileName ?? null)
    setRawRows(draft.rawRows ?? [])
    if ((draft.rawRows?.length ?? 0) > 0) {
      try { setResult(parseRows(draft.rawRows)) } catch {}
    }
    setRestoredAt(draft.savedAt)
  }, [])

  // Auto-save the in-progress preview to localStorage as the user edits.
  useAutoSaveDraft<CompanyImportDraft>(DRAFT_KEY, { fileName, rawRows })

  async function ingestFile(f: File) {
    const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      setParseError(t('import_unsupported_type'))
      return
    }
    setFileName(f.name)
    setOutcome(null)
    setParseError(null)
    try {
      const buf = await f.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
      setRawRows(json)
      setResult(parseRows(json))
    } catch (err) {
      setParseError(err instanceof Error ? err.message : t('import_read_error'))
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) await ingestFile(f)
  }

  function handleDragEnter(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault(); e.stopPropagation()
    dragCounterRef.current += 1
    if (dragCounterRef.current === 1) setDragOver(true)
  }
  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault(); e.stopPropagation()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  }
  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault(); e.stopPropagation()
    dragCounterRef.current -= 1
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0
      setDragOver(false)
    }
  }
  async function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault(); e.stopPropagation()
    dragCounterRef.current = 0
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) await ingestFile(f)
  }
  function openFileDialog() {
    fileInputRef.current?.click()
  }

  // Progress state for chunked uploads: which row are we on / total rows.
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)

  // Refuse to send if the parsed preview has ANY errors. The server also
  // enforces this, but the client check spares a round trip and makes the
  // failure feel like part of the same submit click.
  const hasBlockingErrors = !!result && result.errorRows > 0

  async function send() {
    if (!result) return
    if (hasBlockingErrors) {
      setSendError(
        `Cannot upload — ${result.errorRows} row${result.errorRows === 1 ? '' : 's'} missing required fields. Fix them in the preview below or correct your spreadsheet and re-upload.`,
      )
      return
    }
    setSendError(null)
    setBusy(true)
    setOutcome(null)
    setProgress({ done: 0, total: rawRows.length })

    // Aggregate results across chunks so the UI shows a single summary banner.
    const aggregate: CompanyUploadOutcome = {
      batchId: '',
      totalRows: 0,
      validRows: 0,
      errorRows: 0,
      duplicateRows: 0,
      createdDeliveries: 0,
      duplicatesInDb: 0,
    }

    try {
      for (let i = 0; i < rawRows.length; i += CHUNK_SIZE) {
        const chunk = rawRows.slice(i, i + CHUNK_SIZE)
        try {
          const o = await uploadBatch(JSON.stringify(chunk), fileName)
          aggregate.batchId           = o.batchId  // last batch id; sufficient as a reference handle
          aggregate.totalRows        += o.totalRows
          aggregate.validRows        += o.validRows
          aggregate.errorRows        += o.errorRows
          aggregate.duplicateRows    += o.duplicateRows
          aggregate.createdDeliveries += o.createdDeliveries
          aggregate.duplicatesInDb   += o.duplicatesInDb
        } catch (err) {
          // Surface the chunk failure but continue with the rest so the user
          // doesn't lose all progress over one bad batch.
          aggregate.errorRows += chunk.length
          console.error(`[company import] chunk ${i / CHUNK_SIZE + 1} failed:`, err)
        }
        setProgress({ done: Math.min(i + chunk.length, rawRows.length), total: rawRows.length })
      }

      setOutcome(aggregate)
      // Submitted successfully — wipe the saved draft so a fresh page load
      // doesn't restore an already-sent batch.
      clearImportDraft(DRAFT_KEY)
      setRestoredAt(null)
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  function discardDraft() {
    clearImportDraft(DRAFT_KEY)
    setFileName(null)
    setRawRows([])
    setResult(null)
    setOutcome(null)
    setRestoredAt(null)
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
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
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

      {/* Requirements + sample downloads. Quiet mode before/after a clean upload,
          escalated red mode when the current preview has validation errors. */}
      <ImportRequirements
        lang={lang}
        mode={hasBlockingErrors ? 'error' : 'info'}
        errorCount={result?.errorRows ?? 0}
      />

      {result && result.totalRows > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Total"      value={result.totalRows}      color="text-[var(--color-text-strong)]" />
            <Stat label="Valid"      value={result.validRows}      color="text-green-600 dark:text-green-400" />
            <Stat label="Errors"     value={result.errorRows}      color="text-red-600 dark:text-red-400" />
            <Stat label="Duplicates" value={result.duplicateRows}  color="text-yellow-600 dark:text-yellow-400" />
          </div>

          <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] overflow-hidden">
            <div className="px-6 py-3 border-b border-[var(--color-border)]">
              <p className="text-sm font-semibold text-[var(--color-text)]">Preview (first 50 rows)</p>
            </div>
            <div className="overflow-x-auto max-h-[400px]">
              <table className="w-full text-xs">
                <thead className="bg-[var(--color-card-hover)] sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold text-[var(--color-text-muted)]">#</th>
                    <th className="text-left px-3 py-2 font-semibold text-[var(--color-text-muted)]">Customer</th>
                    <th className="text-left px-3 py-2 font-semibold text-[var(--color-text-muted)]">Phone</th>
                    <th className="text-left px-3 py-2 font-semibold text-[var(--color-text-muted)]">Dropoff</th>
                    <th className="text-left px-3 py-2 font-semibold text-[var(--color-text-muted)]">Zone</th>
                    <th className="text-left px-3 py-2 font-semibold text-[var(--color-text-muted)]">City</th>
                    <th className="text-left px-3 py-2 font-semibold text-[var(--color-text-muted)]">Postal</th>
                    <th className="text-left px-3 py-2 font-semibold text-[var(--color-text-muted)]">Pkg</th>
                    <th className="text-left px-3 py-2 font-semibold text-[var(--color-text-muted)]">Weight kg</th>
                    <th className="text-left px-3 py-2 font-semibold text-[var(--color-text-muted)]">Size cm</th>
                    <th className="text-left px-3 py-2 font-semibold text-red-600 dark:text-red-400">Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.slice(0, 50).map((r: ImportRow) => (
                    <tr key={r.rowNumber} className={`border-b border-[var(--color-border)] ${r.errors.length > 0 ? 'bg-red-500/10' : ''}`}>
                      <td className="px-3 py-1.5 text-[var(--color-text-faint)]">{r.rowNumber}</td>
                      <td className="px-3 py-1.5 text-[var(--color-text-strong)]">{r.data.customerName ?? <em className="text-red-600 dark:text-red-400">missing</em>}</td>
                      <td className="px-3 py-1.5 font-mono text-[var(--color-text)]">{r.data.customerPhone ?? <em className="text-red-600 dark:text-red-400">missing</em>}</td>
                      <td className="px-3 py-1.5 text-[var(--color-text)] truncate max-w-[180px]">{r.data.dropoffAddress ?? <em className="text-red-600 dark:text-red-400">missing</em>}</td>
                      <td className="px-3 py-1.5 text-[var(--color-text-muted)]">{r.data.zone ?? <em className="text-red-600 dark:text-red-400">missing</em>}</td>
                      <td className="px-3 py-1.5 text-[var(--color-text-muted)]">{r.data.city ?? <em className="text-red-600 dark:text-red-400">missing</em>}</td>
                      <td className="px-3 py-1.5 text-[var(--color-text-muted)] font-mono">{r.data.postalCode ?? <em className="text-red-600 dark:text-red-400">missing</em>}</td>
                      <td className="px-3 py-1.5 text-[var(--color-text-muted)]">{r.data.packageType ?? <em className="text-red-600 dark:text-red-400">missing</em>}</td>
                      <td className="px-3 py-1.5 text-[var(--color-text-muted)]">{r.data.weightKg != null ? r.data.weightKg : <em className="text-red-600 dark:text-red-400">missing</em>}</td>
                      <td className="px-3 py-1.5 text-[var(--color-text-muted)]">{r.data.sizeCm ?? <em className="text-red-600 dark:text-red-400">missing</em>}</td>
                      <td className="px-3 py-1.5 text-red-600 dark:text-red-400">{r.errors.join(', ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-6">
            <p className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wide mb-3">Step 2 — Send to admin</p>
            <p className="text-sm text-[var(--color-text)] mb-3">
              Your batch will be reviewed by an admin before parcels are entered into the system.
            </p>
            <button
              onClick={send}
              disabled={busy || result.totalRows === 0 || hasBlockingErrors}
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl px-6 py-2.5 text-sm transition-colors"
              title={hasBlockingErrors ? 'Fix errors below before uploading' : undefined}
            >
              {busy
                ? (progress
                    ? `Sending… ${progress.done.toLocaleString()} / ${progress.total.toLocaleString()}`
                    : 'Sending…')
                : `Send ${result.totalRows.toLocaleString()} rows`}
            </button>
            {progress && progress.total > 0 && (
              <div className="mt-3 h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--color-primary)] transition-all"
                  style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
                />
              </div>
            )}
            {hasBlockingErrors && (
              <p className="text-xs text-[var(--color-danger)] mt-3">
                ⚠ {result.errorRows} row{result.errorRows === 1 ? '' : 's'} missing required fields — fix them in the preview below before sending.
              </p>
            )}
            {sendError && (
              <p className="text-xs text-[var(--color-danger)] mt-3">{sendError}</p>
            )}
          </div>

          {outcome && (
            <div className="bg-green-500/10 border border-[var(--color-border)] rounded-2xl p-6">
              <p className="text-sm font-semibold text-green-700 dark:text-green-300">
                {outcome.createdDeliveries} parcel{outcome.createdDeliveries === 1 ? '' : 's'} sent for verification
              </p>
              <p className="text-xs text-[var(--color-text)] mt-1">
                Reference: <span className="font-mono">{outcome.batchId.slice(-8)}</span> · {outcome.totalRows} rows uploaded · <span className="font-semibold">{outcome.createdDeliveries}</span> created · <span className="text-[var(--color-text-muted)]">{outcome.duplicatesInDb} duplicates skipped</span> · <span className="text-[var(--color-warning)]">{outcome.errorRows} errors</span>
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-2 italic">
                The admin will verify them shortly. You can keep uploading more.
              </p>
            </div>
          )}
        </>
      )}
    </div>
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
