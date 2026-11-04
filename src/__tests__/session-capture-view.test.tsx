/**
 * The session view is for capture, not for precision.
 *
 * It used to render the drag timeline, which needs five conditions to line
 * up before it will create one entry (see lib/gaps.ts). That canvas now
 * lives at /calendar, where dragging, resizing, confirming individual
 * calendar events and planning ahead are the point. What is left here is a
 * list you can tap, the gaps between the entries, and one add button.
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { fetchEntries } from '@/lib/api'

const push = jest.fn()

jest.mock('next/navigation', () => ({
  useParams: () => ({ period: 'morning' }),
  useRouter: () => ({ push, back: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams('date=2026-11-04'),
}))
jest.mock('next-auth/react', () => ({
  useSession: () => ({ status: 'authenticated', data: { user: { id: 'u1' } } }),
}))
jest.mock('@/contexts/CalendarContext', () => ({
  useCalendar: () => ({ getEventsForDate: () => [], refreshCalendar: jest.fn(), isLoading: false }),
}))
jest.mock('@/lib/api', () => ({
  fetchEntries: jest.fn(async () => []),
  createEntries: jest.fn(async (rows: unknown[]) => rows),
  categorizeActivities: jest.fn(async () => []),
  deleteEntry: jest.fn(),
  upsertSessionCompletion: jest.fn(),
  csrfFetch: jest.fn(async () => ({ ok: true, json: async () => ({}) })),
}))
jest.mock('@/lib/types', () => ({
  ...jest.requireActual('@/lib/types'),
  getUserToday: () => '2026-11-04',
  getRealToday: () => '2026-11-04',
  getUserCurrentHour: () => 11,
}))
jest.mock('@/components/PeriodSummaryPopup', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/QuickLogModal', () => ({
  __esModule: true,
  default: ({ isOpen, initialStartTime, initialEndTime }: { isOpen: boolean; initialStartTime?: string; initialEndTime?: string }) =>
    isOpen ? <div data-testid="quick-log">{`${initialStartTime ?? ''}→${initialEndTime ?? ''}`}</div> : null,
}))
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

import LogPeriodPage from '@/app/log/[period]/page'

const entry = (id: string, activity: string, start: string, end: string, minutes: number) => ({
  id,
  user_id: 'u1',
  date: '2026-11-04',
  activity,
  category: 'deep_work',
  start_time: start,
  end_time: end,
  duration_minutes: minutes,
  status: 'confirmed',
})

beforeEach(() => {
  jest.clearAllMocks()
  ;(fetchEntries as jest.Mock).mockResolvedValue([
    entry('1', 'Deep work on the model', '08:30', '10:00', 90),
    entry('2', 'Standup', '10:30', '10:45', 15),
  ])
})

it('lists the session as cards rather than a canvas', async () => {
  render(<LogPeriodPage />)

  expect(await screen.findByText('Deep work on the model')).toBeInTheDocument()
  expect(screen.getByText('Standup')).toBeInTheDocument()
})

it('offers the gap between them, and opens the sheet on those times', async () => {
  render(<LogPeriodPage />)

  const gap = await screen.findByText('10:00 AM – 10:30 AM')
  expect(screen.getByText('30m unaccounted')).toBeInTheDocument()

  fireEvent.click(gap)

  // No dragging involved: the sheet opens already set to the gap.
  await waitFor(() => expect(screen.getByTestId('quick-log')).toHaveTextContent('10:00→10:30'))
})

it('sends precision work to the calendar, for the day being viewed', async () => {
  render(<LogPeriodPage />)

  fireEvent.click(await screen.findByText(/Open the calendar/))
  expect(push).toHaveBeenCalledWith('/calendar?date=2026-11-04')
})

it('asks nothing of a session that is still loading', async () => {
  let release: (value: unknown[]) => void = () => {}
  ;(fetchEntries as jest.Mock).mockReturnValue(new Promise((resolve) => { release = resolve }))

  render(<LogPeriodPage />)

  // Not "Nothing logged yet" — that would be a lie for the moment it shows.
  expect(screen.queryByText(/Nothing logged yet/)).not.toBeInTheDocument()
  release([])
  await waitFor(() => expect(screen.getByText(/Nothing logged yet/)).toBeInTheDocument())
})
