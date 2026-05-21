'use client'

import { useEffect, useState } from 'react'

type Lang = 'ge' | 'en'

export default function LangPicker() {
  const [lang, setLang] = useState<Lang | null>(null)

  useEffect(() => {
    const m = document.cookie.match(/(?:^|;\s*)lang=(ge|en)/)
    setLang((m?.[1] as Lang) ?? 'ge')
  }, [])

  function set(next: Lang) {
    document.cookie = `lang=${next}; path=/; max-age=${60 * 60 * 24 * 365}`
    setLang(next)
    window.location.reload()
  }

  if (!lang) {
    return <div className="w-12 h-8" />
  }

  return (
    <div className="flex items-center bg-[var(--color-card-hover)] rounded-lg overflow-hidden text-xs font-semibold border border-[var(--color-border)]">
      <button
        type="button"
        onClick={() => set('ge')}
        aria-pressed={lang === 'ge'}
        className={`px-2 py-1 transition-colors ${lang === 'ge' ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)]'}`}
      >
        GE
      </button>
      <button
        type="button"
        onClick={() => set('en')}
        aria-pressed={lang === 'en'}
        className={`px-2 py-1 transition-colors ${lang === 'en' ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)]'}`}
      >
        EN
      </button>
    </div>
  )
}
