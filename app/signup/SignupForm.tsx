'use client'

import { useState } from 'react'
import { signupWithEmail } from './actions'

type Strings = {
  nameLabel: string
  namePlaceholder: string
  emailLabel: string
  emailPlaceholder: string
  passwordLabel: string
  passwordPlaceholder: string
  submit: string
  submitting: string
  successTitle: string
  successBody: string
  backToLogin: string
}

export default function SignupForm({ s }: { s: Strings }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const fd = new FormData(e.currentTarget)
      const r = await signupWithEmail(fd)
      if (r.ok) {
        setDone(true)
      } else {
        setError(r.reason)
      }
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-green-500/15 rounded-full mb-3">
          <svg className="w-6 h-6 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-white">{s.successTitle}</p>
        <p className="text-xs text-gray-400 mt-1">{s.successBody}</p>
        <a href="/login" className="inline-block mt-4 text-sm text-blue-400 hover:text-blue-300 font-semibold">
          {s.backToLogin} →
        </a>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="block text-xs text-gray-400 mb-1">{s.nameLabel}</label>
        <input
          name="name"
          type="text"
          required
          placeholder={s.namePlaceholder}
          autoComplete="name"
          className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">{s.emailLabel}</label>
        <input
          name="email"
          type="email"
          required
          placeholder={s.emailPlaceholder}
          autoComplete="email"
          className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">{s.passwordLabel}</label>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          placeholder={s.passwordPlaceholder}
          autoComplete="new-password"
          className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors"
      >
        {busy ? s.submitting : s.submit}
      </button>
    </form>
  )
}
