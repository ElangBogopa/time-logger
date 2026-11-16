import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { csrfFetch } from '@/lib/api'
import { toast } from 'sonner'

jest.mock('sonner', () => ({ toast: { error: jest.fn() } }))

// Relative to the real clock, so the suite does not go stale as days pass.
const mockDates = (() => {
  const types = jest.requireActual('@/lib/types')
  const today: string = types.getLocalDateString()
  return { today, tomorrow: types.shiftDateString(today, 1) as string }
})()
const TOMORROW = mockDates.tomorrow

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(`date=${TOMORROW}`),
}))
jest.mock('@/hooks/useAccount', () => ({
  useAccount: () => ({ status: 'authenticated', data: { user: { id: 'u1' } } }),
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
  isDateLoggable: () => false,
}))
jest.mock('@/components/TimelineView', () => ({ __esModule: true, default: () => <div data-testid="grid" /> }))
jest.mock('@/components/QuickLogModal', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/GhostEntryModal', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/CommitTimeModal', () => ({
  __esModule: true,
  default: ({ taskTitle }: { taskTitle: string }) => <div data-testid="commit-modal">{taskTitle}</div>,
}))

jest.mock('@/components/GoogleTasksPicker', () => ({
  __esModule: true,
  default: ({ isOpen, onImport }: { isOpen: boolean; onImport: (titles: string[]) => void }) =>
    isOpen ? (
      <div>
        <button onClick={() => onImport(['Renew passport', 'Book dentist'])}>pick two</button>
        <button onClick={() => onImport([])}>pick none</button>
      </div>
    ) : null,
}))

import CalendarPage from '@/app/calendar/page'

const planPosts = () =>
  (csrfFetch as jest.Mock).mock.calls.filter(
    ([url, init]) => String(url).startsWith('/api/plans') && init?.method === 'POST'
  )

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = jest.fn(async (url: string) =>
    String(url).includes('/api/plans')
      ? { ok: true, json: async () => ({ plans: [] }) }
      : { ok: true, json: async () => ({ data: [] }) }
  ) as unknown as typeof fetch
})

it('offers Import from Google Tasks in the tray', async () => {
  render(<CalendarPage />)
  expect(await screen.findByRole('button', { name: /Import from Google Tasks/ })).toBeInTheDocument()
})

it('adds each picked task to the day, one request each, in order, without a goal', async () => {
  render(<CalendarPage />)
  fireEvent.click(await screen.findByRole('button', { name: /Import from Google Tasks/ }))
  fireEvent.click(await screen.findByText('pick two'))
  await waitFor(() => expect(planPosts()).toHaveLength(2))
  const bodies = planPosts().map(([, init]) => JSON.parse(init.body))
  expect(bodies).toEqual([
    { date: TOMORROW, title: 'Renew passport' },
    { date: TOMORROW, title: 'Book dentist' },
  ])
  bodies.forEach((b) => expect(b).not.toHaveProperty('goal_id'))
})

it('makes no request when nothing was picked', async () => {
  render(<CalendarPage />)
  fireEvent.click(await screen.findByRole('button', { name: /Import from Google Tasks/ }))
  fireEvent.click(await screen.findByText('pick none'))
  expect(planPosts()).toHaveLength(0)
})

it('says so when the import fails, instead of closing silently', async () => {
  ;(csrfFetch as jest.Mock).mockImplementation(async () => ({ ok: false, json: async () => ({}) }))
  render(<CalendarPage />)
  fireEvent.click(await screen.findByRole('button', { name: /Import from Google Tasks/ }))
  fireEvent.click(await screen.findByText('pick two'))
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/Couldn't import those tasks/)))
})
