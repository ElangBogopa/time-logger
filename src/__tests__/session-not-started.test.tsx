/**
 * A session that has not begun cannot be finished.
 *
 * At 5:35pm the evening could be closed: "Evening Complete · 0m · Great
 * evening! You stayed on track", a green tick on the dashboard, and an offer
 * of a day review that was still locked. And an empty session's primary
 * button was "Done", which congratulated it.
 */

import { render, screen, waitFor } from '@testing-library/react'
import { fetchEntries } from '@/lib/api'

let mockHour = 10

jest.mock('next/navigation', () => ({
  useParams: () => ({ period: 'evening' }),
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams('date=2026-11-03'),
}))
jest.mock('next-auth/react', () => ({
  useSession: () => ({ status: 'authenticated', data: { user: { id: 'u1' } } }),
}))
jest.mock('@/contexts/CalendarContext', () => ({
  useCalendar: () => ({ getEventsForDate: () => [], refreshCalendar: jest.fn(), isLoading: false }),
}))
jest.mock('@/lib/api', () => ({
  fetchEntries: jest.fn(async () => []),
  createEntries: jest.fn(),
  categorizeActivities: jest.fn(),
  deleteEntry: jest.fn(),
  upsertSessionCompletion: jest.fn(),
  csrfFetch: jest.fn(async () => ({ ok: true, json: async () => ({}) })),
}))
jest.mock('@/lib/types', () => ({
  ...jest.requireActual('@/lib/types'),
  getUserToday: () => '2026-11-03',
  getRealToday: () => '2026-11-03',
  getUserCurrentHour: () => mockHour,
}))
jest.mock('@/components/TimelineView', () => ({ __esModule: true, default: () => <div /> }))
jest.mock('@/components/PeriodSummaryPopup', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/QuickLogModal', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/GhostEntryModal', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/ActivityList', () => ({ __esModule: true, default: () => null }))
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

import LogPeriodPage from '@/app/log/[period]/page'

const eveningEntry = {
  id: 'e1', user_id: 'u1', date: '2026-11-03', activity: 'Ran 5k', category: 'exercise',
  duration_minutes: 60, start_time: '18:00', end_time: '19:00', description: null, commentary: null,
  status: 'confirmed', created_at: '2026-11-03T19:00:00Z',
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(fetchEntries as jest.Mock).mockResolvedValue([])
})

it('cannot be wrapped up before it starts', async () => {
  mockHour = 10
  render(<LogPeriodPage />)
  await waitFor(() => expect(fetchEntries).toHaveBeenCalled())

  expect(screen.getByText(/Evening starts at 6:00 PM/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /done with evening/i })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /nothing to log/i })).not.toBeInTheDocument()
})

it('offers only "nothing to log" for a started session with nothing in it', async () => {
  mockHour = 19
  render(<LogPeriodPage />)

  expect(await screen.findByRole('button', { name: /nothing to log for this session/i })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /done with evening/i })).not.toBeInTheDocument()
  expect(screen.queryByText(/Evening starts at/)).not.toBeInTheDocument()
})

it('offers "done" once there is something to be done with', async () => {
  mockHour = 21
  ;(fetchEntries as jest.Mock).mockResolvedValue([eveningEntry])
  render(<LogPeriodPage />)

  expect(await screen.findByRole('button', { name: /done with evening/i })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /nothing to log/i })).not.toBeInTheDocument()
})
