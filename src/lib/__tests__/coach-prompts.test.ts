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

describe('session prompt grounding', () => {
  it('limits ring and plan talk to what the facts say', () => {
    const prompt = buildSessionCommentarySystemPrompt('tomorrow')
    expect(prompt).toContain('only when a line of the facts says so')
    expect(prompt).toContain('never say "as planned"')
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
    const facts = buildEntryFacts({ entry: e, dayEntries: [e] })
    expect(buildEntryRemarkSystemPrompt(facts)).toContain(COACH_VOICE)
    expect(buildEntryRemarkSystemPrompt(facts)).not.toContain(REVIEW_VOICE)
    expect(text).not.toMatch(/\/100|out of 100|\b(Body|Mind|Heart) \d/)
  })
})

describe('entry remark for an entry that feeds no ring', () => {
  // Review 15's examples: a nap, TV and emails feed no ring, and the old
  // prompt's "minutes toward one" got "toward your rest target".
  it.each([
    ['rest', 'Nap'],
    ['entertainment', 'Watching TV'],
    ['admin', 'Emails'],
  ] as const)('%s: says there is no target and never asks for minutes toward one', (category, activity) => {
    const e = entry('a', category, 45, activity)
    const facts = buildEntryFacts({ entry: e, dayEntries: [e] })
    expect(facts.rings).toHaveLength(0)
    const prompt = buildEntryRemarkSystemPrompt(facts)
    expect(prompt).toContain('counts toward no ring')
    expect(prompt).toContain('Never mention a target')
    expect(prompt).not.toContain('minutes toward one')
    const text = describeEntryFacts(facts)
    expect(text).toContain('counts toward none of Body, Mind or Heart. It has no target.')
    expect(text).not.toMatch(/Toward|reached its target|on target/)
  })

  it('an entry that feeds a ring names only that ring as having a target', () => {
    const e = entry('a', 'exercise', 45, 'Gym')
    const facts = buildEntryFacts({ entry: e, dayEntries: [e] })
    const prompt = buildEntryRemarkSystemPrompt(facts)
    expect(prompt).toContain('Only Body has a target here')
    expect(prompt).not.toContain('counts toward no ring')
    expect(describeEntryFacts(facts)).not.toContain('It has no target')
  })
})

describe('session prompt: only the rings have targets', () => {
  it('bars a target of an activity or its kind', () => {
    expect(buildSessionCommentarySystemPrompt('later-today')).toContain('Only Body, Mind and Heart have targets')
  })
})
