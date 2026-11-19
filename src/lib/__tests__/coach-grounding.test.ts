import { checkCoachGrounding, checkCoachLine, COACH_GROUNDING_RULES } from '@/lib/coach-voice-check'
import { buildSessionCommentarySystemPrompt, describeSessionFacts, describeEntryFacts } from '@/lib/prompts'
import { GROUNDING_CASES, type GroundingCase } from '../../../scripts/eval/coach-grounding-cases'

/** What the eval reports for a line without asking a model. */
function groundingRules(c: GroundingCase): string[] {
  const voice = checkCoachLine(c.line, { kind: c.kind, aheadKind: c.kind === 'session' ? c.facts.ahead.kind : undefined })
  const grounding = c.kind === 'session' ? checkCoachGrounding(c.line, c) : checkCoachGrounding(c.line, c)
  return [...voice, ...grounding].map((b) => b.rule).filter((r) => (COACH_GROUNDING_RULES as readonly string[]).includes(r))
}

const byId = (id: string) => {
  const found = GROUNDING_CASES.find((c) => c.id === id)
  if (!found) throw new Error(`no case ${id}`)
  return found
}
const sessionCase = (id: string) => {
  const c = byId(id)
  if (c.kind !== 'session') throw new Error(`${id} is not a session`)
  return c
}

describe('the reviewed lines, each with its answer', () => {
  const ungrounded = GROUNDING_CASES.filter((c) => c.rule !== null)
  const grounded = GROUNDING_CASES.filter((c) => c.rule === null)

  it('holds every example of reviews 15 and 16', () => {
    expect(ungrounded.map((c) => c.id)).toEqual([
      'entertainment-target',
      'rest-target',
      'admin-target',
      'missed-rings-called-open',
      'as-planned-without-a-plan',
      'no-plan-logged',
      'day-over-time-left-today',
      'day-over-time-left-in-the-day',
      'plan-not-done-still-offered',
    ])
    expect(grounded.map((c) => c.id)).toEqual([
      'two-open-rings-named',
      'rings-all-still-open',
      'the-rings-are-all-still-open',
      'no-body-or-mind-target-met',
      'no-rings-reached',
      'twelve-hour-clock',
      'minds-own-target',
    ])
  })

  it.each(ungrounded.map((c) => [c.id, c.rule, c] as const))('%s is failed, as %s and nothing else', (_id, rule, c) => {
    expect([...new Set(groundingRules(c))]).toEqual([rule])
  })

  it.each(grounded.map((c) => [c.id, c] as const))('%s is passed', (_id, c) => {
    expect(groundingRules(c)).toEqual([])
  })
})

