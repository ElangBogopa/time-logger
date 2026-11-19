/**
 * The facts the session comment and the per-entry remark are written from.
 *
 * Pure: the client posts what it knows (the session's entries, the day's
 * entries, the plans, the wake time, the minute), this turns it into facts,
 * and the prompt builders in prompts.ts turn the facts into lines for the
 * model. Rings are judged with the ordinary Body / Mind / Heart functions and
 * the same "on target" test as `countMetricsOnTarget` — no new formula.
 */

import {
  CATEGORY_LABELS,
  PERIOD_LABELS,
  PERIOD_TIME_RANGES,
  TimeCategory,
  TimePeriod,
} from '@/lib/types'
import {
  EXERCISE_TARGET,
  FOCUS_TARGET,
  FOCUS_WEIGHTS,
  METRIC_LABELS,
  METRIC_THRESHOLDS,
  SOCIAL_TARGET,
  calcBody,
  calcFocus,
  calcFocusDetails,
  calcSocial,
  countsTowardHeart,
  exerciseMinutes,
  heartMinutes,
  EntryRow as MetricRow,
} from '@/lib/metrics-calc'
import { comparePlanToActual, PlanRow } from '@/lib/plan-adherence'
import { timeToMinutes } from '@/lib/time-utils'
import { windowAlignment, AlignmentFact } from '@/lib/window-alignment'
import type { DayWindow } from '@/lib/ideal-day'

export interface CoachEntry {
  id: string
  activity: string
  category: TimeCategory | null
  duration_minutes: number
  start_time: string | null
  end_time: string | null
  description?: string | null
}

export type RingKey = 'body' | 'focus' | 'social'
export interface RingFact {
  key: RingKey
  label: string
  /**
   * reached = below target before these entries, on target after
   * already = on target before them
   * open    = not on target, and there is still time today (later-today only)
   * missed  = not on target, and the day's sessions are over (tomorrow / none)
   */
  state: 'reached' | 'already' | 'open' | 'missed'
  done: number
  target: number
  unit: string
}

export type AheadKind = 'none' | 'tomorrow' | 'later-today'

export interface SessionFacts {
  period: TimePeriod
  periodLabel: string
  totalMinutes: number
  entryCount: number
  categories: { label: string; minutes: number }[]
  activities: { activity: string; label: string; minutes: number; start: string | null; end: string | null }[]
  rings: RingFact[]
  plansKept: { title: string; start: string }[]
  plansNotDone: { title: string; start: string }[]
  windowFacts: AlignmentFact[]
  ahead: {
    kind: AheadKind
    nextSessions: string[]
    plans: { title: string; start: string }[]
    windows: { label: string; start: string; end: string }[]
  }
}

export interface SessionFactsInput {
  period: TimePeriod
  sessionEntries: CoachEntry[]
  dayEntries: CoachEntry[]
  plans: PlanRow[]
  windows: DayWindow[]
  nowMinutes: number | null
}

export interface EntryFacts {
  activity: string
  label: string
  minutes: number
  start: string | null
  end: string | null
  description: string | null
  dayTotalMinutes: number
  sameCategoryToday: number
  rings: RingFact[]
}

const toRow = (e: CoachEntry): MetricRow => ({
  category: e.category ?? 'other',
  duration_minutes: e.duration_minutes,
  date: '',
  activity: e.activity,
})

const onTarget = (score: number) => score >= METRIC_THRESHOLDS.green

function hhmm(time: string | null): string | null {
  return time ? time.slice(0, 5) : null
}

