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
let mockPeriod = 'morning'
let mockHour = 11
let mockDate = '2026-11-04'

jest.mock('next/navigation', () => ({
  useParams: () => ({ period: mockPeriod }),
  useRouter: () => ({ push, back: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(`date=${mockDate}`),
}))
jest.mock('@/hooks/useAccount', () => ({
  useAccount: () => ({ status: 'authenticated', data: { user: { id: 'u1' } } }),
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
  fetchSessionCompletions: jest.fn(async () => []),
  deleteSessionCompletion: jest.fn(),
  csrfFetch: jest.fn(async () => ({ ok: true, json: async () => ({}) })),
}))
jest.mock('@/lib/types', () => ({
  ...jest.requireActual('@/lib/types'),
  getUserToday: () => '2026-11-04',
  getRealToday: () => '2026-11-04',
  getUserCurrentHour: () => mockHour,
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
  mockPeriod = 'morning'
  mockHour = 11
  mockDate = '2026-11-04'
  // The hour is pinned to 11 above; the screen reads the minute from the
  // real clock. From a quarter past the hour the stretch since the 10:45
  // entry is itself "30m unaccounted", a second match, and this suite
  // failed for part of every hour. Pin the minute too.
  jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0)
  ;(fetchEntries as jest.Mock).mockResolvedValue([
    entry('1', 'Deep work on the model', '08:30', '10:00', 90),
    entry('2', 'Standup', '10:30', '10:45', 15),
  ])
})

afterEach(() => jest.restoreAllMocks())

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

describe('Afternoon and Evening offer time from the session start', () => {
  it('offers the hours before the first entry, and opens the sheet on them', async () => {
    mockPeriod = 'afternoon'
    mockHour = 15
    ;(fetchEntries as jest.Mock).mockResolvedValue([entry('1', 'Report', '14:00', '15:00', 60)])
    render(<LogPeriodPage />)

    const row = await screen.findByText('12:00 PM – 2:00 PM')
    expect(screen.getByText('2h unaccounted')).toBeInTheDocument()
    fireEvent.click(row)
    await waitFor(() => expect(screen.getByTestId('quick-log')).toHaveTextContent('12:00→14:00'))
  })

  it('offers an empty Afternoon from 12:00 to now', async () => {
    mockPeriod = 'afternoon'
    mockHour = 15
    ;(fetchEntries as jest.Mock).mockResolvedValue([])
    render(<LogPeriodPage />)

    const row = await screen.findByText('12:00 PM – 3:00 PM')
    expect(screen.getByText('3h unaccounted')).toBeInTheDocument()
    fireEvent.click(row)
    await waitFor(() => expect(screen.getByTestId('quick-log')).toHaveTextContent('12:00→15:00'))
  })

  it('does not offer time a morning entry still covers', async () => {
    mockPeriod = 'afternoon'
    mockHour = 15
    ;(fetchEntries as jest.Mock).mockResolvedValue([entry('1', 'Brunch', '11:30', '12:45', 75)])
    render(<LogPeriodPage />)

    expect(await screen.findByText('12:45 PM – 3:00 PM')).toBeInTheDocument()
    expect(screen.queryByText(/^12:00 PM –/)).not.toBeInTheDocument()
  })

  it('offers the Evening from 6 PM', async () => {
    mockPeriod = 'evening'
    mockHour = 21
    ;(fetchEntries as jest.Mock).mockResolvedValue([entry('1', 'Dinner', '19:00', '20:00', 60)])
    render(<LogPeriodPage />)

    const first = await screen.findByText('6:00 PM – 7:00 PM')
    expect(screen.getByText('8:00 PM – 9:00 PM')).toBeInTheDocument()
    fireEvent.click(first)
    await waitFor(() => expect(screen.getByTestId('quick-log')).toHaveTextContent('18:00→19:00'))
  })

  it('still offers nothing for an empty Morning', async () => {
    ;(fetchEntries as jest.Mock).mockResolvedValue([])
    render(<LogPeriodPage />)

    await waitFor(() => expect(screen.getByText(/Nothing logged yet/)).toBeInTheDocument())
    expect(screen.queryByRole('heading', { name: 'Unaccounted' })).not.toBeInTheDocument()
  })

  it('offers nothing until the entries have arrived', async () => {
    mockPeriod = 'afternoon'
    mockHour = 15
    // yesterday: the shared entries cache holds nothing for it yet, so the screen is loading
    mockDate = '2026-11-03'
    let release: (value: unknown[]) => void = () => {}
    ;(fetchEntries as jest.Mock).mockReturnValue(new Promise((resolve) => { release = resolve }))
    render(<LogPeriodPage />)

    expect(screen.queryByRole('heading', { name: 'Unaccounted' })).not.toBeInTheDocument()
    release([])
    expect(await screen.findByText('12:00 PM – 6:00 PM')).toBeInTheDocument()
  })
})

describe('a row running up to now opens an entry ending at the last half hour', () => {
  beforeEach(() => {
    mockPeriod = 'afternoon'
    mockHour = 15
    ;(Date.prototype.getMinutes as jest.Mock).mockReturnValue(13)
    ;(fetchEntries as jest.Mock).mockResolvedValue([entry('1', 'Report', '14:00', '14:30', 30)])
  })

  it('rounds the stretch since the last entry down to 3:00 PM, wording unchanged', async () => {
    render(<LogPeriodPage />)

    const row = await screen.findByText('2:30 PM – 3:13 PM')
    fireEvent.click(row)
    await waitFor(() => expect(screen.getByTestId('quick-log')).toHaveTextContent('14:30→15:00'))
  })

  it('does not round a gap closed by an entry', async () => {
    render(<LogPeriodPage />)

    fireEvent.click(await screen.findByText('12:00 PM – 2:00 PM'))
    await waitFor(() => expect(screen.getByTestId('quick-log')).toHaveTextContent('12:00→14:00'))
  })
})
