import {
  buildDayReviewPrompt,
  buildWeekReviewContext,
  buildWeekReviewSystemPrompt,
  peopleMinutes,
  REVIEW_VOICE,
} from '@/lib/prompts'

/**
 * The reviews said "No time with people was logged" on days with two hours of
 * Social, because that sentence was the example in the voice and the model
 * copied it. Whether people were seen is now a fact in the data.
 */

// The line as it appears in the data; the voice rule quotes it without the full stop.
const NONE = 'Time with people: none logged.'

const week = (categories: { label: string; minutes: number }[]) =>
  buildWeekReviewContext({ isPartialWeek: false, daysSoFar: 7, daysLogged: 7, bestDays: [], bestHours: [], categories })

describe('time with people in the review prompts', () => {
  it('gives the model no absence sentence to copy', () => {
    expect(REVIEW_VOICE).not.toMatch(/no time with people was/i)
    expect(buildWeekReviewSystemPrompt()).not.toMatch(/no time with people was/i)
    expect(buildDayReviewPrompt({ totalMinutesLogged: 60, hours: [{ label: 'Social', minutes: 60 }] })).not.toMatch(
      /no time with people was/i
    )
  })

  it('counts Social and Calls, and nothing else', () => {
    expect(
      peopleMinutes([
        { label: 'Social', minutes: 120 },
        { label: 'Calls', minutes: 45 },
        { label: 'Meetings', minutes: 60 },
      ])
    ).toBe(165)
    expect(peopleMinutes([{ label: 'Deep Work', minutes: 240 }])).toBe(0)
  })

  it('leaves the line out when the day has time with people', () => {
    const prompt = buildDayReviewPrompt({
      totalMinutesLogged: 300,
      hours: [
        { label: 'Deep Work', minutes: 180 },
        { label: 'Social', minutes: 120 },
      ],
    })
    expect(prompt).not.toContain(NONE)
  })

  it('tells the day line when there was none', () => {
    const prompt = buildDayReviewPrompt({ totalMinutesLogged: 240, hours: [{ label: 'Deep Work', minutes: 240 }] })
    expect(prompt).toContain(NONE)
  })

  it('says nothing either way when the day has no breakdown', () => {
    expect(buildDayReviewPrompt({ totalMinutesLogged: 240 })).not.toContain(NONE)
  })

  it('tells the week line the same', () => {
    expect(week([{ label: 'Calls', minutes: 180 }, { label: 'Sleep', minutes: 3000 }])).not.toContain(NONE)
    expect(week([{ label: 'Sleep', minutes: 3000 }])).toContain(NONE)
  })
})
