import {
  COACH_VOICE,
  REVIEW_VOICE,
  buildSessionCommentarySystemPrompt,
  buildEntryRemarkSystemPrompt,
  describeSessionFacts,
  describeEntryFacts,
} from '@/lib/prompts'
import { buildSessionFacts, buildEntryFacts, type CoachEntry } from '@/lib/coach-facts'
import { windowsForWake } from '@/lib/ideal-day'

const entry = (id: string, category: CoachEntry['category'], minutes: number, activity = 'Thing'): CoachEntry => ({
  id, activity, category, duration_minutes: minutes, start_time: '09:00', end_time: '10:00',
})

describe('session system prompt', () => {
  it.each([
    ['later-today', 'still possible later today'],
    ['tomorrow', 'tomorrow makes possible'],
    ['none', 'Do not look ahead'],
  ] as const)('holds the voice and the %s ending', (kind, ending) => {
    const prompt = buildSessionCommentarySystemPrompt(kind)
    expect(prompt).toContain(COACH_VOICE)
    expect(prompt).toContain(ending)
    expect(prompt).not.toContain(REVIEW_VOICE)
  })
})

describe('describeSessionFacts', () => {
  const windows = windowsForWake(null)
  it('says "still open" for an open ring, and has no Still ahead line for none', () => {
    const sess = [entry('a', 'chores', 20)]
    const open = describeSessionFacts(buildSessionFacts({ period: 'morning', sessionEntries: sess, dayEntries: [], plans: [], windows, nowMinutes: 13 * 60 }))
    expect(open).toContain('still open')
    expect(open).not.toMatch(/missed|did not reach/)
    const none = describeSessionFacts(buildSessionFacts({ period: 'morning', sessionEntries: sess, dayEntries: [], plans: [], windows, nowMinutes: null }))
    expect(none).not.toContain('Still ahead')
  })

  it('quotes no score number and holds no review voice', () => {
    const sess = [entry('a', 'deep_work', 250)]
    const text = describeSessionFacts(buildSessionFacts({ period: 'morning', sessionEntries: sess, dayEntries: [], plans: [], windows, nowMinutes: 13 * 60 }))
    expect(text).not.toMatch(/\/100|out of 100|\b(Body|Mind|Heart) \d/)
  })
})

describe('entry prompt', () => {
  it('holds the voice, no review voice and no score number', () => {
    const e = entry('a', 'exercise', 45, 'Gym')
    const text = describeEntryFacts(buildEntryFacts({ entry: e, dayEntries: [e] }))
    expect(buildEntryRemarkSystemPrompt()).toContain(COACH_VOICE)
    expect(buildEntryRemarkSystemPrompt()).not.toContain(REVIEW_VOICE)
    expect(text).not.toMatch(/\/100|out of 100|\b(Body|Mind|Heart) \d/)
  })
})
