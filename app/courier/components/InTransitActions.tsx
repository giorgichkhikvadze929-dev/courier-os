'use client'

import { useState, useTransition } from 'react'
import { updateDeliveryStatus } from '../actions'

type Labels = {
  delivered: string
  failed: string
  refused: string
  addComment: string
  commentPlaceholder: string
}

/**
 * Courier action row for an IN_TRANSIT parcel.
 *
 * One tap on Delivered / Failed / Refused immediately updates status (no
 * confirmation page). Beside the buttons a small "+ comment" link reveals an
 * inline textarea — whatever the courier types is saved as `courierComment`
 * when they submit the chosen action.
 *
 * Both flows reach the same `updateDeliveryStatus` server action — the comment
 * field is optional, so leaving the textarea empty is identical to the
 * one-tap path.
 */
export default function InTransitActions({
  deliveryId,
  labels,
}: {
  deliveryId: string
  labels: Labels
}) {
  const [showComment, setShowComment] = useState(false)
  const [comment, setComment] = useState('')
  const [pending, startTransition] = useTransition()

  async function submit(status: 'DELIVERED' | 'FAILED' | 'REFUSED') {
    const fd = new FormData()
    fd.set('status', status)
    if (comment.trim()) fd.set('courierComment', comment.trim())
    startTransition(async () => {
      await updateDeliveryStatus(deliveryId, fd)
    })
  }

  return (
    <div className="border-t border-[var(--color-border)]">
      {showComment && (
        <div className="p-3 border-b border-[var(--color-border)] bg-[var(--color-card-hover)]/40">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={labels.commentPlaceholder}
            rows={2}
            className="w-full text-sm bg-[var(--color-card)] border border-[var(--color-border-strong)] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
          />
        </div>
      )}

      {/* Primary positive action — filled green, full width above the
          secondary problem actions. Delivering is the goal of every parcel;
          give it the visual weight it deserves. */}
      <button
        type="button"
        disabled={pending}
        onClick={() => submit('DELIVERED')}
        className="w-full inline-flex items-center justify-center gap-2 bg-[var(--color-success)] hover:bg-green-500 disabled:opacity-60 text-white font-semibold text-sm py-3 transition-colors"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 6L9 17l-5-5" />
        </svg>
        {labels.delivered}
      </button>

      {/* Problem outcomes — outlined, secondary weight. They share a row but
          read as exceptions rather than equals to Delivered. */}
      <div className="grid grid-cols-2 divide-x divide-[var(--color-border)] border-t border-[var(--color-border)]">
        <button
          type="button"
          disabled={pending}
          onClick={() => submit('FAILED')}
          className="w-full inline-flex items-center justify-center gap-1.5 bg-transparent text-[var(--color-danger)] hover:bg-red-500/10 disabled:opacity-60 font-semibold text-xs py-2.5 transition-colors"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" />
          </svg>
          {labels.failed}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => submit('REFUSED')}
          className="w-full inline-flex items-center justify-center gap-1.5 bg-transparent text-[var(--color-warning)] hover:bg-orange-500/10 disabled:opacity-60 font-semibold text-xs py-2.5 transition-colors"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M4.93 4.93l14.14 14.14" />
          </svg>
          {labels.refused}
        </button>
      </div>

      {!showComment && (
        <button
          type="button"
          onClick={() => setShowComment(true)}
          className="w-full text-center text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-primary)] py-2 transition-colors"
        >
          {labels.addComment}
        </button>
      )}
    </div>
  )
}
