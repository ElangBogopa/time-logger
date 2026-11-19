import {
  buildWeekReviewContext,
  buildWeekReviewSystemPrompt,
  REVIEW_VOICE,
  type WeekReviewContextInput,
} from '@/lib/prompts'

const week = (extra: Partial<WeekReviewContextInput> = {}) =>
  buildWeekReviewContext({
    isPartialWeek: false,
    bestDays: ['Tuesday'],
    bestHours: ['9 AM'],
    categories: [{ label: 'Deep Work', minutes: 600 }],
    ...extra,
  })

describe('the week review context', () => {
  it('sends no count of days, finished or in progress', () => {
    for (const context of [week(), week({ isPartialWeek: true })]) {
      expect(context).not.toContain('Days with anything logged')
      expect(context).not.toContain('Days covered')
      expect(context).not.toContain('of 7')
      expect(context).not.toMatch(/\b\d+ (?:of 7|days?)\b/)
    }
  })

  it('marks a week in progress and only that', () => {
    const partial = week({ isPartialWeek: true })
    expect(partial).toContain('The week is still in progress.')
    expect(partial).toContain('Hours by category so far:')
    const done = week()
    expect(done).not.toContain('The week is still in progress.')
    expect(done).not.toContain('so far')
  })

  it('leaves out best days and hours it does not have', () => {
    const none = week({ bestDays: [], bestHours: [] })
    expect(none).not.toContain('Best focus days')
    expect(none).not.toContain('Best focus hours')
    expect(none).not.toContain('Not enough data')
    const some = week()
    expect(some).toContain('Best focus days')
    expect(some).toContain('Best focus hours')
  })

  it('states the largest activity for a week with no best focus', () => {
    // Asked to find it, the model said chores (6h) took the most when rest had 10h.
    const restHeavy = [
      { label: 'Rest', minutes: 600 },
      { label: 'Calls', minutes: 180 },
      { label: 'Chores', minutes: 360 },
    ]
    const none = week({ bestDays: [], bestHours: [], categories: restHeavy })
    expect(none).toContain('- Most hours: Rest (10h)')
    const tie = week({
      bestDays: [],
      bestHours: [],
      categories: [{ label: 'Chores', minutes: 360 }, { label: 'Rest', minutes: 360 }],
    })
    expect(tie).toContain('- Most hours: Chores and Rest (6h each)')
    // A week with best focus keeps its pattern about the focus and is not told this.
    expect(week({ categories: restHeavy })).not.toContain('Most hours')
  })

  it('lists the categories by hours', () => {
    const context = week({
      categories: [
        { label: 'Meetings', minutes: 480 },
        { label: 'Deep Work', minutes: 1200 },
      ],
    })
    const at = (l: string) => context.indexOf(`- ${l}:`)
    expect(at('Deep Work')).toBeLessThan(at('Meetings'))
  })

  it('a week holding old sleep rows tells the model nothing about sleep', () => {
    const categories = [
      { label: 'Sleep', minutes: 3000 },
      { label: 'Deep Work', minutes: 1200 },
      { label: 'Social', minutes: 120 },
    ]
    for (const context of [
      week({ categories }),
      week({ categories, bestDays: [], bestHours: [] }),
      week({ categories, isPartialWeek: true }),
      week({ categories: [{ label: 'Sleep', minutes: 3000 }], bestDays: [], bestHours: [] }),
    ]) {
      expect(context).not.toMatch(/sleep/i)
    }
    for (const prompt of [
      buildWeekReviewSystemPrompt({ bestDays: [], bestHours: [] }),
      buildWeekReviewSystemPrompt({ bestDays: ['Tuesday'], bestHours: ['9 AM'] }),
    ]) {
      expect(prompt).not.toMatch(/sleep/i)
    }
  })

  it('a week of only old sleep rows is not told it had no friends or family', () => {
    expect(week({ categories: [{ label: 'Sleep', minutes: 3000 }] })).not.toContain('No time with friends or family')
  })
})

describe('the week review system prompt', () => {
  it('does not talk about logging, and keeps "so far"', () => {
    // REVIEW_VOICE is shared with the day line and is not part of this change.
    const prompt = buildWeekReviewSystemPrompt({ bestDays: ['Tuesday'], bestHours: ['9 AM'] })
    expect(prompt.replace(REVIEW_VOICE, '')).not.toMatch(/\blog(?:ged|ging|s)\b/i)
    expect(prompt).toContain('so far')
  })

  it('says nothing of best focus to a week that has none', () => {
    // The rest-heavy week was told to call them "best focus", and answered
    // that there was no focused work and suggested best focus hours.
    // REVIEW_VOICE's example sentence is shared with the day line.
    const none = buildWeekReviewSystemPrompt({ bestDays: [], bestHours: [] }).replace(REVIEW_VOICE, '')
    expect(none).not.toMatch(/best focus/i)
    expect(none).not.toMatch(/focused work/i)
    expect(none).not.toMatch(/productive/i)
  })

  it('does not ask a week with no best focus to rank the activities itself', () => {
    const none = buildWeekReviewSystemPrompt({ bestDays: [], bestHours: [] })
    expect(none).not.toMatch(/which activit(?:y|ies) took the most/i)
    expect(none).toContain('the data gives as taking the most hours')
  })

  it('names only the best focus days or hours the week has', () => {
    const both = buildWeekReviewSystemPrompt({ bestDays: ['Tuesday'], bestHours: ['9 AM'] })
    expect(both).toContain('"best focus" days and hours')
    const daysOnly = buildWeekReviewSystemPrompt({ bestDays: ['Tuesday'], bestHours: [] })
    expect(daysOnly).toContain('"best focus" days')
    expect(daysOnly).not.toMatch(/hours where the focused work fell|"best focus" days and hours|"best focus" hours/)
    const hoursOnly = buildWeekReviewSystemPrompt({ bestDays: [], bestHours: ['9 AM'] })
    expect(hoursOnly).toContain('"best focus" hours')
    expect(hoursOnly).not.toMatch(/"best focus" days/)
  })

  it('decides the no-friends sentence from the Heart minutes when given', () => {
    const categories = [{ label: 'Meals', minutes: 600 }]
    expect(week({ categories, heartMinutes: 120 })).not.toContain('No time with friends or family')
    expect(week({ categories, heartMinutes: 0 })).toContain('No time with friends or family')
    expect(week({ categories })).toContain('No time with friends or family')
  })
})
