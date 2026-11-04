/**
 * What you said you would do, against what you did.
 *
 * Two halves, and only one of them needs inferring. Whether a task happened
 * is recorded explicitly — you tick it in the post-session popup, and
 * `daily_plans.completed` holds the answer. What is not recorded is whether
 * it happened *when you said it would*, and that is the interesting half: a
 * plan that survives the morning and dies after lunch is a pattern worth
 * seeing.
 *
 * This is deliberately not a score. The app already has one scoring system
 * and four retired impostors; plan adherence is a set of facts — kept,
 * moved, missed — and the sentence they add up to.
 */

import { timeToMinutes } from './time-utils'

export type PlanOutcome = 'kept' | 'moved' | 'missed' | 'upcoming'

export interface PlanRow {
  id: string
  title: string
  completed: boolean
  committed_start: string | null
  committed_end: string | null
}

export interface EntryRow {
  activity: string
  start_time: string | null
  end_time: string | null
  duration_minutes: number
}

export interface PlanComparison {
  id: string
  title: string
  committedStart: string
  committedEnd: string
  outcome: PlanOutcome
  /** What actually occupied most of that window, if anything did. */
  loggedActivity: string | null
}

/** How much of the committed window has to be covered to count as kept. */
const COVERAGE = 0.5

export function comparePlanToActual({
  plans,
  entries,
  nowMinutes = null,
}: {
  plans: PlanRow[]
  entries: EntryRow[]
  /** Minutes past midnight on today; omit for a finished day. */
  nowMinutes?: number | null
}): PlanComparison[] {
  const timed = plans.filter(
    (plan): plan is PlanRow & { committed_start: string; committed_end: string } =>
      Boolean(plan.committed_start && plan.committed_end)
  )

  return timed.map((plan) => {
    const start = timeToMinutes(plan.committed_start)
    const end = timeToMinutes(plan.committed_end)
    const window = Math.max(1, end - start)

    // What was logged across that window, and which activity took most of it
    let covered = 0
    let best: { activity: string; minutes: number } | null = null

    for (const entry of entries) {
      if (!entry.start_time) continue
      const entryStart = timeToMinutes(entry.start_time)
      const entryEnd = entry.end_time
        ? timeToMinutes(entry.end_time)
        : entryStart + entry.duration_minutes
      const overlap = Math.min(end, entryEnd) - Math.max(start, entryStart)
      if (overlap <= 0) continue
      covered += overlap
      if (!best || overlap > best.minutes) best = { activity: entry.activity, minutes: overlap }
    }

    const filled = covered / window >= COVERAGE
    const stillAhead = nowMinutes !== null && nowMinutes < start

    const outcome: PlanOutcome = stillAhead
      ? 'upcoming'
      : plan.completed
        ? filled
          ? 'kept'
          : 'moved' // done, but not in the hour you set aside for it
        : 'missed'

    return {
      id: plan.id,
      title: plan.title,
      committedStart: plan.committed_start,
      committedEnd: plan.committed_end,
      outcome,
      loggedActivity: best?.activity ?? null,
    }
  })
}

export interface PlanAdherence {
  comparisons: PlanComparison[]
  kept: number
  moved: number
  missed: number
  /** Plans with a time that the day has already reached. */
  settled: number
}

export function summarisePlanAdherence(comparisons: PlanComparison[]): PlanAdherence {
  const count = (outcome: PlanOutcome) => comparisons.filter((c) => c.outcome === outcome).length
  const kept = count('kept')
  const moved = count('moved')
  const missed = count('missed')
  return { comparisons, kept, moved, missed, settled: kept + moved + missed }
}
