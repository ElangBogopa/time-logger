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

  it('lists Sleep last and the rest by hours', () => {
    const context = week({
      categories: [
        { label: 'Sleep', minutes: 3000 },
        { label: 'Meetings', minutes: 480 },
        { label: 'Deep Work', minutes: 1200 },
      ],
    })
    const at = (l: string) => context.indexOf(`- ${l}:`)
    expect(at('Deep Work')).toBeLessThan(at('Meetings'))
    expect(at('Meetings')).toBeLessThan(at('Sleep'))
  })
})

describe('the week review system prompt', () => {
  it('does not talk about logging, and keeps "so far"', () => {
    // REVIEW_VOICE is shared with the day line and is not part of this change.
    const prompt = buildWeekReviewSystemPrompt()
    expect(prompt.replace(REVIEW_VOICE, '')).not.toMatch(/\blog(?:ged|ging|s)\b/i)
    expect(prompt).toContain('so far')
  })
})
