'use client'

import { useState, useTransition } from 'react'
import { requestUploadAccess } from './actions'

type Labels = {
  title: string
  description: string
  button: string
  pendingTitle: string
  pendingDescription: string
}

export default function RequestAccess({
  pending,
  labels,
}: {
  pending: boolean
  labels: Labels
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState<boolean>(pending)

  function onClick() {
    setError(null)
    startTransition(async () => {
      const r = await requestUploadAccess()
      if (r.ok) setSubmitted(true)
      else setError(r.reason)
    })
  }

  if (submitted) {
    return (
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-6 flex items-start gap-3">
        <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
        <div>
          <p className="text-base font-semibold text-yellow-700 dark:text-yellow-300">{labels.pendingTitle}</p>
          <p className="text-sm text-yellow-700/80 dark:text-yellow-300/80 mt-1">{labels.pendingDescription}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] p-6">
      <div className="flex items-start gap-3 mb-4">
        <svg className="w-6 h-6 text-[var(--color-text-muted)] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <div>
          <p className="text-base font-semibold text-[var(--color-text-strong)]">{labels.title}</p>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">{labels.description}</p>
        </div>
      </div>
      <button
        onClick={onClick}
        disabled={isPending}
        className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition-colors"
      >
        {isPending ? '…' : labels.button}
      </button>
      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  )
}
