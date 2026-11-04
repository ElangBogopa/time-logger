/**
 * What Body counts.
 *
 * Two corrections, a day apart, pulling in opposite directions.
 *
 * The first: Body was a training metric with a broader name. A day with a
 * shower, two meals and seven hours of work scored 22 and was labelled
 * "Running on empty". Sleep and meals fed no metric at all.
 *
 * The second, and the one this file now pins: the fix went too far. Upkeep
 * and exercise were summed into one pot against one target, so eight hours
 * of sleep, three meals and a shower came to 45 weighted minutes against a
 * target of 48 — a score of 78 on a day with no exercise in it. A metric
 * called Body should not say that.
 *
 * So upkeep is given a curve that approaches a ceiling just under 70 and
 * never reaches it, and exercise closes the gap from there to the top. A
 * first attempt capped upkeep at 45 instead, which is a different claim
 * entirely: it called a flawless day of looking after yourself a 43. The
 * rule is "upkeep cannot take you past 70", not "upkeep barely counts".
 *
 * Exercise is counted in moderate-equivalent minutes, the way the physical
 * activity guidelines count it.
 */

import {
  calcBody,
  calcBodyDetails,
  classifyIntensity,
  exerciseMinutes,
  BODY_CATS,
  UPKEEP_WEIGHTS,
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

// the real 3 Nov day, minus the entries no body metric should count
const thatDay = [entry('self_care', 30), entry('meals', 120)]
// a thorough day of looking after yourself, with no training in it
const perfectUpkeep = [
  entry('sleep', 480),
  entry('meals', 150),
  entry('self_care', 90),
  entry('rest', 60),
]

describe('upkeep cannot stand in for exercise', () => {
  it('keeps a day with no exercise out of the seventies, however well kept', () => {
    const score = calcBody(perfectUpkeep)
    expect(score).toBeLessThan(70)
    // but a thorough day of looking after yourself is a good day, not a
    // failing one: the curve approaches the ceiling rather than stopping short
    expect(score).toBeGreaterThanOrEqual(60)
  })

  it('approaches the ceiling without ever crossing it', () => {
    // Twelve hours of sleep, four of self-care, four of rest and four of
    // meals. Absurd, and still not a seventy.
    const absurd = [
      entry('sleep', 720),
      entry('meals', 240),
      entry('self_care', 240),
      entry('rest', 240),
    ]
    expect(calcBody(absurd)).toBeLessThan(70)
    expect(calcBody(absurd)).toBeGreaterThan(calcBody(perfectUpkeep))
  })

  it('no longer scores a night of sleep and some meals at 78', () => {
    const ordinary = [entry('sleep', 480), entry('meals', 90), entry('self_care', 30)]
    expect(calcBody(ordinary)).toBeLessThan(60)
  })

  it('still refuses to call a day of upkeep "running on empty"', () => {
    expect(calcBody(thatDay)).toBeGreaterThanOrEqual(10)
  })

  it('counts sleep and meals, which once fed no metric at all', () => {
    expect(BODY_CATS).toContain('sleep')
    expect(BODY_CATS).toContain('meals')
    expect(calcBody([entry('sleep', 480)])).toBeGreaterThan(0)
  })

  it('ranks the same day higher once training is in it', () => {
    expect(calcBody([...perfectUpkeep, entry('exercise', 45, 'Gym')])).toBeGreaterThan(
      calcBody(perfectUpkeep)
    )
  })

  it('scores nothing when nothing of the body was logged', () => {
    expect(calcBody([entry('deep_work', 480), entry('social', 120)])).toBe(0)
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
    // 45 moderate-equivalent minutes is the target, which scores 80 on the
    // exercise half before upkeep is added.
    const { exerciseScore } = calcBodyDetails([entry('exercise', EXERCISE_TARGET, 'Gym')])
    expect(exerciseScore).toBe(80)
  })

  it('lets exercise open the part of the scale upkeep cannot reach', () => {
    // Twenty minutes of running beats any amount of sleeping and showering.
    expect(calcBody([entry('exercise', 20, 'Morning run')])).toBeGreaterThan(calcBody(perfectUpkeep))
    expect(calcBody([entry('exercise', 20, 'Morning run')])).toBeGreaterThan(70)
  })

  it('reaches a strong day when both halves are there', () => {
    expect(calcBody([...perfectUpkeep, entry('exercise', 45, 'Gym')])).toBeGreaterThanOrEqual(
      BODY_THRESHOLDS.green
    )
  })
})

describe('the breakdown explains the score', () => {
  it('adds up to the headline', () => {
    const day = [...perfectUpkeep, entry('exercise', 45, 'Gym')]
    const { categoryScores } = calcBodyDetails(day)
    const summed = Object.values(categoryScores).reduce((a, b) => a + b, 0)
    // within rounding of the headline, which is the point of a breakdown
    expect(Math.abs(summed - calcBody(day))).toBeLessThanOrEqual(4)
  })

  it('separates the two halves so the sheet can say which is missing', () => {
    const { exerciseScore, upkeepScore } = calcBodyDetails(perfectUpkeep)
    expect(exerciseScore).toBe(0)
    expect(upkeepScore).toBeGreaterThan(70)
  })

  it('reports minutes as logged, not weighted', () => {
    const { totalMinutes, breakdown } = calcBodyDetails(thatDay)
    expect(totalMinutes).toBe(150)
    expect(breakdown.self_care).toBe(30)
    expect(breakdown.meals).toBe(120)
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

  it('keeps self-care worth more per minute than a meal, and a meal than sleep', () => {
    expect(UPKEEP_WEIGHTS.self_care).toBeGreaterThan(UPKEEP_WEIGHTS.rest)
    expect(UPKEEP_WEIGHTS.rest).toBeGreaterThan(UPKEEP_WEIGHTS.meals)
    expect(UPKEEP_WEIGHTS.meals).toBeGreaterThan(UPKEEP_WEIGHTS.sleep)
  })
})
