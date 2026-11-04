/**
 * Planning a day.
 *
 * The loop existed but nothing joined it up: you added a task inside a
 * goal's page, gave it a time in a modal there, and the result appeared on
 * a calendar reachable only from Settings. The calendar is now the planner —
 * it says so on a future date — and a task with no time sits in a tray until
 * you give it one.
 */

import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { csrfFetch } from '@/lib/api'

const TOMORROW = '2026-11-05'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(`date=${TOMORROW}`),
}))
jest.mock('next-auth/react', () => ({
  useSession: () => ({ status: 'authenticated', data: { user: { id: 'u1' } } }),
}))
jest.mock('@/contexts/CalendarContext', () => ({
  useCalendar: () => ({
    getEventsForDate: () => [],
    fetchEventsForDate: jest.fn(),
    refreshCalendar: jest.fn(),
    isLoading: false,
    isDateInCache: () => true,
    calendarStatus: { connected: false },
  }),
}))
jest.mock('@/lib/api', () => ({
  fetchEntries: jest.fn(async () => []),
  csrfFetch: jest.fn(async () => ({ ok: true, json: async () => ({}) })),
}))
jest.mock('@/lib/types', () => ({
  ...jest.requireActual('@/lib/types'),
  getLocalDateString: (d?: Date) => (d ? jest.requireActual('@/lib/types').getLocalDateString(d) : '2026-11-04'),
  isDateLoggable: () => false,
}))
jest.mock('@/components/TimelineView', () => ({ __esModule: true, default: () => <div data-testid="grid" /> }))
jest.mock('@/components/QuickLogModal', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/GhostEntryModal', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/CommitTimeModal', () => ({
  __esModule: true,
  default: ({ taskTitle }: { taskTitle: string }) => <div data-testid="commit-modal">{taskTitle}</div>,
}))

import CalendarPage from '@/app/calendar/page'

const plans = [
  { id: 'p1', title: 'Write the pricing memo', date: TOMORROW, committed_start: null, committed_end: null, completed: false },
  { id: 'p2', title: 'Gym', date: TOMORROW, committed_start: '07:00', committed_end: '08:00', completed: false },
]

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = jest.fn(async (url: string) =>
    String(url).includes('/api/plans')
      ? { ok: true, json: async () => ({ plans }) }
      : { ok: true, json: async () => ({ data: [] }) }
  ) as unknown as typeof fetch
})

it('says it is a plan when the date is ahead', async () => {
  render(<CalendarPage />)
  expect(await screen.findByText('Plan Tomorrow')).toBeInTheDocument()
})

it('puts a task with no time in the tray, and keeps one that has a time off it', async () => {
  render(<CalendarPage />)

  const untimed = await screen.findByText('Write the pricing memo')
  const tray = untimed.closest('section')!

  // Gym already has 07:00–08:00, so it belongs on the day, not in the tray
  // of things still waiting for one.
  expect(within(tray).queryByText('Gym')).not.toBeInTheDocument()
  // and it is listed on the day itself
  expect(screen.getByText('Gym')).toBeInTheDocument()
})

it('opens the time picker for the task you tap', async () => {
  render(<CalendarPage />)

  fireEvent.click(await screen.findByText('Write the pricing memo'))

  await waitFor(() => expect(screen.getByTestId('commit-modal')).toHaveTextContent('Write the pricing memo'))
})

it('adds a task to the day it is planning', async () => {
  render(<CalendarPage />)

  const input = await screen.findByPlaceholderText('Add something for tomorrow')
  fireEvent.change(input, { target: { value: 'Call the dentist' } })
  fireEvent.submit(input.closest('form')!)

  await waitFor(() => expect(csrfFetch).toHaveBeenCalled())
  const [url, init] = (csrfFetch as jest.Mock).mock.calls[0]
  expect(url).toBe('/api/plans')
  expect(JSON.parse(init.body)).toEqual({ date: TOMORROW, title: 'Call the dentist' })
})
