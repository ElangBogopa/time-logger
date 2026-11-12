/**
 * Onboarding. It used to be a name, a "choice" of one plan and an 80%
 * slider nothing read, and it never mentioned the calendar, the scores or
 * the planner. It now says what the app is for from the person's own
 * calendar and ends by making a first plan.
 */

import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { csrfFetch } from '@/lib/api'
import { readFirstRun } from '@/lib/first-run'

let mockHour = 19
let mockEvents: { id: string; title: string; startTime: string; endTime: string; date: string; isAllDay: boolean }[] = []

jest.mock('next-auth/react', () => ({
  useSession: () => ({ status: 'authenticated', data: { user: { id: 'u1', name: 'Alex Morgan' } } }),
}))
jest.mock('@/contexts/CalendarContext', () => ({
  useCalendar: () => ({ getEventsForDate: () => mockEvents }),
}))
jest.mock('@/lib/api', () => ({
  csrfFetch: jest.fn(),
}))
jest.mock('@/lib/goals', () => ({ invalidateGoals: jest.fn() }))
jest.mock('@/lib/types', () => ({
  ...jest.requireActual('@/lib/types'),
  getUserToday: () => '2026-11-03',
  getUserCurrentHour: () => mockHour,
}))

import OnboardingModal from '@/components/OnboardingModal'

const calls = () =>
  (csrfFetch as jest.Mock).mock.calls.map(([url, init]) => ({
    url,
    method: init?.method ?? 'GET',
    body: init?.body ? JSON.parse(init.body) : undefined,
  }))

beforeEach(() => {
  jest.clearAllMocks()
  localStorage.clear()
  mockHour = 19
  mockEvents = []
  ;(csrfFetch as jest.Mock).mockImplementation(async (url: string, init?: { method?: string }) => ({
    ok: true,
    json: async () => (url === '/api/goals' && !init?.method ? { goals: [] } : {}),
  }))
})

/** Press Next until the screen with this heading is showing. */
const throughTo = async (stepHeading: RegExp) => {
  const onComplete = jest.fn()
  render(<OnboardingModal isOpen onComplete={onComplete} />)
  // name → purpose → scores → first plan
  for (let step = 1; step <= 3; step++) {
    if (screen.queryByRole('heading', { name: stepHeading })) break
    // The first Next saves the name before moving on, so wait for the step
    // itself to change rather than for the button to be there.
    await waitFor(() => expect(screen.getByRole('button', { name: /^Next/ })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: /^Next/ }))
    await screen.findByLabelText(`Step ${step + 1} of 4`)
  }
  await screen.findByRole('heading', { name: stepHeading })
  return onComplete
}

it('starts with the first name from the account, and saves it', async () => {
  render(<OnboardingModal isOpen onComplete={jest.fn()} />)
  await waitFor(() => expect(screen.getByLabelText('Your first name')).toHaveValue('Alex'))

  fireEvent.click(screen.getByRole('button', { name: /^Next/ }))
  await waitFor(() => expect(calls()[0]).toEqual({ url: '/api/user', method: 'PUT', body: { preferredName: 'Alex' } }))
})

it('says what the app is for, using the calendar the person already has', async () => {
  mockEvents = [
    { id: 'e2', title: 'Pricing review', startTime: '14:00', endTime: '15:00', date: '2026-11-04', isAllDay: false },
    { id: 'e1', title: 'Team standup', startTime: '09:30', endTime: '09:45', date: '2026-11-04', isAllDay: false },
    { id: 'e0', title: 'Public holiday', startTime: '', endTime: '', date: '2026-11-04', isAllDay: true },
  ]
  await throughTo(/your calendar holds what other people need from you/i)

  // Evening: the day worth planning is tomorrow.
  expect(screen.getByText('On your calendar tomorrow')).toBeInTheDocument()
  const titles = screen.getAllByRole('listitem').map((li) => li.textContent)
  expect(titles[0]).toContain('Team standup')
  expect(titles[1]).toContain('Pricing review')
  expect(screen.queryByText('Public holiday')).not.toBeInTheDocument()
  expect(screen.getByText('Better reads your Google Calendar and never writes to it.')).toBeInTheDocument()
})

