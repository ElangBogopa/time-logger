/**
 * The day review renders on two routes from one component: /day-review, which
 * is a bare page, and /review?tab=day, which already has a page heading, its
 * own padding and a tab bar.
 *
 * After the two copies were consolidated the surviving component brought its
 * page chrome with it, so the review tab drew a second "Day in Review"
 * heading above the content and a Back button that navigated out of the tab
 * altogether. The `embedded` prop drops the chrome; everything that is
 * actually the day review must still render.
 */

import { render, screen, waitFor } from '@testing-library/react'
import { useAccount } from '@/hooks/useAccount'
import { csrfFetch, fetchEntries } from '@/lib/api'
import { getUserToday } from '@/lib/types'

jest.mock('@/hooks/useAccount', () => ({ useAccount: jest.fn() }))
const stableRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() }
const stableParams = new URLSearchParams('')
jest.mock('next/navigation', () => ({
  useRouter: () => stableRouter,
  useSearchParams: () => stableParams,
}))
jest.mock('@/lib/api', () => ({ csrfFetch: jest.fn(), fetchEntries: jest.fn(async () => []) }))
jest.mock('@/lib/client-cache', () => ({ cacheGet: jest.fn(() => null), cacheSet: jest.fn() }))
const NO_EVENTS: never[] = []
jest.mock('@/contexts/CalendarContext', () => ({ useCalendar: () => ({ getEventsForDate: () => NO_EVENTS }) }))
jest.mock('sonner', () => ({ toast: { error: jest.fn() } }))
jest.mock('@/lib/types', () => ({
  ...jest.requireActual('@/lib/types'),
  getUserCurrentHour: () => 22, // past the 9pm unlock, so the review renders
}))

import DayReviewContent from '@/components/review/DayReviewContent'

const TODAY = getUserToday()
const summary = {
  date: TODAY,
  score: 72,
  scoreColor: 'green',
  sessionsLogged: 2,
  totalSessions: 3,
  totalMinutesLogged: 300,
  wins: [{ id: 'longest-focus', text: '150 min focus session on "Coding"', type: 'focus' }],
  categoryBreakdown: [],
  aggregatedBreakdown: [],
  timeline: [],
  todayMood: null,
  longestFocusSession: null,
  productivityScore: null,
}

beforeEach(() => {
  jest.clearAllMocks()
  window.localStorage.clear()
  ;(useAccount as jest.Mock).mockReturnValue({ status: 'authenticated', data: { user: { id: 'u1' } } })
  ;(fetchEntries as jest.Mock).mockResolvedValue([
    { id: 'e1', date: TODAY, activity: 'Coding', category: 'deep_work', status: 'confirmed', start_time: '09:00', end_time: '11:30', duration_minutes: 150 },
  ])
  global.fetch = jest.fn(async (url: string) =>
    String(url).includes('/api/day-review')
      ? { ok: true, json: async () => ({ source: 'live', review: null }) }
      : String(url).includes('/api/plans')
        ? { ok: true, json: async () => ({ plans: [] }) }
        : { ok: true, json: async () => summary }
  ) as unknown as typeof fetch
  ;(csrfFetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ commentary: 'A steady day.' }) })
})

const ready = () => waitFor(() => expect(screen.getByText('A steady day.')).toBeInTheDocument())

describe('standalone /day-review', () => {
  it('draws its own heading and Back button, because the page has none', async () => {
    render(<DayReviewContent />)
    await ready()

    expect(screen.getByRole('heading', { name: 'Day in Review' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument()
  })
})

describe('embedded in the review tab', () => {
  it('leaves the page chrome to the page', async () => {
    render(<DayReviewContent embedded />)
    await ready()

    expect(screen.queryByRole('heading', { name: 'Day in Review' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument()
  })

  it('still renders the review itself', async () => {
    render(<DayReviewContent embedded />)
    await ready()

    expect(screen.getByText('A steady day.')).toBeInTheDocument()
    expect(screen.getByText('Mind')).toBeInTheDocument()
    expect(screen.getByText('Behind this')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Plan / })).toHaveLength(1)
  })
})
