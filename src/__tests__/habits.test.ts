/**
 * @jest-environment node
 *
 * Habits read from the log. Strict enough that a coincidence is not taken
 * for a habit, loose enough to recognise a thing by another name.
 */

import { usualFor, usualWakeMinutes, recurringActivities, type HabitEntry } from '@/lib/habits'
import type { TimeCategory } from '@/lib/types'

const entry = (date: string, activity: string, category: TimeCategory, start: string, end: string): HabitEntry => {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return { date, activity, category, start_time: start, end_time: end, duration_minutes: eh * 60 + em - (sh * 60 + sm) }
}

const runs = [
  entry('2026-11-02', 'Ran 5k', 'exercise', '18:00', '19:00'),
  entry('2026-11-04', 'Ran 5k', 'exercise', '18:15', '19:00'),
  entry('2026-11-06', 'Long run', 'exercise', '17:45', '19:15'),
  entry('2026-11-09', 'Ran 5k', 'exercise', '18:00', '18:45'),
]

describe('usualFor', () => {
  it('finds the usual hour and length of a thing by name', () => {
    // Lengths of 60, 45, 90 and 45: the middle is 52.5, which is an hour
    // on a quarter-hour grid.
    expect(usualFor('Run', 'exercise', runs)).toMatchObject({
      startMinutes: 18 * 60,
      durationMinutes: 60,
      basis: 'activity',
      days: 4,
    })
  })

  it('recognises it by another name', () => {
    const gym = [
      entry('2026-11-02', 'Weights session', 'exercise', '07:00', '08:00'),
      entry('2026-11-04', 'Gym', 'exercise', '07:00', '08:15'),
      entry('2026-11-06', 'Lifting', 'exercise', '07:15', '08:15'),
    ]
    expect(usualFor('Gym', 'exercise', gym)).toMatchObject({ startMinutes: 7 * 60, basis: 'activity', days: 3 })
  })

  it('needs three separate days before calling it a habit', () => {
    expect(usualFor('Run', null, runs.slice(0, 2))).toBeNull()
    // Three entries on one day are still one day.
    const oneDay = [0, 1, 2].map(() => entry('2026-11-02', 'Ran 5k', 'exercise', '18:00', '19:00'))
    expect(usualFor('Run', null, oneDay)).toBeNull()
  })

  it('falls back to the kind of thing when the name is new', () => {
    expect(usualFor('Yoga', 'exercise', runs)).toMatchObject({ startMinutes: 18 * 60, basis: 'category' })
  })

  it('has no opinion on something new with no category', () => {
    expect(usualFor('Yoga', null, runs)).toBeNull()
  })

  it('gives a length but no hour when the hour wanders', () => {
    const scattered = [
      entry('2026-11-02', 'Reading', 'learning', '07:00', '07:30'),
      entry('2026-11-03', 'Reading', 'learning', '13:00', '13:30'),
      entry('2026-11-04', 'Reading', 'learning', '21:00', '21:30'),
      entry('2026-11-05', 'Reading', 'learning', '10:00', '10:30'),
    ]
    expect(usualFor('Reading', 'learning', scattered)).toMatchObject({ startMinutes: null, durationMinutes: 30 })
  })

  it('keeps the length within what a block can be', () => {
    const marathons = ['02', '03', '04'].map((d) => entry(`2026-11-${d}`, 'Hackathon', 'deep_work', '09:00', '17:00'))
    expect(usualFor('Hackathon', 'deep_work', marathons)?.durationMinutes).toBe(180)
  })
})

describe('usualWakeMinutes', () => {
  const slept = (date: string, end: string) => entry(date, 'Slept', 'sleep', '00:00', end)

  it('is the usual end of the night', () => {
    expect(usualWakeMinutes([slept('2026-11-02', '07:00'), slept('2026-11-03', '07:10'), slept('2026-11-04', '06:45')])).toBe(7 * 60)
  })

  it('needs a few mornings', () => {
    expect(usualWakeMinutes([slept('2026-11-02', '07:00'), slept('2026-11-03', '07:00')])).toBeNull()
  })

  it('ignores an afternoon nap and the first half of a night', () => {
    const entries = [
      slept('2026-11-02', '07:00'),
      slept('2026-11-03', '07:00'),
      slept('2026-11-04', '07:00'),
      entry('2026-11-04', 'Nap', 'sleep', '14:00', '15:00'),
      entry('2026-11-04', 'Went to bed', 'sleep', '23:00', '23:59'),
    ]
    expect(usualWakeMinutes(entries)).toBe(7 * 60)
  })
})

describe('recurringActivities', () => {
  // 2026-11-12 is a Thursday.
  const log = [
    ...runs,
    entry('2026-11-02', 'Reserving model build', 'deep_work', '09:00', '11:30'),
    entry('2026-11-03', 'Reserving model build', 'deep_work', '09:00', '11:30'),
    entry('2026-11-05', 'Reserving model build', 'deep_work', '09:00', '11:30'),
    entry('2026-10-29', 'Called home', 'calls', '20:00', '20:30'),
    entry('2026-11-05', 'Called home', 'calls', '20:00', '20:30'),
    entry('2026-11-02', 'Called home', 'calls', '20:00', '20:30'),
    // Daily, and none of the planner's business:
    ...['02', '03', '04', '05'].flatMap((d) => [
      entry(`2026-11-${d}`, 'Slept', 'sleep', '00:00', '07:00'),
      entry(`2026-11-${d}`, 'Lunch', 'meals', '12:30', '13:00'),
      entry(`2026-11-${d}`, 'Pricing review', 'meetings', '14:00', '15:00'),
      entry(`2026-11-${d}`, 'Watched a series', 'entertainment', '21:00', '22:00'),
    ]),
    entry('2026-11-03', 'Dentist', 'errands', '16:00', '17:00'),
  ]

  it('offers what recurs, most typical of that weekday first', () => {
    const offered = recurringActivities(log, { forDate: '2026-11-12' })
    expect(offered.map((o) => o.title)).toEqual(['Called home', 'Reserving model build', 'Ran 5k'])
    expect(offered[0]).toMatchObject({ onThisWeekday: 2, days: 3 })
  })

  it('leaves out sleep, meals, meetings and television however regular', () => {
    const titles = recurringActivities(log, { forDate: '2026-11-12', limit: 10 }).map((o) => o.title)
    for (const dull of ['Slept', 'Lunch', 'Pricing review', 'Watched a series']) expect(titles).not.toContain(dull)
  })

  it('leaves out a one-off', () => {
    expect(recurringActivities(log, { forDate: '2026-11-12', limit: 10 }).map((o) => o.title)).not.toContain('Dentist')
  })

  it('does not offer what is already planned, by whatever name', () => {
    const offered = recurringActivities(log, { forDate: '2026-11-12', alreadyPlanned: ['Run', 'Call home'] })
    expect(offered.map((o) => o.title)).toEqual(['Reserving model build'])
  })

  it('uses the wording you use most', () => {
    const offered = recurringActivities(runs, { forDate: '2026-11-12' })
    expect(offered[0].title).toBe('Ran 5k')
  })
})
