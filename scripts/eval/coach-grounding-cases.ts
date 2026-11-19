/**
 * Fixed lines with a known answer to "is this true to its facts?".
 *
 * Every one is a line a review of the coach's voice quoted (reviews 15 and 16
 * in docs/reviews/open.md), against the facts it was written from. Two things
 * are held to them:
 *
 * - `checkCoachGrounding` and `checkCoachLine` (src/lib/coach-voice-check.ts)
 *   must fail each ungrounded one under the rule named here and pass each
 *   grounded one: src/lib/__tests__/coach-grounding.test.ts.
 * - The eval's judge model is asked about each of them before it grades a
 *   single new line, and `npm run eval:coach` fails if the answer the eval
 *   would report for any of them is wrong: a judge that cannot tell these
 *   apart is measuring noise.
 *
 * A change that needs an answer here to flip has broken something.
 */

import {
  buildEntryFacts,
  buildSessionFacts,
  type CoachEntry,
  type EntryFacts,
  type SessionFacts,
} from '../../src/lib/coach-facts'
import { windowsForWake } from '../../src/lib/ideal-day'
import type { PlanRow } from '../../src/lib/plan-adherence'
import type { TimeCategory } from '../../src/lib/types'

export type GroundingCase = {
  id: string
  line: string
  /** The rule that must fail it, or null when the line is true to its facts. */
  rule: 'invented-target' | 'ring-state' | 'no-plan' | 'plan-not-ahead' | 'looks-ahead' | null
} & ({ kind: 'session'; facts: SessionFacts } | { kind: 'entry'; facts: EntryFacts })

const WINDOWS = windowsForWake(null)

const e = (id: string, activity: string, category: TimeCategory, start: string, end: string, minutes: number): CoachEntry => ({
  id,
  activity,
  category,
  duration_minutes: minutes,
  start_time: start,
  end_time: end,
})
const plan = (id: string, title: string, start: string, end: string): PlanRow => ({
  id,
  title,
  completed: false,
  committed_start: start,
  committed_end: end,
})

const nap = e('nap', 'Nap', 'rest', '14:00', '14:45', 45)
const tv = e('tv', 'Watching TV', 'entertainment', '15:00', '16:30', 90)
const sync = e('sync', 'Project sync', 'meetings', '15:00', '16:00', 60)

const sessionFacts = (
  period: 'morning' | 'afternoon' | 'evening',
  sessionEntries: CoachEntry[],
  opts: { before?: CoachEntry[]; plans?: PlanRow[]; nowMinutes: number | null }
) =>
  buildSessionFacts({
    period,
    sessionEntries,
    dayEntries: [...(opts.before ?? []), ...sessionEntries],
    plans: opts.plans ?? [],
    windows: WINDOWS,
    nowMinutes: opts.nowMinutes,
  })

/** An afternoon of a nap and TV finished at 17:00: all three rings still open. */
const quietAfternoon = sessionFacts('afternoon', [nap, tv], { nowMinutes: 17 * 60 })
/** Emails, finished at 18:00, with "Call Mum" planned for 15:00 and not done. */
const planNotDone = sessionFacts('afternoon', [e('mail', 'Emails', 'admin', '13:00', '13:45', 45)], {
  nowMinutes: 18 * 60,
  plans: [plan('mum', 'Call Mum', '15:00', '15:30')],
})
/** Dinner takes Heart to its target at 21:00; Body and Mind did not reach theirs. */
const eveningHeart = sessionFacts('evening', [e('dinner', 'Dinner with family', 'social', '18:30', '20:00', 90)], {
  nowMinutes: 21 * 60,
  before: [e('work', 'Work', 'shallow_work', '10:00', '12:00', 120)],
})
/** Twenty minutes of tidying, finished at 21:00. No plan anywhere. */
const thinEvening = sessionFacts('evening', [e('tidy', 'Tidying', 'chores', '19:00', '19:20', 20)], { nowMinutes: 21 * 60 })
/** A session of a day already over: nothing is ahead. */
const earlierDay = sessionFacts('afternoon', [e('study', 'Study', 'learning', '13:00', '15:00', 120), tv], { nowMinutes: null })

const tvEntry = buildEntryFacts({ entry: tv, dayEntries: [tv] })
const napEntry = buildEntryFacts({ entry: nap, dayEntries: [nap] })
const meetingEntry = buildEntryFacts({
  entry: sync,
  dayEntries: [
    e('standup', 'Standup', 'meetings', '09:30', '10:30', 60),
    e('client', 'Client call', 'meetings', '11:00', '12:00', 60),
    sync,
  ],
})

