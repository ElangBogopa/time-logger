/**
 * Regression: the AI commentary effect must not retry forever. The line
 * now words the day's read (lib/review-read.ts); the rule is the same.
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
 * unmounted on every pass: a non-stop flicker, with the wins block jumping as
 * the block above it appeared and vanished, plus an unbounded stream of POSTs
 * to /api/day-commentary.
 */

import { render, screen, waitFor } from '@testing-library/react'
import { useAccount } from '@/hooks/useAccount'
import { csrfFetch, fetchEntries } from '@/lib/api'
import { getUserToday } from '@/lib/types'

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

jest.mock('@/hooks/useAccount', () => ({ useAccount: jest.fn() }))
// The surviving implementation reads ?date= and can redirect to /login.
// Both must be stable across renders. Next's own useRouter is; a mock that
// returns a fresh object each render re-fires every effect that depends on
// it, which looks exactly like a bug in the component.
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
// The day's log, read by the screen: one long focused block, a Keep.
const block = (minutes: number) => [{
  id: 'e1', date: TODAY, activity: 'Coding', category: 'deep_work', status: 'confirmed',
  start_time: '09:00', end_time: '11:30', duration_minutes: minutes,
}]
const commentaryCalls = () =>
  (csrfFetch as jest.Mock).mock.calls.filter(([url]) => url === '/api/day-commentary').length

const summary = {
  date: TODAY,
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
  ;(useAccount as jest.Mock).mockReturnValue({ status: 'authenticated', data: { user: { id: 'u1' } } })
  ;(fetchEntries as jest.Mock).mockResolvedValue(block(150))
  // It asks /api/day-review first (is this day saved?), then /api/day-summary.
  global.fetch = jest.fn(async (url: string) =>
    String(url).includes('/api/day-review')
      ? { ok: true, json: async () => ({ source: 'live', review: null }) }
      : String(url).includes('/api/plans')
        ? { ok: true, json: async () => ({ plans: [] }) }
        : { ok: true, json: async () => summary }
  ) as unknown as typeof fetch
})

async function settle() {
  await waitFor(() => expect(screen.getByText('Behind this')).toBeInTheDocument())
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

  expect(commentaryCalls()).toBe(1)
})

it('requests commentary once when the route returns empty commentary', async () => {
  // /api/day-commentary returns `completion…?.trim() || ''`, so '' is reachable
  ;(csrfFetch as jest.Mock).mockImplementation(async () => {
    await delay(30)
    return { ok: true, json: async () => ({ commentary: '' }) }
  })

  render(<DayReviewContent />)
  await settle()

  expect(commentaryCalls()).toBe(1)
})

it('requests commentary once when the request throws', async () => {
  ;(csrfFetch as jest.Mock).mockImplementation(async () => {
    await delay(30)
    throw new Error('network down')
  })

  render(<DayReviewContent />)
  await settle()

  expect(commentaryCalls()).toBe(1)
})

it('no longer lists the wins on the screen', async () => {
  // The wins are still sent to the coach and saved with the review, but the
  // screen no longer repeats them.
  ;(csrfFetch as jest.Mock).mockImplementation(async () => {
    await delay(30)
    return { ok: true, json: async () => ({ commentary: 'Good day.' }) }
  })

  render(<DayReviewContent />)
  await waitFor(() => expect(screen.getByText('Good day.')).toBeInTheDocument())

  expect(screen.queryByText('150 min focus session on "Coding"')).not.toBeInTheDocument()
})

it('renders the commentary and stops requesting on success', async () => {
  ;(csrfFetch as jest.Mock).mockImplementation(async () => {
    await delay(30)
    return { ok: true, json: async () => ({ commentary: 'Strong focus today.' }) }
  })

  render(<DayReviewContent />)
  await settle()

  expect(screen.getByText('Strong focus today.')).toBeInTheDocument()
  expect(commentaryCalls()).toBe(1)
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

    expect(commentaryCalls()).toBe(1)
  })

  it('regenerates once after the day data changes', async () => {
    ;(csrfFetch as jest.Mock).mockImplementation(ok('A steady day.'))

    const first = render(<DayReviewContent />)
    await waitFor(() => expect(screen.getByText('A steady day.')).toBeInTheDocument())
    first.unmount()

    // same date, but the block has grown since: the read's facts change
    ;(fetchEntries as jest.Mock).mockResolvedValue(block(180))
    ;(csrfFetch as jest.Mock).mockImplementation(ok('Even better after that session.'))

    render(<DayReviewContent />)
    await waitFor(() => expect(screen.getByText('Even better after that session.')).toBeInTheDocument())
    await delay(120)

    expect(commentaryCalls()).toBe(2)
  })
})
