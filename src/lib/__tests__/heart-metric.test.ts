/**
 * The third hero metric: Heart.
 *
 * It used to be called Social and counted only `social` and `calls`, so a
 * church service — in-person connection by its own definition — scored zero,
 * and after `faith` was added as a category it fed no metric at all. The
 * triad is now Body / Mind / Heart, and Heart is about what sustains you
 * rather than only who you saw.
 */

import { calcSocial, calcSocialDetails, calcBody, calcFocus, WITH_FRIENDS_OR_FAMILY_KEY, SOCIAL_CATS, SOCIAL_TARGET, METRIC_LABELS, EntryRow } from '../metrics-calc'

// Hitting the target scores 80, not 100 — see saturatingScore.
const AT_TARGET = 80

const entry = (category: string, duration_minutes: number): EntryRow => ({
  category,
  duration_minutes,
  date: '2026-11-02',
})

describe('the triad', () => {
  it('is Body, Mind and Heart', () => {
    expect(METRIC_LABELS).toEqual({ body: 'Body', focus: 'Mind', social: 'Heart' })
  })

  it('keeps the old data keys, so stored trends still read', () => {
    // Only the display names changed; the API and client caches still use these.
    expect(Object.keys(METRIC_LABELS).sort()).toEqual(['body', 'focus', 'social'])
  })
})

describe('what Heart counts', () => {
  it('counts time with people', () => {
    expect(SOCIAL_CATS).toContain('social')
    expect(SOCIAL_CATS).toContain('calls')
  })

  it('counts faith', () => {
    expect(SOCIAL_CATS).toContain('faith')
    expect(calcSocial([entry('faith', SOCIAL_TARGET)])).toBe(AT_TARGET)
  })

  it('does not require faith — an hour with friends still maxes it', () => {
    // The property that keeps this fair to someone with no religious practice.
    expect(calcSocial([entry('social', SOCIAL_TARGET)])).toBe(AT_TARGET)
  })

  it('adds faith to time with people rather than replacing it', () => {
    const half = SOCIAL_TARGET / 2
    const halfScore = calcSocial([entry('calls', half)])
    const together = calcSocial([entry('calls', half), entry('faith', half)])
    expect(together).toBe(AT_TARGET)
    expect(together).toBeGreaterThan(halfScore)
  })

  it('still ignores work interaction', () => {
    // meetings are Ops; the metric is about connection, not interaction
    expect(calcSocial([entry('meetings', 180)])).toBe(0)
  })

  it('scores nothing for a day with neither', () => {
    expect(calcSocial([entry('deep_work', 480), entry('meals', 60)])).toBe(0)
  })
})

describe('time with friends or family, whatever the activity', () => {
  const row = (category: string, activity: string, duration_minutes: number): EntryRow => ({
    category,
    activity,
    duration_minutes,
    date: '2026-11-02',
  })

  it('counts video games with friends toward Heart and not Mind', () => {
    const rows = [row('entertainment', 'Video games with friends', 60)]
    expect(calcSocial(rows)).toBe(AT_TARGET)
    expect(calcFocus(rows)).toBe(0)
  })

  it('leaves Body as it was', () => {
    expect(calcSocial([row('exercise', 'Gym with friends', 45)])).toBeGreaterThan(0)
    expect(calcBody([row('exercise', 'Gym with friends', 45)])).toBe(calcBody([row('exercise', 'Gym', 45)]))
  })

  it('does not count work words or bare names', () => {
    expect(calcSocial([row('meals', 'Lunch with colleagues', 60)])).toBe(0)
    expect(calcSocial([row('exercise', 'Gym with Thabo', 60)])).toBe(0)
  })

  it('counts an entry once', () => {
    expect(calcSocial([row('social', 'Dinner with family', 60)])).toBe(AT_TARGET)
  })

  it('still scores by category when there is no activity', () => {
    expect(calcSocial([entry('social', 60)])).toBe(AT_TARGET)
  })

  it('lists the minutes in the breakdown', () => {
    const details = calcSocialDetails([row('meals', 'Dinner with family', 60), row('calls', 'Call', 15)])
    expect(details.totalMinutes).toBe(75)
    expect(details.breakdown[WITH_FRIENDS_OR_FAMILY_KEY]).toBe(60)
    expect(details.breakdown.calls).toBe(15)
  })
})
