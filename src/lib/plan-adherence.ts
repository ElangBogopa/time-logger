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
  /** True when kept or moved was read from the log rather than ticked. */
  inferred?: boolean
  /** The logged entry recognised as this plan, when one was. */
  matchedActivity?: string | null
  /** When that entry started, for a plan done at another time. */
  matchedStart?: string | null
}

/** How much of the committed window has to be covered to count as kept. */
const COVERAGE = 0.5

/**
 * Whether a logged activity is the planned one in other words.
 *
 * A plan used to count as kept only if it was ticked in the popup that
 * follows a session. Skip the popup — or log from the planner — and "Run,
 * 6pm" with "Ran 5k" logged at six was a missed plan. The log already
 * holds the answer; this reads it.
 *
 * Deliberately modest: shared words after light stemming, a few irregular
 * verbs, and a few names for the same thing. It is allowed to miss — a
 * miss leaves the plan for the user to confirm in one tap — but it should
 * not claim a match on a word like "work".
 */
const STOPWORDS = new Set([
  'the', 'a', 'an', 'to', 'on', 'for', 'with', 'my', 'of', 'and', 'at', 'in', 'some', 'do', 'go',
])
/** Words too general to prove two activities are the same one. */
const GENERIC = new Set(['work', 'session', 'time', 'block', 'task', 'stuff', 'thing', 'deep', 'quick'])

const CANONICAL: Record<string, string> = {
  // irregular verbs
  ran: 'run', wrote: 'write', written: 'write', swam: 'swim', rode: 'ride', ate: 'eat',
  slept: 'sleep', met: 'meet', built: 'build', taught: 'teach', read: 'read',
  // the same thing by other names
  jog: 'run', jogging: 'run', '5k': 'run', '10k': 'run',
  gym: 'workout', weights: 'workout', lifting: 'workout', lift: 'workout', training: 'workout',
  exercise: 'workout', crossfit: 'workout',
  phone: 'call', phoned: 'call', rang: 'call', facetime: 'call',
  studying: 'study', studied: 'study', revision: 'study',
}

function stem(word: string): string {
  if (CANONICAL[word]) return CANONICAL[word]
  let w = word
  if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3)
  else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2)
  else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1)
  // "running" → "runn" → "run", "called" → "call" is already right
  if (w.length > 3 && w[w.length - 1] === w[w.length - 2] && !/[ls]$/.test(w)) w = w.slice(0, -1)
  return CANONICAL[w] ?? w
}

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOPWORDS.has(w))
    .map(stem)
}

/**
 * The share of the plan's meaningful words found in the activity, 0 to 1.
 * A plan made only of general words ("Deep work") has to match exactly.
 */
export function activityMatch(planTitle: string, activity: string): number {
  const planAll = tokens(planTitle)
  const logged = new Set(tokens(activity))
  if (planAll.length === 0) return 0

  const planSpecific = [...new Set(planAll.filter((w) => !GENERIC.has(w)))]
  if (planSpecific.length === 0) {
    return planAll.join(' ') === tokens(activity).join(' ') ? 1 : 0
  }
  return planSpecific.filter((w) => logged.has(w)).length / planSpecific.length
}

/**
 * One key for an activity however it was worded: "Ran 5k" and "Run" are
 * the same thing; "Long run" is not quite. Used to count how often
 * something recurs.
 */
export function activityKey(text: string): string {
  const all = tokens(text)
  const specific = [...new Set(all.filter((w) => !GENERIC.has(w)))]
  return (specific.length > 0 ? specific : all).sort().join(' ')
}

/** In the planned hour, half the plan's words are enough to recognise it. */
const MATCH_IN_WINDOW = 0.5
/** Anywhere else in the day it has to be unmistakable. */
const MATCH_ELSEWHERE = 1

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
    // The plan itself, found in the log: in its hour, or somewhere else
    let foundInWindow: string | null = null
    let foundElsewhere: { activity: string; startTime: string } | null = null

    for (const entry of entries) {
      if (!entry.start_time) continue
      const entryStart = timeToMinutes(entry.start_time)
      const entryEnd = entry.end_time
        ? timeToMinutes(entry.end_time)
        : entryStart + entry.duration_minutes
      const overlap = Math.min(end, entryEnd) - Math.max(start, entryStart)
      const match = activityMatch(plan.title, entry.activity)

      if (overlap <= 0) {
        if (!foundElsewhere && match >= MATCH_ELSEWHERE) {
          foundElsewhere = { activity: entry.activity, startTime: entry.start_time }
        }
        continue
      }

      covered += overlap
      if (!best || overlap > best.minutes) best = { activity: entry.activity, minutes: overlap }
      if (!foundInWindow && match >= MATCH_IN_WINDOW && overlap / window >= COVERAGE) {
        foundInWindow = entry.activity
      }
    }

    const filled = covered / window >= COVERAGE
    const stillAhead = nowMinutes !== null && nowMinutes < start

    // A tick is the user's word and stands. Without one, the log can still
    // show the plan happened — in its hour, or at another time.
    const keptByTick = plan.completed && filled
    const movedByTick = plan.completed && !filled
    const outcome: PlanOutcome =
      keptByTick || foundInWindow
        ? 'kept'
        : movedByTick || foundElsewhere
          ? 'moved' // done, but not in the hour you set aside for it
          : stillAhead
            ? 'upcoming'
            : 'missed'

    return {
      id: plan.id,
      title: plan.title,
      committedStart: plan.committed_start,
      committedEnd: plan.committed_end,
      outcome,
      loggedActivity: best?.activity ?? null,
      inferred: !plan.completed && (outcome === 'kept' || outcome === 'moved'),
      matchedActivity: outcome === 'kept' ? foundInWindow : outcome === 'moved' ? foundElsewhere?.activity ?? null : null,
      matchedStart: outcome === 'moved' && !plan.completed ? foundElsewhere?.startTime ?? null : null,
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
