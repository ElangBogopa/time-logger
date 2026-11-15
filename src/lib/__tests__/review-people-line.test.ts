import {
  buildDayReviewPrompt,
  buildWeekReviewContext,
  buildWeekReviewSystemPrompt,
  peopleMinutes,
  NO_FRIENDS_OR_FAMILY,
  REVIEW_DATA_LABELS,
  REVIEW_VOICE,
  type WeekReviewContextInput,
} from '@/lib/prompts'
import { SOCIAL_CATS } from '@/lib/metrics-calc'
import { CATEGORY_LABELS, type TimeCategory } from '@/lib/types'

/**
 * The reviews said "no time with people" about days full of meetings, and
 * read the data's own label back with its colon. Time with friends or family
 * is what the Heart ring counts; the day review never says there was none,
 * and a finished week with none is told so in a sentence.
 */

type Hours = { label: string; minutes: number }[]

const week = (categories: Hours, extra: Partial<WeekReviewContextInput> = {}) =>
  buildWeekReviewContext({
    isPartialWeek: false,
    bestDays: [],
    bestHours: [],
    categories,
    ...extra,
  })

const DAY_PROMPTS = [
  buildDayReviewPrompt({ totalMinutesLogged: 240, hours: [{ label: 'Deep Work', minutes: 240 }] }),
  buildDayReviewPrompt({ totalMinutesLogged: 240, hours: [{ label: 'Meetings', minutes: 240 }] }),
  buildDayReviewPrompt({ totalMinutesLogged: 240 }),
]

describe('time with friends or family in the review prompts', () => {
  it('counts Social, Calls and Faith, and not Meetings', () => {
    expect(
      peopleMinutes([
        { label: 'Social', minutes: 120 },
        { label: 'Calls', minutes: 45 },
        { label: 'Faith', minutes: 30 },
        { label: 'Meetings', minutes: 60 },
      ])
    ).toBe(195)
  })

  it('agrees with the Heart ring', () => {
    for (const c of SOCIAL_CATS) {
      expect(peopleMinutes([{ label: CATEGORY_LABELS[c as TimeCategory], minutes: 10 }])).toBe(10)
    }
    expect(peopleMinutes([{ label: CATEGORY_LABELS.meetings, minutes: 10 }])).toBe(0)
  })

  it('gives the model no wording about it to copy', () => {
    for (const text of [REVIEW_VOICE, buildWeekReviewSystemPrompt(), ...DAY_PROMPTS]) {
      expect(text).not.toMatch(/time with people/i)
      expect(text).not.toMatch(/friends or family/i)
    }
  })

  it('never tells the day line there was none', () => {
    for (const prompt of DAY_PROMPTS) {
      expect(prompt).not.toContain(NO_FRIENDS_OR_FAMILY)
      expect(prompt).not.toContain('Time with people')
    }
  })

  it('tells a finished week that had none, in a sentence', () => {
    const context = week([
      { label: 'Sleep', minutes: 3000 },
      { label: 'Meetings', minutes: 840 },
    ])
    expect(context).toContain(NO_FRIENDS_OR_FAMILY)
    expect(context.split('\n')).toContain(NO_FRIENDS_OR_FAMILY)
  })

  it('says nothing when the week had some, is still in progress, or has no breakdown', () => {
    expect(week([{ label: 'Faith', minutes: 300 }])).not.toContain(NO_FRIENDS_OR_FAMILY)
    expect(week([{ label: 'Calls', minutes: 180 }, { label: 'Sleep', minutes: 3000 }])).not.toContain(NO_FRIENDS_OR_FAMILY)
    expect(week([{ label: 'Sleep', minutes: 1300 }], { isPartialWeek: true })).not.toContain(
      NO_FRIENDS_OR_FAMILY
    )
    expect(week([])).not.toContain(NO_FRIENDS_OR_FAMILY)
  })

  it('nowhere uses the old label', () => {
    expect(week([{ label: 'Sleep', minutes: 3000 }])).not.toContain('Time with people')
    expect(week([{ label: 'Social', minutes: 300 }])).not.toContain('Time with people')
    expect(week([{ label: 'Sleep', minutes: 1300 }], { isPartialWeek: true })).not.toContain(
      'Time with people'
    )
  })

  it('lists every label the builders write before a colon', () => {
    const known = new Set<string>([...REVIEW_DATA_LABELS, ...Object.values(CATEGORY_LABELS)])
    const labelsIn = (lines: string[]) =>
      lines.flatMap((l) => {
        const m = l.match(/^(?:- )?([A-Z][A-Za-z ]*?)(?: so far)?:/)
        return m ? [m[1]] : []
      })

    const dayLines = buildDayReviewPrompt({
      metrics: { body: 50, focus: 60, social: 40 },
      plan: { kept: 1, moved: 1, missed: 1 },
      totalMinutesLogged: 330,
      wins: [{ text: 'Finished the draft' }],
      mood: 'okay',
      longestFocusSession: { activity: 'Essay draft', minutes: 90 },
      hours: [
        { label: 'Deep Work', minutes: 180 },
        { label: 'Faith', minutes: 30 },
        { label: 'Meetings', minutes: 120 },
      ],
    }).split('\n')
    const start = dayLines.findIndex((l) => l.startsWith('WHAT WAS LOGGED'))
    expect(start).toBeGreaterThan(-1)
    const dayLabels = labelsIn(dayLines.slice(start + 1))

    const cats = [
      { label: 'Sleep', minutes: 3000 },
      { label: 'Self Care', minutes: 120 },
    ]
    const extra = { bestDays: ['Tuesday'], bestHours: ['9 AM'] }
    const weekLabels = [
      ...labelsIn(week(cats, extra).split('\n')),
      ...labelsIn(week(cats, { ...extra, isPartialWeek: true }).split('\n')),
    ]

    // The test is worth nothing if the pattern stops finding labels.
    expect(dayLabels).toEqual(expect.arrayContaining(['Time by category', 'Time tracked', 'Plan', 'Noted', 'Evening mood', 'Longest focus session', 'Deep Work']))
    expect(weekLabels).toEqual(expect.arrayContaining(['Weekly Review Data', 'Best focus days', 'Best focus hours', 'Hours by category', 'Sleep']))
    for (const label of [...dayLabels, ...weekLabels]) expect(known).toContain(label)
  })
})
