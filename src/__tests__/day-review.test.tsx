/**
 * The day review: the three rings with a line each against the person's
 * last four weeks, one read worded from its facts, the evidence behind it,
 * and one button into the planner.
 */

import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { useAccount } from '@/hooks/useAccount'
import { csrfFetch, fetchEntries } from '@/lib/api'
import { getUserToday, shiftDateString } from '@/lib/types'
import { toast } from 'sonner'

jest.mock('@/hooks/useAccount', () => ({ useAccount: jest.fn() }))
const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() }
let mockParams = new URLSearchParams('')
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => mockParams,
}))
jest.mock('@/lib/api', () => ({ csrfFetch: jest.fn(), fetchEntries: jest.fn(async () => []) }))
jest.mock('@/lib/client-cache', () => ({ cacheGet: jest.fn(() => null), cacheSet: jest.fn(), cacheDelete: jest.fn() }))
const NO_EVENTS: never[] = []
jest.mock('@/contexts/CalendarContext', () => ({ useCalendar: () => ({ getEventsForDate: () => NO_EVENTS }) }))
jest.mock('sonner', () => ({ toast: { error: jest.fn() } }))
jest.mock('@/lib/types', () => ({
  ...jest.requireActual('@/lib/types'),
  getUserCurrentHour: () => 22, // past the 9pm unlock, so the review renders
}))

import DayReviewContent from '@/components/review/DayReviewContent'

const TODAY = getUserToday()
const YESTERDAY = shiftDateString(TODAY, -1)
const TOMORROW = shiftDateString(TODAY, 1)

function row(date: string, activity: string, category: string, start: string, minutes: number) {
  const [h, m] = start.split(':').map(Number)
  const end = h * 60 + m + minutes
  return {
    id: `${date}-${activity}-${start}`,
    date,
    activity,
    category,
    start_time: start,
    end_time: `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`,
    duration_minutes: minutes,
    status: 'confirmed',
  }
}

const summary = (date: string, extra: Record<string, unknown> = {}) => ({
  date,
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
  longestFocusSession: { activity: 'Essay draft', minutes: 130 },
  productivityScore: null,
  ...extra,
})

/** The routes the screen asks with plain fetch: the review's status, the summary, the plans. */
function serve(daySummary: Record<string, unknown>) {
  global.fetch = jest.fn(async (url: string) => {
    const target = String(url)
    if (target.includes('/api/day-review')) return { ok: true, json: async () => ({ source: 'live', review: null }) }
    if (target.includes('/api/day-summary')) return { ok: true, json: async () => daySummary }
    if (target.includes('/api/plans')) return { ok: true, json: async () => ({ plans: [] }) }
    return { ok: false, json: async () => ({}) }
  }) as unknown as typeof fetch
}

const commentaryCalls = () =>
  (csrfFetch as jest.Mock).mock.calls.filter(([url]) => String(url) === '/api/day-commentary')

function wordsFromModel(text: string) {
  ;(csrfFetch as jest.Mock).mockImplementation(async (url: string) => {
    if (url === '/api/day-commentary') return { ok: true, json: async () => ({ commentary: text }) }
    return { ok: false, json: async () => ({}) }
  })
}

// A long focused block on the reviewed day, with no history: keep-long-focus.
const longFocus = (date: string) => [row(date, 'Essay draft', 'deep_work', '09:15', 130)]

function show(date: string, rows: unknown[], extra: Record<string, unknown> = {}) {
  mockParams = new URLSearchParams(`date=${date}`)
  ;(fetchEntries as jest.Mock).mockResolvedValue(rows)
  serve(summary(date, extra))
  return render(<DayReviewContent />)
}

beforeEach(() => {
  jest.clearAllMocks()
  window.localStorage.clear()
  window.sessionStorage.clear()
  ;(useAccount as jest.Mock).mockReturnValue({ status: 'authenticated', data: { user: { id: 'u1' } } })
  wordsFromModel('The essay ran 2h 10m from 9:15 AM.')
})

