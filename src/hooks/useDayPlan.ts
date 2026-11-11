'use client'

import { useCallback, useEffect, useState } from 'react'
import type { PlanRow } from '@/lib/plan-adherence'

export interface DayPlanTask extends PlanRow {
  date: string
}

const cacheKey = (date: string) => `day-plan:${date}`

function readCache(date: string): DayPlanTask[] | null {
  if (typeof window === 'undefined') return null
  try {
    return JSON.parse(sessionStorage.getItem(cacheKey(date)) || '').plans ?? null
  } catch {
    return null
  }
}

/** Fetch a day's tasks and refresh the cache. Null when the request fails. */
async function loadPlans(date: string): Promise<DayPlanTask[] | null> {
  try {
    const res = await fetch(`/api/plans?date=${date}`)
    if (!res.ok) return null
    const { plans } = (await res.json()) as { plans: DayPlanTask[] }
    const next = plans ?? []
    try {
      sessionStorage.setItem(cacheKey(date), JSON.stringify({ plans: next }))
    } catch {
      /* storage is a convenience */
    }
    return next
  } catch (err) {
    console.error('Failed to fetch the day plan:', err)
    return null
  }
}

/**
 * The tasks planned for a day. Cached per date in sessionStorage so that
 * coming back to Today shows the list at once and refreshes it quietly.
 */
export function useDayPlan(date: string, enabled = true) {
  const cached = readCache(date)
  const [state, setState] = useState<{ date: string; plans: DayPlanTask[]; loaded: boolean }>({
    date,
    plans: cached ?? [],
    loaded: cached !== null,
  })

  const refetch = useCallback(async () => {
    if (!enabled || !date) return
    const plans = await loadPlans(date)
    if (plans) setState({ date, plans, loaded: true })
  }, [date, enabled])

  useEffect(() => {
    if (!enabled || !date) return
    let cancelled = false
    loadPlans(date).then((plans) => {
      if (!cancelled && plans) setState({ date, plans, loaded: true })
    })
    return () => {
      cancelled = true
    }
  }, [date, enabled])

  // A different day: show its cache (or nothing) until its own fetch lands.
  if (state.date !== date) {
    const forDate = readCache(date)
    return { plans: forDate ?? [], isLoading: forDate === null, refetch }
  }

  return { plans: state.plans, isLoading: !state.loaded, refetch }
}

/* ── Items set aside for the day ─────────────────────────────────────────
   "Skip" answers "what became of this?" without a schema: the plan stays
   as it is — so the review still reports it honestly as not done — and
   this device simply stops asking. */

const SKIP_KEY = 'next-up-skipped'

function readAllSkipped(): Record<string, string[]> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(SKIP_KEY) || '{}') ?? {}
  } catch {
    return {}
  }
}

export function useSkipped(date: string) {
  const [skipped, setSkipped] = useState<string[]>(() => readAllSkipped()[date] ?? [])
  const [forDate, setForDate] = useState(date)
  if (forDate !== date) {
    setForDate(date)
    setSkipped(readAllSkipped()[date] ?? [])
  }

  const write = useCallback(
    (next: string[]) => {
      setSkipped(next)
      try {
        const all = readAllSkipped()
        all[date] = next
        // Keep a week; older days are locked and never asked about again.
        const keep = Object.keys(all).sort().slice(-7)
        localStorage.setItem(SKIP_KEY, JSON.stringify(Object.fromEntries(keep.map((d) => [d, all[d]]))))
      } catch {
        /* storage is a convenience */
      }
    },
    [date]
  )

  const skip = useCallback((key: string) => write([...new Set([...skipped, key])]), [skipped, write])
  const unskip = useCallback((key: string) => write(skipped.filter((k) => k !== key)), [skipped, write])

  return { skipped, skip, unskip }
}
