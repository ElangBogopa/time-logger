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

import { render, screen, waitFor, within } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import { csrfFetch, fetchEntries } from '@/lib/api'
import { getUserToday, getWeekStartForDate, shiftDateString } from '@/lib/types'

jest.mock('next-auth/react', () => ({ useSession: jest.fn() }))
const stableRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() }
const stableParams = new URLSearchParams('')
jest.mock('next/navigation', () => ({
  useRouter: () => stableRouter,
  useSearchParams: () => stableParams,
}))
jest.mock('@/lib/api', () => ({ csrfFetch: jest.fn(), fetchEntries: jest.fn(async () => []) }))
jest.mock('@/lib/client-cache', () => ({ cacheGet: jest.fn(() => null), cacheSet: jest.fn() }))
jest.mock('@/lib/types', () => ({
  ...jest.requireActual('@/lib/types'),
  getUserCurrentHour: () => 22, // past the 9pm unlock, so the day review renders
}))

import DayReviewContent from '@/components/review/DayReviewContent'
import WeeklyReviewContent from '@/components/review/WeeklyReviewContent'
import { useWeekEntries } from '@/hooks/useWeekEntries'

const entry = (category: string, start_time: string, end_time: string, date = '2026-11-01') => {
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

const daySummary = (extra: Record<string, unknown>) => ({
  date: '2026-11-01',
  score: 72,
  scoreColor: 'green',
  sessionsLogged: 2,
  totalSessions: 3,
  totalMinutesLogged: 300,
  wins: [{ id: 'longest-focus', text: 'A long focus session', type: 'focus' }],
  categoryBreakdown: [],
  aggregatedBreakdown: [],
  timeline: [],
  todayMood: null,
  longestFocusSession: null,
  productivityScore: null,
  ...extra,
})

function serveDay(summary: Record<string, unknown>) {
  global.fetch = jest.fn(async (url: string) =>
    String(url).includes('/api/day-review')
      ? { ok: true, json: async () => ({ source: 'live', review: null }) }
      : { ok: true, json: async () => summary }
  ) as unknown as typeof fetch
}

beforeEach(() => {
  jest.clearAllMocks()
  window.localStorage.clear()
  window.sessionStorage.clear()
  ;(useSession as jest.Mock).mockReturnValue({ status: 'authenticated', data: { user: { id: 'u1' } } })
  ;(fetchEntries as jest.Mock).mockResolvedValue([])
  ;(csrfFetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ commentary: 'A steady day.' }) })
})

describe('the day review', () => {
  it('says how much of the day fell in the hours that suit it', async () => {
    // With no wake time known the windows are the reference day's: focus
    // 9–12 and 14–16, movement 6–8 and 17–19.
    serveDay(
      daySummary({
        entries: [
          entry('deep_work', '09:30', '11:30'), // all of it inside
          entry('deep_work', '20:00', '21:00'), // none of it
          entry('exercise', '12:00', '12:45'), // none of it
        ],
      })
    )
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
    serveDay(daySummary({ entries: [entry('deep_work', '09:30', '11:30')] }))
    render(<DayReviewContent embedded />)

    const card = await screen.findByRole('region', { name: 'In your windows' })
    expect(within(card).getByRole('img', { name: '0 percent of focused work inside your windows' })).toBeInTheDocument()
  })

  it('reads a saved day, which carries no entries, from the history', async () => {
    const yesterday = shiftDateString(getUserToday(), -1)
    ;(fetchEntries as jest.Mock).mockResolvedValue([
      entry('deep_work', '09:00', '10:30', yesterday),
      entry('deep_work', '09:00', '10:30', shiftDateString(yesterday, -1)), // another day's, not this one's
    ])
    serveDay(daySummary({ date: yesterday }))
    render(<DayReviewContent embedded />)

    const card = await screen.findByRole('region', { name: 'In your windows' })
    expect(within(card).getByText('1h 30m')).toBeInTheDocument()
    expect(within(card).getByText(/of 1h 30m/)).toBeInTheDocument()
  })

  it('says nothing when the day had nothing the windows are about', async () => {
    serveDay(daySummary({ entries: [entry('meals', '12:00', '12:30'), entry('sleep', '00:00', '07:00')] }))
    render(<DayReviewContent embedded />)

    await waitFor(() => expect(screen.getByText("Today's Wins")).toBeInTheDocument())
    expect(screen.queryByRole('region', { name: 'In your windows' })).not.toBeInTheDocument()
  })

  it('survives the history failing to load', async () => {
    ;(fetchEntries as jest.Mock).mockRejectedValue(new Error('offline'))
    const quiet = jest.spyOn(console, 'error').mockImplementation(() => {})
    serveDay(daySummary({ entries: [entry('deep_work', '09:30', '11:30')] }))
    render(<DayReviewContent embedded />)

    expect(await screen.findByRole('region', { name: 'In your windows' })).toBeInTheDocument()
    quiet.mockRestore()
  })
})

describe('the weekly review', () => {
  const weekStart = getWeekStartForDate(getUserToday(), 1)
  const review = {
    weekStart,
    weekEnd: shiftDateString(weekStart, 6),
    averages: { body: 60, focus: 70, social: 40 },
    activeDays: 3,
    highlights: [],
    totalMinutes: 600,
    entryCount: 9,
    previousWeekMinutes: null,
    previousWeekEntryCount: 0,
    hasEnoughData: true,
    hasPreviousWeekData: false,
    targetProgress: [],
    targetScorecards: [],
    categoryBreakdown: [],
    bestDays: [],
    bestHours: [],
    insights: [],
    coachSummary: null,
  }

  beforeEach(() => {
    ;(csrfFetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => review })
    global.fetch = jest.fn(async () => ({ ok: false, json: async () => null })) as unknown as typeof fetch
  })

  it('asks for the week itself, today included, and leads with the focus share', async () => {
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
    expect(within(card).getByText('75% of your focused work fell inside your focus windows.')).toBeInTheDocument()
    expect(within(card).getByText('3h')).toBeInTheDocument()
    expect(within(card).getByText(/of 4h/)).toBeInTheDocument()
    expect(within(card).getByText('Time with people')).toBeInTheDocument()
  })

  it('leaves the card out of a week with nothing to report', async () => {
    render(<WeeklyReviewContent />)

    await waitFor(() => expect(screen.getByText('This week')).toBeInTheDocument())
    expect(screen.queryByRole('region', { name: /In your windows/ })).not.toBeInTheDocument()
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
