/**
 * The Mind metric's weighting.
 *
 * calcFocus skips any category without a weight, so meetings — absent from
 * FOCUS_WEIGHTS — scored nothing. Six hours of client calls read as a blank
 * day while six hours of email read as 45%, which ranks a working day
 * backwards.
 */

import { calcFocus, calcFocusDetails, FOCUS_WEIGHTS, FOCUS_TARGET, FOCUS_THRESHOLDS, EntryRow } from '../metrics-calc'

const entry = (category: string, duration_minutes: number): EntryRow => ({
  category,
  duration_minutes,
  date: '2026-11-02',
})

const hours = (n: number) => n * 60

describe('what Mind counts', () => {
  it('ranks the kinds of work in the order a person would', () => {
    expect(FOCUS_WEIGHTS.deep_work).toBeGreaterThan(FOCUS_WEIGHTS.learning)
    expect(FOCUS_WEIGHTS.learning).toBeGreaterThan(FOCUS_WEIGHTS.creating)
    expect(FOCUS_WEIGHTS.creating).toBeGreaterThan(FOCUS_WEIGHTS.meetings)
    expect(FOCUS_WEIGHTS.meetings).toBeGreaterThan(FOCUS_WEIGHTS.shallow_work)
  })

  it('counts meetings, which used to score nothing', () => {
    expect(calcFocus([entry('meetings', hours(6))])).toBeGreaterThan(0)
  })

  it('ranks a day of meetings above a day of email', () => {
    const meetings = calcFocus([entry('meetings', hours(6))])
    const email = calcFocus([entry('shallow_work', hours(6))])
    expect(meetings).toBeGreaterThan(email)
  })

  it('still keeps a day with no deep work short of green', () => {
    // Meetings count, but they should not be a route to a green Mind on
    // their own — the deep work hierarchy is the point of the weighting.
    const sixHoursOfMeetings = calcFocus([entry('meetings', hours(6))])
    expect(sixHoursOfMeetings).toBeLessThan(FOCUS_THRESHOLDS.green)
    expect(sixHoursOfMeetings).toBeGreaterThanOrEqual(FOCUS_THRESHOLDS.yellow)
  })

  it('gives a full day of light work a real but modest score', () => {
    // The thing that made an eight-hour admin day read as nothing.
    expect(calcFocus([entry('shallow_work', hours(8))])).toBe(60)
  })

  it('reaches 100 on four hours of deep work', () => {
    expect(calcFocus([entry('deep_work', FOCUS_TARGET)])).toBe(100)
  })

  it('ignores categories that belong to other metrics', () => {
    expect(calcFocus([entry('exercise', hours(2)), entry('social', hours(2))])).toBe(0)
  })

  it('includes meetings in the breakdown that explains the score', () => {
    // The detail sheet kept its own copy of the weights; a category scored but
    // missing from the breakdown would be invisible in the explanation.
    const { breakdown } = calcFocusDetails([entry('meetings', hours(2))])
    expect(breakdown.meetings).toBe(hours(2))
  })
})
