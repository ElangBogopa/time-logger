/**
 * "Confirm all" on the session page.
 *
 * Calendar events had to be confirmed one at a time, and each one cost a
 * categorise call, an insert, a re-fetch of the day and a commentary call —
 * so a morning with four meetings in it was ~16 requests and 8 model calls,
 * through four modals. This pins the replacement: one categorise call and
 * one insert for the whole set, whatever its size.
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { createEntries, categorizeActivities, fetchEntries } from '@/lib/api'

// Mutable, so a test can render the page with a different calendar.
let events = [
  { id: 'c1', title: 'Pricing review', startTime: '09:00', endTime: '10:00', date: '2026-11-03', isAllDay: false },
  { id: 'c2', title: 'Reserving walkthrough', startTime: '10:30', endTime: '11:30', date: '2026-11-03', isAllDay: false },
  { id: 'c3', title: 'Standup', startTime: '11:30', endTime: '11:45', date: '2026-11-03', isAllDay: false },
]

jest.mock('next/navigation', () => ({
  useParams: () => ({ period: 'morning' }),
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams('date=2026-11-03'),
}))
jest.mock('next-auth/react', () => ({
  useSession: () => ({ status: 'authenticated', data: { user: { id: 'u1' } } }),
}))
jest.mock('@/contexts/CalendarContext', () => ({
  useCalendar: () => ({
    getEventsForDate: () => events,
    refreshCalendar: jest.fn(),
    isLoading: false,
  }),
}))
jest.mock('@/lib/api', () => ({
  fetchEntries: jest.fn(async () => []),
  createEntries: jest.fn(async (rows: unknown[]) => rows),
  categorizeActivities: jest.fn(async () => ['meetings', 'meetings', 'meetings']),
  deleteEntry: jest.fn(),
  upsertSessionCompletion: jest.fn(),
  csrfFetch: jest.fn(async () => ({ ok: true, json: async () => ({}) })),
}))
jest.mock('@/lib/types', () => ({
  ...jest.requireActual('@/lib/types'),
  getUserToday: () => '2026-11-03',
  getRealToday: () => '2026-11-03',
}))
// The timeline and the modals are not what this is about.
jest.mock('@/components/TimelineView', () => ({ __esModule: true, default: () => <div /> }))
jest.mock('@/components/PeriodSummaryPopup', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/QuickLogModal', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/GhostEntryModal', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/ActivityList', () => ({ __esModule: true, default: () => null }))
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

import LogPeriodPage from '@/app/log/[period]/page'

beforeEach(() => {
  jest.clearAllMocks()
  ;(fetchEntries as jest.Mock).mockResolvedValue([])
  ;(createEntries as jest.Mock).mockImplementation(async (rows: unknown[]) => rows)
  ;(categorizeActivities as jest.Mock).mockResolvedValue(['meetings', 'meetings', 'meetings'])
})

it('offers to confirm the whole set at once', async () => {
  render(<LogPeriodPage />)
  expect(await screen.findByText('3 calendar events in this session')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /confirm all/i })).toBeInTheDocument()
})

it('confirms them with one categorise call and one insert', async () => {
  render(<LogPeriodPage />)
  fireEvent.click(await screen.findByRole('button', { name: /confirm all/i }))

  await waitFor(() => expect(createEntries).toHaveBeenCalledTimes(1))
  expect(categorizeActivities).toHaveBeenCalledTimes(1)
  expect(categorizeActivities).toHaveBeenCalledWith(['Pricing review', 'Reserving walkthrough', 'Standup'])

  const rows = (createEntries as jest.Mock).mock.calls[0][0]
  expect(rows).toEqual([
    { date: '2026-11-03', activity: 'Pricing review', category: 'meetings', duration_minutes: 60, start_time: '09:00', end_time: '10:00' },
    { date: '2026-11-03', activity: 'Reserving walkthrough', category: 'meetings', duration_minutes: 60, start_time: '10:30', end_time: '11:30' },
    { date: '2026-11-03', activity: 'Standup', category: 'meetings', duration_minutes: 15, start_time: '11:30', end_time: '11:45' },
  ])
})

it('still saves the entries when categorising fails', async () => {
  // A categoriser outage must not cost the person their calendar; the
  // entries land uncategorised and the day review can still see them.
  ;(categorizeActivities as jest.Mock).mockRejectedValue(new Error('AI down'))

  render(<LogPeriodPage />)
  fireEvent.click(await screen.findByRole('button', { name: /confirm all/i }))

  await waitFor(() => expect(createEntries).toHaveBeenCalledTimes(1))
  const rows = (createEntries as jest.Mock).mock.calls[0][0]
  expect(rows).toHaveLength(3)
  expect(rows.every((row: { category: unknown }) => row.category === null)).toBe(true)
})

it('does not offer it for a single event', async () => {
  // One event is one tap on the timeline already; a confirm-all row there
  // would just be a second way to do the same thing.
  const all = events
  events = [all[0]]
  try {
    render(<LogPeriodPage />)
    await waitFor(() => expect(fetchEntries).toHaveBeenCalled())
    expect(screen.queryByText(/calendar events in this session/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /confirm all/i })).not.toBeInTheDocument()
  } finally {
    events = all
  }
})

it('scales to a day packed with meetings without extra calls', async () => {
  const all = events
  events = Array.from({ length: 8 }, (_, i) => ({
    id: `m${i}`,
    title: `Meeting ${i}`,
    startTime: `0${(i % 3) + 8}:00`,
    endTime: `0${(i % 3) + 8}:30`,
    date: '2026-11-03',
    isAllDay: false,
  }))
  ;(categorizeActivities as jest.Mock).mockResolvedValue(Array(8).fill('meetings'))
  try {
    render(<LogPeriodPage />)
    fireEvent.click(await screen.findByRole('button', { name: /confirm all/i }))

    await waitFor(() => expect(createEntries).toHaveBeenCalledTimes(1))
    expect(categorizeActivities).toHaveBeenCalledTimes(1)
    expect((createEntries as jest.Mock).mock.calls[0][0]).toHaveLength(8)
  } finally {
    events = all
  }
})
