/**
 * The read each review leads with: Keep, Change or Nothing, chosen by fixed
 * rules from the log. The model only words the facts written here, so these
 * rules are the whole of what a review decides.
 */

import {
  dayRead,
  weekRead,
  ringComparisons,
  ringNotes,
  resolveReadAction,
  sanitiseRead,
  plainReadText,
  dayLabel,
  type Row,
  type ReviewRead,
} from '@/lib/review-read'
import { windowsForWake } from '@/lib/ideal-day'
import { NO_FRIENDS_OR_FAMILY, buildReadSystemPrompt, describeRead, REVIEW_VOICE } from '@/lib/prompts'
import { shiftDateString, CATEGORY_LABELS } from '@/lib/types'
import { minutesToTime, timeToMinutes } from '@/lib/time-utils'

const windows = windowsForWake(null)
const D = '2026-11-16' // a Monday

function r(date: string, activity: string, category: string, start: string | null, minutes: number): Row {
  return {
    date,
    activity,
    category,
    start_time: start,
    end_time: start ? minutesToTime(Math.min(24 * 60, timeToMinutes(start) + minutes)) : null,
    duration_minutes: minutes,
  }
}

/** One row on each of `n` days, counting back from `from`. */
const daily = (from: string, n: number, make: (date: string) => Row[]) =>
  Array.from({ length: n }, (_, i) => make(shiftDateString(from, -i))).flat()

const back = (n: number) => shiftDateString(D, -n)

/** Every read made in this file, for the checks that apply to all of them. */
const made: ReviewRead[] = []
const day = (rows: Row[], history: Row[]) => {
  const read = dayRead({ date: D, rows, history, windows })
  made.push(read)
  return read
}
const week = (
  days: { date: string; rows: Row[] }[],
  history: Row[] = [],
  opts: { isPartialWeek?: boolean; weekHeartMinutes?: number } = {}
) => {
  const read = weekRead({
    days,
    history,
    windows,
    isPartialWeek: opts.isPartialWeek ?? false,
    weekHeartMinutes: opts.weekHeartMinutes ?? 0,
  })
  made.push(read)
  return read
}

// A person who ran at 6pm on five days, two to four weeks back.
const runHistory = [20, 18, 16, 14, 12].map((n) => r(back(n), 'Run', 'exercise', '18:00', 30))
const desk = (date: string) => [r(date, 'Desk work', 'deep_work', '09:00', 120)]

describe('the ring lines', () => {
  // Seven days of an hour with friends: Body 0, Mind 0, Heart 80 each.
  const history = daily(back(1), 7, (date) => [r(date, 'Dinner with friends', 'social', '19:00', 60)])

  it('says above, below or about at the ±8 line', () => {
    const { rings, loggedDays } = ringComparisons({ body: 8, focus: 7, social: 72 }, history)
    expect(loggedDays).toBe(7)
    expect(rings.body).toEqual({ usual: 0, relation: 'above' })
    expect(rings.focus).toEqual({ usual: 0, relation: 'about' })
    expect(rings.social).toEqual({ usual: 80, relation: 'below' })
    expect(ringNotes(ringComparisons({ body: 8, focus: 7, social: 72 }, history))).toEqual({
      notes: { body: 'Above your usual 0', focus: 'About your usual', social: 'Below your usual 80' },
    })
  })

  it('has no usual under seven logged days, and says the real count', () => {
    const thin = history.slice(0, 4)
    const comparisons = ringComparisons({ body: 50, focus: 50, social: 50 }, thin)
    expect(comparisons.rings).toEqual({ body: null, focus: null, social: null })
    expect(comparisons.loggedDays).toBe(4)
    expect(ringNotes(comparisons)).toEqual({
      notes: {},
      caption: 'Too little history to compare yet: 4 of the last 28 days have anything logged.',
    })
    expect(ringNotes(ringComparisons({ body: 0, focus: 0, social: 0 }, thin.slice(0, 1))).caption).toBe(
      'Too little history to compare yet: 1 of the last 28 days has anything logged.'
    )
  })
})

