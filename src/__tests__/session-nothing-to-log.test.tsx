/**
 * "Nothing to log" is an answer: the session screen shows it with an Undo,
 * and a failed save no longer sends the person home as if it had worked.
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { fetchEntries, fetchSessionCompletions, deleteSessionCompletion, upsertSessionCompletion } from '@/lib/api'
import { toast as sonnerToast } from 'sonner'

const mockPush = jest.fn()

jest.mock('next/navigation', () => ({
  useParams: () => ({ period: 'evening' }),
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams('date=2026-11-03'),
}))
jest.mock('@/hooks/useAccount', () => ({
  useAccount: () => ({ status: 'authenticated', data: { user: { id: 'u1' } } }),
}))
jest.mock('@/contexts/CalendarContext', () => ({
  useCalendar: () => ({ getEventsForDate: () => [], refreshCalendar: jest.fn(), isLoading: false }),
}))
jest.mock('@/lib/api', () => ({
  fetchEntries: jest.fn(async () => []),
  fetchSessionCompletions: jest.fn(async () => []),
  deleteSessionCompletion: jest.fn(async () => undefined),
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
  getUserCurrentHour: () => 19,
}))
jest.mock('@/components/TimelineView', () => ({ __esModule: true, default: () => <div /> }))
jest.mock('@/components/PeriodSummaryPopup', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/QuickLogModal', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/GhostEntryModal', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/ActivityList', () => ({ __esModule: true, default: () => null }))
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

import LogPeriodPage from '@/app/log/[period]/page'

const skippedRow = {
  id: 'c1', user_id: 'u1', date: '2026-11-03', period: 'evening', entry_count: 0,
  total_minutes: 0, skipped: true, completed_at: '2026-11-03T19:00:00Z', created_at: '2026-11-03T19:00:00Z',
}
const eveningEntry = {
  id: 'e1', user_id: 'u1', date: '2026-11-03', activity: 'Ran 5k', category: 'exercise',
  duration_minutes: 60, start_time: '18:00', end_time: '19:00', description: null, commentary: null,
  status: 'confirmed', created_at: '2026-11-03T19:00:00Z',
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(fetchEntries as jest.Mock).mockResolvedValue([])
  ;(fetchSessionCompletions as jest.Mock).mockResolvedValue([])
})

it('shows the answer with Undo instead of the button', async () => {
  ;(fetchSessionCompletions as jest.Mock).mockResolvedValue([skippedRow])
  render(<LogPeriodPage />)

  expect(await screen.findByRole('button', { name: 'Undo' })).toBeInTheDocument()
  expect(screen.getByText('Nothing to log for this session')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /nothing to log for this session/i })).not.toBeInTheDocument()
})

it('Undo removes the answer and brings the button back', async () => {
  ;(fetchSessionCompletions as jest.Mock).mockResolvedValue([skippedRow])
  render(<LogPeriodPage />)

  fireEvent.click(await screen.findByRole('button', { name: 'Undo' }))

  await waitFor(() =>
    expect(deleteSessionCompletion).toHaveBeenCalledWith({ date: '2026-11-03', period: 'evening' })
  )
  expect(await screen.findByRole('button', { name: /nothing to log for this session/i })).toBeInTheDocument()
})

it('a skipped row with an entry shows Done, no note', async () => {
  ;(fetchSessionCompletions as jest.Mock).mockResolvedValue([skippedRow])
  ;(fetchEntries as jest.Mock).mockResolvedValue([eveningEntry])
  render(<LogPeriodPage />)

  expect(await screen.findByRole('button', { name: /done with evening/i })).toBeInTheDocument()
  expect(screen.queryByText('Nothing to log for this session')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
})

it('a failed save shows the error and stays on the screen', async () => {
  ;(upsertSessionCompletion as jest.Mock).mockRejectedValue(new Error('nope'))
  jest.spyOn(console, 'error').mockImplementation(() => {})
  render(<LogPeriodPage />)

  fireEvent.click(await screen.findByRole('button', { name: /nothing to log for this session/i }))

  await waitFor(() => expect(sonnerToast.error).toHaveBeenCalledWith('Could not save that. Try again.'))
  expect(mockPush).not.toHaveBeenCalled()
})
