// Server-only i18n helpers (use cookies). Client code must NOT import this file.
import { cookies } from 'next/headers'
import { t, type DictKey, type Lang } from './i18n'

const DEFAULT: Lang = 'ge'

export async function getLang(): Promise<Lang> {
  try {
    const c = await cookies()
    const v = c.get('lang')?.value
    return v === 'en' ? 'en' : 'ge'
  } catch {
    return DEFAULT
  }
}

/** Server-side helper: returns a translator + the current lang */
export async function getT(): Promise<{ t: (k: DictKey) => string; lang: Lang }> {
  const lang = await getLang()
  return { t: (k) => t(k, lang), lang }
}