describe('a Change never comes from one day', () => {
  /** The last `n` logged days, ending at D, without movement; the run history before them. */
  const withoutMovement = (n: number) => {
    const quiet = daily(back(1), n - 1, desk)
    return { rows: desk(D), history: [...runHistory, ...quiet] }
  }

  it('is not a change when only the reviewed day had no movement', () => {
    const read = day(desk(D), [...runHistory, r(back(1), 'Run', 'exercise', '18:00', 30)])
    expect(read.kind).not.toBe('change')
  })

  it('is not a change on two days', () => {
    const { rows, history } = withoutMovement(2)
    expect(day(rows, [...history, r(back(2), 'Run', 'exercise', '18:00', 30)]).kind).not.toBe('change')
  })

  it('is a change on three days', () => {
    const { rows, history } = withoutMovement(3)
    const read = day(rows, history)
    expect(read.kind).toBe('change')
    expect(read.rule).toBe('change-no-movement')
    expect(read.facts).toEqual([
      'No movement was logged on 3 days in a row: Sat 14 Nov, Sun 15 Nov and Mon 16 Nov.',
      'In the four weeks before, movement was logged on 5 days, usually around 6:00 PM.',
      'One option: Run at 6:00 PM.',
    ])
    expect(read.evidence).toEqual([
      { label: 'Sat 14 Nov', value: 'No movement' },
      { label: 'Sun 15 Nov', value: 'No movement' },
      { label: 'Mon 16 Nov', value: 'No movement' },
      { label: 'Last four weeks', value: 'Movement on 5 days' },
    ])
    expect(read.slot).toEqual({ title: 'Run', startTime: '18:00', durationMinutes: 30 })
    expect(read.timing).toBe(false)
  })

  it('is not a change past a week (eight days): that is the weekly review\'s subject', () => {
    const { rows, history } = withoutMovement(8)
    expect(day(rows, history).kind).not.toBe('change')
  })

  it('lets an unlogged day in the middle neither count nor break the run', () => {
    // D and the day before without movement, nothing logged two days back,
    // then a third day without movement: a run of three.
    const history = [...runHistory, ...desk(back(1)), ...desk(back(3))]
    const read = day(desk(D), history)
    expect(read.rule).toBe('change-no-movement')
    expect(read.facts[0]).toBe('No movement was logged on 3 days in a row: Fri 13 Nov, Sun 15 Nov and Mon 16 Nov.')

    // With a run where the third day was, the unlogged day does not count: two.
    const broken = [...runHistory, ...desk(back(1)), r(back(3), 'Run', 'exercise', '18:00', 30)]
    expect(day(desk(D), broken).kind).not.toBe('change')
  })

  it('does not fire for someone with no movement in their history', () => {
    const history = daily(back(1), 10, desk)
    const read = day(desk(D), history)
    expect(read.rule).not.toBe('change-no-movement')
  })
})

describe('change-focus-outside-window', () => {
  const evening = (date: string) => [r(date, 'Essay draft', 'deep_work', '18:00', 120)]

  it('fires on three days in a row of focus mostly outside the windows', () => {
    const read = day(evening(D), [...evening(back(1)), ...evening(back(2))])
    expect(read.rule).toBe('change-focus-outside-window')
    expect(read.kind).toBe('change')
    expect(read.facts).toEqual([
      'On 3 days in a row, less than half of the focused work fell inside the focus windows (9:00 AM–12:00 PM and 2:00 PM–4:00 PM).',
      'On this day it was 0m of 2h.',
      'One option: Essay draft at 9:00 AM.',
    ])
    expect(read.evidence).toEqual([
      { label: 'Sat 14 Nov', value: '0m of 2h inside' },
      { label: 'Sun 15 Nov', value: '0m of 2h inside' },
      { label: 'Mon 16 Nov', value: '0m of 2h inside' },
    ])
    expect(read.slot).toEqual({ title: 'Essay draft', startTime: '09:00', durationMinutes: 120 })
    expect(read.timing).toBe(true)
  })

  it('does not fire on two', () => {
    expect(day(evening(D), evening(back(1))).kind).not.toBe('change')
  })
})

