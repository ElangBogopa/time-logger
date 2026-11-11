'use client'

import { useEffect, useState } from 'react'
import { fetchEntries } from '@/lib/api'
import { getUserToday, shiftDateString } from '@/lib/types'
import type { HabitEntry } from '@/lib/habits'

/** Four weeks is long enough for a weekly habit to show three times. */
const DAYS = 28

const cacheKey = (through: string) => `habit-history:${through}`

function readCache(through: string): HabitEntry[] | null {
  if (typeof window === 'undefined') return null
  try {
    return JSON.parse(sessionStorage.getItem(cacheKey(through)) || '').entries ?? null
  } catch {
    return null
  }
}

/**
 * The last four weeks of the log, up to yesterday, reduced to what the
 * planner reads habits from. One request per session; the planner works
 * without it and simply knows less.
 */
export function useHabitHistory(enabled = true): HabitEntry[] {
  const through = shiftDateString(getUserToday(), -1)
  const [entries, setEntries] = useState<HabitEntry[]>(() => readCache(through) ?? [])

  useEffect(() => {
    if (!enabled || readCache(through)) return
    let cancelled = false
    fetchEntries({ dateFrom: shiftDateString(through, -(DAYS - 1)), dateTo: through, status: 'confirmed' })
      .then((rows) => {
        const slim: HabitEntry[] = rows.map((row) => ({
          activity: row.activity,
          category: row.category,
          date: row.date,
          start_time: row.start_time,
          end_time: row.end_time,
          duration_minutes: row.duration_minutes,
        }))
        try {
          sessionStorage.setItem(cacheKey(through), JSON.stringify({ entries: slim }))
        } catch {
          /* storage is a convenience */
        }
        if (!cancelled) setEntries(slim)
      })
      .catch((err) => console.error('Failed to load habit history:', err))
    return () => {
      cancelled = true
    }
  }, [enabled, through])

  return entries
}
