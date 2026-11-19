import { buildSessionFacts, buildEntryFacts, type CoachEntry } from '@/lib/coach-facts'
import { windowsForWake } from '@/lib/ideal-day'
import type { PlanRow } from '@/lib/plan-adherence'
import type { TimeCategory } from '@/lib/types'

let n = 0
const e = (activity: string, category: TimeCategory, start: string, end: string, minutes: number): CoachEntry => ({
  id: `e${++n}`, activity, category, start_time: start, end_time: end, duration_minutes: minutes,
})
const plan = (title: string, start: string, end: string, completed = false): PlanRow => ({
  id: `p${++n}`, title, completed, committed_start: start, committed_end: end,
})
const windows = windowsForWake(null)
const ring = (facts: { rings: { key: string; state: string }[] }, key: string) => facts.rings.find((r) => r.key === key)

describe('buildSessionFacts', () => {
  it('Mind reached when the day had 60 focused minutes before and the session adds 200', () => {
    const before = e('Email', 'deep_work', '08:00', '09:00', 60)
    const sess = e('Essay', 'deep_work', '09:30', '12:50', 200)
    const facts = buildSessionFacts({ period: 'morning', sessionEntries: [sess], dayEntries: [before, sess], plans: [], windows, nowMinutes: 13 * 60 })
    expect(ring(facts, 'focus')?.state).toBe('reached')
  })

  it('Heart already on target before the session', () => {
    const before = e('Lunch with family', 'social', '12:00', '13:30', 90)
    const sess = e('Reading', 'learning', '14:00', '15:00', 60)
    const facts = buildSessionFacts({ period: 'afternoon', sessionEntries: [sess], dayEntries: [before], plans: [], windows, nowMinutes: 16 * 60 })
    expect(ring(facts, 'social')?.state).toBe('already')
  })

  it('a ring not on target is open for a morning finish and missed for an evening one', () => {
    const sess = e('Tidying', 'chores', '09:00', '09:20', 20)
    const morning = buildSessionFacts({ period: 'morning', sessionEntries: [sess], dayEntries: [], plans: [], windows, nowMinutes: 13 * 60 })
    const evSess = e('Tidying', 'chores', '19:00', '19:20', 20)
    const evening = buildSessionFacts({ period: 'evening', sessionEntries: [evSess], dayEntries: [], plans: [], windows, nowMinutes: 21 * 60 })
    expect(ring(morning, 'social')?.state).toBe('open')
    expect(ring(evening, 'social')?.state).toBe('missed')
  })

  it('ahead.kind follows the period and the date', () => {
    const sess = e('Reading', 'learning', '14:00', '15:00', 60)
    const kind = (period: 'afternoon' | 'evening', now: number | null) =>
      buildSessionFacts({ period, sessionEntries: [sess], dayEntries: [], plans: [], windows, nowMinutes: now }).ahead.kind
    expect(kind('afternoon', 16 * 60)).toBe('later-today')
    expect(kind('evening', 21 * 60)).toBe('tomorrow')
    expect(kind('afternoon', null)).toBe('none')
  })

  it('a kept plan lands in the afternoon and not the morning', () => {
    const sess = e('Call Mum', 'calls', '15:00', '15:30', 30)
    const plans = [plan('Call Mum', '15:00', '15:30')]
    const input = { sessionEntries: [sess], dayEntries: [sess], plans, windows, nowMinutes: 18 * 60 }
    expect(buildSessionFacts({ ...input, period: 'afternoon' }).plansKept.map((p) => p.title)).toEqual(['Call Mum'])
    expect(buildSessionFacts({ ...input, period: 'morning' }).plansKept).toEqual([])
  })

  it('an upcoming 21:00 plan is ahead at 18:00', () => {
    const sess = e('Lecture notes', 'learning', '14:00', '15:00', 60)
    const facts = buildSessionFacts({
      period: 'afternoon', sessionEntries: [sess], dayEntries: [], plans: [plan('Read', '21:00', '21:30')], windows, nowMinutes: 18 * 60,
    })
    expect(facts.ahead.plans.map((p) => p.title)).toEqual(['Read'])
  })

  it('a plan whose hour is still running is not "not done"; once it ends unlogged it is', () => {
    const sess = e('Emails', 'admin', '13:00', '13:45', 45)
    const plans = [plan('Call Mum', '15:00', '16:00')]
    const at = (now: number) =>
      buildSessionFacts({ period: 'afternoon', sessionEntries: [sess], dayEntries: [sess], plans, windows, nowMinutes: now })
    const during = at(15 * 60 + 30)
    expect(during.plansNotDone).toEqual([])
    expect(during.ahead.plans).toEqual([])
    expect(at(16 * 60).plansNotDone.map((p) => p.title)).toEqual(['Call Mum'])
    expect(at(18 * 60).plansNotDone.map((p) => p.title)).toEqual(['Call Mum'])
  })

  it('categories sum to the total', () => {
    const entries = [e('A', 'deep_work', '09:00', '10:00', 60), e('B', 'meals', '10:00', '10:30', 30), e('C', 'other', '10:30', '10:40', 10)]
    const facts = buildSessionFacts({ period: 'morning', sessionEntries: entries, dayEntries: [], plans: [], windows, nowMinutes: null })
    expect(facts.categories.reduce((s, c) => s + c.minutes, 0)).toBe(facts.totalMinutes)
    expect(facts.totalMinutes).toBe(100)
  })
})

describe('buildEntryFacts', () => {
  it('Body reached for a 45-minute gym entry on a day with meals; no Heart ring for a solo run', () => {
    const gym = e('Gym', 'exercise', '07:00', '07:45', 45)
    const day = [
      e('Breakfast', 'meals', '08:00', '08:30', 30),
      e('Lunch', 'meals', '12:00', '12:30', 30),
      gym,
    ]
    const facts = buildEntryFacts({ entry: gym, dayEntries: day })
    expect(ring(facts, 'body')?.state).toBe('reached')
    const run = e('Run', 'exercise', '18:00', '18:30', 30)
    expect(buildEntryFacts({ entry: run, dayEntries: [run] }).rings.some((r) => r.key === 'social')).toBe(false)
  })
})
