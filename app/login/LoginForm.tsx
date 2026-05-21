'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

type Strings = {
  emailLabel: string
  passwordLabel: string
  emailPlaceholder: string
  passwordPlaceholder: string
  signing: string
  signin: string
  invalid: string
}

export default function LoginForm({ s }: { s: Strings }) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const form = new FormData(e.currentTarget)
    // Trim whitespace — paste-from-spreadsheet, autofill, and stray spaces are common.
    // Password is trimmed too because the seeded credentials don't have leading/trailing
    // spaces; if the user has a password whose spaces are significant they'd need to
    // type carefully but for this app that's the right trade.
    const emailRaw    = (form.get('email')    ?? '').toString()
    const passwordRaw = (form.get('password') ?? '').toString()
    const result = await signIn('credentials', {
      email:    emailRaw.trim(),
      password: passwordRaw.trim(),
      redirect: false,
    })
    setLoading(false)
    if (result?.error) {
      setError(s.invalid)
    } else {
      router.push('/')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1.5">
          {s.emailLabel}
        </label>
        <input
          id="email"
          name="email"
          type="text"
          required
          autoComplete="username"
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder={s.emailPlaceholder}
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1.5">
          {s.passwordLabel}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder={s.passwordPlaceholder}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-950 border border-red-800 rounded-xl px-4 py-3">
          <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors mt-1"
      >
        {loading ? s.signing : s.signin}
      </button>
    </form>
  )
}