function clock(minutes: number): string {
  const m = Math.max(0, Math.min(1440, Math.round(minutes)))
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** The ring's score, its progress toward the target and what the progress is counted in. */
function ringMeasure(key: RingKey, rows: MetricRow[]): { score: number; done: number; target: number; unit: string } {
  if (key === 'focus') {
    return {
      score: calcFocus(rows),
      done: Math.round(calcFocusDetails(rows).weightedMinutes),
      target: FOCUS_TARGET,
      unit: 'focused minutes',
    }
  }
  if (key === 'body') {
    return {
      score: calcBody(rows),
      done: Math.round(exerciseMinutes(rows)),
      target: EXERCISE_TARGET,
      unit: 'moderate-equivalent exercise minutes',
    }
  }
  return {
    score: calcSocial(rows),
    done: Math.round(heartMinutes(rows)),
    target: SOCIAL_TARGET,
    unit: 'minutes with friends or family',
  }
}

const RING_KEYS: RingKey[] = ['body', 'focus', 'social']

function ringFact(
  key: RingKey,
  before: MetricRow[],
  after: MetricRow[],
  notReached: 'open' | 'missed'
): RingFact {
  const was = ringMeasure(key, before)
  const now = ringMeasure(key, after)
  const state: RingFact['state'] = onTarget(was.score)
    ? 'already'
    : onTarget(now.score)
      ? 'reached'
      : notReached
  return { key, label: METRIC_LABELS[key], state, done: now.done, target: now.target, unit: now.unit }
}

export function buildSessionFacts(input: SessionFactsInput): SessionFacts {
  const { period, sessionEntries, dayEntries, plans, windows, nowMinutes } = input

  const kind: AheadKind = nowMinutes === null ? 'none' : period === 'evening' ? 'tomorrow' : 'later-today'

  const sessionIds = new Set(sessionEntries.map((e) => e.id))
  const rest = dayEntries.filter((e) => !sessionIds.has(e.id))
  const day = [...rest, ...sessionEntries]
  const beforeRows = rest.map(toRow)
  const dayRows = day.map(toRow)

  const totalMinutes = sessionEntries.reduce((s, e) => s + e.duration_minutes, 0)

  const byCategory = new Map<string, number>()
  for (const e of sessionEntries) {
    const label = CATEGORY_LABELS[e.category ?? 'other']
    byCategory.set(label, (byCategory.get(label) ?? 0) + e.duration_minutes)
  }
  const categories = [...byCategory.entries()]
    .map(([label, minutes]) => ({ label, minutes }))
    .sort((a, b) => b.minutes - a.minutes)

  const activities = [...sessionEntries]
    .sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''))
    .slice(0, 12)
    .map((e) => ({
      activity: e.activity.slice(0, 80),
      label: CATEGORY_LABELS[e.category ?? 'other'],
      minutes: e.duration_minutes,
      start: hhmm(e.start_time),
      end: hhmm(e.end_time),
    }))

  const notReached = kind === 'later-today' ? 'open' : 'missed'
  const rings = RING_KEYS.map((key) => ringFact(key, beforeRows, dayRows, notReached))

  const comparisons = comparePlanToActual({ plans, entries: day, nowMinutes })
  const range = PERIOD_TIME_RANGES[period]
  const inPeriod = comparisons.filter((c) => {
    const hour = parseInt(c.committedStart.split(':')[0], 10)
    return hour >= range.start && hour < range.end
  })
  const planLine = (c: { title: string; committedStart: string }) => ({
    title: c.title.slice(0, 80),
    start: c.committedStart.slice(0, 5),
  })
  const plansKept = inPeriod.filter((c) => c.outcome === 'kept' || c.outcome === 'moved').map(planLine)
  // A plan whose hour is still running is not missed yet (it has time left),
  // so it is in neither list; the comparison only knows its start has passed.
  const stillRunning = (c: { committedEnd: string }) =>
    nowMinutes !== null && nowMinutes < timeToMinutes(c.committedEnd)
  const plansNotDone = inPeriod.filter((c) => c.outcome === 'missed' && !stillRunning(c)).map(planLine)

  const windowFacts = windowAlignment(sessionEntries, windows)

  const nextSessions: string[] =
    kind === 'later-today'
      ? period === 'morning'
        ? [PERIOD_LABELS.afternoon, PERIOD_LABELS.evening]
        : [PERIOD_LABELS.evening]
      : kind === 'tomorrow'
        ? [PERIOD_LABELS.morning]
        : []

  const aheadPlans =
    kind === 'later-today'
      ? comparisons
          .filter((c) => c.outcome === 'upcoming')
          .sort((a, b) => a.committedStart.localeCompare(b.committedStart))
          .slice(0, 3)
          .map(planLine)
      : []

  const byStart = [...windows].sort((a, b) => a.startMinutes - b.startMinutes)
  const aheadWindows =
    kind === 'later-today'
      ? byStart.filter((w) => w.endMinutes > (nowMinutes as number)).slice(0, 3)
      : kind === 'tomorrow'
        ? byStart.slice(0, 2)
        : []

  return {
    period,
    periodLabel: PERIOD_LABELS[period],
    totalMinutes,
    entryCount: sessionEntries.length,
    categories,
    activities,
    rings,
    plansKept,
    plansNotDone,
    windowFacts,
    ahead: {
      kind,
      nextSessions,
      plans: aheadPlans,
      windows: aheadWindows.map((w) => ({
        label: w.label,
        start: clock(w.startMinutes),
        end: clock(w.endMinutes),
      })),
    },
  }
}

export function buildEntryFacts(input: { entry: CoachEntry; dayEntries: CoachEntry[] }): EntryFacts {
  const { entry, dayEntries } = input
  const rest = dayEntries.filter((e) => e.id !== entry.id)
  const day = [...rest, entry]
  const beforeRows = rest.map(toRow)
  const dayRows = day.map(toRow)
  const row = toRow(entry)

  const feeds: RingKey[] = []
  if (exerciseMinutes([row]) > 0) feeds.push('body')
  if (entry.category && FOCUS_WEIGHTS[entry.category]) feeds.push('focus')
  if (countsTowardHeart(row)) feeds.push('social')

  const rings = RING_KEYS.filter((k) => feeds.includes(k)).map((key) => ringFact(key, beforeRows, dayRows, 'open'))

  return {
    activity: entry.activity.slice(0, 80),
    label: CATEGORY_LABELS[entry.category ?? 'other'],
    minutes: entry.duration_minutes,
    start: hhmm(entry.start_time),
    end: hhmm(entry.end_time),
    description: entry.description ? entry.description.slice(0, 200) : null,
    dayTotalMinutes: day.reduce((s, e) => s + e.duration_minutes, 0),
    sameCategoryToday: day.filter((e) => e.category === entry.category).length,
    rings,
  }
}