describe('the facts and the prompt behind each reviewed line', () => {
  it('an evening with Body and Mind short: the facts say "did not reach", never "still open"', () => {
    const c = sessionCase('missed-rings-called-open')
    const text = describeSessionFacts(c.facts)
    expect(c.facts.ahead.kind).toBe('tomorrow')
    expect(text).toContain('Body did not reach its target today')
    expect(text).toContain('Mind did not reach its target today')
    expect(text).not.toContain('still open')
    const prompt = buildSessionCommentarySystemPrompt('tomorrow')
    expect(prompt).toContain('is never called open')
    expect(prompt).not.toContain('has not been missed')
    expect(prompt).toContain('never say there is time left today')
  })

  it('a thin evening with no plan: no plan line, and the prompt bars both "as planned" and "no plan"', () => {
    const text = describeSessionFacts(sessionCase('as-planned-without-a-plan').facts)
    expect(text).not.toMatch(/Plan kept|Plan not done|planned "/)
    const prompt = buildSessionCommentarySystemPrompt('tomorrow')
    expect(prompt).toContain('never say "as planned" or "on plan"')
    expect(prompt).toContain('never say there was no plan')
  })

  it('a session of a day that is over: the prompt has no "time left today" line and the facts say none is left', () => {
    const c = sessionCase('day-over-time-left-today')
    expect(c.facts.ahead.kind).toBe('none')
    const prompt = buildSessionCommentarySystemPrompt('none')
    expect(prompt).not.toContain('there is time left today')
    expect(prompt).not.toContain('has not been missed')
    expect(prompt).toContain('never say there is time left')
    const text = describeSessionFacts(c.facts)
    expect(text).toContain('The day of this session is over. No time is left in it.')
    expect(text).not.toContain('Still ahead')
    expect(text).not.toContain('still open')
  })

  it('only a session with later today ahead of it is told there is time left today', () => {
    expect(buildSessionCommentarySystemPrompt('later-today')).toContain(
      'A ring marked "still open" has not been missed: there is time left today.'
    )
    for (const kind of ['tomorrow', 'none'] as const) {
      expect(buildSessionCommentarySystemPrompt(kind)).not.toContain('has not been missed')
    }
  })

  it('a plan not done is in no "Still ahead" line, its line says its time has passed, and the prompt points only at "Still ahead"', () => {
    const c = sessionCase('plan-not-done-still-offered')
    const text = describeSessionFacts(c.facts)
    expect(text).toContain('Plan not done: "Call Mum" (15:00). Its time has passed.')
    const ahead = text.split('\n').find((l) => l.startsWith('Still ahead'))
    expect(ahead).toBeDefined()
    expect(ahead).not.toMatch(/Mum/)
    const prompt = buildSessionCommentarySystemPrompt('later-today')
    expect(prompt).toContain('never say it can still be done')
    expect(prompt).toContain('Point ahead only at what a "Still ahead" line names')
  })

  it('an entry that feeds no ring has no target in its facts; one that feeds Mind has Mind\'s line', () => {
    const tv = byId('entertainment-target')
    const meeting = byId('minds-own-target')
    if (tv.kind !== 'entry' || meeting.kind !== 'entry') throw new Error('entries expected')
    expect(describeEntryFacts(tv.facts)).toContain('It has no target')
    expect(describeEntryFacts(meeting.facts)).toContain('Toward Mind: 90 of 240 focused minutes today.')
  })
})

describe('looks-ahead', () => {
  const none = (text: string) => checkCoachLine(text, { kind: 'session', aheadKind: 'none' }).filter((b) => b.rule === 'looks-ahead')

  it.each([
    'The targets were not reached, but there is still time left today to engage in those areas.',
    "No targets were reached in this session, but there's still time left in the day.",
    'There’s still time left in the day.',
    'You still have time for a walk.',
    'The rest of the day is yours.',
  ])('a day that is over: "%s" is flagged', (text) => {
    expect(none(text).length).toBeGreaterThan(0)
  })

  it('a day that is over: a line that stays on the session is not flagged', () => {
    expect(none('Two hours of study and 1 hour 30 minutes of TV. Body, Mind and Heart did not reach their targets.')).toEqual([])
  })

  it('with later today ahead, "time left today" is not flagged', () => {
    expect(checkCoachLine('Mind reached its target, and there is still time left today for a walk.', { kind: 'session', aheadKind: 'later-today' })).toEqual([])
  })

  it('after the evening, time left today is flagged and tomorrow is not', () => {
    const rules = (text: string) => checkCoachLine(text, { kind: 'session', aheadKind: 'tomorrow' }).map((b) => b.rule)
    expect(rules('Heart reached its target, and there is still time left today for Body.')).toContain('looks-ahead')
    expect(rules('Heart reached its target tonight. Tomorrow opens with Morning movement.')).toEqual([])
  })
})

describe('checkCoachGrounding beyond the reviewed lines', () => {
  const planNotDone = sessionCase('plan-not-done-still-offered')
  const thin = sessionCase('as-planned-without-a-plan')
  const evening = sessionCase('missed-rings-called-open')
  const rules = (text: string, c: GroundingCase) =>
    (c.kind === 'session' ? checkCoachGrounding(text, c) : checkCoachGrounding(text, c)).map((b) => b.rule)

  it('a plan not done that is said flatly is not "pointed at"', () => {
    expect(rules('You logged 45 minutes on Emails. The call to Mum at 15:00 was not done; the Evening session is still ahead.', planNotDone)).toEqual([])
    expect(rules('Emails took 45 minutes, and you could not call Mum.', planNotDone)).toEqual([])
  })

  it('a ring that did not reach its target, said so, is not a ring-state breach; "tomorrow is open" is not about a ring', () => {
    expect(rules('Body and Mind did not reach their targets today. Tomorrow morning is open for movement.', evening)).toEqual([])
  })

  it('one ring called open among rings that are not is a breach', () => {
    expect(rules('Heart reached its target and Body is still open.', evening)).toEqual(['ring-state'])
  })

  it('the window called "Plan and refuel" is not a plan claim', () => {
    expect(rules('Twenty minutes of tidying. Tomorrow gives you a chance to focus on Plan and refuel from 08:00.', thin)).toEqual([])
  })

  it('a ring the entry does not feed is not its to mention', () => {
    const meeting = byId('minds-own-target')
    expect(rules('"Project sync" added an hour toward Body.', meeting)).toEqual(['invented-target'])
    expect(rules('"Project sync" added to Mind: 90 of 240 focused minutes.', meeting)).toEqual([])
  })

  it('a target for a kind of activity is invented in a session too, and "the other targets" is not', () => {
    expect(rules('Twenty minutes toward your chores target.', thin)).toEqual(['invented-target'])
    expect(rules('Heart reached its target; the other targets were not reached.', evening)).toEqual([])
  })
})
