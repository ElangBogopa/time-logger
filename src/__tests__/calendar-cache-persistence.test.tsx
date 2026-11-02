/**
 * The calendar cache must survive a page reload.
 *
 * CalendarContext held both the Google event range and the connection status
 * in component state only, so every full page load — dashboard, review page,
 * session pages — refetched both. Measured on the live site: /api/calendar/
 * events and /api/calendar/status on every single cold load, the events call
 * covering a 22-day range from Google.
 */

import { render, screen, waitFor } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import { CalendarProvider, useCalendar } from '@/contexts/CalendarContext'

jest.mock('next-auth/react', () => ({ useSession: jest.fn() }))

const EVENTS_KEY = 'calendar-events-cache-v1'
const STATUS_KEY = 'calendar-status-cache-v1'

const events = [
  { id: 'e1', title: 'Standup', startTime: '09:00', endTime: '09:15', date: '2026-11-02', isAllDay: false },
]

function Probe() {
  const { getEventsForDate } = useCalendar()
  return <div data-testid="count">{getEventsForDate('2026-11-02').length}</div>
}

function seed(key: string, value: unknown, savedAt = Date.now()) {
  window.sessionStorage.setItem(key, JSON.stringify({ value, savedAt }))
}

function apiCalls() {
  return (global.fetch as jest.Mock).mock.calls.map((c) => String(c[0]))
}

beforeEach(() => {
  jest.clearAllMocks()
  window.sessionStorage.clear()
  ;(useSession as jest.Mock).mockReturnValue({ status: 'authenticated', data: { user: { id: 'u1' } } })
  global.fetch = jest.fn(async (url: string) => {
    if (String(url).includes('/api/calendar/status')) {
      return { ok: true, json: async () => ({ connected: true, source: 'google_oauth', googleEmail: 'a@b.c' }) }
    }
    return { ok: true, json: async () => ({ events }) }
  }) as unknown as typeof fetch
})

it('fetches status and events when nothing is cached', async () => {
  render(<CalendarProvider><Probe /></CalendarProvider>)

  await waitFor(() => expect(apiCalls().some((u) => u.includes('/api/calendar/events'))).toBe(true))
  expect(apiCalls().some((u) => u.includes('/api/calendar/status'))).toBe(true)
})

it('makes no calls at all when a fresh cache is in sessionStorage', async () => {
  seed(STATUS_KEY, { connected: true, source: 'google_oauth', googleEmail: 'a@b.c' })
  seed(EVENTS_KEY, { events, startDate: '2026-10-26', endDate: '2026-11-16', lastFetched: Date.now() })

  render(<CalendarProvider><Probe /></CalendarProvider>)

  await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'))
  await new Promise((r) => setTimeout(r, 60))

  expect(apiCalls().filter((u) => u.includes('/api/calendar/'))).toEqual([])
})

it('refetches events when the stored cache is past its 30 minutes', async () => {
  seed(STATUS_KEY, { connected: true, source: 'google_oauth', googleEmail: 'a@b.c' })
  seed(EVENTS_KEY, {
    events,
    startDate: '2026-10-26',
    endDate: '2026-11-16',
    lastFetched: Date.now() - 31 * 60 * 1000, // the cache's own age, not the envelope's
  })

  render(<CalendarProvider><Probe /></CalendarProvider>)

  await waitFor(() => expect(apiCalls().some((u) => u.includes('/api/calendar/events'))).toBe(true))
})

it('writes the fetched range back to sessionStorage', async () => {
  render(<CalendarProvider><Probe /></CalendarProvider>)

  await waitFor(() => {
    const raw = window.sessionStorage.getItem(EVENTS_KEY)
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw as string).value.events).toHaveLength(1)
  })
})

it('does not renew the cache life just by mounting again', async () => {
  const lastFetched = Date.now() - 29 * 60 * 1000
  seed(STATUS_KEY, { connected: true, source: 'google_oauth', googleEmail: 'a@b.c' })
  seed(EVENTS_KEY, { events, startDate: '2026-10-26', endDate: '2026-11-16', lastFetched })

  const first = render(<CalendarProvider><Probe /></CalendarProvider>)
  await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'))
  first.unmount()

  // re-persisting on mount must not reset lastFetched, or the cache would
  // never expire for anyone who keeps the tab open
  const stored = JSON.parse(window.sessionStorage.getItem(EVENTS_KEY) as string)
  expect(stored.value.lastFetched).toBe(lastFetched)
})

it('clears both caches on logout', async () => {
  seed(STATUS_KEY, { connected: true, source: 'google_oauth', googleEmail: 'a@b.c' })
  seed(EVENTS_KEY, { events, startDate: '2026-10-26', endDate: '2026-11-16', lastFetched: Date.now() })
  ;(useSession as jest.Mock).mockReturnValue({ status: 'unauthenticated', data: null })

  render(<CalendarProvider><Probe /></CalendarProvider>)

  await waitFor(() => expect(window.sessionStorage.getItem(EVENTS_KEY)).toBeNull())
  expect(window.sessionStorage.getItem(STATUS_KEY)).toBeNull()
})
