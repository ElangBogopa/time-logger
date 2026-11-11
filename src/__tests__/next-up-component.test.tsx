/**
 * Next up, on screen. The join between the plan and the record: one tap on
 * "Did it" writes the entry at the planned time and marks the plan kept.
 */

import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { createEntry, categorizeActivities, csrfFetch } from '@/lib/api'

const DATE = '2026-11-03'
let mockHour = 20
let mockEvents: { id: string; title: string; startTime: string; endTime: string; date: string; isAllDay: boolean }[] = []
let mockPlans: Record<string, unknown>[] = []

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
}))
jest.mock('@/contexts/CalendarContext', () => ({
  useCalendar: () => ({ getEventsForDate: () => mockEvents }),
}))
jest.mock('@/lib/api', () => ({
  createEntry: jest.fn(async (row: Record<string, unknown>) => ({ id: 'new-entry', ...row })),
  deleteEntry: jest.fn(async () => {}),
  categorizeActivities: jest.fn(async () => ['exercise']),
  csrfFetch: jest.fn(async () => ({ ok: true, json: async () => ({}) })),
}))
jest.mock('@/lib/types', () => ({
  ...jest.requireActual('@/lib/types'),
  getUserToday: () => '2026-11-03',
  getUserCurrentHour: () => mockHour,
  isTaskCompletable: () => true,
}))
jest.mock('@/components/CommitTimeModal', () => ({
  __esModule: true,
  default: ({ taskTitle }: { taskTitle: string }) => <div data-testid="move-sheet">{taskTitle}</div>,
}))
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

import NextUp from '@/components/NextUp'

const plan = (id: string, title: string, start: string | null, end: string | null, completed = false) => ({
  id, title, date: DATE, completed, committed_start: start, committed_end: end,
})
const entry = (activity: string, start: string, end: string) => ({
  id: activity, user_id: 'u1', date: DATE, activity, category: 'admin', duration_minutes: 60,
  start_time: start, end_time: end, description: null, commentary: null, status: 'confirmed', created_at: '',
})

beforeEach(() => {
  jest.clearAllMocks()
  sessionStorage.clear()
  localStorage.clear()
  mockHour = 20
  mockEvents = []
  mockPlans = [plan('p1', 'Run', '18:00', '19:00'), plan('p2', 'Call home', '21:00', '21:30')]
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ plans: mockPlans }) })) as unknown as typeof fetch
})

const renderList = (props: Partial<React.ComponentProps<typeof NextUp>> = {}) =>
  render(<NextUp date={DATE} entries={[]} {...props} />)

