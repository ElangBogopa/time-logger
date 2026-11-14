import { checkReviewLine, REVIEW_VERDICT_WORDS } from '@/lib/review-voice-check'
import { REVIEW_BANNED_WORDS } from '@/lib/prompts'

const rules = (text: string, opts: Parameters<typeof checkReviewLine>[1] = { kind: 'day' }) =>
  Array.from(new Set(checkReviewLine(text, opts).map((b) => b.rule))).sort()

describe('checkReviewLine', () => {
  it('passes a plain day line', () => {
    expect(
      rules('Four hours of deep work, most of it in one block on the essay. A 30-minute walk. No time with people was logged.')
    ).toEqual([])
  })

  it('catches banned words and exclamation marks', () => {
    expect(rules('A steady day with real focus in it. Great work!')).toEqual(['banned-word', 'exclamation'])
  })

  it('catches verdicts and score talk', () => {
    expect(rules('The day was a strong one for focus, with Mind at 82/100.')).toEqual(['score-talk', 'verdict'])
  })

  it('catches relative days', () => {
    expect(rules('Today held three hours of meetings.')).toEqual(['relative-day'])
  })

  it('catches advice', () => {
    expect(rules('Two hours of TV. Consider a walk next time.')).toEqual(['advice'])
  })

  it('catches a hard day unless the mood is low', () => {
    expect(rules('It was a tough day with little logged.')).toEqual(['hard-day'])
    expect(rules('It was a tough day with little logged.', { kind: 'day', mood: 'low' })).toEqual([])
  })

  it('catches questions', () => {
    expect(rules('How did the afternoon go? Three hours of admin.')).toEqual(['question'])
  })

  it('limits day lines to three sentences and week lines to four', () => {
    const four = 'Two hours of reading. One hour of cooking. A 20-minute walk. Three hours of meetings.'
    expect(rules(four)).toEqual(['too-long'])
    expect(rules(four, { kind: 'week' })).toEqual([])
  })

  it('catches lists', () => {
    expect(rules('- Deep work: 3h\n- Sleep: 8h')).toContain('list')
  })

  it('catches an empty line', () => {
    expect(rules('')).toEqual(['empty'])
  })

  it('matches whole words only', () => {
    expect(rules('Greater Manchester run, 40 minutes.')).toEqual([])
  })

  it('accepts a week line with one option, and catches a correction', () => {
    expect(
      rules(
        'You logged 12 hours of deep work, most of it before noon. One option for next week is a walk on Wednesday at 3 PM.',
        { kind: 'week' }
      )
    ).toEqual([])
    expect(rules('You should protect your mornings.', { kind: 'week' })).toEqual(['correction'])
  })

  it('catches every banned and verdict word', () => {
    for (const w of REVIEW_BANNED_WORDS) {
      expect(rules(`The work was ${w} in the morning.`, { kind: 'week' })).toContain('banned-word')
    }
    for (const w of REVIEW_VERDICT_WORDS) {
      expect(rules(`The work was ${w} in the morning.`, { kind: 'week' })).toContain('verdict')
    }
  })

  it('catches "no time with people" on a day that has some, and only then', () => {
    const line = 'Two hours of social time and one hour of exercise. No time with people was logged.'
    expect(rules(line, { kind: 'day', peopleMinutes: 120 })).toEqual(['false-absence'])
    expect(rules('Three hours of deep work. No social time was logged.', { kind: 'week', peopleMinutes: 45 })).toEqual([
      'false-absence',
    ])
    expect(rules('Four hours of deep work. No time with people was logged.', { kind: 'day', peopleMinutes: 0 })).toEqual([])
    expect(rules('Two hours of social time. No exercise was logged.', { kind: 'day', peopleMinutes: 120 })).toEqual([])
  })
})