it('has something to say when the calendar is empty', async () => {
  await throughTo(/your calendar holds/i)
  expect(screen.getByText(/A clear day to give to what matters/)).toBeInTheDocument()
})

it('explains the three scores', async () => {
  await throughTo(/a day is three numbers/i)
  for (const name of ['Body', 'Mind', 'Heart']) expect(screen.getByText(name)).toBeInTheDocument()
  expect(screen.getByText(/Reaching the target scores 80, and 100 is out of reach on purpose/)).toBeInTheDocument()
})

it('ends by planning: the picks become tasks and the planner is next', async () => {
  const onComplete = await throughTo(/what matters tomorrow/i)

  fireEvent.click(screen.getByRole('button', { name: 'Exercise' }))
  fireEvent.click(screen.getByRole('button', { name: 'Call someone' }))
  fireEvent.click(screen.getByRole('button', { name: /find them a time/i }))

  await waitFor(() => expect(onComplete).toHaveBeenCalledWith({ planDate: '2026-11-04' }))
  const plans = calls().filter((c) => c.url === '/api/plans')
  expect(plans.map((c) => c.body)).toEqual([
    { date: '2026-11-04', title: 'Exercise' },
    { date: '2026-11-04', title: 'Call someone' },
  ])
  // The account is marked as set up, and the first-run list starts — with
  // nothing ticked: choosing what matters is not yet giving it a time.
  expect(calls().some((c) => c.url === '/api/preferences' && c.method === 'PUT')).toBe(true)
  expect(readFirstRun()).toMatchObject({ started: true, planned: false })
})

it('plans the rest of today when there is still a day left', async () => {
  mockHour = 9
  const onComplete = await throughTo(/what matters today/i)
  fireEvent.click(screen.getByRole('button', { name: 'Deep work' }))
  fireEvent.click(screen.getByRole('button', { name: /find them a time/i }))
  await waitFor(() => expect(onComplete).toHaveBeenCalledWith({ planDate: '2026-11-03' }))
})

it('stops at three, and takes something of your own', async () => {
  await throughTo(/what matters tomorrow/i)
  const group = screen.getByRole('group', { name: /what matters tomorrow/i })

  fireEvent.change(screen.getByLabelText('Something of your own'), { target: { value: 'Piano practice' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add it' }))
  expect(within(group).getByRole('button', { name: 'Piano practice' })).toHaveAttribute('aria-pressed', 'true')

  fireEvent.click(within(group).getByRole('button', { name: 'Exercise' }))
  fireEvent.click(within(group).getByRole('button', { name: 'Read' }))
  // Three chosen: the rest wait.
  expect(within(group).getByRole('button', { name: 'Deep work' })).toBeDisabled()
})

it('cannot go on with nothing picked, but can leave planning for later', async () => {
  const onComplete = await throughTo(/what matters tomorrow/i)
  expect(screen.getByRole('button', { name: /find them a time/i })).toBeDisabled()

  fireEvent.click(screen.getByRole('button', { name: /plan later/i }))
  await waitFor(() => expect(onComplete).toHaveBeenCalledWith(undefined))
  expect(calls().some((c) => c.url === '/api/plans')).toBe(false)
  // Still marked as set up: skipping used to leave nothing behind, so the sheet came back every visit.
  expect(calls().some((c) => c.url === '/api/preferences' && c.method === 'PUT')).toBe(true)
  expect(readFirstRun()).toMatchObject({ started: true, planned: false })
})

it('does not create a second default goal for an account that has one', async () => {
  ;(csrfFetch as jest.Mock).mockImplementation(async (url: string, init?: { method?: string }) => ({
    ok: true,
    json: async () =>
      url === '/api/goals' && !init?.method ? { goals: [{ title: 'Increase Productivity', active: true }] } : {},
  }))
  const onComplete = await throughTo(/what matters tomorrow/i)
  fireEvent.click(screen.getByRole('button', { name: /plan later/i }))
  await waitFor(() => expect(onComplete).toHaveBeenCalled())
  expect(calls().some((c) => c.url === '/api/goals' && c.method === 'POST')).toBe(false)
})
