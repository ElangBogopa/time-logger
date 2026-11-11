/**
 * A planner that knows you.
 *
 * It proposed the gym at 6am to someone whose log showed a run at 6pm every
 * time, made every block an hour, and waited for "gym" to be typed again
 * each evening. It now reads the last four weeks of the log: your usual
 * hour and length for a thing, and what you do often enough to offer.
 */

import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { csrfFetch, fetchEntries, categorizeActivities } from '@/lib/api'

const mockDates = (() => {
  const types = jest.requireActual('@/lib/types')
  const today: string = types.getLocalDateString()
  return { today, tomorrow: types.shiftDateString(today, 1) as string, shift: types.shiftDateString as (d: string, n: number) => string }
})()
const TOMORROW = mockDates.tomorrow

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
  fetchEntries: jest.fn(),
  categorizeActivities: jest.fn(),
  csrfFetch: jest.fn(async () => ({ ok: true, json: async () => ({ plan: { id: 'new-plan' } }) })),
}))
jest.mock('@/lib/types', () => ({
  ...jest.requireActual('@/lib/types'),
  isDateLoggable: () => false,
}))
jest.mock('@/components/TimelineView', () => ({ __esModule: true, default: () => <div data-testid="grid" /> }))
jest.mock('@/components/QuickLogModal', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/GhostEntryModal', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/SourceSheet', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/CommitTimeModal', () => ({
  __esModule: true,
  default: ({ taskTitle, defaultStart, defaultEnd }: { taskTitle: string; defaultStart?: string; defaultEnd?: string }) => (
    <div data-testid="commit-modal">
      {taskTitle} {defaultStart}-{defaultEnd}
    </div>
  ),
}))

import CalendarPage from '@/app/calendar/page'

/** Four weeks in which this person ran at 6pm, three times a week, and slept until seven. */
const history = (() => {
  const rows: Record<string, unknown>[] = []
  for (let back = 1; back <= 21; back++) {
    const date = mockDates.shift(mockDates.today, -back)
    rows.push({ id: `s${back}`, date, activity: 'Slept', category: 'sleep', start_time: '00:00', end_time: '07:00', duration_minutes: 420 })
    if (back % 2 === 1) {
      rows.push({ id: `r${back}`, date, activity: 'Ran 5k', category: 'exercise', start_time: '18:00', end_time: '18:45', duration_minutes: 45 })
    }
  }
  return rows
})()

let plans: Record<string, unknown>[] = []

beforeEach(() => {
  jest.clearAllMocks()
  sessionStorage.clear()
  plans = [{ id: 'p1', title: 'Run', date: TOMORROW, committed_start: null, committed_end: null, completed: false }]
  ;(fetchEntries as jest.Mock).mockImplementation(async (params: { dateFrom?: string }) => (params?.dateFrom ? history : []))
  ;(categorizeActivities as jest.Mock).mockResolvedValue(['exercise'])
  global.fetch = jest.fn(async (url: string) =>
    String(url).includes('/api/plans')
      ? { ok: true, json: async () => ({ plans }) }
      : { ok: true, json: async () => ({ data: [] }) }
  ) as unknown as typeof fetch
})

const suggest = async () => {
  render(<CalendarPage />)
  fireEvent.click(await screen.findByRole('button', { name: /suggest times around my calendar/i }))
  return screen.findByText(/When you usually do this/)
}

it('proposes your usual hour and length, and says that is why', async () => {
  const reason = await suggest()
  const card = reason.closest('div.rounded-lg') as HTMLElement

  // 6:00pm for 45 minutes: this person's run, not the textbook's 6am hour.
  expect(within(card).getByText(/6:00 PM\s+–\s+6:45 PM/)).toBeInTheDocument()
  expect(reason).toHaveTextContent('When you usually do this — body temperature peaks')
})

it('never proposes anything before you are usually up', async () => {
  // Take the evening away, so the habit is out of reach and the research
  // window for exercise is the early morning. Six would be in bed.
  plans = [
    plans[0],
    { id: 'p2', title: 'Dinner out', date: TOMORROW, committed_start: '15:00', committed_end: '22:00', completed: false },
  ]
  render(<CalendarPage />)
  fireEvent.click(await screen.findByRole('button', { name: /suggest times around my calendar/i }))

  expect(await screen.findByText(/7:30 AM\s+–\s+8:15 AM/)).toBeInTheDocument()
})

it('steps to a different time when asked for another', async () => {
  await suggest()
  fireEvent.click(screen.getByRole('button', { name: 'Another time' }))

  await waitFor(() => expect(screen.queryByText(/6:00 PM\s+–\s+6:45 PM/)).not.toBeInTheDocument())
  // Still forty-five minutes, somewhere else.
  expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument()
})

it('changes the length in place', async () => {
  await suggest()
  const lengths = screen.getByRole('group', { name: 'Length of Run' })
  fireEvent.click(within(lengths).getByRole('button', { name: '30m' }))

  expect(await screen.findByText(/6:00 PM\s+–\s+6:30 PM/)).toBeInTheDocument()
  expect(within(lengths).getByRole('button', { name: '30m' })).toHaveAttribute('aria-pressed', 'true')
})

it('scores the plan before it is lived', async () => {
  await suggest()
  expect(screen.getByText('If the day goes to plan')).toBeInTheDocument()
  // Forty-five minutes of running and nothing else: Body moves, Heart does not.
  expect(screen.getByLabelText(/Body \d+, Mind 0, Heart 0/)).toBeInTheDocument()
})

it('offers what you do often as a one-tap task, and not what is already planned', async () => {
  plans = []
  render(<CalendarPage />)

  fireEvent.click(await screen.findByRole('button', { name: 'Add Ran 5k' }))
  await waitFor(() => expect(csrfFetch).toHaveBeenCalled())
  const [url, init] = (csrfFetch as jest.Mock).mock.calls[0]
  expect(url).toBe('/api/plans')
  expect(JSON.parse(init.body)).toEqual({ date: TOMORROW, title: 'Ran 5k' })
  // Sleep is daily and none of the planner's business.
  expect(screen.queryByRole('button', { name: 'Add Slept' })).not.toBeInTheDocument()
})

it('does not offer a habit that is already on the plan under another name', async () => {
  render(<CalendarPage />)
  await screen.findByRole('button', { name: /suggest times around my calendar/i })
  expect(screen.queryByRole('button', { name: 'Add Ran 5k' })).not.toBeInTheDocument()
})

it('opens the time sheet on your usual hour rather than 9am', async () => {
  render(<CalendarPage />)
  const tray = (await screen.findByText('What matters tomorrow')).closest('section') as HTMLElement
  fireEvent.click(within(tray).getByText('Run'))

  // No category is known yet, so the hour comes from the name alone.
  await waitFor(() => expect(screen.getByTestId('commit-modal')).toHaveTextContent('Run 18:00-18:45'))
})