describe('the Keeps', () => {
  // Eight days of an hour's focus at nine: a usual longest block of 1h.
  const focusHistory = daily(back(1), 8, (date) => [r(date, 'Desk work', 'deep_work', '09:00', 60)])

  it('keep-long-focus fires on a block well past the usual', () => {
    const read = day([r(D, 'Essay draft', 'deep_work', '09:15', 130)], focusHistory)
    expect(read.rule).toBe('keep-long-focus')
    expect(read.kind).toBe('keep')
    expect(read.facts).toEqual([
      'The longest focused block was 2h 10m on "Essay draft", starting at 9:15 AM.',
      'The usual longest block over the last four weeks is 1h.',
      'It started inside the focus window (9:00 AM–12:00 PM).',
    ])
    expect(read.evidence).toEqual([
      { label: 'Longest focused block', value: '2h 10m, from 9:15 AM' },
      { label: 'Usual longest block', value: '1h over 8 days' },
    ])
    expect(read.slot).toEqual({ title: 'Essay draft', startTime: '09:15', durationMinutes: 135 })
    expect(read.timing).toBe(true)
  })

  it('keep-long-focus needs 90 minutes when there is little history', () => {
    expect(day([r(D, 'Essay draft', 'deep_work', '09:00', 80)], []).rule).not.toBe('keep-long-focus')
    expect(day([r(D, 'Essay draft', 'deep_work', '09:00', 90)], []).rule).toBe('keep-long-focus')
  })

  it('keep-long-focus does not fire on a day that is merely usual', () => {
    expect(day([r(D, 'Desk work', 'deep_work', '09:00', 70)], focusHistory).kind).toBe('nothing')
  })

  it('keep-movement-target fires on reaching the target, with no usual to compare', () => {
    const read = day([r(D, 'Run', 'exercise', '18:00', 30)], [])
    expect(read.rule).toBe('keep-movement-target')
    expect(read.facts).toEqual([
      '60 moderate-equivalent minutes of movement, most of it "Run" at 6:00 PM, which reaches the movement target of 45.',
      'It fell inside the Physical peak window (5:00 PM–7:00 PM).',
    ])
    expect(read.evidence).toEqual([{ label: 'Movement', value: '60 of 45 minutes' }])
    expect(read.slot).toEqual({ title: 'Run', startTime: '18:00', durationMinutes: 30 })
    expect(read.timing).toBe(true)
  })

  it('keep-movement-target says the usual when there is one, and is not timing outside a window', () => {
    const history = daily(back(1), 7, (date) => [r(date, 'Walk', 'movement', '12:00', 30)])
    const read = day([r(D, 'Gym', 'exercise', '07:30', 60)].map((x) => ({ ...x, start_time: '12:30', end_time: '13:30' })), history)
    expect(read.rule).toBe('keep-movement-target')
    expect(read.facts).toContain('The usual over the last four weeks is 15 minutes a day.')
    expect(read.evidence).toEqual([
      { label: 'Movement', value: '60 of 45 minutes' },
      { label: 'Usual', value: '15 minutes a day' },
    ])
    expect(read.timing).toBe(false)
  })

  it('keep-movement-target does not fire when reaching it is usual', () => {
    const history = daily(back(1), 7, (date) => [r(date, 'Run', 'exercise', '18:00', 30)])
    expect(day([r(D, 'Run', 'exercise', '18:00', 30)], history).kind).toBe('nothing')
  })

  it('keep-people-time fires on two hours with family against a usual twenty minutes', () => {
    const history = daily(back(1), 7, (date) => [r(date, 'Call with mum', 'calls', '20:00', 20)])
    const read = day([r(D, 'Dinner with family', 'social', '19:00', 120)], history)
    expect(read.rule).toBe('keep-people-time')
    expect(read.facts).toEqual([
      '2h with friends or family, the longest "Dinner with family" at 7:00 PM.',
      'The usual over the last four weeks is 20 minutes a day.',
    ])
    expect(read.evidence).toEqual([
      { label: 'With friends or family', value: '2h' },
      { label: 'Usual', value: '20 minutes a day' },
    ])
    expect(read.slot).toEqual({ title: 'Dinner with family', startTime: '19:00', durationMinutes: 120 })
    expect(read.timing).toBe(false)
  })

  it('keep-people-time does not fire when that much is usual', () => {
    const history = daily(back(1), 7, (date) => [r(date, 'Dinner with family', 'social', '19:00', 90)])
    expect(day([r(D, 'Dinner with family', 'social', '19:00', 120)], history).kind).toBe('nothing')
  })

  it('takes the Keep whose ring is furthest above its usual', () => {
    const today = [r(D, 'Run', 'exercise', '18:00', 30), r(D, 'Dinner with family', 'social', '19:00', 120)]
    // Usual Body 0 and Heart about 41: the run stands further above.
    const quietBody = daily(back(1), 7, (date) => [r(date, 'Call with mum', 'calls', '20:00', 20)])
    expect(day(today, quietBody).rule).toBe('keep-movement-target')
    // Usual Body in the seventies (40 minutes at the gym) and Heart 0: the dinner does.
    const quietHeart = daily(back(1), 7, (date) => [r(date, 'Gym', 'exercise', '07:00', 40)])
    expect(day(today, quietHeart).rule).toBe('keep-people-time')
  })

  it('takes the table order with no usual', () => {
    const today = [r(D, 'Run', 'exercise', '18:00', 30), r(D, 'Dinner with family', 'social', '19:00', 120)]
    expect(day(today, []).rule).toBe('keep-movement-target')
  })
})

