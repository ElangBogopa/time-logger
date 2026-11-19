'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { csrfFetch } from '@/lib/api'
import { useCalendar } from '@/contexts/CalendarContext'
import { getUserCurrentHour, getUserToday, shiftDateString } from '@/lib/types'
import { minutesToTime, timeToMinutes } from '@/lib/time-utils'
import { resolveReadAction, type BusySpan, type ReadAction, type ReviewRead } from '@/lib/review-read'

interface PlanRow {
  id: string
  title: string
  committed_start: string | null
  committed_end: string | null
}

const plansKey = (date: string) => `read-action-plans:${date}`

function readPlans(date: string): PlanRow[] | null {
  if (typeof window === 'undefined') return null
  try {
    const plans = JSON.parse(sessionStorage.getItem(plansKey(date)) || '').plans
    return Array.isArray(plans) ? plans : null
  } catch {
    return null
  }
}

/** The plan for a date: from the cache at once, refreshed behind it. */
function usePlans(date: string, enabled: boolean): PlanRow[] {
  const [loaded, setLoaded] = useState<{ date: string; plans: PlanRow[] } | null>(null)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    Promise.resolve()
      .then(() => fetch(`/api/plans?date=${date}`))
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || !Array.isArray(data.plans)) return
        const plans: PlanRow[] = data.plans.map((p: PlanRow) => ({
          id: p.id,
          title: p.title,
          committed_start: p.committed_start ?? null,
          committed_end: p.committed_end ?? null,
        }))
        try {
          sessionStorage.setItem(plansKey(date), JSON.stringify({ plans }))
        } catch {
          /* storage is a convenience */
        }
        if (!cancelled) setLoaded({ date, plans })
      })
      .catch(() => {
        /* without the plan the button still opens the planner */
      })
    return () => {
      cancelled = true
    }
  }, [date, enabled])

  if (loaded && loaded.date === date) return loaded.plans
  return readPlans(date) ?? NO_PLANS
}

const NO_PLANS: PlanRow[] = []

function busyFrom(events: { startTime: string; endTime: string; isAllDay: boolean }[], plans: PlanRow[]): BusySpan[] {
  const spans: BusySpan[] = []
  for (const event of events) {
    if (event.isAllDay || !event.startTime || !event.endTime) continue
    const start = timeToMinutes(event.startTime)
    const end = timeToMinutes(event.endTime)
    spans.push({ startMinutes: start, endMinutes: end > start ? end : 24 * 60 })
  }
  for (const plan of plans) {
    if (!plan.committed_start || !plan.committed_end) continue
    spans.push({ startMinutes: timeToMinutes(plan.committed_start), endMinutes: timeToMinutes(plan.committed_end) })
  }
  return spans
}

/**
 * The one button a review ends on: what it says, where it goes, and — when
 * the read offers a free slot — putting that slot into the plan on a tap.
 * Nothing is written until the person taps.
 */
export function useReadAction(
  read: ReviewRead | null,
  where: { reviewDate?: string; weekStart?: string },
  enabled = true
): { action: ReadAction | null; run: () => Promise<void>; isSaving: boolean } {
  const router = useRouter()
  const { getEventsForDate } = useCalendar()
  const today = getUserToday()
  const tomorrow = shiftDateString(today, 1)
  const plansToday = usePlans(today, enabled)
  const plansTomorrow = usePlans(tomorrow, enabled)
  const [isSaving, setIsSaving] = useState(false)

  const now = new Date()
  const nowMinutes = Math.min(getUserCurrentHour(now), 23) * 60 + now.getMinutes()
  // To the half hour: the button does not need to change every minute.
  const clock = Math.floor(nowMinutes / 30) * 30

  const eventsToday = getEventsForDate(today)
  const eventsTomorrow = getEventsForDate(tomorrow)

  const action = useMemo(
    () =>
      read
        ? resolveReadAction({
            read,
            reviewDate: where.reviewDate,
            weekStart: where.weekStart,
            today,
            nowMinutes: clock,
            busyToday: busyFrom(eventsToday, plansToday),
            busyTomorrow: busyFrom(eventsTomorrow, plansTomorrow),
            plannedTitles: { today: plansToday.map((p) => p.title), tomorrow: plansTomorrow.map((p) => p.title) },
          })
        : null,
    [read, where.reviewDate, where.weekStart, today, clock, eventsToday, eventsTomorrow, plansToday, plansTomorrow]
  )

  const run = useCallback(async () => {
    if (!action || isSaving) return
    const { slot, targetDate } = action
    if (!slot) {
      router.push(action.href)
      return
    }
    setIsSaving(true)
    try {
      const created = await csrfFetch('/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: targetDate, title: slot.title }),
      })
      if (!created.ok) throw new Error('Failed to add the plan')
      const { plan } = await created.json()
      const start = timeToMinutes(slot.startTime)
      const timed = await csrfFetch('/api/plans', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: plan.id,
          committed_start: slot.startTime,
          committed_end: minutesToTime(Math.min(24 * 60, start + slot.durationMinutes)),
        }),
      })
      if (!timed.ok) throw new Error('Failed to time the plan')
      try {
        sessionStorage.removeItem(plansKey(targetDate))
      } catch {
        /* storage is a convenience */
      }
      router.push(`/calendar?date=${targetDate}`)
    } catch {
      toast.error("Couldn't add that to the plan. Try again.")
      setIsSaving(false)
    }
  }, [action, isSaving, router])

  return { action, run, isSaving }
}
