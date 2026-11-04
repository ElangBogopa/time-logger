/**
 * The shared metric curve.
 *
 * Whoop's approach: accumulate load linearly, display it on a scale that gets
 * harder the further you go, so the top of the range is not a place you visit
 * on an ordinary good day. All three metrics were linear-and-capped (Body was
 * sqrt-with-caps), which meant 100 arrived at the target and nothing beyond it
 * registered at all.
 */

import {
  calcBodyDetails,
  EXERCISE_TARGET,
  saturatingScore,
  calcBody,
  calcFocus,
  calcSocial,
  MAX_SCORE,
  FOCUS_TARGET,
  SOCIAL_TARGET,
  EntryRow,
} from '../metrics-calc'

const entry = (category: string, duration_minutes: number): EntryRow => ({
  category,
  duration_minutes,
  date: '2026-11-02',
})

describe('saturatingScore', () => {
  it('scores 80 at the target, whatever the target is', () => {
    expect(saturatingScore(100, 100)).toBe(80)
    expect(saturatingScore(240, 240)).toBe(80)
    expect(saturatingScore(7, 7)).toBe(80)
  })

  it('is generous early and stingy late', () => {
    expect(saturatingScore(25, 100)).toBe(33)
    expect(saturatingScore(50, 100)).toBe(55)
    expect(saturatingScore(75, 100)).toBe(70)
    expect(saturatingScore(150, 100)).toBe(91)
    expect(saturatingScore(200, 100)).toBe(96)
  })

  it('buys less and less for the same extra effort', () => {
    const first = saturatingScore(60, 240) - saturatingScore(0, 240)
    const fourth = saturatingScore(240, 240) - saturatingScore(180, 240)
    expect(first).toBeGreaterThan(fourth * 2)
  })

  it('never reaches 100, however much is logged', () => {
    expect(saturatingScore(1_000_000, 60)).toBe(MAX_SCORE)
    expect(MAX_SCORE).toBeLessThan(100)
  })

  it('is zero for nothing, and safe with a nonsense target', () => {
    expect(saturatingScore(0, 240)).toBe(0)
    expect(saturatingScore(-5, 240)).toBe(0)
    expect(saturatingScore(60, 0)).toBe(0)
  })

  it('rises monotonically', () => {
    let previous = -1
    for (let load = 0; load <= 600; load += 15) {
      const score = saturatingScore(load, 240)
      expect(score).toBeGreaterThanOrEqual(previous)
      previous = score
    }
  })
})

describe('all three metrics use it', () => {
  it('scores 80 at each target', () => {
    expect(calcFocus([entry('deep_work', FOCUS_TARGET)])).toBe(80)
    expect(calcSocial([entry('social', SOCIAL_TARGET)])).toBe(80)
    // Body is the exception, and deliberately so: it is two scores, and
    // exercise carries 0.75 of the total, so hitting the exercise target
    // puts the half at 80 and the headline at 60. A strong Body day needs
    // training and upkeep, which is the whole point of the split.
    expect(calcBodyDetails([entry('exercise', EXERCISE_TARGET)]).exerciseScore).toBe(80)
  })

  it('leaves none of them able to hit 100', () => {
    expect(calcFocus([entry('deep_work', 1440)])).toBeLessThan(100)
    expect(calcSocial([entry('social', 1440)])).toBeLessThan(100)
    expect(calcBody([entry('exercise', 1440)])).toBeLessThan(100)
  })

  it('still rewards a balanced Body day over a single long session', () => {
    const balanced = calcBody([entry('exercise', 45), entry('self_care', 30), entry('rest', 20)])
    const onlyExercise = calcBody([entry('exercise', 45)])
    expect(balanced).toBeGreaterThan(onlyExercise)
  })

  it('counts movement, but not as if it were training', () => {
    // It used to be folded into exercise at full weight, so an hour's walk
    // scored the same as an hour in the gym. Light activity is worth half a
    // moderate minute now, the way the guidelines count it.
    const walk = calcBody([entry('movement', 60)])
    const gym = calcBody([entry('exercise', 60)])
    expect(walk).toBeGreaterThan(0)
    expect(walk).toBeLessThan(gym)
  })
})
