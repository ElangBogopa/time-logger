'use client'

import { useEffect, useMemo, useState } from 'react'
import { fetchEntries } from '@/lib/api'
import { shiftDateString } from '@/lib/types'
import { coveredOn, type CoveredBlock } from '@/lib/overnight'

const cacheKey = (date: string) => `overnight-spill:${date}`

type SpillRow = Parameters<typeof coveredOn>[1][number]

function readCache(date: string): SpillRow[] | null {
  if (typeof window === 'undefined') return null
  try {
    return JSON.parse(sessionStorage.getItem(cacheKey(date)) || '').rows ?? null
  } catch {
    return null
  }
}

/**
 * The parts of the neighbouring days' overnight sleeps that spill into
 * `date` (`coveredOn`): shown as covered, never counted here. Planned and
 * confirmed rows both count.
 *
 * Shown from the cache at once and refreshed behind it; refetched when
 * `refreshKey` changes (pass the day's entries, so a save shows at once).
 */
export function useOvernightSpill(date: string | null, refreshKey?: unknown): CoveredBlock[] {
  const [loaded, setLoaded] = useState<{ date: string; rows: SpillRow[] } | null>(null)

  useEffect(() => {
    if (!date) return
    let cancelled = false
    // A detail of the day: a failed lookup must not take the screen down.
    Promise.resolve()
      .then(() =>
        fetchEntries({
          dateFrom: shiftDateString(date, -1),
          dateTo: shiftDateString(date, 1),
          fields: 'id,date,activity,category,start_time,end_time,status',
        })
      )
      .then((entries) => {
        const rows: SpillRow[] = entries.map((e) => ({
          id: e.id,
          date: e.date,
          activity: e.activity,
          category: e.category,
          start_time: e.start_time,
          end_time: e.end_time,
        }))
        try {
          sessionStorage.setItem(cacheKey(date), JSON.stringify({ rows }))
        } catch {
          /* storage is a convenience */
        }
        if (!cancelled) setLoaded({ date, rows })
      })
      .catch((err) => console.error('Failed to load the neighbouring nights:', err))
    return () => {
      cancelled = true
    }
  }, [date, refreshKey])

  return useMemo(() => {
    if (!date) return EMPTY
    // Never another day's rows while this one loads.
    const rows = loaded && loaded.date === date ? loaded.rows : readCache(date)
    if (!rows) return EMPTY
    const blocks = coveredOn(date, rows)
    return blocks.length > 0 ? blocks : EMPTY
  }, [date, loaded])
}

const EMPTY: CoveredBlock[] = []