describe('an ordinary day', () => {
  const ordinary = [r(D, 'Email', 'shallow_work', '10:00', 60), r(D, 'Lunch', 'meals', '12:00', 30)]

  it('is nothing-ordinary: no slot, no evidence, no advice', () => {
    const read = day(ordinary, [])
    expect(read.kind).toBe('nothing')
    expect(read.rule).toBe('nothing-ordinary')
    expect(read.slot).toBeNull()
    expect(read.evidence).toEqual([])
    expect(read.timing).toBe(false)
    expect(read.facts).toEqual([
      'An ordinary day. There is too little history yet to say what is usual.',
      'Most of the logged time went to Shallow Work (1h) and Meals (30m).',
    ])
    for (const fact of read.facts) expect(fact).not.toMatch(/\b(could|should|option|plan)\b/i)
  })

  it('says it stands apart from nothing when there is history', () => {
    const history = daily(back(1), 7, (date) => [r(date, 'Email', 'shallow_work', '10:00', 60)])
    expect(day(ordinary, history).facts[0]).toBe('An ordinary day: nothing in it stands apart from the last four weeks.')
  })

  it('never names Sleep among the largest categories', () => {
    const read = day([...ordinary, r(D, 'Sleep', 'sleep', '00:00', 480)], [])
    expect(read.facts[1]).toBe('Most of the logged time went to Shallow Work (1h) and Meals (30m).')
  })
})

