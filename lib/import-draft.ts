'use client'

import { useEffect, useRef } from 'react'

/**
 * Persist an in-progress import preview to localStorage so a refresh / accidental
 * navigation doesn't lose work.
 *
 * The draft object is generic — pass whatever shape your importer needs (file
 * name, parsed rows, column mapping, per-row overrides, target company, etc.).
 *
 * Why localStorage and not server-side: the parsed rows can be megabytes for
 * large files, but typical admin/company uploads are a few thousand rows so it
 * fits comfortably. We catch QuotaExceededError and silently skip persistence
 * for over-sized files (the in-memory state still works, it just won't survive
 * a refresh).
 */

export type ImportDraft<T> = T & { savedAt: number }

export function loadImportDraft<T>(key: string): ImportDraft<T> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as ImportDraft<T>
  } catch {
    return null
  }
}

export function saveImportDraft<T extends object>(key: string, draft: T): boolean {
  if (typeof window === 'undefined') return false
  try {
    const payload = { ...draft, savedAt: Date.now() }
    window.localStorage.setItem(key, JSON.stringify(payload))
    return true
  } catch {
    // Most likely QuotaExceededError on large files. Don't break the UI.
    return false
  }
}

export function clearImportDraft(key: string): void {
  if (typeof window === 'undefined') return
  try { window.localStorage.removeItem(key) } catch {}
}

/**
 * Auto-save the given draft to localStorage whenever it changes. Debounced so
 * we don't thrash on every keystroke during inline-editing.
 *
 * `enabled` lets the caller skip saving while the user is e.g. mid-submit, so
 * a partial state right before clearing isn't reintroduced after the clear.
 */
export function useAutoSaveDraft<T extends object>(
  key: string,
  draft: T,
  options: { debounceMs?: number; enabled?: boolean } = {},
) {
  const { debounceMs = 600, enabled = true } = options
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Stringify so we can detect deep changes; cheap enough for our row counts.
  const serialized = JSON.stringify(draft)
  useEffect(() => {
    if (!enabled) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      saveImportDraft(key, draft)
    }, debounceMs)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, serialized, debounceMs, enabled])
}
