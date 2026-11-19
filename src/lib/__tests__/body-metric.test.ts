/**
 * What Body counts.
 *
 * Body is movement. Exercise and movement carry the ring, counted in
 * moderate-equivalent minutes the way the physical activity guidelines count
 * them; 45 of them is the target and scores 80. Rest and self-care are a
 * small part on a curve of their own that approaches 50 and never passes it,
 * and movement closes the gap from there:
 *
 *   body = care + (100 − care) × curve(movement), shown up to 99
 *
 * Meals and sleep count for nothing. Sleep is no longer offered; rows saved
 * as sleep before it was removed must still re-score without error.
 */

import {
  calcBody,
  calcBodyDetails,
  calcFocus,
  calcSocial,
  countMetricsOnTarget,
  classifyIntensity,
  exerciseMinutes,
  BODY_CATS,
  UPKEEP_WEIGHTS,
  UPKEEP_CEILING,
  BODY_THRESHOLDS,
  EXERCISE_TARGET,
  EntryRow,
} from '../metrics-calc'

const entry = (category: string, duration_minutes: number, activity?: string): EntryRow => ({
  category,
  duration_minutes,
  date: '2026-11-03',
  activity,
})

// a thorough day of rest and self-care, with no movement in it
const perfectCare = [entry('self_care', 60), entry('rest', 120)]

describe('the worked examples', () => {
  it('45 min gym, nothing else → 80', () => {
    expect(calcBody([entry('exercise', 45, 'Gym')])).toBe(80)
  })

  it('45 min gym + 20 min shower → 83', () => {
    expect(calcBody([entry('exercise', 45, 'Gym'), entry('self_care', 20, 'Shower')])).toBe(83)
  })

  it('20 min run, nothing else → 76', () => {
    expect(calcBody([entry('exercise', 20, 'Run')])).toBe(76)
  })

  it('45 min walk, nothing else → 55', () => {
    expect(calcBody([entry('movement', 45, 'Walk')])).toBe(55)
  })

  it('60 min self-care + 2 h rest, no movement → 47', () => {
    expect(calcBody(perfectCare)).toBe(47)
  })

  it('4 h self-care, no movement → 50 at most', () => {
    expect(calcBody([entry('self_care', 240)])).toBeLessThanOrEqual(50)
  })

  it('8 h sleep + three meals, nothing else → 0', () => {
    expect(
      calcBody([entry('sleep', 480), entry('meals', 30), entry('meals', 30), entry('meals', 45)])
    ).toBe(0)
  })
})

describe('rest and self-care cannot stand in for movement', () => {
  it('a day of only rest and self-care never passes 50', () => {
    for (const restMinutes of [0, 30, 120, 240, 480, 720]) {
      for (const careMinutes of [0, 30, 120, 240, 480, 720]) {
        const score = calcBody([entry('rest', restMinutes), entry('self_care', careMinutes)])
        expect(score).toBeLessThanOrEqual(UPKEEP_CEILING)
        expect(score).toBeLessThanOrEqual(50)
      }
    }
  })

  it('the movement target alone scores exactly 80', () => {
    expect(calcBody([entry('exercise', EXERCISE_TARGET)])).toBe(80)
    expect(calcBody([entry('exercise', EXERCISE_TARGET, 'Gym')])).toBe(80)
  })

  it('meals and sleep add nothing to Body', () => {
    const without = [entry('exercise', 30, 'Gym'), entry('self_care', 20)]
    const withThem = [...without, entry('meals', 120), entry('sleep', 480)]
    expect(calcBody(withThem)).toBe(calcBody(without))
    expect(BODY_CATS).not.toContain('sleep')
    expect(BODY_CATS).not.toContain('meals')
    expect(UPKEEP_WEIGHTS.meals).toBeUndefined()
    expect(UPKEEP_WEIGHTS.sleep).toBeUndefined()
  })

  it('ranks the same day higher once movement is in it', () => {
    expect(calcBody([...perfectCare, entry('exercise', 45, 'Gym')])).toBeGreaterThan(calcBody(perfectCare))
  })

  it('scores nothing when nothing of the body was logged', () => {
    expect(calcBody([entry('deep_work', 480), entry('social', 120)])).toBe(0)
  })

  it('never shows 100', () => {
    expect(calcBody([entry('exercise', 600, 'Run'), entry('self_care', 600)])).toBeLessThanOrEqual(99)
  })
})