describe('the read', () => {
  it('shows the read in the model\'s words, with "Ask about this" under them', async () => {
    show(YESTERDAY, longFocus(YESTERDAY))
    const words = await screen.findByText('The essay ran 2h 10m from 9:15 AM.')
    expect(within(words.parentElement as HTMLElement).getByRole('button', { name: 'Ask about this' })).toBeInTheDocument()
    // The model is given the read's kind and facts and nothing else.
    const [, init] = commentaryCalls()[0]
    expect(JSON.parse(init.body)).toEqual({
      read: {
        kind: 'keep',
        facts: ['The longest focused block was 2h 10m on "Essay draft", starting at 9:15 AM.', 'It started inside the focus window (9:00 AM–12:00 PM).'],
      },
    })
  })

  it('shows the facts themselves when the model fails', async () => {
    ;(csrfFetch as jest.Mock).mockResolvedValue({ ok: false, json: async () => ({}) })
    show(YESTERDAY, longFocus(YESTERDAY))
    expect(
      await screen.findByText(
        'The longest focused block was 2h 10m on "Essay draft", starting at 9:15 AM. It started inside the focus window (9:00 AM–12:00 PM).'
      )
    ).toBeInTheDocument()
  })

  it('asks the model once for an unchanged day, and again when the facts change', async () => {
    const first = show(YESTERDAY, longFocus(YESTERDAY))
    await screen.findByText('The essay ran 2h 10m from 9:15 AM.')
    first.unmount()

    const second = show(YESTERDAY, longFocus(YESTERDAY))
    await screen.findByText('The essay ran 2h 10m from 9:15 AM.')
    expect(commentaryCalls()).toHaveLength(1)
    second.unmount()

    wordsFromModel('The essay ran 2h 30m from 9:15 AM.')
    show(YESTERDAY, [row(YESTERDAY, 'Essay draft', 'deep_work', '09:15', 150)])
    await screen.findByText('The essay ran 2h 30m from 9:15 AM.')
    expect(commentaryCalls()).toHaveLength(2)
  })

  it('never asks the model about a day with nothing logged', async () => {
    show(YESTERDAY, [], { totalMinutesLogged: 0, longestFocusSession: null })
    expect(await screen.findByText('Nothing was logged on this day')).toBeInTheDocument()
    // and the empty day still ends on the plain button
    expect(await screen.findByRole('button', { name: 'Plan tomorrow' })).toBeInTheDocument()
    expect(commentaryCalls()).toHaveLength(0)
  })

  it('never asks the model when the log holds nothing for the day', async () => {
    show(YESTERDAY, [])
    expect(
      await screen.findByText('An ordinary day. There is too little history yet to say what is usual.')
    ).toBeInTheDocument()
    expect(commentaryCalls()).toHaveLength(0)
  })

  it('has no longest-focus-session card and no "… logged" caption', async () => {
    show(YESTERDAY, longFocus(YESTERDAY))
    await screen.findByText('The essay ran 2h 10m from 9:15 AM.')
    expect(screen.queryByText(/longest focus session/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^\d+h( \d+m)? logged$/)).not.toBeInTheDocument()
  })
})

describe('the evidence', () => {
  it('shows "Behind this" and "In your windows" for a read about timing', async () => {
    show(YESTERDAY, longFocus(YESTERDAY))
    expect(await screen.findByText('Behind this')).toBeInTheDocument()
    expect(screen.getByText('Longest focused block')).toBeInTheDocument()
    expect(screen.getByText('2h 10m, from 9:15 AM')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'In your windows' })).toBeInTheDocument()
  })

  it('shows neither for an ordinary day', async () => {
    wordsFromModel('An ordinary day, mostly email.')
    show(YESTERDAY, [row(YESTERDAY, 'Email', 'shallow_work', '10:00', 60)])
    await screen.findByText('An ordinary day, mostly email.')
    expect(screen.queryByText('Behind this')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'In your windows' })).not.toBeInTheDocument()
  })
})