describe('time with friends or family', () => {
  it('no day read ever states an absence of it', () => {
    const quiet = [
      day([r(D, 'Email', 'shallow_work', '10:00', 60)], []),
      day(desk(D), daily(back(1), 7, desk)),
      day([r(D, 'Run', 'exercise', '18:00', 30)], []),
    ]
    for (const read of quiet) {
      for (const fact of read.facts) {
        expect(fact).not.toMatch(/friends or family|no time with|with people/i)
      }
    }
  })

  const weekDays = (rows: (date: string) => Row[]) =>
    Array.from({ length: 7 }, (_, i) => {
      const date = shiftDateString('2026-11-09', i)
      return { date, rows: rows(date) }
    })

  it('a finished week with none ends its facts with the sentence, whole and without a colon', () => {
    const read = week(weekDays((date) => [r(date, 'Email', 'shallow_work', '10:00', 60)]), [], { weekHeartMinutes: 0 })
    expect(read.facts[read.facts.length - 1]).toBe(NO_FRIENDS_OR_FAMILY)
    expect(NO_FRIENDS_OR_FAMILY).not.toContain(':')
    expect(plainReadText(read)).toContain(NO_FRIENDS_OR_FAMILY)
  })

  it('a week in progress does not get it, and says it is in progress first', () => {
    const read = week(weekDays((date) => [r(date, 'Email', 'shallow_work', '10:00', 60)]).slice(0, 3), [], {
      isPartialWeek: true,
      weekHeartMinutes: 0,
    })
    expect(read.facts[0]).toBe('The week is still in progress.')
    expect(read.facts).not.toContain(NO_FRIENDS_OR_FAMILY)
  })

  it('a week with some does not get it', () => {
    const read = week(weekDays((date) => [r(date, 'Email', 'shallow_work', '10:00', 60)]), [], { weekHeartMinutes: 60 })
    expect(read.facts).not.toContain(NO_FRIENDS_OR_FAMILY)
  })
})

