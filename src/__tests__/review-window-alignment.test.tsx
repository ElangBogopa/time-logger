/**
 * "How much landed in your windows", on the two reviews.
 *
 * The windows were only ever advice: Today said when focus, movement and
 * people go best, and nothing afterwards said whether the day had put them
 * there. Both reviews now do — as time inside out of time done, never as a
 * fourth score.
 *
 * Where the entries come from matters as much as the sum. A live day review
 * carries its own; a saved one does not and reads the four-week history. A
 * week asks for its own seven days, because that history stops at yesterday
 * and a week reviewed on its last evening would have been missing a day.
 */

import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import { useAccount } from '@/hooks/useAccount'
import { csrfFetch, fetchEntries } from '@/lib/api'
import { getUserToday, getWeekStartForDate, shiftDateString } from '@/lib/types'
import { NO_FRIENDS_OR_FAMILY } from '@/lib/prompts'

jest.mock('@/hooks/useAccount', () => ({ useAccount: jest.fn() }))
const stableRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() }
let mockParams = new URLSearchParams('')
jest.mock('next/navigation', () => ({
  useRouter: () => stableRouter,
  useSearchParams: () => mockParams,
}))
jest.mock('@/lib/api', () => ({ csrfFetch: jest.fn(), fetchEntries: jest.fn(async () => []) }))
jest.mock('@/lib/client-cache', () => ({ cacheGet: jest.fn(() => null), cacheSet: jest.fn() }))
const NO_EVENTS: never[] = []
jest.mock('@/contexts/CalendarContext', () => ({ useCalendar: () => ({ getEventsForDate: () => NO_EVENTS }) }))
jest.mock('sonner', () => ({ toast: { error: jest.fn() } }))
jest.mock('@/lib/types', () => ({
  ...jest.requireActual('@/lib/types'),
  getUserCurrentHour: () => 22, // past the 9pm unlock, so the day review renders
}))

import DayReviewContent from '@/components/review/DayReviewContent'
import WeeklyReviewContent from '@/components/review/WeeklyReviewContent'
import { useWeekEntries } from '@/hooks/useWeekEntries'

const YESTERDAY = shiftDateString(getUserToday(), -1)

const entry = (category: string, start_time: string, end_time: string, date = YESTERDAY) => {
  const [sh, sm] = start_time.split(':').map(Number)
  const [eh, em] = end_time.split(':').map(Number)
  return {
    id: `${date}-${start_time}`,
    activity: category,
    category,
    date,
    start_time,
    end_time,
    duration_minutes: eh * 60 + em - (sh * 60 + sm),
    status: 'confirmed',
  }
}

const daySummary = (extra: Record<string, unknown> = {}) => ({
  date: YESTERDAY,
  score: 72,
  scoreColor: 'green',
  sessionsLogged: 2,
  totalSessions: 3,
  totalMinutesLogged: 300,
  wins: [],
  categoryBreakdown: [],
  aggregatedBreakdown: [],
  timeline: [],
  todayMood: null,
  longestFocusSession: null,
  productivityScore: null,
  ...extra,
})

/** The day review of yesterday, its log served from /api/entries. */
function serveDay(rows: unknown[], source: 'live' | 'saved' = 'live') {
  mockParams = new URLSearchParams(`date=${YESTERDAY}`)
  ;(fetchEntries as jest.Mock).mockResolvedValue(rows)
  global.fetch = jest.fn(async (url: string) => {
    const target = String(url)
    if (target.includes('/api/day-review')) {
      return { ok: true, json: async () => (source === 'saved' ? { source, review: daySummary() } : { source, review: null }) }
    }
    if (target.includes('/api/plans')) return { ok: true, json: async () => ({ plans: [] }) }
    return { ok: true, json: async () => daySummary() }
  }) as unknown as typeof fetch
}

beforeEach(() => {
  jest.clearAllMocks()
  window.localStorage.clear()
  window.sessionStorage.clear()
  ;(useAccount as jest.Mock).mockReturnValue({ status: 'authenticated', data: { user: { id: 'u1' } } })
  ;(fetchEntries as jest.Mock).mockResolvedValue([])
  ;(csrfFetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ commentary: 'A steady day.' }) })
})