it('lists the plan and the calendar together, in time order', async () => {
  mockHour = 8
  mockEvents = [{ id: 'e1', title: 'Pricing review', startTime: '14:00', endTime: '15:00', date: DATE, isAllDay: false }]
  renderList()

  await screen.findByText('Run')
  const titles = ['Pricing review', 'Run', 'Call home'].map((t) => screen.getByText(t))
  expect(titles[0].compareDocumentPosition(titles[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(titles[1].compareDocumentPosition(titles[2]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.getByRole('separator', { name: /now/i })).toBeInTheDocument()
})

it('asks nothing about what has not happened yet', async () => {
  mockHour = 8
  renderList()
  await screen.findByText('Run')
  expect(screen.queryByRole('button', { name: 'Did it' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument()
})

it('logs the entry at the planned time and marks the plan kept, in one tap', async () => {
  const onChanged = jest.fn()
  renderList({ onChanged })

  fireEvent.click(await screen.findByRole('button', { name: 'Did it' }))

  await waitFor(() => expect(createEntry).toHaveBeenCalledTimes(1))
  expect(categorizeActivities).toHaveBeenCalledWith(['Run'])
  expect(createEntry).toHaveBeenCalledWith({
    date: DATE,
    activity: 'Run',
    category: 'exercise',
    duration_minutes: 60,
    start_time: '18:00',
    end_time: '19:00',
    commentary: 'Logged',
  })

  await waitFor(() => expect(csrfFetch).toHaveBeenCalled())
  const [url, init] = (csrfFetch as jest.Mock).mock.calls[0]
  expect(url).toBe('/api/plans')
  expect(init.method).toBe('PATCH')
  // Tagged with the session it belongs to, as the post-session popup did.
  expect(JSON.parse(init.body)).toEqual({ id: 'p1', completed: true, completed_session: 'evening' })
  await waitFor(() => expect(onChanged).toHaveBeenCalled())
})

it('still logs the entry when the categoriser is down', async () => {
  ;(categorizeActivities as jest.Mock).mockRejectedValueOnce(new Error('AI down'))
  renderList()
  fireEvent.click(await screen.findByRole('button', { name: 'Did it' }))
  await waitFor(() => expect(createEntry).toHaveBeenCalledTimes(1))
  expect((createEntry as jest.Mock).mock.calls[0][0].category).toBeNull()
})

it('offers "That was it" when something else was logged in the hour, and writes no second entry', async () => {
  renderList({ entries: [entry('Emails', '18:00', '19:00')] as never })

  expect(await screen.findByText('You logged Emails then')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Did it' })).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'That was it' }))
  await waitFor(() => expect(csrfFetch).toHaveBeenCalledTimes(1))
  expect(createEntry).not.toHaveBeenCalled()
  expect(JSON.parse((csrfFetch as jest.Mock).mock.calls[0][1].body)).toMatchObject({ id: 'p1', completed: true })
})

it('shows a plan the log already holds as done, with nothing to press', async () => {
  renderList({ entries: [entry('Ran 5k', '18:00', '19:00')] as never })
  expect(await screen.findByLabelText('Done')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Did it' })).not.toBeInTheDocument()
})

it('sets a skipped plan aside and remembers it', async () => {
  const { unmount } = renderList()
  fireEvent.click(await screen.findByRole('button', { name: 'Skip' }))

  expect(screen.getByText('Skipped')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Did it' })).not.toBeInTheDocument()
  // Nothing was written to the plan: the review still reports it as not done.
  expect(csrfFetch).not.toHaveBeenCalled()

  unmount()
  renderList()
  expect(await screen.findByText('Skipped')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
  expect(await screen.findByRole('button', { name: 'Did it' })).toBeInTheDocument()
})

it('opens the time sheet from Move', async () => {
  renderList()
  fireEvent.click(await screen.findByRole('button', { name: 'Move' }))
  expect(screen.getByTestId('move-sheet')).toHaveTextContent('Run')
})

it('confirms a calendar event that has finished', async () => {
  mockPlans = []
  mockEvents = [{ id: 'e1', title: 'Pricing review', startTime: '14:00', endTime: '15:00', date: DATE, isAllDay: false }]
  ;(categorizeActivities as jest.Mock).mockResolvedValueOnce(['meetings'])
  renderList()

  fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }))
  await waitFor(() => expect(createEntry).toHaveBeenCalledTimes(1))
  expect((createEntry as jest.Mock).mock.calls[0][0]).toMatchObject({
    activity: 'Pricing review', category: 'meetings', start_time: '14:00', end_time: '15:00',
  })
  // A calendar event is not a plan: there is nothing to tick.
  expect(csrfFetch).not.toHaveBeenCalled()
})

it('points at the planner when the day has nothing in it', async () => {
  mockPlans = []
  renderList()
  expect(await screen.findByText('Nothing planned for today')).toBeInTheDocument()
})

it('mentions tasks that have no time yet', async () => {
  mockPlans = [plan('p3', 'Buy stamps', null, null)]
  renderList()
  expect(await screen.findByText(/1 task without a time: Buy stamps/)).toBeInTheDocument()
})

describe('inside a session', () => {
  it('shows only that session’s planned items, and no calendar', async () => {
    mockPlans = [plan('p0', 'Write', '09:00', '10:00'), plan('p1', 'Run', '18:00', '19:00')]
    mockEvents = [{ id: 'e1', title: 'Pricing review', startTime: '18:30', endTime: '19:00', date: DATE, isAllDay: false }]
    renderList({ period: 'evening' })

    const section = (await screen.findByText('Planned')).closest('section') as HTMLElement
    expect(within(section).getByText('Run')).toBeInTheDocument()
    expect(within(section).queryByText('Write')).not.toBeInTheDocument()
    expect(screen.queryByText('Pricing review')).not.toBeInTheDocument()
  })

  it('renders nothing when the session has no plans', async () => {
    mockPlans = [plan('p0', 'Write', '09:00', '10:00')]
    const { container } = renderList({ period: 'evening' })
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })
})