describe('the week rules', () => {
  const MON = '2026-11-09'
  const on = (offset: number) => shiftDateString(MON, offset)
  const weekOf = (byOffset: Record<number, Row[]>, length = 7) =>
    Array.from({ length }, (_, i) => ({ date: on(i), rows: byOffset[i] ?? [] }))
  const histBack = (n: number) => shiftDateString(MON, -n)

  it('week-change-movement-few-days', () => {
    const days = weekOf({
      0: desk(on(0)),
      1: desk(on(1)),
      2: [...desk(on(2)), r(on(2), 'Walk', 'movement', '12:00', 20)],
      3: desk(on(3)),
      4: desk(on(4)),
      5: desk(on(5)),
    })
    const history = [20, 18, 16, 14].map((n) => r(histBack(n), 'Run', 'exercise', '18:00', 30))
    const read = week(days, history, { weekHeartMinutes: 30 })
    expect(read.rule).toBe('week-change-movement-few-days')
    expect(read.facts).toEqual([
      'Movement was logged on 1 of the 6 days.',
      'In the four weeks before, it was logged on 4 days, usually around 6:00 PM.',
      'One option: Run at 6:00 PM.',
    ])
    expect(read.evidence).toEqual([
      { label: 'This week', value: 'Movement on 1 of 6 days' },
      { label: 'Four weeks before', value: 'Movement on 4 days' },
    ])
    expect(read.slot).toEqual({ title: 'Run', startTime: '18:00', durationMinutes: 30 })
  })

  it('week-change-focus-outside-window, from three days of the week itself', () => {
    const late = (d: string) => [r(d, 'Essay draft', 'deep_work', '18:00', 120)]
    const days = weekOf({ 0: late(on(0)), 2: late(on(2)), 3: late(on(3)), 4: desk(on(4)) })
    const read = week(days, [], { weekHeartMinutes: 30 })
    expect(read.rule).toBe('week-change-focus-outside-window')
    expect(read.facts).toEqual([
      'On 3 days (Mon, Wed and Thu), less than half of the focused work fell inside the focus windows (9:00 AM–12:00 PM and 2:00 PM–4:00 PM).',
      'Over the week it was 2h of 8h.',
      'One option: Essay draft at 9:00 AM.',
    ])
    expect(read.evidence).toEqual([
      { label: 'Mon', value: '0m of 2h inside' },
      { label: 'Wed', value: '0m of 2h inside' },
      { label: 'Thu', value: '0m of 2h inside' },
    ])
    expect(read.slot).toEqual({ title: 'Essay draft', startTime: '09:00', durationMinutes: 120 })
    expect(read.timing).toBe(true)
  })

  it('week-keep-focus-start', () => {
    const big = (d: string, start: string) => [r(d, 'Essay draft', 'deep_work', start, 240)]
    const days = weekOf({ 0: desk(on(0)).map((x) => ({ ...x, duration_minutes: 60, end_time: '10:00' })), 1: big(on(1), '09:00'), 3: big(on(3), '09:30') })
    const read = week(days, [], { weekHeartMinutes: 30 })
    expect(read.rule).toBe('week-keep-focus-start')
    expect(read.kind).toBe('keep')
    expect(read.facts).toEqual([
      'Mind reached its target on Tue and Thu.',
      'On both days focused work began around 9:15 AM.',
      'On the other day it did not reach it.',
    ])
    expect(read.evidence).toEqual([
      { label: 'Tue', value: 'from 9:00 AM, 4h focused' },
      { label: 'Thu', value: 'from 9:30 AM, 4h focused' },
    ])
    expect(read.slot).toEqual({ title: 'Essay draft', startTime: '09:15', durationMinutes: 180 })
  })

  it('week-keep-movement-days', () => {
    const run = (d: string) => [r(d, 'Run', 'exercise', '18:00', 30)]
    const days = weekOf({ 0: run(on(0)), 2: run(on(2)), 4: run(on(4)), 5: run(on(5)), 1: desk(on(1)) })
    const read = week(days, [], { weekHeartMinutes: 30 })
    expect(read.rule).toBe('week-keep-movement-days')
    expect(read.facts).toEqual([
      'The movement target was reached on 4 days: Mon, Wed, Fri and Sat.',
      'In the four weeks before, it was reached on 0 days in all.',
      'Those sessions began around 6:00 PM.',
    ])
    expect(read.evidence).toEqual([
      { label: 'Mon', value: '60 of 45 minutes' },
      { label: 'Wed', value: '60 of 45 minutes' },
      { label: 'Fri', value: '60 of 45 minutes' },
      { label: 'Sat', value: '60 of 45 minutes' },
    ])
    expect(read.slot).toEqual({ title: 'Run', startTime: '18:00', durationMinutes: 30 })
  })

  it('week-keep-movement-days needs more than a quarter of the history\'s count', () => {
    const run = (d: string) => [r(d, 'Run', 'exercise', '18:00', 30)]
    const days = weekOf({ 0: run(on(0)), 2: run(on(2)), 4: run(on(4)) })
    const history = Array.from({ length: 12 }, (_, i) => run(histBack(i + 1))).flat()
    expect(week(days, history, { weekHeartMinutes: 30 }).rule).not.toBe('week-keep-movement-days')
  })

  it('week-nothing-ordinary leaves out the rings that reached nothing', () => {
    const days = weekOf({ 0: desk(on(0)), 1: [r(on(1), 'Dinner with friends', 'social', '19:00', 60)] })
    const read = week(days, [], { weekHeartMinutes: 60 })
    expect(read.rule).toBe('week-nothing-ordinary')
    expect(read.facts).toEqual([
      'An ordinary week. There is too little history yet to say what is usual.',
      'Heart reached its target on 1 day.',
    ])
    expect(read.slot).toBeNull()
    expect(read.evidence).toEqual([])
  })
})