export const GROUNDING_CASES: GroundingCase[] = [
  // ── Says what the facts do not ──────────────────────────────────────────
  {
    id: 'entertainment-target',
    kind: 'entry',
    facts: tvEntry,
    line: 'Watching TV added 1 hour and 30 minutes toward your entertainment target today.',
    rule: 'invented-target',
  },
  {
    id: 'rest-target',
    kind: 'entry',
    facts: napEntry,
    line: 'A 45-minute nap this afternoon, all of it toward your rest target.',
    rule: 'invented-target',
  },
  {
    id: 'admin-target',
    kind: 'session',
    facts: planNotDone,
    line: 'You logged 45 minutes on Emails, which reached its target for admin time. The Evening session is still ahead.',
    rule: 'invented-target',
  },
  {
    id: 'missed-rings-called-open',
    kind: 'session',
    facts: eveningHeart,
    line: 'Dinner with family took Heart to its target. The Body and Mind targets are still open. Tomorrow starts with Morning movement.',
    rule: 'ring-state',
  },
  {
    id: 'as-planned-without-a-plan',
    kind: 'session',
    facts: thinEvening,
    line: 'You spent 20 minutes tidying as planned. Tomorrow opens with Morning movement from 06:00.',
    rule: 'no-plan',
  },
  {
    id: 'no-plan-logged',
    kind: 'session',
    facts: thinEvening,
    line: 'You logged 20 minutes of tidying, with no plan logged for today. Tomorrow opens with Morning movement.',
    rule: 'no-plan',
  },
  {
    id: 'day-over-time-left-today',
    kind: 'session',
    facts: earlierDay,
    line: 'In this session, you logged 3 hours and 30 minutes across two activities, with 2 hours dedicated to studying. The Body, Mind, and Heart targets were not reached, but there is still time left today to engage in those areas.',
    rule: 'looks-ahead',
  },
  {
    id: 'day-over-time-left-in-the-day',
    kind: 'session',
    facts: earlierDay,
    line: "You logged 3 hours and 30 minutes across two activities, with 2 hours dedicated to studying. No targets were reached for Body, Mind, or Heart in this session, but there's still time left in the day.",
    rule: 'looks-ahead',
  },
  {
    id: 'plan-not-done-still-offered',
    kind: 'session',
    facts: planNotDone,
    line: 'You logged 45 minutes on emails, which is a solid chunk of Admin. The Body, Mind, and Heart rings are all still open, giving you time to engage in those areas. You could still make that call to Mum or connect with others in the evening session.',
    rule: 'plan-not-ahead',
  },

  // ── True to the facts ───────────────────────────────────────────────────
  {
    id: 'two-open-rings-named',
    kind: 'session',
    facts: quietAfternoon,
    line: 'You logged 2 hours and 15 minutes today, with a solid block of 1 hour and 30 minutes for watching TV. Both Body and Mind are still open, with no minutes logged towards their targets yet. The Evening session is still ahead, with the Physical peak from 17:00 to 19:00.',
    rule: null,
  },
  {
    id: 'rings-all-still-open',
    kind: 'session',
    facts: planNotDone,
    line: 'You logged 45 minutes of Admin time for Emails. The Body, Mind, and Heart rings are all still open, with no minutes logged yet. You have the Evening session ahead, with a Physical peak from 17:00 to 19:00.',
    rule: null,
  },
  {
    id: 'the-rings-are-all-still-open',
    kind: 'session',
    facts: quietAfternoon,
    line: 'A 45-minute nap and 1 hour 30 minutes of watching TV this afternoon. The rings are all still open, and the Evening session is ahead.',
    rule: null,
  },
  {
    id: 'no-body-or-mind-target-met',
    kind: 'session',
    facts: eveningHeart,
    line: 'You had a solid dinner with family, reaching your Heart target with 90 minutes logged. While there was no Body or Mind target met today, the time spent in social connection was well-placed. Tomorrow offers the chance for Morning movement.',
    rule: null,
  },
  {
    id: 'no-rings-reached',
    kind: 'session',
    facts: thinEvening,
    line: 'You logged 20 minutes of tidying in the evening. No rings reached their targets today, but tomorrow offers the chance for morning movement from 06:00 to 08:00, which can help you make progress on your Body target.',
    rule: null,
  },
  {
    id: 'twelve-hour-clock',
    kind: 'entry',
    facts: tvEntry,
    line: 'You spent an hour and a half watching TV from 3:00 to 4:30, adding a nice break to your day.',
    rule: null,
  },
  {
    id: 'minds-own-target',
    kind: 'entry',
    facts: meetingEntry,
    line: '"Project sync" added a solid hour toward your Mind focus, bringing you closer to your target.',
    rule: null,
  },
]