describe('old days re-score without error', () => {
  // Rows as they were saved before sleep was removed.
  const oldDay = [
    entry('sleep', 480),
    entry('meals', 90),
    entry('exercise', 30, 'Gym'),
    entry('not_a_category', 60, 'Something'),
  ]

  it('goes through every scorer with a finite 0–99 result', () => {
    for (const score of [calcBody(oldDay), calcFocus(oldDay), calcSocial(oldDay)]) {
      expect(Number.isFinite(score)).toBe(true)
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(99)
    }
    const details = calcBodyDetails(oldDay)
    expect(Number.isFinite(details.totalMinutes)).toBe(true)
    for (const value of Object.values(details.categoryScores)) expect(Number.isFinite(value)).toBe(true)
    const onTarget = countMetricsOnTarget(oldDay)
    expect(onTarget).toBeGreaterThanOrEqual(0)
    expect(onTarget).toBeLessThanOrEqual(3)
  })

  it('leaves the sleep and meals rows out of the Body breakdown', () => {
    const { breakdown, totalMinutes } = calcBodyDetails(oldDay)
    expect(breakdown.sleep).toBeUndefined()
    expect(breakdown.meals).toBeUndefined()
    expect(totalMinutes).toBe(30)
  })
})

describe('exercise is ranked by intensity, not just minutes', () => {
  it('counts vigorous work double and light movement half', () => {
    // WHO asks for 150 minutes of moderate a week or 75 of vigorous, so
    // vigorous is worth twice as much per minute.
    expect(classifyIntensity('exercise', 'Morning run')).toBe('vigorous')
    expect(classifyIntensity('exercise', 'Gym: leg day')).toBe('moderate')
    expect(classifyIntensity('exercise', 'Walk to the shops')).toBe('light')
    expect(classifyIntensity('movement', 'Stretching')).toBe('light')
  })

  it('treats an unrecognised exercise entry as moderate, not as nothing', () => {
    // The person called it exercise; the app should not argue.
    expect(classifyIntensity('exercise', 'Kettlebell complexes')).toBe('moderate')
    expect(classifyIntensity('exercise', undefined)).toBe('moderate')
  })

  it('treats bare movement as light', () => {
    expect(classifyIntensity('movement', undefined)).toBe('light')
  })

  it('converts a session into moderate-equivalent minutes', () => {
    expect(exerciseMinutes([entry('exercise', 30, 'Run')])).toBe(60)
    expect(exerciseMinutes([entry('exercise', 30, 'Gym')])).toBe(30)
    expect(exerciseMinutes([entry('movement', 30, 'Walk the dog')])).toBe(15)
  })

  it('scores a short hard session above a long gentle one', () => {
    const run = calcBody([entry('exercise', 25, 'Interval run')])
    const walk = calcBody([entry('movement', 45, 'Walk')])
    expect(run).toBeGreaterThan(walk)
  })

  it('puts a session at the target on the published 80', () => {
    const { exerciseScore } = calcBodyDetails([entry('exercise', EXERCISE_TARGET, 'Gym')])
    expect(exerciseScore).toBe(80)
  })

  it('lets twenty minutes of running beat a whole day of looking after yourself', () => {
    expect(calcBody([entry('exercise', 20, 'Morning run')])).toBeGreaterThan(calcBody(perfectCare))
    expect(calcBody([entry('exercise', 20, 'Morning run')])).toBeGreaterThan(70)
  })

  it('reaches a strong day when both are there', () => {
    expect(calcBody([...perfectCare, entry('exercise', 45, 'Gym')])).toBeGreaterThanOrEqual(BODY_THRESHOLDS.green)
  })
})

describe('the breakdown explains the score', () => {
  it('adds up to the headline', () => {
    const day = [...perfectCare, entry('exercise', 45, 'Gym')]
    const { categoryScores } = calcBodyDetails(day)
    const summed = Object.values(categoryScores).reduce((a, b) => a + b, 0)
    // within rounding of the headline, which is the point of a breakdown
    expect(Math.abs(summed - calcBody(day))).toBeLessThanOrEqual(3)
  })

  it('splits care between rest and self-care only', () => {
    const { categoryScores } = calcBodyDetails([...perfectCare, entry('meals', 60), entry('sleep', 480)])
    expect(Object.keys(categoryScores).sort()).toEqual(['exercise', 'rest', 'self_care'])
  })

  it('separates the two halves so the sheet can say which is missing', () => {
    const { exerciseScore, upkeepScore } = calcBodyDetails(perfectCare)
    expect(exerciseScore).toBe(0)
    expect(upkeepScore).toBeGreaterThan(70)
  })

  it('reports minutes as logged, not weighted, for Body categories only', () => {
    const { totalMinutes, breakdown } = calcBodyDetails([entry('self_care', 30), entry('meals', 120)])
    expect(totalMinutes).toBe(30)
    expect(breakdown.self_care).toBe(30)
    expect(breakdown.meals).toBeUndefined()
  })

  it('folds movement into exercise in the breakdown, and records the intensity', () => {
    const { breakdown, intensities } = calcBodyDetails([
      entry('movement', 30, 'Walk'),
      entry('exercise', 30, 'Run'),
    ])
    expect(breakdown.exercise).toBe(60)
    expect(breakdown.movement).toBeUndefined()
    expect(intensities).toEqual({ light: 30, vigorous: 30 })
  })

  it('keeps self-care worth more per minute than rest', () => {
    expect(UPKEEP_WEIGHTS.self_care).toBeGreaterThan(UPKEEP_WEIGHTS.rest)
  })
})
