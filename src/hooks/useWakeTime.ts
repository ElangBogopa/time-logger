'use client'

import { useCallback, useState } from 'react'

const KEY = 'wake-time'

function readSet(): number | null {
  if (typeof window === 'undefined') return null
  try {
    const value = Number(localStorage.getItem(KEY))
    return Number.isFinite(value) && value > 0 && value < 24 * 60 ? value : null
  } catch {
    return null
  }
}

export type WakeSource = 'set' | 'unknown'

/**
 * When this person wakes: what they have said, kept on the device. It is
 * never read from the log. With none stated, the windows are the reference
 * day and the screen says so.
 *
 * It is kept on the device because there is nowhere on the server to put it
 * without a schema change.
 */
export function useWakeTime() {
  const [set, setSet] = useState<number | null>(readSet)

  const setWake = useCallback((minutes: number | null) => {
    setSet(minutes)
    try {
      if (minutes === null) localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, String(minutes))
    } catch {
      /* storage is a convenience */
    }
  }, [])

  const source: WakeSource = set !== null ? 'set' : 'unknown'

  return { wakeMinutes: set, source, setWake }
}