describe('the day review', () => {
  it('says how much of the day fell in the hours that suit it, under a read about timing', async () => {
    // With no wake time known the windows are the reference day's: focus
    // 9–12 and 14–16, movement 6–8 and 17–19. A two-hour block is a Keep.
    serveDay([
      entry('deep_work', '09:30', '11:30'), // all of it inside
      entry('deep_work', '20:00', '21:00'), // none of it
      entry('exercise', '12:00', '12:45'), // none of it
    ])
    render(<DayReviewContent embedded />)

    const card = await screen.findByRole('region', { name: 'In your windows' })
    expect(within(card).getByText('Focused work')).toBeInTheDocument()
    expect(within(card).getByText('2h')).toBeInTheDocument()
    expect(within(card).getByText(/of 3h/)).toBeInTheDocument()
    expect(within(card).getByRole('img', { name: '67 percent of focused work inside your windows' })).toBeInTheDocument()
    expect(within(card).getByRole('img', { name: '0 percent of exercise inside your windows' })).toBeInTheDocument()
    // Nobody was seen that day, so nothing is said about people.
    expect(within(card).queryByText('Time with people')).not.toBeInTheDocument()
  })

  it('moves with a wake time the person has stated', async () => {
    // Up at 9:30: the body's windows are three hours later, so the same
    // 9:30 start is before peak focus opens at noon.
    window.localStorage.setItem('wake-time', JSON.stringify(9 * 60 + 30))
    serveDay([entry('deep_work', '09:30', '11:30')])
    render(<DayReviewContent embedded />)

    const card = await screen.findByRole('region', { name: 'In your windows' })
    expect(within(card).getByRole('img', { name: '0 percent of focused work inside your windows' })).toBeInTheDocument()
  })

  it('reads a saved day, which carries no entries, from the log', async () => {
    serveDay(
      [
        entry('deep_work', '09:00', '10:30'),
        entry('deep_work', '09:00', '10:30', shiftDateString(YESTERDAY, -1)), // another day's, not this one's
      ],
      'saved'
    )
    render(<DayReviewContent embedded />)

    const card = await screen.findByRole('region', { name: 'In your windows' })
    expect(within(card).getByText('1h 30m')).toBeInTheDocument()
    expect(within(card).getByText(/of 1h 30m/)).toBeInTheDocument()
  })

  it('says nothing about the windows for an ordinary day', async () => {
    serveDay([entry('meals', '12:00', '12:30'), entry('sleep', '00:00', '07:00')])
    render(<DayReviewContent embedded />)

    await screen.findByText('A steady day.')
    expect(screen.queryByRole('region', { name: 'In your windows' })).not.toBeInTheDocument()
  })

  it('survives the log failing to load, with the plain read', async () => {
    const quiet = jest.spyOn(console, 'error').mockImplementation(() => {})
    serveDay([])
    ;(fetchEntries as jest.Mock).mockRejectedValue(new Error('offline'))
    render(<DayReviewContent embedded />)

    expect(
      await screen.findByText('An ordinary day. There is too little history yet to say what is usual.')
    ).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'In your windows' })).not.toBeInTheDocument()
    quiet.mockRestore()
  })
})

