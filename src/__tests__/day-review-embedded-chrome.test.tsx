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
import { useSession } from 'next-auth/react'
import { csrfFetch } from '@/lib/api'

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
  getUserCurrentHour: () => 22, // past the 9pm unlock, so the review renders
}))

import DayReviewContent from '@/components/review/DayReviewContent'

const summary = {
  date: '2026-11-01',
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
  ;(useSession as jest.Mock).mockReturnValue({ status: 'authenticated', data: { user: { id: 'u1' } } })
  global.fetch = jest.fn(async (url: string) =>
    String(url).includes('/api/day-review')
      ? { ok: true, json: async () => ({ source: 'live', review: null }) }
      : { ok: true, json: async () => summary }
  ) as unknown as typeof fetch
  ;(csrfFetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ commentary: 'A steady day.' }) })
})

const ready = () => waitFor(() => expect(screen.getByText("Today's Wins")).toBeInTheDocument())

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

    expect(screen.getByText('150 min focus session on "Coding"')).toBeInTheDocument()
    expect(screen.getByText('A steady day.')).toBeInTheDocument()
    expect(screen.getByText(/2\/3 sessions/)).toBeInTheDocument()
    expect(screen.getByText(/November 1/)).toBeInTheDocument()
  })
})
