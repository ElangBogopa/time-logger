/**
 * Regression: the AI commentary effect must not retry forever.
 *
 * DayReviewContent gated its commentary fetch on the state that fetch itself
 * sets:
 *
 *   if (summary && !commentary && !isLoadingCommentary) fetchCommentary(summary)
 *   deps: [summary, commentary, isLoadingCommentary, fetchCommentary]
 *
 * When a request finished without producing commentary — a non-ok response, a
 * thrown error, or the route legitimately returning { commentary: '' } — the
 * guard became true again the moment isLoadingCommentary flipped back to
 * false, so the effect re-fired immediately and forever. Because the section
 * renders only while (commentary || isLoadingCommentary), it mounted and
 * unmounted on every pass: a non-stop flicker, with Today's Wins jumping as
 * the block above it appeared and vanished, plus an unbounded stream of POSTs
 * to /api/day-commentary.
 */

import { render, screen, waitFor } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import { csrfFetch } from '@/lib/api'

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

jest.mock('next-auth/react', () => ({ useSession: jest.fn() }))
jest.mock('@/lib/api', () => ({ csrfFetch: jest.fn() }))
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
  // the shape /api/day-summary really returns
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
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => summary })) as unknown as typeof fetch
})

async function settle() {
  await waitFor(() => expect(screen.getByText("Today's Wins")).toBeInTheDocument())
  // Long enough for many cycles of a 30ms request: the pre-fix component reached
  // ~20 calls in this window.
  for (let i = 0; i < 8; i++) await delay(100)
}

it('requests commentary once when the endpoint is rate limited', async () => {
  ;(csrfFetch as jest.Mock).mockImplementation(async () => {
    await delay(30)
    return { ok: false, status: 429, json: async () => ({ error: 'Rate limit exceeded' }) }
  })

  render(<DayReviewContent />)
  await settle()

  expect(csrfFetch).toHaveBeenCalledTimes(1)
})

it('requests commentary once when the route returns empty commentary', async () => {
  // /api/day-commentary returns `completion…?.trim() || ''`, so '' is reachable
  ;(csrfFetch as jest.Mock).mockImplementation(async () => {
    await delay(30)
    return { ok: true, json: async () => ({ commentary: '' }) }
  })

  render(<DayReviewContent />)
  await settle()

  expect(csrfFetch).toHaveBeenCalledTimes(1)
})

it('requests commentary once when the request throws', async () => {
  ;(csrfFetch as jest.Mock).mockImplementation(async () => {
    await delay(30)
    throw new Error('network down')
  })

  render(<DayReviewContent />)
  await settle()

  expect(csrfFetch).toHaveBeenCalledTimes(1)
})

it('renders each win from the summary', async () => {
  // The local Win type claimed { icon, label }, which the API never sends, so
  // the section rendered its heading over empty rows.
  ;(csrfFetch as jest.Mock).mockImplementation(async () => {
    await delay(30)
    return { ok: true, json: async () => ({ commentary: 'Good day.' }) }
  })

  render(<DayReviewContent />)
  await waitFor(() => expect(screen.getByText("Today's Wins")).toBeInTheDocument())

  expect(screen.getByText('150 min focus session on "Coding"')).toBeInTheDocument()
})

it('renders the commentary and stops requesting on success', async () => {
  ;(csrfFetch as jest.Mock).mockImplementation(async () => {
    await delay(30)
    return { ok: true, json: async () => ({ commentary: 'Strong focus today.' }) }
  })

  render(<DayReviewContent />)
  await settle()

  expect(screen.getByText('Strong focus today.')).toBeInTheDocument()
  expect(csrfFetch).toHaveBeenCalledTimes(1)
})

describe('reusing commentary between visits', () => {
  const ok = (commentary: string) => async () => {
    await delay(30)
    return { ok: true, json: async () => ({ commentary }) }
  }

  it('does not regenerate when nothing about the day changed', async () => {
    // The old cache was a module-level Map keyed on the date alone, so every
    // full page load regenerated the commentary even on an unchanged day.
    ;(csrfFetch as jest.Mock).mockImplementation(ok('A steady day.'))

    const first = render(<DayReviewContent />)
    await waitFor(() => expect(screen.getByText('A steady day.')).toBeInTheDocument())
    first.unmount()

    render(<DayReviewContent />)
    await waitFor(() => expect(screen.getByText('A steady day.')).toBeInTheDocument())
    await delay(120)

    expect(csrfFetch).toHaveBeenCalledTimes(1)
  })

  it('regenerates once after the day data changes', async () => {
    ;(csrfFetch as jest.Mock).mockImplementation(ok('A steady day.'))

    const first = render(<DayReviewContent />)
    await waitFor(() => expect(screen.getByText('A steady day.')).toBeInTheDocument())
    first.unmount()

    // same date, but another entry has been logged since
    const later = { ...summary, totalMinutesLogged: summary.totalMinutesLogged + 45, score: 71 }
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => later })) as unknown as typeof fetch
    ;(csrfFetch as jest.Mock).mockImplementation(ok('Even better after that session.'))

    render(<DayReviewContent />)
    await waitFor(() => expect(screen.getByText('Even better after that session.')).toBeInTheDocument())
    await delay(120)

    expect(csrfFetch).toHaveBeenCalledTimes(2)
  })
})
