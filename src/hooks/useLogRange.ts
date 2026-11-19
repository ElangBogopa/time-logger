'use client'

import { useEffect, useMemo, useState } from 'react'
import { fetchEntries } from '@/lib/api'
import type { Row } from '@/lib/review-read'

const cacheKey = (from: string, to: string) => `log-range:${from}:${to}`

function readCache(from: string, to: string): Row[] | null {
  if (typeof window === 'undefined') return null
  try {
    const rows = JSON.parse(sessionStorage.getItem(cacheKey(from, to)) || '').rows
    return Array.isArray(rows) ? rows : null
  } catch {
    return null
  }
}

/**
 * The confirmed, categorised entries from `from` to `to`, reduced to what the
 * review's rules read. The day review reads the reviewed day and the four
 * weeks before it from one range, so a saved day (which carries no entries)
 * reads the same as a live one.
 *
 * Shown from the cache at once and refreshed behind it, as in
 * useWeekEntries; never another range's rows while a new one loads.
 */
export function useLogRange(from: string, to: string, enabled = true): { rows: Row[]; loaded: boolean; failed: boolean } {
  const [loaded, setLoaded] = useState<{ key: string; rows: Row[]; failed?: boolean } | null>(null)
  const key = cacheKey(from, to)
  // Read once per range, so the rows keep one identity from render to render.
  const cached = useMemo(() => readCache(from, to), [from, to])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    // Inside a promise from the first line: a failure here must not take the
    // review down with it.
    Promise.resolve()
      .then(() => fetchEntries({ dateFrom: from, dateTo: to, status: 'confirmed' }))
      .then((entries) => {
        const rows: Row[] = entries
          .filter((e) => e.category)
          .map((e) => ({
            date: e.date,
            activity: e.activity,
            category: e.category as string,
            start_time: e.start_time,
            end_time: e.end_time,
            duration_minutes: e.duration_minutes,
          }))
        try {
          sessionStorage.setItem(key, JSON.stringify({ rows }))
        } catch {
          /* storage is a convenience */
        }
        if (!cancelled) setLoaded({ key, rows })
      })
      .catch((err) => {
        console.error('Failed to load the log:', err)
        // With a cached range that is what is shown. With none, the log is
        // not loaded: `failed` says so, and rows are not an empty day.
        if (cancelled) return
        setLoaded((current) => {
          if (current?.key === key) return current
          const kept = readCache(from, to)
          return kept ? { key, rows: kept } : { key, rows: [], failed: true }
        })
      })
    return () => {
      cancelled = true
    }
  }, [enabled, from, to, key])

  if (loaded && loaded.key === key) {
    return loaded.failed ? { rows: EMPTY, loaded: false, failed: true } : { rows: loaded.rows, loaded: true, failed: false }
  }
  return cached ? { rows: cached, loaded: true, failed: false } : { rows: EMPTY, loaded: false, failed: false }
}

const EMPTY: Row[] = []
