import { checkReviewLine, REVIEW_VERDICT_WORDS } from '@/lib/review-voice-check'
import { REVIEW_BANNED_WORDS } from '@/lib/prompts'

const rules = (text: string, opts: Parameters<typeof checkReviewLine>[1] = { kind: 'day' }) =>
  Array.from(new Set(checkReviewLine(text, opts).map((b) => b.rule))).sort()

describe('checkReviewLine', () => {
  it('passes a plain day line', () => {
    expect(
      rules('Four hours of deep work, most of it in one block on the essay. A 30-minute walk.')
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

  it('limits day lines to two sentences and week lines to four', () => {
    const three = 'Two hours of reading. One hour of cooking. A 20-minute walk.'
    const four = 'Two hours of reading. One hour of cooking. A 20-minute walk. Three hours of meetings.'
    expect(rules(three)).toEqual(['too-long'])
    expect(rules(four, { kind: 'week' })).toEqual([])
  })

  it('catches lists', () => {
    expect(rules('- Deep work: 3h\n- Rest: 8h')).toContain('list')
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

  it('catches a line that says nobody was seen when somebody was', () => {
    const line = 'Two hours of social time and one hour of exercise. No time with people was logged.'
    expect(rules(line, { kind: 'day', peopleMinutes: 120 })).toEqual(['false-absence'])
    expect(rules('Three hours of deep work. No social time was logged.', { kind: 'week', peopleMinutes: 45 })).toEqual([
      'false-absence',
    ])
    expect(rules('Two hours of social time. No exercise was logged.', { kind: 'day', peopleMinutes: 120 })).toEqual([])
  })

  it('never lets a day line say there was none', () => {
    expect(
      rules('Four hours of meetings. No time with friends or family was logged.', { kind: 'day', peopleMinutes: 0 })
    ).toEqual(['day-absence'])
    expect(rules('Three hours of deep work. There was no time with people logged.', { kind: 'day' })).toEqual([
      'day-absence',
    ])
  })

  it('wants a finished week with none to say so, as friends or family', () => {
    const week = { kind: 'week', peopleMinutes: 0 } as const
    expect(rules('You logged 20 hours of deep work. You logged no time with friends or family.', week)).toEqual([])
    expect(rules('You logged 20 hours of deep work. No time with people was logged.', week)).toEqual([
      'absence-unsaid',
      'absence-wording',
    ])
    expect(rules('You logged 20 hours of deep work.', week)).toEqual(['absence-unsaid'])
  })

  it('wants a week in progress to say nothing about it', () => {
    const partial = { kind: 'week', peopleMinutes: 0, isPartialWeek: true } as const
    expect(rules('You logged 9 hours of deep work so far.', partial)).toEqual([])
    expect(rules('You logged 9 hours of deep work so far. No time with friends or family so far.', partial)).toEqual([
      'partial-week-absence',
    ])
  })

  it('catches a label from the data pasted back with its colon', () => {
    expect(rules('Meals took 1 hour. Time with people: none logged.', { kind: 'day', peopleMinutes: 0 })).toContain(
      'label-read-back'
    )
    expect(rules('Deep Work: 4 hours.')).toContain('label-read-back')
    expect(rules('The plan held: three blocks kept.')).toEqual([])
  })

  describe('a line that words a read', () => {
    const keepFacts = [
      'The longest focused block was 2h 10m on "Essay draft", starting at 9:15 AM.',
      'It started inside the focus window (9:00 AM–12:00 PM).',
    ]

    it('lets a Keep or a Change offer the hour, and catches only a correction', () => {
      const keep = { kind: 'day', readKind: 'keep' } as const
      expect(rules('2h 10m on the essay from 9:15 AM. Consider the same hour again.', keep)).toEqual([])
      expect(rules('2h 10m on the essay. You should keep the same hour.', keep)).toEqual(['correction'])
      const change = { kind: 'day', readKind: 'change' } as const
      expect(rules('Three days without movement. One option is a run at 6 PM.', change)).toEqual([])
    })

    it('keeps the advice rule for an ordinary day', () => {
      const nothing = { kind: 'day', readKind: 'nothing' } as const
      expect(rules('An ordinary day, mostly deep work. Consider a walk.', nothing)).toEqual(['advice', 'nothing-advice'])
    })

    it('catches any advice on an ordinary day or week, "could", "option" and "plan" included', () => {
      expect(rules('An ordinary week. You could add a run.', { kind: 'week', readKind: 'nothing', peopleMinutes: 30 })).toEqual([
        'nothing-advice',
      ])
      expect(rules('An ordinary day. One option is a walk.', { kind: 'day', readKind: 'nothing' })).toEqual(['nothing-advice'])
      expect(rules('An ordinary week. Plan a walk.', { kind: 'week', readKind: 'nothing', peopleMinutes: 30 })).toEqual([
        'nothing-advice',
      ])
      expect(rules('An ordinary week, as planned.', { kind: 'week', readKind: 'nothing', peopleMinutes: 30 })).toEqual([])
    })

    it('catches a cause, in either scope', () => {
      expect(rules('Focus ran long because it started at 9:15 AM.')).toEqual(['cause'])
      expect(rules('Thanks to an early start, focus ran long.', { kind: 'week', peopleMinutes: 30 })).toEqual(['cause'])
      expect(rules('An early start led to a long block.')).toEqual(['cause'])
    })

    it('catches a time or a number that is not in the facts', () => {
      const keep = { kind: 'day', readKind: 'keep', facts: keepFacts } as const
      expect(rules('The essay block ran 2h 10m from 9:15 AM, inside the focus window.', keep)).toEqual([])
      expect(rules('The essay block ran 2 hours 10 minutes from 9:15 in the morning.', keep)).toEqual([])
      expect(rules('The essay block ran 2h 10m from 10:15 AM.', keep)).toEqual(['ungrounded'])
      expect(rules('The essay block ran 130 minutes.', keep)).toEqual(['ungrounded'])
      expect(rules('The essay block ran 2h 10m, three times the usual.', keep)).toEqual(['ungrounded'])
    })

    it('allows a number written as a word, and "both" for 2', () => {
      const facts = ['Mind reached its target on Tue and Thu.', 'On both days focused work began around 9:00 AM.', 'On the other 4 days it did not reach it.']
      const keep = { kind: 'week', readKind: 'keep', facts, peopleMinutes: 30 } as const
      expect(rules('Mind reached its target on Tuesday and Thursday, both starting around 9 AM. Not on the other four days.', keep)).toEqual([])
      const counted = { kind: 'day', readKind: 'change', facts: ['No movement was logged on 3 days in a row: Sat 14 Nov, Sun 15 Nov and Mon 16 Nov.', 'One option: Run at 6:00 PM.'] } as const
      expect(rules('No movement on three days in a row. One option is a run at 6:00 PM.', counted)).toEqual([])
      expect(rules('No movement on five days in a row. One option is a run at 6:00 PM.', counted)).toEqual(['ungrounded'])
    })
  })
})