describe('what every read holds to', () => {
  it('no fact contains sleep, today, yesterday, tomorrow or a score', () => {
    // A day and a week holding old sleep rows, for good measure.
    made.push(day([r(D, 'Sleep', 'sleep', '00:00', 420), ...desk(D)], [r(back(1), 'Sleep', 'sleep', '00:00', 480)]))
    expect(made.length).toBeGreaterThan(20)
    for (const read of made) {
      for (const fact of read.facts) {
        expect(fact).not.toMatch(/sleep|\btoday\b|\byesterday\b|\btomorrow\b|\bscores?\b|\/100/i)
        // A sentence, never a category label read back with a colon.
        for (const label of Object.values(CATEGORY_LABELS)) expect(fact.startsWith(`${label}:`)).toBe(false)
      }
    }
  })
})

describe('resolveReadAction', () => {
  const keepRead = (slot = { title: 'Essay draft', startTime: '09:15', durationMinutes: 135 }): ReviewRead => ({
    scope: 'day', kind: 'keep', rule: 'keep-long-focus', facts: ['x'], evidence: [], slot, timing: true,
  })
  const changeRead: ReviewRead = {
    scope: 'day', kind: 'change', rule: 'change-no-movement', facts: ['x'], evidence: [],
    slot: { title: 'Run', startTime: '18:00', durationMinutes: 30 }, timing: false,
  }
  const nothingRead: ReviewRead = {
    scope: 'day', kind: 'nothing', rule: 'nothing-ordinary', facts: ['x'], evidence: [], slot: null, timing: false,
  }
  const base = {
    today: D,
    nowMinutes: 20 * 60,
    busyToday: [],
    busyTomorrow: [],
    plannedTitles: { today: [], tomorrow: [] },
  }

  it('offers a Keep its own slot when it is free', () => {
    const action = resolveReadAction({ ...base, read: keepRead(), reviewDate: D })
    expect(action.slot).toEqual({ title: 'Essay draft', startTime: '09:15', durationMinutes: 135 })
    expect(action.label).toBe('Plan "Essay draft" at 9:15 AM tomorrow')
    expect(action.targetDate).toBe('2026-11-17')
    expect(action.href).toBe('/calendar?date=2026-11-17')
  })

  it('gives a Keep the plain label when its slot is taken', () => {
    const action = resolveReadAction({
      ...base, read: keepRead(), reviewDate: D, busyTomorrow: [{ startMinutes: 600, endMinutes: 660 }],
    })
    expect(action.slot).toBeNull()
    expect(action.label).toBe('Plan tomorrow')
  })

  it('moves a Change forward to the next free half hour', () => {
    const action = resolveReadAction({
      ...base, read: changeRead, reviewDate: D, busyTomorrow: [{ startMinutes: 18 * 60, endMinutes: 19 * 60 }],
    })
    expect(action.slot).toEqual({ title: 'Run', startTime: '19:00', durationMinutes: 30 })
    expect(action.label).toBe('Plan "Run" at 7:00 PM tomorrow')
  })

  it('offers no slot for a Change with no free start within three hours', () => {
    const action = resolveReadAction({
      ...base, read: changeRead, reviewDate: D, busyTomorrow: [{ startMinutes: 18 * 60, endMinutes: 22 * 60 }],
    })
    expect(action.slot).toBeNull()
  })

  it('gives Nothing the plain label', () => {
    expect(resolveReadAction({ ...base, read: nothingRead, reviewDate: D }).label).toBe('Plan tomorrow')
  })

  it('offers no slot for a day three days back', () => {
    const action = resolveReadAction({ ...base, read: keepRead(), reviewDate: shiftDateString(D, -3) })
    expect(action.slot).toBeNull()
  })

  it('offers no slot when the title is already planned', () => {
    const action = resolveReadAction({
      ...base, read: keepRead(), reviewDate: D, plannedTitles: { today: [], tomorrow: ['Essay draft'] },
    })
    expect(action.slot).toBeNull()
  })

  it('plans the rest of today for an earlier day before six, with the slot still ahead', () => {
    const yesterday = shiftDateString(D, -1)
    const morning = resolveReadAction({ ...base, read: changeRead, reviewDate: yesterday, nowMinutes: 10 * 60 })
    expect(morning.targetDate).toBe(D)
    expect(morning.label).toBe('Plan "Run" at 6:00 PM today')
    expect(morning.isToday).toBe(true)
    const plain = resolveReadAction({ ...base, read: nothingRead, reviewDate: yesterday, nowMinutes: 10 * 60 })
    expect(plain.label).toBe('Plan the rest of today')
    expect(plain.href).toBe('/calendar')
    // After six, tomorrow.
    expect(resolveReadAction({ ...base, read: changeRead, reviewDate: yesterday, nowMinutes: 19 * 60 }).targetDate).toBe(
      '2026-11-17'
    )
    // Before six but the slot has passed: tomorrow.
    const passed = resolveReadAction({ ...base, read: keepRead(), reviewDate: yesterday, nowMinutes: 11 * 60 })
    expect(passed.targetDate).toBe('2026-11-17')
  })

  it('takes a week to tomorrow, with a slot only for this week or last', () => {
    const weekRead_: ReviewRead = { ...changeRead, scope: 'week' }
    const thisWeek = resolveReadAction({ ...base, read: weekRead_, weekStart: '2026-11-16', nowMinutes: 9 * 60 })
    expect(thisWeek.targetDate).toBe('2026-11-17')
    expect(thisWeek.slot).not.toBeNull()
    expect(resolveReadAction({ ...base, read: weekRead_, weekStart: '2026-11-09' }).slot).not.toBeNull()
    expect(resolveReadAction({ ...base, read: weekRead_, weekStart: '2026-11-02' }).slot).toBeNull()
  })
})

