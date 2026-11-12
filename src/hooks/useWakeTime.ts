'use client'

import { useCallback, useMemo, useState } from 'react'
import { usualWakeMinutes, type HabitEntry } from '@/lib/habits'

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

export type WakeSource = 'set' | 'log' | 'unknown'

/**
 * When this person wakes: what they have said, else what their log shows,
 * else nothing — in which case the windows are the reference day and the
 * screen says so.
 *
 * A stated time wins because it is a statement: someone who is moving their
 * mornings earlier wants tomorrow's windows, not the average of last
 * month's. It is kept on the device; there is nowhere on the server to put
 * it without a schema change.
 */
export function useWakeTime(history: HabitEntry[]) {
  const [set, setSet] = useState<number | null>(readSet)
  const learned = useMemo(() => usualWakeMinutes(history), [history])

  const setWake = useCallback((minutes: number | null) => {
    setSet(minutes)
    try {
      if (minutes === null) localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, String(minutes))
    } catch {
      /* storage is a convenience */
    }
  }, [])

  const wakeMinutes = set ?? learned
  const source: WakeSource = set !== null ? 'set' : learned !== null ? 'log' : 'unknown'

  return { wakeMinutes, source, learnedMinutes: learned, setWake }
}
