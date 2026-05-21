'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Soft real-time: refetches the current server-rendered page every `intervalMs`
 * using router.refresh() so company users see status changes from couriers
 * without manually reloading. PRD §4.2 — "real time" status visibility.
 *
 * Pauses while the tab is hidden so we don't burn cycles in background.
 */
export default function AutoRefresh({ intervalMs = 30_000 }: { intervalMs?: number }) {
  const router = useRouter()
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    function start() {
      stop()
      timerRef.current = window.setInterval(() => router.refresh(), intervalMs)
    }
    function stop() {
      if (timerRef.current != null) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
    function onVisibility() {
      if (document.hidden) stop()
      else { router.refresh(); start() }
    }
    start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [intervalMs, router])

  return null
}