describe('sanitiseRead', () => {
  it('accepts a known kind and one to six facts, cutting each to 240 characters', () => {
    const long = 'x'.repeat(300)
    expect(sanitiseRead({ kind: 'keep', facts: ['A fact.', long] })).toEqual({ kind: 'keep', facts: ['A fact.', 'x'.repeat(240)] })
  })

  it('rejects a wrong kind, too many or too few facts, and non-strings', () => {
    expect(sanitiseRead({ kind: 'praise', facts: ['A fact.'] })).toBeNull()
    expect(sanitiseRead({ kind: 'keep', facts: Array(7).fill('A fact.') })).toBeNull()
    expect(sanitiseRead({ kind: 'keep', facts: [] })).toBeNull()
    expect(sanitiseRead({ kind: 'keep', facts: [42] })).toBeNull()
    expect(sanitiseRead({ kind: 'keep', facts: 'A fact.' })).toBeNull()
    expect(sanitiseRead(null)).toBeNull()
    expect(sanitiseRead('keep')).toBeNull()
  })
})

it('labels days as "Mon 16 Nov"', () => {
  expect(dayLabel('2026-11-16')).toBe('Mon 16 Nov')
  expect(dayLabel('2026-12-01')).toBe('Tue 1 Dec')
})

describe('the read prompt', () => {
  const kinds = ['keep', 'change', 'nothing'] as const

  it('gives the model no wording about friends or family to copy', () => {
    for (const scope of ['day', 'week'] as const) {
      for (const kind of kinds) {
        const prompt = buildReadSystemPrompt(scope, kind)
        expect(prompt).toContain(REVIEW_VOICE)
        expect(prompt).not.toMatch(/friends or family|time with people/i)
        expect(prompt).not.toMatch(/sleep/i)
      }
    }
  })

  it('tells a day line never to say today, yesterday or tomorrow, and a week to say "so far"', () => {
    expect(buildReadSystemPrompt('day', 'keep')).toContain('never write "today", "yesterday" or "tomorrow"')
    expect(buildReadSystemPrompt('week', 'keep')).toContain('"so far"')
  })

  it('gives the model the facts and nothing else', () => {
    expect(describeRead({ facts: ['One.', 'Two.'] })).toBe('THE FACTS. Write only from these:\nOne.\nTwo.')
  })
})