describe('the button', () => {
  it('is exactly one, and goes to the planner', async () => {
    wordsFromModel('An ordinary day, mostly email.')
    show(shiftDateString(TODAY, -4), [row(shiftDateString(TODAY, -4), 'Email', 'shallow_work', '10:00', 60)])
    await screen.findByText('An ordinary day, mostly email.')
    const buttons = screen.getAllByRole('button', { name: /^Plan / })
    expect(buttons).toHaveLength(1)
    fireEvent.click(buttons[0])
    expect(mockRouter.push).toHaveBeenCalledWith(`/calendar?date=${TOMORROW}`)
    expect(csrfFetch).not.toHaveBeenCalledWith('/api/plans', expect.anything())
  })

  it('names a free slot, and on a tap puts it into the plan and opens the planner', async () => {
    ;(csrfFetch as jest.Mock).mockImplementation(async (url: string, init?: { method?: string }) => {
      if (url === '/api/day-commentary') return { ok: true, json: async () => ({ commentary: 'The essay ran 2h 10m from 9:15 AM.' }) }
      if (url === '/api/plans' && init?.method === 'POST') return { ok: true, json: async () => ({ plan: { id: 'p1' } }) }
      if (url === '/api/plans' && init?.method === 'PATCH') return { ok: true, json: async () => ({ plan: { id: 'p1' } }) }
      return { ok: false, json: async () => ({}) }
    })
    show(YESTERDAY, longFocus(YESTERDAY))

    const button = await screen.findByRole('button', { name: 'Plan "Essay draft" at 9:15 AM tomorrow' })
    expect(csrfFetch).not.toHaveBeenCalledWith('/api/plans', expect.anything())
    fireEvent.click(button)

    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith(`/calendar?date=${TOMORROW}`))
    const plans = (csrfFetch as jest.Mock).mock.calls.filter(([url]) => url === '/api/plans')
    expect(JSON.parse(plans[0][1].body)).toEqual({ date: TOMORROW, title: 'Essay draft' })
    expect(plans[0][1].method).toBe('POST')
    expect(JSON.parse(plans[1][1].body)).toEqual({ id: 'p1', committed_start: '09:15', committed_end: '11:30' })
    expect(plans[1][1].method).toBe('PATCH')
  })

  it('stays, and says so, when the plan cannot be added', async () => {
    ;(csrfFetch as jest.Mock).mockImplementation(async (url: string) => {
      if (url === '/api/day-commentary') return { ok: true, json: async () => ({ commentary: 'The essay ran 2h 10m from 9:15 AM.' }) }
      return { ok: false, json: async () => ({}) }
    })
    show(YESTERDAY, longFocus(YESTERDAY))
    fireEvent.click(await screen.findByRole('button', { name: 'Plan "Essay draft" at 9:15 AM tomorrow' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Couldn't add that to the plan. Try again."))
    expect(mockRouter.push).not.toHaveBeenCalled()
  })
})

describe('the ring lines', () => {
  it('says under each ring how it compares with the last four weeks', async () => {
    // Seven days of a two-hour block: Mind 55 each, Body and Heart 0. The
    // reviewed day: 2h 10m (about the same), no movement, two hours with family.
    const history = Array.from({ length: 7 }, (_, i) => row(shiftDateString(YESTERDAY, -(i + 1)), 'Desk', 'deep_work', '09:00', 120))
    show(YESTERDAY, [...history, row(YESTERDAY, 'Dinner with family', 'social', '19:00', 120), row(YESTERDAY, 'Desk', 'deep_work', '09:00', 130)])
    expect(await screen.findAllByText('About your usual')).toHaveLength(2)
    expect(screen.getByText('Above your usual 0')).toBeInTheDocument()
    expect(screen.queryByText(/Too little history/)).not.toBeInTheDocument()
  })

  it('says once, under the row, when there is too little history to compare', async () => {
    const history = Array.from({ length: 4 }, (_, i) => row(shiftDateString(YESTERDAY, -(i + 1)), 'Desk', 'deep_work', '09:00', 60))
    show(YESTERDAY, [...history, ...longFocus(YESTERDAY)])
    expect(
      await screen.findByText('Too little history to compare yet: 4 of the last 28 days have anything logged.')
    ).toBeInTheDocument()
    expect(screen.queryByText(/your usual/)).not.toBeInTheDocument()
  })
})

describe('the page around it', () => {
  it('redirects to login if not authenticated', () => {
    ;(useAccount as jest.Mock).mockReturnValue({ status: 'unauthenticated' })
    show(YESTERDAY, [])
    expect(mockRouter.push).toHaveBeenCalledWith('/login')
  })

  it('goes back from its own Back button', async () => {
    show(YESTERDAY, longFocus(YESTERDAY))
    fireEvent.click(await screen.findByRole('button', { name: /back/i }))
    expect(mockRouter.back).toHaveBeenCalled()
  })
})
