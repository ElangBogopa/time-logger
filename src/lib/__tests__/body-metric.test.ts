/**
 * What Body counts.
 *
 * It was a training metric with a broader name: reaching 80 without exercise
 * needed 192 minutes of self-care, and sleep and meals counted toward no
 * metric at all. On 3 Nov 2026 a day with a shower, two meals, a haircut and
 * seven hours of work scored 22, labelled "Running on empty".
 *
 * Body now means "did you look after yourself". Training is still the
 * strongest single lever, but it is no longer the only route.
 */

import {
  calcBody,
  calcBodyDetails,
  BODY_CATS,
  BODY_WEIGHTS,
  BODY_THRESHOLDS,
  EntryRow,
} from '../metrics-calc'

const entry = (category: string, duration_minutes: number): EntryRow => ({
  category,
  duration_minutes,
  date: '2026-11-03',
})

// the real 3 Nov day, minus the entries no body metric should count
const thatDay = [entry('self_care', 30), entry('meals', 120)]

describe('what Body counts', () => {
  it('counts sleep and meals, which fed no metric at all', () => {
    expect(BODY_CATS).toContain('sleep')
    expect(BODY_CATS).toContain('meals')
    expect(calcBody([entry('sleep', 480)])).toBeGreaterThan(0)
    expect(calcBody([entry('meals', 120)])).toBeGreaterThan(0)
  })

  it('keeps exercise the strongest lever', () => {
    const w = BODY_WEIGHTS
    expect(w.exercise.weight).toBeGreaterThan(w.self_care.weight)
    expect(w.self_care.weight).toBeGreaterThan(w.rest.weight)
    expect(w.rest.weight).toBeGreaterThan(w.meals.weight)
    expect(w.meals.weight).toBeGreaterThan(w.sleep.weight)
  })

  it('still scores an hour of training at exactly the target', () => {
    expect(calcBody([entry('exercise', 60)])).toBe(80)
  })

  it('no longer calls a day of upkeep "running on empty"', () => {
    // 22 before this change
    const score = calcBody(thatDay)
    expect(score).toBe(55)
    expect(score).toBeGreaterThanOrEqual(BODY_THRESHOLDS.yellow)
  })

  it('lets a full night plus upkeep reach the target without training', () => {
    expect(calcBody([...thatDay, entry('sleep', 480)])).toBe(80)
  })

  it('still scores nothing when nothing is logged', () => {
    expect(calcBody([entry('deep_work', 480), entry('social', 120)])).toBe(0)
  })

  it('ranks a training day above the same day without it', () => {
    expect(calcBody([...thatDay, entry('exercise', 60)])).toBeGreaterThan(calcBody(thatDay))
  })
})

describe('the breakdown explains the score', () => {
  it('scores each category on the same scale as the headline', () => {
    // calcBodyDetails kept the old sqrt-and-caps maths after calcBody moved
    // to the shared curve, so the parts no longer related to the whole.
    const { categoryScores } = calcBodyDetails([entry('exercise', 60)])
    expect(categoryScores.exercise).toBe(calcBody([entry('exercise', 60)]))
  })

  it('agrees with the headline for every single-category day', () => {
    for (const cat of Object.keys(BODY_WEIGHTS)) {
      const day = [entry(cat, 90)]
      expect(calcBodyDetails(day).categoryScores[cat]).toBe(calcBody(day))
    }
  })

  it('reports minutes as logged, not weighted', () => {
    const { totalMinutes, breakdown } = calcBodyDetails(thatDay)
    expect(totalMinutes).toBe(150)
    expect(breakdown.self_care).toBe(30)
    expect(breakdown.meals).toBe(120)
  })

  it('folds movement into exercise in the breakdown', () => {
    const { breakdown } = calcBodyDetails([entry('movement', 30), entry('exercise', 30)])
    expect(breakdown.exercise).toBe(60)
    expect(breakdown.movement).toBeUndefined()
  })
})
