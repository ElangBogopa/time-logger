/**
 * @jest-environment node
 *
 * Plan against actual. The distinction that carries the whole feature is
 * between a plan you dropped and a plan you simply moved: both have
 * `completed` saying one thing and the clock saying another, and calling a
 * moved plan "missed" would be the app lying about a day that went fine.
 */

import { comparePlanToActual, summarisePlanAdherence } from '@/lib/plan-adherence'
import type { PlanRow, EntryRow } from '@/lib/plan-adherence'

const plan = (title: string, start: string | null, end: string | null, completed = false): PlanRow => ({
  id: title,
  title,
  completed,
  committed_start: start,
  committed_end: end,
})

const entry = (activity: string, start: string, end: string): EntryRow => ({
  activity,
  start_time: start,
  end_time: end,
  duration_minutes: 60,
})

const outcomes = (plans: PlanRow[], entries: EntryRow[], nowMinutes: number | null = null) =>
  comparePlanToActual({ plans, entries, nowMinutes }).map((c) => [c.title, c.outcome])

it('ignores a task that was never given a time', () => {
  // A task in the tray is not a broken promise.
  expect(comparePlanToActual({ plans: [plan('Call the dentist', null, null)], entries: [] })).toEqual([])
})

it('counts a plan you did, when you said you would, as kept', () => {
  const result = comparePlanToActual({
    plans: [plan('Write the memo', '09:00', '10:00', true)],
    entries: [entry('Writing the pricing memo', '09:00', '10:00')],
  })

  expect(result[0].outcome).toBe('kept')
  expect(result[0].loggedActivity).toBe('Writing the pricing memo')
})

it('counts a plan you did at another time as moved, not missed', () => {
  // You kept the promise, just not the hour. Calling this "missed" would be
  // the app being wrong about a day that went fine.
  expect(
    outcomes([plan('Write the memo', '09:00', '10:00', true)], [entry('Writing the pricing memo', '14:00', '15:00')])
  ).toEqual([['Write the memo', 'moved']])
})

it('counts an unticked plan whose hour has passed as missed', () => {
  expect(outcomes([plan('Write the memo', '09:00', '10:00')], [], 12 * 60)).toEqual([
    ['Write the memo', 'missed'],
  ])
})

it('says what took the hour instead', () => {
  const result = comparePlanToActual({
    plans: [plan('Write the memo', '09:00', '10:00')],
    entries: [entry('Email and Slack', '09:00', '10:00')],
    nowMinutes: 12 * 60,
  })

  expect(result[0].outcome).toBe('missed')
  expect(result[0].loggedActivity).toBe('Email and Slack')
})

it('does not judge a plan whose time has not come', () => {
  expect(outcomes([plan('Gym', '18:00', '19:00')], [], 12 * 60)).toEqual([['Gym', 'upcoming']])
})

it('judges the whole day once it is over', () => {
  // No "now" means a finished day: nothing is still upcoming.
  expect(outcomes([plan('Gym', '18:00', '19:00')], [])).toEqual([['Gym', 'missed']])
})

it('needs half the window covered, not a brush past it', () => {
  const memo = [plan('Write the memo', '09:00', '10:00', true)]
  expect(outcomes(memo, [entry('Standup', '09:00', '09:15')])).toEqual([['Write the memo', 'moved']])
  expect(outcomes(memo, [entry('Writing', '09:00', '09:40')])).toEqual([['Write the memo', 'kept']])
})

it('adds up several short entries across the window', () => {
  const result = comparePlanToActual({
    plans: [plan('Deep work', '09:00', '10:00', true)],
    entries: [entry('Drafting', '09:00', '09:25'), entry('Drafting', '09:30', '09:55')],
  })

  expect(result[0].outcome).toBe('kept')
})

it('summarises the day without inventing a score', () => {
  const comparisons = comparePlanToActual({
    plans: [
      plan('Write the memo', '09:00', '10:00', true),
      plan('Call the actuary', '11:00', '11:30', true),
      plan('Gym', '18:00', '19:00'),
    ],
    entries: [entry('Writing the pricing memo', '09:00', '10:00')],
    nowMinutes: 20 * 60,
  })

  expect(summarisePlanAdherence(comparisons)).toMatchObject({ kept: 1, moved: 1, missed: 1, settled: 3 })
})
