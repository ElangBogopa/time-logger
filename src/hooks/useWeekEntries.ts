'use client'

import { useEffect, useState } from 'react'
import { fetchEntries } from '@/lib/api'
import { shiftDateString } from '@/lib/types'
import type { AlignmentEntry } from '@/lib/window-alignment'

const cacheKey = (weekStart: string) => `week-entries:${weekStart}`

function readCache(weekStart: string): AlignmentEntry[] | null {
  if (typeof window === 'undefined') return null
  try {
    return JSON.parse(sessionStorage.getItem(cacheKey(weekStart)) || '').entries ?? null
  } catch {
    return null
  }
}

/**
 * What was logged in the seven days from `weekStart`, reduced to when and
 * what kind. The habit history could not stand in for this: it stops at
 * yesterday, so a week reviewed on its last evening was missing that day,
 * and it reaches back four weeks, so an older week showed nothing at all.
 *
 * Shown from the cache at once and refreshed behind it — the current week
 * changes every time something is logged.
 */
export function useWeekEntries(weekStart: string, enabled = true): AlignmentEntry[] {
  const [loaded, setLoaded] = useState<{ week: string; entries: AlignmentEntry[] } | null>(null)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    // Inside a promise from the first line, as in useHabitHistory: this is
    // a detail of the review and must not be able to take the review down.
    Promise.resolve()
      .then(() => fetchEntries({ dateFrom: weekStart, dateTo: shiftDateString(weekStart, 6), status: 'confirmed' }))
      .then((rows) => {
        const entries: AlignmentEntry[] = rows.map((row) => ({
          category: row.category,
          start_time: row.start_time,
          end_time: row.end_time,
          duration_minutes: row.duration_minutes,
        }))
        try {
          sessionStorage.setItem(cacheKey(weekStart), JSON.stringify({ entries }))
        } catch {
          /* storage is a convenience */
        }
        if (!cancelled) setLoaded({ week: weekStart, entries })
      })
      .catch((err) => console.error('Failed to load the week:', err))
    return () => {
      cancelled = true
    }
  }, [enabled, weekStart])

  // Never another week's entries while this one loads.
  if (loaded && loaded.week === weekStart) return loaded.entries
  return readCache(weekStart) ?? EMPTY
}

const EMPTY: AlignmentEntry[] = []