describe('the weekly review', () => {
  const weekStart = getWeekStartForDate(getUserToday(), 1)
  const timingRead = {
    scope: 'week',
    kind: 'change',
    rule: 'week-change-focus-outside-window',
    facts: [
      'On 3 days (Mon, Wed and Thu), less than half of the focused work fell inside the focus windows (9:00 AM–12:00 PM and 2:00 PM–4:00 PM).',
      'Over the week it was 2h of 9h.',
      'One option: Essay draft at 9:00 AM.',
    ],
    evidence: [
      { label: 'Mon', value: '30m of 2h inside' },
      { label: 'Wed', value: '0m of 3h inside' },
      { label: 'Thu', value: '1h of 4h inside' },
    ],
    slot: { title: 'Essay draft', startTime: '09:00', durationMinutes: 120 },
    timing: true,
  }
  const plainRead = {
    scope: 'week',
    kind: 'nothing',
    rule: 'week-nothing-ordinary',
    facts: ['An ordinary week: its shape matches the four before it.', 'Mind reached its target on 2 days.', NO_FRIENDS_OR_FAMILY],
    evidence: [],
    slot: null,
    timing: false,
  }
  const review = (extra: Record<string, unknown> = {}) => ({
    weekStart,
    weekEnd: shiftDateString(weekStart, 6),
    averages: { body: 60, focus: 70, social: 40 },
    activeDays: 3,
    totalMinutes: 600,
    entryCount: 9,
    previousWeekMinutes: null,
    previousWeekEntryCount: 0,
    hasEnoughData: true,
    hasPreviousWeekData: false,
    categoryBreakdown: [],
    read: timingRead,
    comparisons: { rings: { body: null, focus: null, social: null }, loggedDays: 3 },
    finding: null,
    coachSummary: null,
    ...extra,
  })
  const serveWeek = (extra: Record<string, unknown> = {}) =>
    (csrfFetch as jest.Mock).mockImplementation(async (url: string) =>
      url === '/api/weekly-review'
        ? { ok: true, json: async () => review(extra) }
        : { ok: true, json: async () => ({ plan: { id: 'p1' } }) }
    )

  beforeEach(() => {
    serveWeek()
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ plans: [] }) })) as unknown as typeof fetch
  })

  it('asks for the week itself, today included, and shows the windows under a read about timing', async () => {
    ;(fetchEntries as jest.Mock).mockImplementation(async (params: { dateFrom?: string }) =>
      params.dateFrom === weekStart
        ? [
            entry('deep_work', '10:00', '11:30', weekStart),
            entry('deep_work', '10:00', '11:30', getUserToday()),
            entry('deep_work', '22:00', '23:00', weekStart),
            entry('social', '19:30', '21:00', weekStart),
          ]
        : []
    )
    render(<WeeklyReviewContent />)

    const card = await screen.findByRole('region', { name: 'In your windows this week' })
    expect(fetchEntries).toHaveBeenCalledWith({
      dateFrom: weekStart,
      dateTo: shiftDateString(weekStart, 6),
      status: 'confirmed',
    })
    expect(within(card).getByText('3h')).toBeInTheDocument()
    expect(within(card).getByText(/of 4h/)).toBeInTheDocument()
    expect(within(card).getByText('Time with people')).toBeInTheDocument()
    expect(screen.queryByText(/% of your focused work/)).not.toBeInTheDocument()
  })

  it('leaves out the logging-volume figures, even with a week to compare to', async () => {
    serveWeek({ previousWeekMinutes: 300, hasPreviousWeekData: true })
    render(<WeeklyReviewContent />)

    await waitFor(() => expect(screen.getByText('This week')).toBeInTheDocument())
    expect(screen.queryByText('Active Days')).not.toBeInTheDocument()
    expect(screen.queryByText('Entries')).not.toBeInTheDocument()
    expect(screen.queryByText(/time logged vs/)).not.toBeInTheDocument()
  })

  it('leaves the windows out of a read that is not about timing', async () => {
    ;(fetchEntries as jest.Mock).mockResolvedValue([entry('deep_work', '10:00', '11:30', weekStart)])
    serveWeek({ read: plainRead })
    render(<WeeklyReviewContent />)

    await waitFor(() => expect(screen.getByText('This week')).toBeInTheDocument())
    expect(screen.queryByRole('region', { name: /In your windows/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Behind this')).not.toBeInTheDocument()
  })

  it('leads with the read in the model\'s words, or its facts, with "Ask about this"', async () => {
    serveWeek({ coachSummary: 'Focus fell outside the windows on three days. One option is the essay at 9:00 AM.' })
    const first = render(<WeeklyReviewContent />)
    expect(
      await screen.findByText('Focus fell outside the windows on three days. One option is the essay at 9:00 AM.')
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ask about this' })).toBeInTheDocument()
    first.unmount()

    serveWeek({ read: plainRead, coachSummary: null, weekStart: shiftDateString(weekStart, -7) })
    render(<WeeklyReviewContent />)
    expect(await screen.findByText(plainRead.facts.join(' '))).toBeInTheDocument()
  })

  it('shows the evidence and one button into the planner, and no Highlights or Insights', async () => {
    render(<WeeklyReviewContent />)
    expect(await screen.findByText('Behind this')).toBeInTheDocument()
    expect(screen.getByText('30m of 2h inside')).toBeInTheDocument()
    const buttons = screen.getAllByRole('button', { name: /^Plan / })
    expect(buttons).toHaveLength(1)
    expect(buttons[0]).toHaveTextContent('Plan "Essay draft" at 9:00 AM tomorrow')
    expect(screen.queryByText('Insights')).not.toBeInTheDocument()
    expect(screen.queryByText(/Best day/)).not.toBeInTheDocument()
    fireEvent.click(buttons[0])
    await waitFor(() =>
      expect(stableRouter.push).toHaveBeenCalledWith(`/calendar?date=${shiftDateString(getUserToday(), 1)}`)
    )
  })

  it('shows "What your log shows" with a finding, and nothing without one', async () => {
    const sentence =
      'On the 7 days you trained before noon, your focused work came to a median of 3h 10m. On the 9 days you trained later, 2h 20m.'
    serveWeek({ finding: { id: 'training-early-late', sentence } })
    const first = render(<WeeklyReviewContent />)
    expect(await screen.findByText('What your log shows')).toBeInTheDocument()
    expect(screen.getByText(sentence)).toBeInTheDocument()
    expect(screen.getByText('From your last three months. A pattern in the log, not a cause.')).toBeInTheDocument()
    first.unmount()

    serveWeek({ finding: null })
    render(<WeeklyReviewContent />)
    await screen.findByText('Behind this')
    expect(screen.queryByText('What your log shows')).not.toBeInTheDocument()
  })

  it('draws the ring lines, or the one too-little-history line', async () => {
    serveWeek({
      comparisons: {
        rings: {
          body: { usual: 40, relation: 'above' },
          focus: { usual: 70, relation: 'about' },
          social: { usual: 55, relation: 'below' },
        },
        loggedDays: 20,
      },
    })
    const first = render(<WeeklyReviewContent />)
    expect(await screen.findByText('Above your usual 40')).toBeInTheDocument()
    expect(screen.getByText('About your usual')).toBeInTheDocument()
    expect(screen.getByText('Below your usual 55')).toBeInTheDocument()
    first.unmount()

    serveWeek({ comparisons: { rings: { body: null, focus: null, social: null }, loggedDays: 4 } })
    render(<WeeklyReviewContent />)
    expect(
      await screen.findByText('Too little history to compare yet: 4 of the last 28 days have anything logged.')
    ).toBeInTheDocument()
  })

  it('sends the stated wake time with the request', async () => {
    window.localStorage.setItem('wake-time', String(7 * 60))
    render(<WeeklyReviewContent />)
    await screen.findByText('Behind this')
    const [, init] = (csrfFetch as jest.Mock).mock.calls.find(([url]) => url === '/api/weekly-review')
    expect(JSON.parse(init.body)).toMatchObject({ weekStart, wakeMinutes: 7 * 60 })
  })
})

describe('useWeekEntries', () => {
  function Probe({ week }: { week: string }) {
    const entries = useWeekEntries(week)
    return <p>{entries.length} entries</p>
  }

  it('never shows one week under another while the next one loads', async () => {
    let release: (rows: unknown[]) => void = () => {}
    ;(fetchEntries as jest.Mock).mockImplementation(async (params: { dateFrom?: string }) =>
      params.dateFrom === '2026-11-02'
        ? [entry('deep_work', '09:00', '10:00', '2026-11-02'), entry('exercise', '17:00', '18:00', '2026-11-03')]
        : new Promise((resolve) => { release = resolve })
    )
    const { rerender } = render(<Probe week="2026-11-02" />)
    await waitFor(() => expect(screen.getByText('2 entries')).toBeInTheDocument())

    rerender(<Probe week="2026-10-26" />)
    expect(screen.getByText('0 entries')).toBeInTheDocument()

    await waitFor(() => expect(fetchEntries).toHaveBeenCalledTimes(2))
    release([entry('social', '19:00', '20:00', '2026-10-27')])
    await waitFor(() => expect(screen.getByText('1 entries')).toBeInTheDocument())
  })

  it('shows a week it has seen before at once, then refreshes it', async () => {
    window.sessionStorage.setItem(
      'week-entries:2026-11-02',
      JSON.stringify({ entries: [{ category: 'deep_work', start_time: '09:00', end_time: '10:00', duration_minutes: 60 }] })
    )
    ;(fetchEntries as jest.Mock).mockResolvedValue([
      entry('deep_work', '09:00', '10:00', '2026-11-02'),
      entry('deep_work', '14:00', '15:00', '2026-11-02'),
    ])
    render(<Probe week="2026-11-02" />)

    expect(screen.getByText('1 entries')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('2 entries')).toBeInTheDocument())
  })
})
